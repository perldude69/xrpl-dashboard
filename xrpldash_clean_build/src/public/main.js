(function() {
   window.XRPL = window.XRPL || {};

   // Load panels
   window.XRPL.loadAndCreatePanels();

   // Load and display current ledger transactions
   window.XRPL.loadCurrentLedgerTable = function() {
     const tableBody = document.querySelector('#currentLedgerTable tbody');
     if (!tableBody) return;
     // Fetch current ledger data from server
     window.XRPL.socket.emit('getCurrentLedgerTransactions');
   };
    // Listen for ledger transactions
    window.XRPL.socket.on('currentLedgerTransactions', (transactions) => {
      console.log('Received currentLedgerTransactions:', transactions.length);  // Debug log
      console.log('Sample received tx:', transactions[0]);  // Debug log
      console.log('Updating table');  // Debug log
      const tableBody = document.querySelector('#currentLedgerTable tbody');
      if (!tableBody) {
        console.warn('Table body not found - panel not expanded?');
        return;
      }
      tableBody.innerHTML = '';
      transactions.slice(0, 50).forEach(tx => {  // Limit to 50
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${tx.type || 'Unknown'}</td>
          <td>${tx.account || 'N/A'}</td>
          <td>${tx.amount || 'N/A'}</td>
          <td>${tx.details || ''}</td>
        `;
        tableBody.appendChild(row);
      });
    });

   // Re-send on reconnect
   window.XRPL.socket.on('connect', () => {
     window.XRPL.loadAndCreatePanels();
   });

    // Listen for ledger updates to refresh table
    window.XRPL.socket.on('ledgerInfo', (data) => {
      console.log('Ledger changed to', data.ledger, 'fetching transactions');
      window.XRPL.loadCurrentLedgerTable();
    });
    // Fallback: update table every 5 seconds if panel is expanded
    setInterval(() => {
      if (document.querySelector('#currentLedgerTable tbody')) {
        window.XRPL.loadCurrentLedgerTable();
      }
    }, 5000);
 })();