function handleWalletConnections(io, userData) {
  io.on('connection', (socket) => {
    userData[socket.id] = { addresses: [], nicknames: {}, alerts: {} };
    socket.emit('connectionStatus', 'Connected');
    socket.on('disconnect', () => {
      delete userData[socket.id];
    });

    socket.on('setWatchedAddresses', async (addresses) => {
      const { Client } = require('xrpl');
      const client = new Client('wss://s1.ripple.com');
      try {
        await client.connect();
        const balances = [];
        for (const addr of addresses) {
          try {
            const info = await client.request({ command: 'account_info', account: addr });
            const balance = parseInt(info.result.account_data.Balance) / 1000000;
            balances.push({ address: addr, balance });
          } catch (err) {
            balances.push({ address: addr, balance: 'Invalid' });
          }
        }
        socket.emit('balances', balances);
      } catch (err) {
        console.error('Wallet balance error:', err);
      } finally {
        client.disconnect();
      }
    });

    socket.on('exportData', () => {
      const data = {
        addresses: userData[socket.id].addresses,
        nicknames: userData[socket.id].nicknames,
        alerts: userData[socket.id].alerts
      };
      socket.emit('exportDataResponse', data);
    });

    socket.on('importData', (data) => {
      if (data.addresses) {
        userData[socket.id].addresses = data.addresses;
        userData[socket.id].nicknames = data.nicknames || {};
        userData[socket.id].alerts = data.alerts || {};
        socket.emit('walletData', userData[socket.id]);
      }
    });
  });
}

module.exports = {
  handleWalletConnections
};