(function() {
  window.XRPL = window.XRPL || {};

   // Export data
   document.getElementById('exportData').addEventListener('click', () => {
     const panels = window.XRPL.loadPanels();
     const watchedAddresses = JSON.parse(localStorage.getItem('watchedAddresses') || '[]');
     const data = { panels, watchedAddresses };
     const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
     const url = URL.createObjectURL(blob);
     const a = document.createElement('a');
     a.href = url;
     a.download = 'xrpl_dashboard_data.json';
     a.click();
     URL.revokeObjectURL(url);
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
             const promises = data.panels.map(panel => window.XRPL.savePanel(panel));
             Promise.all(promises).then(() => {
               window.XRPL.loadAndCreatePanels();
             });
           }
           if (data.watchedAddresses) {
             localStorage.setItem('watchedAddresses', JSON.stringify(data.watchedAddresses));
             document.getElementById('walletAddresses').value = data.watchedAddresses.join(', ');
             // Emit to server if connected
             if (window.XRPL.socket.connected) {
               window.XRPL.socket.emit('setWatchedAddresses', data.watchedAddresses);
             }
           }
         } catch (err) {
           alert('Invalid JSON file');
         }
       };
       reader.readAsText(file);
     }
   });
})();