function togglePanel(id) {
  const full = document.getElementById(id + 'Full');
  if (!full) {
    console.error('Full element not found for', id);
    return;
  }
  if (full.style.display === 'none' || full.style.display === '') {
    full.style.display = 'block';
  } else {
    full.style.display = 'none';
  }
}

console.log('Client script loaded');
(function(){
  const socket = io();
  console.log('Socket created, connected:', socket.connected);
  socket.on('connect', () => console.log('Socket connected event'));
  socket.on('disconnect', () => console.log('Socket disconnected event'));

  const tableBody = document.querySelector('#transactions tbody');
  const rlusdBody = document.querySelector('#rlusd tbody');

  // Panel template
  const panelTemplate = {
    id: '',
    name: 'Currency Monitor',
    currency: 'XRP',
    issuer: null,
    limit: 0
  };

// localStorage for panels
function savePanels(panels) {
  localStorage.setItem('xrplPanels', JSON.stringify(panels));
}

function loadPanels() {
  const data = localStorage.getItem('xrplPanels');
  return data ? JSON.parse(data) : [];
}

function savePanel(panel) {
  const panels = loadPanels();
  const index = panels.findIndex(p => p.id === panel.id);
  if (index >= 0) {
    panels[index] = panel;
  } else {
    panels.push(panel);
  }
  savePanels(panels);
}

function deletePanel(id) {
  const panels = loadPanels().filter(p => p.id !== id);
  savePanels(panels);
}

  function createPanel(config) {
    let displayCurrency = config.currency;
    if (config.currency === '524C555344000000000000000000000000000000') displayCurrency = 'RLUSD';
    const panel = document.createElement('div');
    panel.className = 'panel';
    panel.id = config.id;
    panel.innerHTML = `
      <div class="summary" data-panel="${config.id}" style="position: relative;">
        <span class="edit-icon" data-panel="${config.id}" style="position: absolute; top: 5px; right: 5px; cursor: pointer; color: #00ff00; font-size: 16px;">&#9997;</span>
        <span class="reset-icon" data-panel="${config.id}" style="position: absolute; bottom: 5px; right: 5px; cursor: pointer; color: #ff6600; font-size: 16px;">&#128465;</span>
        <div>${config.name}</div><div>Currency: ${displayCurrency}</div><div class="filter" data-panel="${config.id}">Filter: >${config.limit}</div><div>Captured: <span id="${config.id}Count">0</span></div>
      </div>
      <div class="full" id="${config.id}Full" style="display: none;" onclick="togglePanel('${config.id}')">
        <button onclick="togglePanel('${config.id}')" style="position: absolute; top: 10px; right: 10px; background: #000; color: #ff6600; border: 1px solid #ff6600; font-size: 20px; cursor: pointer;">×</button>
        <h1>${config.name} - ${displayCurrency}</h1>
        <p class="threshold">Monitoring transactions greater than ${config.limit} ${displayCurrency}</p>
        <table id="table-${config.id}" onclick="event.stopPropagation()">
          <thead>
            <tr>
              <th>Ledger Number</th>
              <th>Sender Account</th>
              <th>Receiver Account</th>
              <th>Amount (${displayCurrency})</th>
              <th>Timestamp</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>
    `;
    return panel;
  }

  function loadAndCreatePanels() {
    const panels = loadPanels();
    // Ensure default XRP panel exists
      if (!panels.find(p => p.id === 'default-xrp')) {
        const defaultPanel = { ...panelTemplate, id: 'default-xrp', name: 'XRP Monitor', currency: 'XRP', issuer: null, limit: 0 };
        panels.push(defaultPanel);
        savePanel(defaultPanel);
      }
     const container = document.querySelector('.panels-container');
     container.innerHTML = ''; // Clear existing panels to avoid duplicates
     panels.forEach(config => {
      const panel = createPanel(config);
      container.appendChild(panel);
      // Listen for events
      socket.off(`panelTransaction:${config.id}`); // Remove previous listener to avoid duplicates
      socket.on(`panelTransaction:${config.id}`, (data) => {
        const tbody = document.querySelector(`#table-${config.id} tbody`);
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${data.ledger}</td>
          <td>${data.sender}</td>
          <td>${data.receiver}</td>
          <td>${data.amount}</td>
          <td>${new Date(data.timestamp).toLocaleString()}</td>
        `;
        tbody.appendChild(row);
        if (tbody.children.length > 10) tbody.removeChild(tbody.firstChild);
        const countSpan = document.getElementById(`${config.id}Count`);
        countSpan.textContent = parseInt(countSpan.textContent) + 1;

        // Add notification
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.textContent = `New ${config.currency} transaction: ${data.amount} (>${config.limit})`;
        document.getElementById('notifications').appendChild(notification);
        setTimeout(() => {
          if (notification.parentNode) notification.parentNode.removeChild(notification);
        }, 5000);
      });
    });
    // Send configs to server
    console.log('Emitting updatePanels:', panels);
    socket.emit('updatePanels', panels);
  }

  // Event handlers for transactions
  socket.on('newTransaction', (data) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${data.sender}</td>
      <td>${data.receiver}</td>
      <td>${data.amount} XRP</td>
      <td>${new Date(data.timestamp).toLocaleString()}</td>
    `;
    tableBody.appendChild(row);
    if (tableBody.children.length > 10) tableBody.removeChild(tableBody.firstChild);
  });

  socket.on('newRLUSDTransaction', (data) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${data.sender}</td>
      <td>${data.receiver}</td>
      <td>${data.amount} RLUSD</td>
      <td>${new Date(data.timestamp).toLocaleString()}</td>
    `;
    rlusdBody.appendChild(row);
    if (rlusdBody.children.length > 10) rlusdBody.removeChild(rlusdBody.firstChild);
  });

   // Ledger info
    socket.on('ledgerInfo', (data) => {
      document.getElementById('ledgerIndex').textContent = data.ledger || 'N/A';
     document.getElementById('txCount').textContent = data.txCount || 0;
     document.getElementById('xrpPayments').textContent = data.xrpPayments || 0;
     document.getElementById('xrpBurned').textContent = data.totalBurned ? data.totalBurned.toFixed(2) : '0.00';
     if (data.latestPrice) {
       document.getElementById('currentPrice').textContent = data.latestPrice.toFixed(4);
       document.getElementById('smallCurrentPrice').textContent = data.latestPrice.toFixed(4);
     }
   });

  // Wallet events
  socket.on('balances', (balances) => {
    const balanceList = document.getElementById('balanceList');
    balanceList.innerHTML = '';
    balances.forEach(bal => {
      const li = document.createElement('li');
      li.textContent = `${bal.address}: ${bal.balance} XRP (Seq: ${bal.sequence})`;
      balanceList.appendChild(li);
    });
  });

  socket.on('walletActivity', (data) => {
    const activityList = document.getElementById('activityList');
    const li = document.createElement('li');
    li.textContent = `Ledger ${data.ledger}: ${data.account} -> ${data.destination} ${data.amount} (${data.type})`;
    activityList.appendChild(li);
    if (activityList.children.length > 20) activityList.removeChild(activityList.firstChild);
  });

    // Price updates
    console.log('Setting up priceUpdate handler');
    socket.on('priceUpdate', (price) => {
      console.log('Price update received:', price);
      const currentPriceEl = document.getElementById('currentPrice');
      const smallCurrentPriceEl = document.getElementById('smallCurrentPrice');
      console.log('Elements found:', !!currentPriceEl, !!smallCurrentPriceEl);
      const formatted = price.toFixed(4) + ' (' + new Date().toLocaleTimeString() + ')';
      console.log('Formatted price:', formatted);
      if (currentPriceEl) {
        currentPriceEl.textContent = formatted;
        console.log('Updated currentPrice');
      }
      if (smallCurrentPriceEl) {
        smallCurrentPriceEl.textContent = formatted;
        console.log('Updated smallCurrentPrice');
      }
    });

  // Enhanced Ledger Inspection
  socket.on('inspectLedgerResponse', (ledgerData) => {
    const list = document.getElementById('ledgerTxList');
    list.innerHTML = '';

    if (ledgerData.message) {
      list.innerHTML = `<p>${ledgerData.message}</p>`;
      document.getElementById('ledgerOverlay').style.display = 'block';
      return;
    }

    if (ledgerData.transactions.length === 0) {
      list.innerHTML = '<p>No transactions in this ledger.</p>';
      return;
    }

    const table = document.createElement('table');
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';
    table.innerHTML = `
      <thead>
        <tr style="background: #ff6600; color: #000;">
          <th>From</th>
          <th>To</th>
          <th>Type</th>
          <th>Currency</th>
          <th>Amount</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;

    const tbody = table.querySelector('tbody');
    ledgerData.transactions.forEach(tx => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${tx.from}</td>
        <td>${tx.to}</td>
        <td>${tx.type}</td>
        <td>${tx.currency}</td>
        <td>${tx.amount}</td>
      `;
      tbody.appendChild(row);
    });

    list.appendChild(table);
    document.getElementById('ledgerOverlay').style.display = 'block';
  });

  document.getElementById('inspectLedger').addEventListener('click', () => {
    socket.emit('requestLedgerInspection');
  });

  document.getElementById('closeOverlay').addEventListener('click', () => {
    document.getElementById('ledgerOverlay').style.display = 'none';
  });

  // Wallet address input
  document.getElementById('setAddresses').addEventListener('click', () => {
    const addresses = document.getElementById('walletAddresses').value.split(',').map(a => a.trim());
    socket.emit('setWatchedAddresses', addresses);
  });

  // Track wallet activity
  document.getElementById('trackActivity').addEventListener('click', () => {
    const addresses = document.getElementById('walletAddresses').value.split(',').map(a => a.trim());
    socket.emit('trackWalletActivity', { addresses });
  });

  // Graph refresh
  document.getElementById('refreshGraph').addEventListener('click', () => {
    const period = document.getElementById('periodSelect').value;
    const interval = document.getElementById('intervalSelect').value;
    fetch(`/graph?period=${period}&interval=${interval}`)
      .then(res => res.json())
      .then(data => {
        const ctx = document.getElementById('priceChart').getContext('2d');
        new Chart(ctx, {
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
         document.getElementById('currentPrice').textContent = data.latestPrice ? data.latestPrice.toFixed(4) : 'N/A';
         document.getElementById('smallCurrentPrice').textContent = data.latestPrice ? data.latestPrice.toFixed(4) : 'N/A';
      })
      .catch(console.error);
  });

  // Load initial graph
  document.getElementById('refreshGraph').click();

  // Load panels
  loadAndCreatePanels();

  // Re-send on reconnect
  socket.on('connect', () => {
    loadAndCreatePanels();
  });

  // New panel button
  document.getElementById('newPanel').addEventListener('click', () => {
    // Clear fields
    document.getElementById('newCurrencyName').value = '';
    document.getElementById('newCurrencyCode').value = '';
    document.getElementById('newIssuer').value = '';
    document.getElementById('newLimit').value = '';
    document.getElementById('newPanelModal').style.display = 'block';
  });

  // Close modal
  document.getElementById('closeNewModal').addEventListener('click', () => {
    document.getElementById('newPanelModal').style.display = 'none';
  });

  // Cancel
  document.getElementById('cancelPanel').addEventListener('click', () => {
    document.getElementById('newPanelModal').style.display = 'none';
  });

  // New panel creation
  document.getElementById('createPanel').addEventListener('click', () => {
    const name = document.getElementById('newCurrencyName').value.trim();
    let currency = document.getElementById('newCurrencyCode').value.trim();
    let issuer = document.getElementById('newIssuer').value.trim() || null;
    const limit = parseFloat(document.getElementById('newLimit').value);
    // Map common names to codes
    if (currency.toUpperCase() === 'RLUSD') {
      currency = '524C555344000000000000000000000000000000';
      if (!issuer) issuer = 'rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De';
    }
    if (!name || !currency || isNaN(limit)) {
      alert('Please fill all fields correctly.');
      return;
    }
    const config = { ...panelTemplate, id: Date.now().toString(), name, currency, issuer, limit };
    savePanel(config);
    loadAndCreatePanels(); // Recreate all panels including the new one
    document.getElementById('newPanelModal').style.display = 'none';
  });

  // Panel toggle and edit/reset handlers
  document.addEventListener('click', (e) => {
    // Toggle panel if clicking summary but not icons
    if (e.target.closest('.summary') && !e.target.classList.contains('edit-icon') && !e.target.classList.contains('reset-icon') && !e.target.classList.contains('filter')) {
      const panelId = e.target.closest('.summary').dataset.panel;
      togglePanel(panelId);
      return;
    }
    if (e.target.classList.contains('edit-icon')) {
      e.stopPropagation();
      // Open edit modal
      const panelId = e.target.dataset.panel;
      const panels = loadPanels();
      const panel = panels.find(p => p.id === panelId);
      if (panel) {
          document.getElementById('editModalContent').innerHTML = `
            <label>Name: <input id="editName" value="${panel.name}"></label><br><br>
            <label>Currency: <input id="editCurrency" value="${panel.currency}"></label><br><br>
            <label>Issuer: <input id="editIssuer" value="${panel.issuer || ''}"></label><br><br>
            <label>Limit: <input id="editLimit" type="number" value="${panel.limit}"></label><br><br>
            <button id="saveEdit">Save</button>
            <button id="deletePanel" style="background: #ff0000; color: #fff; margin-left: 10px;">Delete Panel</button>
          `;
          document.getElementById('editModal').style.display = 'block';

          // Save edit
          document.getElementById('saveEdit').addEventListener('click', () => {
            panel.name = document.getElementById('editName').value.trim();
            panel.currency = document.getElementById('editCurrency').value.trim();
            panel.issuer = document.getElementById('editIssuer').value.trim() || null;
            panel.limit = parseFloat(document.getElementById('editLimit').value);
            if (!panel.name || !panel.currency || isNaN(panel.limit)) {
              alert('Please fill fields correctly.');
              return;
            }
        savePanel(panel);
        // Update DOM
        let displayCurrency = panel.currency;
        if (panel.currency === '524C555344000000000000000000000000000000') displayCurrency = 'RLUSD';
        const summary = document.querySelector(`#${panel.id} .summary`);
        const currentCount = document.getElementById(`${panel.id}Count`).textContent;
        summary.innerHTML = `
          <span class="edit-icon" data-panel="${panel.id}" style="position: absolute; top: 5px; right: 5px; cursor: pointer; color: #00ff00; font-size: 16px;">&#9997;</span>
          <span class="reset-icon" data-panel="${panel.id}" style="position: absolute; bottom: 5px; right: 5px; cursor: pointer; color: #ff6600; font-size: 16px;">&#128465;</span>
          <div>${panel.name}</div><div>Currency: ${displayCurrency}</div><div class="filter" data-panel="${panel.id}">Filter: >${panel.limit}</div><div>Captured: <span id="${panel.id}Count">${currentCount}</span></div>
        `;
        socket.emit('updatePanels', panels);
        document.getElementById('editModal').style.display = 'none';
          });

          // Delete panel
          document.getElementById('deletePanel').addEventListener('click', () => {
            if (confirm('Delete this panel? This cannot be undone.')) {
          deletePanel(panel.id);
          document.getElementById(panel.id).remove();
          socket.emit('updatePanels', panels.filter(p => p.id !== panel.id));
          document.getElementById('editModal').style.display = 'none';
        }
      });
    }
    }
    if (e.target.classList.contains('reset-icon')) {
      e.stopPropagation();
      // Reset count
      const panelId = e.target.dataset.panel;
      document.getElementById(`${panelId}Count`).textContent = '0';
      const tbody = document.querySelector(`#table-${panelId} tbody`);
      tbody.innerHTML = '';
    }
    if (e.target.classList.contains('filter')) {
      e.stopPropagation();
      // Edit limit
      const panelId = e.target.dataset.panel;
      const newLimit = prompt('Enter new limit:');
      if (newLimit && !isNaN(parseFloat(newLimit))) {
        const panels = loadPanels();
        const panel = panels.find(p => p.id === panelId);
        if (panel) {
          panel.limit = parseFloat(newLimit);
        savePanel(panel);
        // Update display
        e.target.textContent = `Filter: >${panel.limit}`;
        // Update server
        socket.emit('updatePanels', panels);
        }
      }
    }
  });

  // Close edit modal
  document.getElementById('closeEditModal').addEventListener('click', () => {
    document.getElementById('editModal').style.display = 'none';
  });

  // Export data
  document.getElementById('exportData').addEventListener('click', () => {
    loadPanels().then(panels => {
      const data = { panels };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'xrpl_dashboard_data.json';
      a.click();
      URL.revokeObjectURL(url);
    });
  });

  // Import data
  document.getElementById('importBtn').addEventListener('click', () => {
    document.getElementById('importData').click();
  });

  document.getElementById('importData').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target.result);
          if (data.panels) {
            // Clear existing
            const container = document.querySelector('.panels-container');
            container.innerHTML = '';
            // Save and create new
            const promises = data.panels.map(panel => savePanel(panel));
            Promise.all(promises).then(() => {
              loadAndCreatePanels();
            });
          }
        } catch (err) {
          alert('Invalid JSON file');
        }
      };
      reader.readAsText(file);
    }
  });
})();