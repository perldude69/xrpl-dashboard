(function() {
  window.XRPL = window.XRPL || {};

  const panelTemplate = {
    id: '',
    name: 'Currency Monitor',
    currency: 'XRP',
    issuer: null,
    limit: 0
  };

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
     if (config.id === 'ledger-overview') {
       // Special panel for Ledger Overview
       const panel = document.createElement('div');
       panel.className = 'panel';
       panel.id = config.id;
       panel.innerHTML = `
         <div class="summary" data-panel="${config.id}" style="position: relative;">
           <span class="reset-icon" data-panel="${config.id}" style="position: absolute; bottom: 5px; right: 5px; cursor: pointer; color: #ff6600; font-size: 16px;">&#128465;</span>
           <div>${config.name}</div><div>Real-time ledger metrics & transactions</div>
         </div>
         <div class="full" id="${config.id}Full" style="display: none;" onclick="window.XRPL.togglePanel('${config.id}')">
           <button onclick="window.XRPL.togglePanel('${config.id}')" style="position: absolute; top: 10px; right: 10px; background: #000; color: #ff6600; border: 1px solid #ff6600; font-size: 20px; cursor: pointer;">×</button>
            <h1>${config.name}</h1>
            <button id="inspectLedger" style="background: var(--bg-secondary); color: var(--text-primary); border: 1px solid var(--accent-primary); padding: var(--spacing-sm) var(--spacing-md); margin-bottom: var(--spacing-md); cursor: pointer;">Inspect Current Ledger</button>
            <div class="ledger-grid">
             <div class="metric-card">
               <span class="metric-icon">📊</span>
               <div class="metric-label">Current Ledger</div>
               <div class="metric-value" id="ledgerIndex">Loading...</div>
             </div>
             <div class="metric-card">
               <span class="metric-icon">🔄</span>
               <div class="metric-label">Transactions</div>
               <div class="metric-value" id="txCount">0</div>
             </div>
             <div class="metric-card">
               <span class="metric-icon">💸</span>
               <div class="metric-label">XRP Payments</div>
               <div class="metric-value" id="xrpPayments">0</div>
             </div>
             <div class="metric-card">
               <span class="metric-icon">🔥</span>
               <div class="metric-label">XRP Burned</div>
               <div class="metric-value" id="xrpBurned">0</div>
             </div>
           </div>
           <h3>Current Ledger Transactions</h3>
           <div class="ledger-table-container">
             <table id="currentLedgerTable" class="no-border">
               <thead>
                 <tr>
                   <th>Type</th>
                   <th>Account</th>
                   <th>Amount</th>
                   <th>Details</th>
                 </tr>
               </thead>
               <tbody></tbody>
             </table>
           </div>
         </div>
       `;
       return panel;
     }
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
       <div class="full" id="${config.id}Full" style="display: none;" onclick="window.XRPL.togglePanel('${config.id}')">
         <button onclick="window.XRPL.togglePanel('${config.id}')" style="position: absolute; top: 10px; right: 10px; background: #000; color: #ff6600; border: 1px solid #ff6600; font-size: 20px; cursor: pointer;">×</button>
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
      // Ensure Ledger Overview panel exists
      if (!panels.find(p => p.id === 'ledger-overview')) {
        const ledgerPanel = { id: 'ledger-overview', name: 'Ledger Overview', currency: '', issuer: null, limit: 0 };
        panels.push(ledgerPanel); // Add at end
        savePanel(ledgerPanel);
      }

      // Reorder panels to ensure Ledger Overview is at the bottom
      const ledgerOverviewIndex = panels.findIndex(p => p.id === 'ledger-overview');
      if (ledgerOverviewIndex >= 0 && ledgerOverviewIndex < panels.length - 1) {
        const ledgerPanel = panels.splice(ledgerOverviewIndex, 1)[0];
        panels.push(ledgerPanel);
      }
     const container = document.querySelector('.panels-container');
     // Do not clear to preserve static panels
     panels.forEach(config => {
       if (!document.getElementById(config.id)) {
         const panel = createPanel(config);
         // Special handling for Ledger Overview - place it after Wallet Monitoring
         if (config.id === 'ledger-overview') {
           const walletPanel = document.querySelector('.panel h1');
           if (walletPanel && walletPanel.textContent === 'Wallet Monitoring') {
             const walletMonitoringPanel = walletPanel.closest('.panel');
             walletMonitoringPanel.parentNode.insertBefore(panel, walletMonitoringPanel.nextSibling);
           } else {
             container.appendChild(panel);
           }
         } else {
           container.appendChild(panel);
         }
       }
      // Listen for events
      window.XRPL.socket.off(`panelTransaction:${config.id}`); // Remove previous listener to avoid duplicates
      window.XRPL.socket.on(`panelTransaction:${config.id}`, (data) => {
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
        notification.className = 'notification show';
        notification.textContent = `New ${config.currency} transaction: ${data.amount} (>${config.limit})`;
        document.getElementById('notifications').appendChild(notification);
        setTimeout(() => {
          if (notification.parentNode) notification.parentNode.removeChild(notification);
        }, 5000);
      });
    });
    // Send configs to server
    console.log('Emitting updatePanels:', panels);
    window.XRPL.socket.emit('updatePanels', panels);
  }

  window.XRPL.panelTemplate = panelTemplate;
  window.XRPL.savePanels = savePanels;
  window.XRPL.loadPanels = loadPanels;
  window.XRPL.savePanel = savePanel;
  window.XRPL.deletePanel = deletePanel;
  window.XRPL.createPanel = createPanel;
  window.XRPL.loadAndCreatePanels = loadAndCreatePanels;
})();