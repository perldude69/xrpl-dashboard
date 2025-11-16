const socket = io();
socket.on('connect', () => {
});
socket.on('disconnect', () => {
});
socket.on('connect_error', (err) => {
});
socket.on('test', (msg) => {
});

const tableBody = document.querySelector('#transactions tbody');
const rlusdBody = document.querySelector('#rlusd tbody');

let walletData = JSON.parse(localStorage.getItem('walletData') || '{"addresses":[],"nicknames":{},"alerts":{}}');
let priceChart;
let currentLedgerTxs = [];

function saveWalletData() {
  localStorage.setItem('walletData', JSON.stringify(walletData));
}

function renderWalletList() {
  const list = document.getElementById('walletList');
  const isEdit = document.getElementById('editMode').checked;
  list.innerHTML = '';

  if (isEdit) {
    const table = document.createElement('table');
    table.className = 'no-border';
    table.style.width = 'auto';
    table.style.maxWidth = '500px';
    table.style.borderCollapse = 'collapse';
    const thead = document.createElement('thead');
    thead.innerHTML = `
      <tr style="color: #00ff00;">
        <th style="padding: 5px;"></th>
        <th style="padding: 5px;">Nickname</th>
        <th style="padding: 5px;">Address</th>
      </tr>
    `;
    table.appendChild(thead);
    const tbody = document.createElement('tbody');
    table.appendChild(tbody);
    list.appendChild(table);
    for (let i = 0; i < 10; i++) {
      const addr = walletData.addresses[i] || '';
      const nickname = walletData.nicknames[i] || '';
      const alertEnabled = walletData.alerts[i] !== false;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="padding: 5px; text-align: center;"><input type="checkbox" id="alert${i}" ${alertEnabled ? 'checked' : ''}></td>
        <td style="padding: 5px;"><input type="text" class="wallet-input" id="nickname${i}" placeholder="Nickname" value="${nickname}" style="min-width: 100px;"></td>
        <td style="padding: 5px;"><input type="text" class="wallet-input" id="addr${i}" placeholder="Address ${i + 1}" value="${addr}" style="min-width: 250px;"></td>
      `;
      tbody.appendChild(tr);
    }
  } else {
    const table = document.createElement('table');
    table.className = 'no-border';
    table.style.width = 'auto';
    table.style.maxWidth = '600px';
    table.style.borderCollapse = 'collapse';
    const thead = document.createElement('thead');
    thead.innerHTML = `
      <tr style="color: #00ff00;">
        <th style="padding: 5px;">Wallet</th>
        <th style="padding: 5px;">Balance</th>
        <th style="padding: 5px;"></th>
      </tr>
    `;
    table.appendChild(thead);
    const tbody = document.createElement('tbody');
    table.appendChild(tbody);
    list.appendChild(table);
    for (let i = 0; i < 10; i++) {
      const addr = walletData.addresses[i] || '';
      const nickname = walletData.nicknames[i] || '';
      const displayName = nickname || addr;
      if (displayName) {
        const alertIcon = walletData.alerts[i] ? '&#9888;' : '';
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td style="padding: 5px;">${displayName}</td>
          <td style="padding: 5px;" id="balance${i}"></td>
          <td style="padding: 5px; color: yellow; font-size: 20px; text-align: center;">${alertIcon}</td>
        `;
        tbody.appendChild(tr);
      }
    }
  }
}

function saveWallets() {
  for (let i = 0; i < 10; i++) {
    const addrInput = document.getElementById(`addr${i}`);
    const nicknameInput = document.getElementById(`nickname${i}`);
    const alertInput = document.getElementById(`alert${i}`);
    if (addrInput && nicknameInput && alertInput) {
      walletData.addresses[i] = addrInput.value.trim();
      walletData.nicknames[i] = nicknameInput.value.trim();
      walletData.alerts[i] = alertInput.checked;
    }
  }
  saveWalletData();
  socket.emit('updateWalletData', walletData);
  socket.emit('setWatchedAddresses', walletData.addresses);
  renderWalletList();
}

window.addEventListener('load', () => {
  renderWalletList();
  socket.emit('updateWalletData', walletData);
  if (walletData.addresses.length) socket.emit('setWatchedAddresses', walletData.addresses);
  loadGraphData();
  setInterval(() => {
    socket.emit('getLatestPrice');
  }, 10000);

  document.getElementById('editMode').addEventListener('change', () => {
    const isEdit = document.getElementById('editMode').checked;
    if (!isEdit) {
      saveWallets();
    } else {
      renderWalletList();
    }
  });
});

