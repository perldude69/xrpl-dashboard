(function() {
  window.XRPL = window.XRPL || {};

  // Helper to allow test time manipulation
  let _timeNow = function() { return Date.now(); };

  // Centralized price update function
  window.XRPL.updatePriceDisplay = function(price, includeTimestamp = true) {
    // Robust type handling: accept numbers or numeric strings
    let numeric = Number(price);
    if (!Number.isFinite(numeric) || numeric <= 0) return;

    // Debounce duplicate emissions across multiple UI sources
    if (window.XRPL.lastPrice !== undefined && numeric === window.XRPL.lastPrice) {
      const lastTime = window.XRPL.lastPriceTime || 0;
      if (_timeNow() - lastTime < 1000) {
        return;
      }
    }

    window.XRPL.lastPrice = numeric;
    window.XRPL.lastPriceTime = _timeNow();

    const formatted = includeTimestamp ?
      numeric.toFixed(4) + ' (' + new Date().toLocaleTimeString() + ')' :
      numeric.toFixed(4);

    window.XRPL.latestFormattedPrice = formatted;
    window.XRPL.latestPrice = numeric;

    const currentPriceEl = document.getElementById('currentPrice');
    const smallCurrentPriceEl = document.getElementById('smallCurrentPrice');

    if (currentPriceEl) {
      currentPriceEl.textContent = formatted;
    }
    if (smallCurrentPriceEl) {
      smallCurrentPriceEl.textContent = formatted;
    }
  };

  // Divergence tracking (5-minute window) and test hooks
  const DIVERGENCE_WINDOW_MS = 5 * 60 * 1000;
  let _priceHistory = [];
  window.XRPL._divergenceSubscribers = window.XRPL._divergenceSubscribers || [];
  window.XRPL._divergenceLog = window.XRPL._divergenceLog || [];

  function _pruneHistory(now) {
    while (_priceHistory.length && _priceHistory[0].t < now - DIVERGENCE_WINDOW_MS) {
      _priceHistory.shift();
    }
  }

  function _emitDivergenceEvent(event) {
    // Persist for test hooks
    window.XRPL._divergenceLog.push(event);
    // Notify listeners
    window.XRPL._divergenceSubscribers.forEach(cb => {
      try { cb(event); } catch (e) { console.error('Divergence listener error', e); }
    });
    // Emit divergence to server for external collection, if socket exists
    try {
      if (window.XRPL && window.XRPL.socket && window.XRPL.socket.connected) {
        window.XRPL.socket.emit('divergenceDetected', {
          timestamp: event.timestamp || Date.now(),
          socketPrice: event.socketPrice,
          mean: event.mean,
          std: event.std,
          diff: event.diff,
          windowSize: event.windowSize,
          graphPrice: (window.XRPL.lastGraphPrice || null)
        });
      }
    } catch (e) {
      // Ignore if socket not available
    }
  }

  function _handlePriceUpdate(price) {
    const numeric = Number(price);
    if (!Number.isFinite(numeric) || numeric <= 0) return;

    // Update centralized display path
    window.XRPL.updatePriceDisplay(numeric);

    const now = _timeNow();
    _priceHistory.push({ price: numeric, t: now });
    _pruneHistory(now);

    if (_priceHistory.length >= 2) {
      const values = _priceHistory.map(p => p.price);
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const variance = values.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / values.length;
      const std = Math.sqrt(variance);
      const diff = Math.abs(numeric - mean);
      const threshold = std > 0 ? 3 * std : 0.001;
      if (diff > threshold) {
        const event = {
          timestamp: now,
          socketPrice: numeric,
          mean: mean,
          std: std,
          diff: diff,
          windowSize: values.length
        };
        _emitDivergenceEvent(event);
      }
    }
  }

  // Expose test hooks
  window.XRPL.simulatePriceUpdate = function(price) {
    _handlePriceUpdate(price);
  };

  window.XRPL.onDivergence = function(cb) {
    window.XRPL._divergenceSubscribers.push(cb);
  };

  // Allow tests to inject a custom time source
  window.XRPL.setTimeNow = function(fn) {
    if (typeof fn === 'function') {
      _timeNow = fn;
    }
  };

  // Wait for DOM to be ready
  function ensureListener() {
    // noop, kept for potential future expansion
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureListener);
  } else {
    ensureListener();
  }

  // Set up price update listener after socket is connected
  function setupPriceListener() {
    if (!window.XRPL.socket || !window.XRPL.socket.connected) {
      console.log('Socket not ready, retrying price listener setup...');
      setTimeout(setupPriceListener, 1000);
      return;
    }

    console.log('Setting up priceUpdate handler');
    // Use internal handler for divergence-aware updates
    window.XRPL.socket.off('priceUpdate').on('priceUpdate', (price) => {
      console.log('Price update received:', price);
      _handlePriceUpdate(price);
    });
  }

  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupPriceListener);
  } else {
    setupPriceListener();
  }

  // Store chart instance
  let priceChart = null;

  // Track graph load state to auto-initialize on panel open
  window.XRPL.graphLoaded = false;

  // Graph refresh
  document.getElementById('refreshGraph').addEventListener('click', () => {
    loadGraph();
  });

  window.XRPL.loadGraph = loadGraph;

  function loadGraph() {
    const period = document.getElementById('periodSelect').value;
    const interval = document.getElementById('intervalSelect').value;
    fetch(`/graph?period=${period}&interval=${interval}`)
      .then(res => {
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res.json();
      })
      .then(data => {
        const ctx = document.getElementById('priceChart').getContext('2d');
        if (priceChart) {
          priceChart.destroy();
        }
        priceChart = new Chart(ctx, {
          type: 'line',
          data: {
            labels: data.labels,
            datasets: [{
              label: 'XRP Price (USD)',
              data: data.prices,
              borderColor: '#00ff00',
              backgroundColor: 'rgba(0,255,0,0.1)',
              fill: true
            }]
          },
          options: {
            responsive: true,
            scales: {
              x: { display: true },
              y: { display: true }
            }
          }
        });
        // Mark graph as loaded to avoid re-fetching on repeated opens
        window.XRPL.graphLoaded = true;
        // Do not update the price display from graph data to avoid overwriting real-time prices.
        // We rely on real-time priceUpdate events to update the UI.
        // If needed, we can store latest graph price for diagnostics in window.XRPL.lastGraphPrice.
        if (typeof data.latestPrice === 'number') {
          window.XRPL.lastGraphPrice = data.latestPrice;
        }
      })
      .catch(error => {
        console.error('Failed to load graph:', error);
        // Show error in UI
        const currentPriceEl = document.getElementById('currentPrice');
        const smallCurrentPriceEl = document.getElementById('smallCurrentPrice');
        if (currentPriceEl) currentPriceEl.textContent = 'Error loading graph';
        if (smallCurrentPriceEl) smallCurrentPriceEl.textContent = 'Error loading graph';
      });
  }

   // Graph is loaded when panel is opened
})();