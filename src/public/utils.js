(function() {
  window.XRPL = window.XRPL || {};

   window.togglePanel = window.XRPL.togglePanel = function(id) {
     const full = document.getElementById(id + 'Full');
     if (!full) {
       console.error('Full element not found for', id);
       return;
     }
     if (full.style.display === 'none' || full.style.display === '') {
       full.style.display = 'block';
       // If it's the graph panel, load the chart
       if (id === 'graph') {
         setTimeout(() => {
           // Update currentPrice with latest if available
           const currentPriceEl = document.getElementById('currentPrice');
           if (currentPriceEl && window.XRPL.latestFormattedPrice) {
             currentPriceEl.textContent = window.XRPL.latestFormattedPrice;
           }
           // Load the graph
           window.XRPL.loadGraph();
         }, 100);
       }
       // If it's the ledger-overview panel, load the current ledger table
       if (id === 'ledger-overview') {
         setTimeout(() => {
           window.XRPL.loadCurrentLedgerTable();
         }, 100);
       }
     } else {
       full.style.display = 'none';
     }
   };
})();