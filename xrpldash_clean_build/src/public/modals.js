(function() {
  window.XRPL = window.XRPL || {};

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
    const config = { ...window.XRPL.panelTemplate, id: Date.now().toString(), name, currency, issuer, limit };
    window.XRPL.savePanel(config);
    window.XRPL.loadAndCreatePanels(); // Recreate all panels including the new one
    document.getElementById('newPanelModal').style.display = 'none';
  });

  // Panel toggle and edit/reset handlers
  document.addEventListener('click', (e) => {
    // Toggle panel if clicking summary but not icons
    if (e.target.closest('.summary') && !e.target.classList.contains('edit-icon') && !e.target.classList.contains('reset-icon') && !e.target.classList.contains('filter')) {
      const panelId = e.target.closest('.summary').dataset.panel;
      window.XRPL.togglePanel(panelId);
      return;
    }
    if (e.target.classList.contains('edit-icon')) {
      e.stopPropagation();
      // Open edit modal
      const panelId = e.target.dataset.panel;
      const panels = window.XRPL.loadPanels();
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
           window.XRPL.savePanel(panel);
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
           // Update full panel threshold
           const threshold = document.querySelector(`#${panel.id}Full .threshold`);
           if (threshold) {
             threshold.textContent = `Monitoring transactions greater than ${panel.limit} ${displayCurrency}`;
           }
           window.XRPL.socket.emit('updatePanels', panels);
           document.getElementById('editModal').style.display = 'none';
        });

        // Delete panel
        document.getElementById('deletePanel').addEventListener('click', () => {
          if (confirm('Delete this panel? This cannot be undone.')) {
            window.XRPL.deletePanel(panel.id);
            document.getElementById(panel.id).remove();
            window.XRPL.socket.emit('updatePanels', panels.filter(p => p.id !== panel.id));
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
        const panels = window.XRPL.loadPanels();
        const panel = panels.find(p => p.id === panelId);
        if (panel) {
          panel.limit = parseFloat(newLimit);
          window.XRPL.savePanel(panel);
          // Update display
          e.target.textContent = `Filter: >${panel.limit}`;
          // Update full panel threshold
          let displayCurrency = panel.currency;
          if (panel.currency === '524C555344000000000000000000000000000000') displayCurrency = 'RLUSD';
          const threshold = document.querySelector(`#${panelId}Full .threshold`);
          if (threshold) {
            threshold.textContent = `Monitoring transactions greater than ${panel.limit} ${displayCurrency}`;
          }
          // Update server
          window.XRPL.socket.emit('updatePanels', panels);
        }
      }
    }
  });

  // Close edit modal
  document.getElementById('closeEditModal').addEventListener('click', () => {
    document.getElementById('editModal').style.display = 'none';
  });
})();