function loadGraphData() {
  const period = document.getElementById('periodSelect').value;
  const interval = document.getElementById('intervalSelect').value;
  socket.emit('getGraphData', { period, interval });
}

socket.on('ledgerInfo', (info) => {
  const ledgerEl = document.getElementById('ledgerNum');
  if (ledgerEl) {
    ledgerEl.textContent = info.ledger;
    document.getElementById('txCount').textContent = info.txCount;
    document.getElementById('xrpPayments').textContent = info.xrpPayments;
    document.getElementById('xrpBurned').textContent = info.totalBurned.toFixed(9);
  }
});

socket.on('ledgerTransactions', (txs) => {
  currentLedgerTxs = txs;
});

socket.on('graphData', (data) => {
  renderChart(data);
  const latestPrice = data.latestPrice || (data.prices.length > 0 ? data.prices[data.prices.length - 1] : null);
  updateGraphSummary(latestPrice);
  const priceText = latestPrice ? `$${latestPrice.toFixed(4)}` : 'N/A';
  document.getElementById('currentPrice').textContent = priceText;
});

socket.on('latestPrice', (price) => {
  updateGraphSummary(price);
  const priceText = price ? `$${price.toFixed(4)}` : 'N/A';
  document.getElementById('currentPrice').textContent = priceText;
});

socket.on('newTransaction', (transaction) => {
  const row = document.createElement('tr');
  row.innerHTML = `
    <td>${transaction.ledger}</td>
    <td>${transaction.sender}</td>
    <td>${transaction.receiver}</td>
    <td>${transaction.amount}</td>
    <td>${transaction.timestamp}</td>
  `;
  tableBody.insertBefore(row, tableBody.firstChild);
  document.getElementById('xrpCount').textContent = tableBody.children.length;
});

socket.on('newRLUSDTransaction', (transaction) => {
  const row = document.createElement('tr');
  row.innerHTML = `
    <td>${transaction.ledger}</td>
    <td>${transaction.sender}</td>
    <td>${transaction.receiver}</td>
    <td>${transaction.amount}</td>
    <td>${transaction.timestamp}</td>
  `;
  rlusdBody.insertBefore(row, rlusdBody.firstChild);
  document.getElementById('rlusdCount').textContent = rlusdBody.children.length;
});

socket.on('balances', (balances) => {
  balances.forEach((b, index) => {
    const span = document.getElementById(`balance${index}`);
    if (span) span.textContent = b.balance;
  });
});

socket.on('walletActivity', (data) => {
  showNotification(`Wallet activity detected in ledger ${data.ledger}: ${data.account} -> ${data.destination}`, 'info');
});

socket.on('walletData', (data) => {
  walletData = data;
  saveWalletData();
  renderWalletList();
});

function renderChart(data) {
  if (priceChart) {
    priceChart.destroy();
  }
  priceChart = new Chart(document.getElementById('priceChart'), {
    type: 'line',
    data: {
      labels: data.labels,
      datasets: [{
        label: 'XRP Price',
        data: data.prices,
        borderColor: '#00ff00',
        backgroundColor: 'rgba(0, 255, 0, 0.1)',
        pointRadius: 0,
        pointHoverRadius: 5,
        pointHoverBackgroundColor: 'transparent',
        pointHoverBorderColor: 'transparent',
        segment: {
          borderColor: (ctx) => {
            if (!ctx.p0 || !ctx.p1) return '#00ff00';
            if (ctx.p0.parsed.y < ctx.p1.parsed.y) return '#800080';
            if (ctx.p0.parsed.y > ctx.p1.parsed.y) return '#ff6600';
            return '#00ff00';
          }
        }
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          ticks: {
            callback: function(value, index, values) {
              const date = new Date(this.getLabelForValue(value));
              return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            }
          }
        }
      }
    }
  });
}

function updateGraphSummary(latestPrice) {
  const priceText = latestPrice ? `$${latestPrice.toFixed(4)}` : 'N/A';
  const summary = document.querySelector('#graphPanel .summary');
  summary.innerHTML = `
    <div>XRP Price Graph</div><div>Latest: ${priceText}</div>
  `;
}

function showNotification(message, type = 'info') {
  const notifications = document.getElementById('notifications');
  const note = document.createElement('div');
  note.className = `notification ${type}`;
  note.textContent = message;
  notifications.appendChild(note);
  setTimeout(() => note.classList.add('show'), 10);
  setTimeout(() => {
    note.classList.remove('show');
    setTimeout(() => notifications.removeChild(note), 500);
  }, 5000);
}

