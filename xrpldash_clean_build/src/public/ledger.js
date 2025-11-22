(function() {
  window.XRPL = window.XRPL || {};

  // Ledger info
  window.XRPL.socket.on('ledgerInfo', (data) => {
    document.getElementById('ledgerIndex').textContent = data.ledger || 'N/A';
    document.getElementById('txCount').textContent = data.txCount || 0;
    // Do not aggressively override XRP Payments from ledgerInfo; rely on per-panel aggregation
    if (typeof data.xrpPayments !== 'undefined' && data.xrpPayments !== null) {
      const v = Number(data.xrpPayments);
      document.getElementById('xrpPayments').textContent = Number.isNaN(v) ? '0' : v.toFixed(6);
    } else {
      // keep existing display if ledgerInfo doesn't include xrpPayments
    }
    document.getElementById('xrpBurned').textContent = data.totalBurned ? data.totalBurned.toFixed(6) : '0.000000';
    // Only update price from ledgerInfo if no real-time price has been received in the last 10 seconds
    if (data.latestPrice && window.XRPL.updatePriceDisplay) {
      const now = Date.now();
      const lastRealTimePriceTime = window.XRPL.lastPriceTime || 0;
      if (now - lastRealTimePriceTime > 10000) { // 10 seconds
        window.XRPL.updatePriceDisplay(data.latestPrice, false);
      }
    }
  });

  // Enhanced Ledger Inspection
  window.XRPL.socket.on('inspectLedgerResponse', (ledgerData) => {
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

  // Only attach event listener if element exists (created dynamically)
  const inspectButton = document.getElementById('inspectLedger');
  if (inspectButton) {
    inspectButton.addEventListener('click', () => {
      window.XRPL.socket.emit('requestLedgerInspection');
    });
  }

  document.getElementById('closeOverlay').addEventListener('click', () => {
    document.getElementById('ledgerOverlay').style.display = 'none';
  });
})();