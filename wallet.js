const { Client } = require('xrpl');
const { servers } = require('./config');

function selectWorkingXRPLServer() {
  return servers.find(server => !server.includes('rich-list')) || servers[0];
}

function handleWalletConnections(io, userData) {
  io.on('connection', (socket) => {
    userData[socket.id] = { 
      socket, 
      addresses: [], 
      nicknames: {}, 
      alerts: {},
      lastProcessedLedger: null 
    };

    socket.on('disconnect', () => {
      delete userData[socket.id];
    });

    socket.on('updateWalletData', (data) => {
      userData[socket.id] = {
        ...userData[socket.id],
        ...data,
        lastProcessedLedger: userData[socket.id].lastProcessedLedger
      };
    });

    socket.on('setWatchedAddresses', async (addresses) => {
      const client = new Client(selectWorkingXRPLServer());
      try {
        await client.connect();
        const balances = await Promise.all(
          addresses.map(async (addr) => {
            try {
              const info = await client.request({ command: 'account_info', account: addr });
              return { 
                address: addr, 
                balance: parseInt(info.result.account_data.Balance) / 1000000,
                sequence: info.result.account_data.Sequence
              };
            } catch (err) {
              return { address: addr, balance: 'Invalid', sequence: null };
            }
          })
        );
        socket.emit('balances', balances);
        userData[socket.id].addresses = addresses;
      } catch (err) {
        console.error('Wallet balance error:', err);
      } finally {
        await client.disconnect();
      }
    });

    socket.on('trackWalletActivity', async (config) => {
      const { 
        addresses, 
        minThreshold = 0, 
        startLedger = null 
      } = config;

      userData[socket.id].addresses = addresses;
      userData[socket.id].lastProcessedLedger = startLedger;

      socket.emit('walletTrackingStarted', {
        message: `Tracking wallet activities for ${addresses.length} addresses`,
        addresses
      });
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