document.getElementById('exportData').addEventListener('click', () => {
  socket.emit('exportData');
});

socket.on('exportDataResponse', (data) => {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'dashboard_data.json';
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById('importBtn').addEventListener('click', () => {
  document.getElementById('importData').click();
});

document.getElementById('importData').addEventListener('change', (event) => {
  const file = event.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        socket.emit('importData', data);
      } catch (err) {
        showNotification('Invalid JSON file.', 'error');
      }
    };
    reader.readAsText(file);
  }
});

function togglePanel(id) {
  const full = document.getElementById(id + 'Full');
  full.style.display = full.style.display === 'none' ? 'block' : 'none';
}

document.getElementById('refreshGraph').addEventListener('click', loadGraphData);
document.getElementById('periodSelect').addEventListener('change', loadGraphData);
document.getElementById('intervalSelect').addEventListener('change', loadGraphData);

document.getElementById('inspectLedger').addEventListener('click', () => {
  populateLedgerOverlay();
  document.getElementById('ledgerOverlay').style.display = 'block';
});

document.getElementById('closeOverlay').addEventListener('click', () => {
  document.getElementById('ledgerOverlay').style.display = 'none';
});

function extractTxInfo(tx) {
  const json = tx.tx_json || {};
  const meta = tx.meta || {};
  let amount = 'N/A';
  let currency = 'N/A';

  if (json.Amount) {
    if (typeof json.Amount === 'string') {
      currency = 'XRP';
      amount = (parseInt(json.Amount) / 1000000).toFixed(6);
    } else if (json.Amount.currency) {
      currency = json.Amount.currency;
      amount = json.Amount.value || 'N/A';
    }
  } else if (json.TakerGets) {
    // For offers
    if (typeof json.TakerGets === 'string') {
      currency = 'XRP';
      amount = (parseInt(json.TakerGets) / 1000000).toFixed(6);
    } else if (json.TakerGets.currency) {
      currency = json.TakerGets.currency;
      amount = json.TakerGets.value || 'N/A';
    }
  } else if (meta.delivered_amount) {
    // Actual delivered
    if (typeof meta.delivered_amount === 'string') {
      currency = 'XRP';
      amount = (parseInt(meta.delivered_amount) / 1000000).toFixed(6);
    } else if (meta.delivered_amount.currency) {
      currency = meta.delivered_amount.currency;
      amount = meta.delivered_amount.value || 'N/A';
    }
  }

  return {
    from: json.Account || 'N/A',
    to: json.Destination || 'N/A',
    type: json.TransactionType || 'N/A',
    currency,
    amount,
    hash: tx.hash || 'N/A'
  };
}

function populateLedgerOverlay() {
  const list = document.getElementById('ledgerTxList');
  list.innerHTML = '';
  if (currentLedgerTxs.length === 0) {
    list.innerHTML = '<p>No transactions in current ledger.</p>';
    return;
  }
  const table = document.createElement('table');
  table.style.width = '85%';
  table.style.borderCollapse = 'collapse';
  table.innerHTML = `
    <thead>
      <tr style="background: #ff6600; color: #000;">
        <th style="border: 1px solid #000; padding: 5px;">From</th>
        <th style="border: 1px solid #000; padding: 5px;">To</th>
        <th style="border: 1px solid #000; padding: 5px;">Transaction Type</th>
        <th style="border: 1px solid #000; padding: 5px;">Currency Code</th>
        <th style="border: 1px solid #000; padding: 5px;">Amount</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;
  const tbody = table.querySelector('tbody');
  currentLedgerTxs.forEach(tx => {
    const info = extractTxInfo(tx);
    const row = document.createElement('tr');
    row.innerHTML = `
      <td style="border: 1px solid #ff6600; padding: 5px; min-width: 150px;">&nbsp;${info.from}&nbsp;</td>
      <td style="border: 1px solid #ff6600; padding: 5px; min-width: 150px;">&nbsp;${info.to}&nbsp;</td>
      <td style="border: 1px solid #ff6600; padding: 5px;">&nbsp;${info.type}&nbsp;</td>
      <td style="border: 1px solid #ff6600; padding: 5px;">&nbsp;${info.currency}&nbsp;</td>
      <td style="border: 1px solid #ff6600; padding: 5px;">&nbsp;${info.amount}&nbsp;</td>
    `;
    tbody.appendChild(row);
  });
  list.appendChild(table);
}