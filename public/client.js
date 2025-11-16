console.log('Script starting');
console.log('io object:', io);
const socket = io();
console.log('Socket created:', socket);
socket.on('connect', () => {
  console.log('Socket connected, id:', socket.id);
});
socket.on('disconnect', () => {
  console.log('Socket disconnected');
});
socket.on('connect_error', (err) => {
  console.log('Socket connect error:', err);
});
socket.on('test', (msg) => {
  console.log('Test received:', msg);
});

const tableBody = document.querySelector('#transactions tbody');
const rlusdBody = document.querySelector('#rlusd tbody');

let walletData = JSON.parse(localStorage.getItem('walletData') || '{"addresses":[],"nicknames":{},"alerts":{}}');
let priceChart;

function saveWalletData() {
  localStorage.setItem('walletData', JSON.stringify(walletData));
}

function renderWalletList() {
  const list = document.getElementById('walletList');
  const isEdit = document.getElementById('editMode').checked;
  list.innerHTML = '';

  if (isEdit) {
    const table = document.createElement('table');
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';
    table.style.border = '1px solid #ff6600';
    const thead = document.createElement('thead');
    thead.innerHTML = `
      <tr style="background: #ff6600; color: #000;">
        <th style="border: 1px solid #000; padding: 5px;">Alert</th>
        <th style="border: 1px solid #000; padding: 5px;">Nickname</th>
        <th style="border: 1px solid #000; padding: 5px;">Address</th>
        <th style="border: 1px solid #000; padding: 5px;">Balance</th>
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
        <td style="border: 1px solid #ff6600; padding: 5px; text-align: center;"><input type="checkbox" id="alert${i}" ${alertEnabled ? 'checked' : ''}></td>
        <td style="border: 1px solid #ff6600; padding: 5px;"><input type="text" class="wallet-input" id="nickname${i}" placeholder="Nickname" value="${nickname}" style="width: 100%;"></td>
        <td style="border: 1px solid #ff6600; padding: 5px;"><input type="text" class="wallet-input" id="addr${i}" placeholder="Address ${i + 1}" value="${addr}" style="width: 100%;"></td>
        <td style="border: 1px solid #ff6600; padding: 5px;" id="balance${i}"></td>
      `;
      tbody.appendChild(tr);
    }
  } else {
    const table = document.createElement('table');
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';
    const thead = document.createElement('thead');
    thead.innerHTML = `
      <tr style="background: #ff6600; color: #000;">
        <th style="border: 1px solid #000; padding: 5px;">Wallet</th>
        <th style="border: 1px solid #000; padding: 5px;">Balance</th>
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
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td style="border: 1px solid #ff6600; padding: 5px;">${displayName}</td>
          <td style="border: 1px solid #ff6600; padding: 5px;" id="balance${i}"></td>
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
  socket.emit('setWatchedAddresses', walletData.addresses);
  renderWalletList();
}

window.addEventListener('load', () => {
  console.log('Edit mode element:', document.getElementById('editMode'));
  renderWalletList();
  if (walletData.addresses.length) socket.emit('setWatchedAddresses', walletData.addresses);
  loadGraphData();
  setInterval(() => {
    socket.emit('getLatestPrice');
  }, 10000);

  document.getElementById('editMode').addEventListener('change', () => {
    const isEdit = document.getElementById('editMode').checked;
    console.log('Edit mode changed to:', isEdit);
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
  console.log('Received ledgerInfo:', info);
  const ledgerEl = document.getElementById('ledgerNum');
  console.log('ledgerNum element:', ledgerEl);
  if (ledgerEl) {
    ledgerEl.textContent = info.ledger;
    document.getElementById('txCount').textContent = info.txCount;
    document.getElementById('xrpPayments').textContent = info.xrpPayments;
    document.getElementById('xrpBurned').textContent = info.totalBurned.toFixed(9);
  }
});

socket.on('connectionStatus', (status) => {
  document.getElementById('connectionStatus').textContent = status;
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
  alert(`Wallet activity detected in ledger ${data.ledger}: ${data.account} -> ${data.destination}`);
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
        alert('Invalid JSON file.');
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