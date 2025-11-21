(function() {
  window.XRPL = window.XRPL || {};

  // Wallet events
   window.XRPL.socket.on('balances', (balances) => {
     const balanceList = document.getElementById('balanceList');
     balanceList.innerHTML = '';
     balances.forEach(bal => {
       const li = document.createElement('li');
       li.textContent = `${bal.address}: ${bal.balance} XRP ($${bal.usdValue})`;
       balanceList.appendChild(li);
     });
   });

  window.XRPL.socket.on('walletActivity', (data) => {
    const activityList = document.getElementById('activityList');
    const li = document.createElement('li');
    li.textContent = `Ledger ${data.ledger}: ${data.account} -> ${data.destination} ${data.amount} (${data.type})`;
    activityList.appendChild(li);
    if (activityList.children.length > 20) activityList.removeChild(activityList.firstChild);
  });

   // Load managed wallets from localStorage on load
   let managedWallets = JSON.parse(localStorage.getItem('managedWallets') || '[]');
   function updateMainInput() {
     const tracked = managedWallets.filter(w => w.trackActivity).map(w => w.address);
     document.getElementById('walletAddresses').value = tracked.join(', ');
   }
   function renderManagedWallets() {
     const list = document.getElementById('managedWalletList');
     list.innerHTML = '';
     managedWallets.forEach((wallet, index) => {
       const li = document.createElement('li');
       li.className = 'wallet-item';
       li.innerHTML = `
         <input type="checkbox" ${wallet.trackActivity ? 'checked' : ''} data-index="${index}">
         ${wallet.address}
         <button data-index="${index}">Remove</button>
       `;
       list.appendChild(li);
     });
   }
   updateMainInput();
   renderManagedWallets();

   // Toggle subpanel
   document.getElementById('toggleWalletManage').addEventListener('click', () => {
     const subpanel = document.getElementById('walletSubpanel');
     const toggle = document.getElementById('toggleWalletManage');
     if (subpanel.classList.contains('hidden')) {
       subpanel.classList.remove('hidden');
       toggle.textContent = 'Manage Wallets ▲';
     } else {
       subpanel.classList.add('hidden');
       toggle.textContent = 'Manage Wallets ▼';
     }
   });

   // Add single wallet
   document.getElementById('addSingleWallet').addEventListener('click', () => {
     const addr = document.getElementById('singleWalletAddress').value.trim();
     if (addr && !managedWallets.some(w => w.address === addr)) {
       managedWallets.push({ address: addr, trackActivity: true });
       localStorage.setItem('managedWallets', JSON.stringify(managedWallets));
       document.getElementById('singleWalletAddress').value = '';
       updateMainInput();
       renderManagedWallets();
     }
   });

   // Handle checkbox and remove
   document.getElementById('managedWalletList').addEventListener('change', (e) => {
     if (e.target.type === 'checkbox') {
       const index = e.target.dataset.index;
       managedWallets[index].trackActivity = e.target.checked;
       localStorage.setItem('managedWallets', JSON.stringify(managedWallets));
       updateMainInput();
     }
   });
   document.getElementById('managedWalletList').addEventListener('click', (e) => {
     if (e.target.tagName === 'BUTTON') {
       const index = e.target.dataset.index;
       managedWallets.splice(index, 1);
       localStorage.setItem('managedWallets', JSON.stringify(managedWallets));
       updateMainInput();
       renderManagedWallets();
     }
   });

   // Wallet address input (bulk set)
   document.getElementById('setAddresses').addEventListener('click', () => {
     const addresses = document.getElementById('walletAddresses').value.split(',').map(a => a.trim()).filter(a => a);
     // Update managed wallets: add new ones, set trackActivity for existing
     addresses.forEach(addr => {
       let existing = managedWallets.find(w => w.address === addr);
       if (!existing) {
         managedWallets.push({ address: addr, trackActivity: true });
       } else {
         existing.trackActivity = true;
       }
     });
     localStorage.setItem('managedWallets', JSON.stringify(managedWallets));
     renderManagedWallets();
     window.XRPL.socket.emit('setWatchedAddresses', addresses);
   });

   // Track wallet activity
   document.getElementById('trackActivity').addEventListener('click', () => {
     const addresses = managedWallets.filter(w => w.trackActivity).map(w => w.address);
     window.XRPL.socket.emit('trackWalletActivity', { addresses });
   });
})();