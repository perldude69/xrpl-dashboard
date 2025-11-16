(function(){
  const socket = io();

  const tableBody = document.querySelector('#transactions tbody');
  const rlusdBody = document.querySelector('#rlusd tbody');

  let walletData = JSON.parse(localStorage.getItem('walletData') || '{"addresses":[],"nicknames":{},"alerts":{}}');
  let priceChart;
  let currentLedgerTxs = [];
  let filters = JSON.parse(localStorage.getItem('filters') || '{"xrp":{"currency":"XRP","limit":10000000},"rlusd":{"currency":"524C555344000000000000000000000000000000","issuer":"rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De","limit":10}}');
  let currentEditingPanel = '';

  // Trash / Reset and Save delegation
  document.addEventListener('click', function(e){
    if (e.target && e.target.classList && e.target.classList.contains('reset-icon')) {
      e.stopPropagation();
      resetCapturedCount(e.target.dataset.panel);
    }
    if (e.target && (e.target.id === 'saveXrp' || e.target.id === 'saveRlusd' || e.target.id === 'saveCustom')) {
      e.preventDefault();
      e.stopPropagation();
      handlePanelSave();
    }
  });

  function getCurrencyDisplay(currency) {
    const known = {
      '524C555344000000000000000000000000000000': 'RLUSD',
      '5553440000000000000000000000000000000000': 'USD',
      '4254430000000000000000000000000000000000': 'BTC',
      '4555520000000000000000000000000000000000': 'EUR',
      '4742500000000000000000000000000000000000': 'GBP',
      '4A50590000000000000000000000000000000000': 'JPY',
      '434E590000000000000000000000000000000000': 'CNY'
    };
    return known[currency] || currency;
  }

  function validatePositiveNumber(value, fieldName) {
    const num = parseFloat(value);
    if (isNaN(num) || num <= 0 || !Number.isInteger(num)) return fieldName + ' must be a positive integer.';
    return null;
  }

  function saveWalletData(){ localStorage.setItem('walletData', JSON.stringify(walletData)); }

  function renderWalletList(){
    const list = document.getElementById('walletList');
    const isEdit = document.getElementById('editMode').checked;
    list.innerHTML = '';
    if(isEdit){
      const table = document.createElement('table');
      table.className='no-border';
      table.style.width='auto';
      table.style.maxWidth='500px';
      table.style.borderCollapse='collapse';
      const thead = document.createElement('thead');
      thead.innerHTML = `<tr style="color: #00ff00;"><th style="padding: 5px;"></th><th style="padding: 5px;">Nickname</th><th style="padding: 5px;">Address</th></tr>`;
      table.appendChild(thead);
      const tbody = document.createElement('tbody');
      table.appendChild(tbody);
      list.appendChild(table);
      for (let i=0;i<10;i++){
        const addr = walletData.addresses[i]||'';
        const nickname = walletData.nicknames[i]||'';
        const alertEnabled = walletData.alerts[i] !== false;
        const tr = document.createElement('tr');
        tr.innerHTML = `<td style="padding: 5px; text-align: center;"><input type="checkbox" id="alert${i}" ${alertEnabled?'checked':''}></td>`+
                       `<td style="padding: 5px;"><input type="text" class="wallet-input" id="nickname${i}" placeholder="Nickname" value="${nickname}" style="min-width: 100px;"></td>`+
                       `<td style="padding: 5px;"><input type="text" class="wallet-input" id="addr${i}" placeholder="Address ${i+1}" value="${addr}" style="min-width: 250px;"></td>`;
        tbody.appendChild(tr);
      }
    } else {
      const table = document.createElement('table');
      table.className='no-border';
      table.style.width='auto';
      table.style.maxWidth='500px';
      table.style.borderCollapse='collapse';
      const thead = document.createElement('thead');
      thead.innerHTML = `<tr style="color: #00ff00;"><th style="padding: 5px;">Wallet</th><th style="padding: 5px;">Balance</th><th style="padding: 5px;"></th></tr>`;
      table.appendChild(thead);
      const tbody = document.createElement('tbody');
      table.appendChild(tbody);
      list.appendChild(table);
      for(let i=0;i<10;i++){
        const addr = walletData.addresses[i]||'';
        const nickname = walletData.nicknames[i]||'';
        const displayName = nickname||addr;
        if(displayName){
          const alertIcon = walletData.alerts[i] ? '&#9888;' : '';
          const tr = document.createElement('tr');
          tr.innerHTML = `<td style="padding: 5px;">${displayName}</td>`+
                         `<td style="padding: 5px;" id="balance${i}"></td>`+
                         `<td style="padding: 5px; color: #ffffff; font-size: 20px; text-align: center;">${alertIcon}</td>`;
          tbody.appendChild(tr);
        }
      }
    }
  }

  function saveWallets(){
    for(let i=0;i<10;i++){
      const addrInput = document.getElementById(`addr${i}`);
      const nicknameInput = document.getElementById(`nickname${i}`);
      const alertInput = document.getElementById(`alert${i}`);
      if (addrInput && nicknameInput && alertInput){
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

  function createPanelFromFilter(panelId, f){
    const displayCurrency = getCurrencyDisplay(f.currency);
    const panel = document.createElement('div');
    panel.className = 'panel';
    panel.id = panelId + 'Panel';
    panel.style.position = 'relative';
    panel.innerHTML = `
      <div class="summary" onclick="togglePanel('${panelId}')" style="position: relative;">
        <span class="edit-icon" data-panel="${panelId}" style="position: absolute; top: 5px; right: 5px; cursor: pointer; color: #00ff00; font-size: 16px;">&#9997;</span>
        <div>Currency: ${displayCurrency}</div><div>Filter: >${f.limit}</div><div>Captured: <span id="${panelId}Count">0</span></div>
        <span class="reset-icon" data-panel="${panelId}" style="position: absolute; bottom: 5px; right: 5px; cursor: pointer; color: #ff6600; font-size: 16px;">&#128465;</span>
      </div>
      <div class="full" id="${panelId}Full" style="display: none;" onclick="togglePanel('${panelId}')">
        <h1>${displayCurrency} Large Transactions Dashboard</h1>
        <p class="threshold">Monitoring transactions greater than ${f.limit} ${displayCurrency}</p>
        <table id="${panelId}Table" onclick="event.stopPropagation()">
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
    document.querySelector('.panels-container').appendChild(panel);
  }

  function editPanel(panelType){
    currentEditingPanel = panelType;
    const content = document.getElementById('editModalContent');
    if(panelType === 'wallet'){
      content.innerHTML = '<p>Wallet panel: Toggle edit mode.</p><button id="toggleEdit">Toggle Edit</button>';
      document.getElementById('toggleEdit').addEventListener('click', ()=>{
        const editMode = document.getElementById('editMode');
        editMode.checked = !editMode.checked;
        renderWalletList();
        hideEditModal();
      });
    } else if(panelType === 'xrp'){
      content.innerHTML = '<label>Limit: <input id="editXrpLimit" type="number" value="' + (filters.xrp?.limit || 10000000) + '"></label><br><button id="saveXrp">Save</button>';
    } else if(panelType === 'rlusd'){
      content.innerHTML = '<label>Currency: <input id="editRlusdCurrency" value="' + (filters.rlusd?.currency || 'RLUSD') + '"></label><br><label>Issuer: <input id="editRlusdIssuer" value="' + (filters.rlusd?.issuer || '') + '"></label><br><label>Limit: <input id="editRlusdLimit" type="number" value="' + (filters.rlusd?.limit || 10) + '"></label><br><button id="saveRlusd">Save</button>';
    } else {
      const f = filters[panelType];
      content.innerHTML = '<label>Currency: <input id="editCustomCurrency" value="' + (f?.currency || '') + '"></label><br><label>Issuer: <input id="editCustomIssuer" value="' + (f?.issuer || '') + '"></label><br><label>Limit: <input id="editCustomLimit" type="number" value="' + (f?.limit || 0) + '"></label><br><button id="saveCustom">Save</button>';
    }
    document.getElementById('editModal').style.display = 'block';
    document.getElementById('modalOverlay').style.display = 'block';
  }

  function handlePanelSave(){
    const panel = currentEditingPanel;
    if(panel === 'xrp'){
      const limitValue = document.getElementById('editXrpLimit').value;
      const error = validatePositiveNumber(limitValue, 'Limit');
      if (error) { document.getElementById('editError').textContent = error; return; }
      filters.xrp.limit = parseInt(limitValue, 10);
      localStorage.setItem('filters', JSON.stringify(filters));
      socket.emit('updateFilters', filters);
      document.querySelector('#xrpPanel .summary div:nth-child(2)').textContent = 'Filter: >' + filters.xrp.limit;
      hideEditModal();
    } else if(panel === 'rlusd'){
      const currency = document.getElementById('editRlusdCurrency').value;
      const issuer = document.getElementById('editRlusdIssuer').value;
      const limitValue = document.getElementById('editRlusdLimit').value;
      const limitError = validatePositiveNumber(limitValue, 'Limit');
      if (limitError) { document.getElementById('editError').textContent = limitError; return; }
      filters.rlusd.currency = currency;
      filters.rlusd.issuer = issuer;
      filters.rlusd.limit = parseInt(limitValue, 10);
      localStorage.setItem('filters', JSON.stringify(filters));
      socket.emit('updateFilters', filters);
      const disp = getCurrencyDisplay(filters.rlusd.currency);
      document.querySelector('#rlusdPanel .summary div:nth-child(1)').textContent = 'Currency: ' + disp;
      document.querySelector('#rlusdPanel .summary div:nth-child(2)').textContent = 'Filter: >' + filters.rlusd.limit;
      hideEditModal();
    } else { // custom
      const panelId = panel;
      const currency = document.getElementById('editCustomCurrency').value;
      const issuer = document.getElementById('editCustomIssuer').value;
      const limitValue = document.getElementById('editCustomLimit').value;
      const limitError = validatePositiveNumber(limitValue, 'Limit');
      if (limitError) { document.getElementById('editError').textContent = limitError; return; }
      filters[panelId].currency = currency;
      filters[panelId].issuer = issuer;
      filters[panelId].limit = parseInt(limitValue, 10);
      localStorage.setItem('filters', JSON.stringify(filters));
      socket.emit('updateFilters', filters);
      const disp = getCurrencyDisplay(filters[panelId].currency);
      document.querySelector('#' + panelId + 'Panel .summary div:nth-child(1)').textContent = 'Currency: ' + disp;
      document.querySelector('#' + panelId + 'Panel .summary div:nth-child(2)').textContent = 'Filter: >' + filters[panelId].limit;
      hideEditModal();
    }
  }

  window.addEventListener('load', () => {
    // initialize
    renderWalletList();
    if (walletData.addresses.length) {
      // wire up basic wallet watch (no XRPL fetch here to keep it lightweight)
      // placeholder
    }
    // create panels for existing custom filters
    for (const [key, f] of Object.entries(filters)) {
      if (key !== 'xrp' && key !== 'rlusd' && key !== 'graph') {
        createPanelFromFilter(key, f);
      }
    }
    // basic wiring for icons
    document.querySelectorAll('.edit-icon').forEach(icon => {
      icon.addEventListener('click', (e) => { editPanel(e.target.dataset.panel); });
    });
    document.querySelectorAll('.reset-icon').forEach(icon => {
      icon.addEventListener('click', (e) => { e.stopPropagation(); resetCapturedCount(e.target.dataset.panel); });
    });
  });
})();
