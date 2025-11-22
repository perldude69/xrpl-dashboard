const { Client } = require('xrpl');
const { servers } = require('../config');

let currentServerIndex = 0;
let isConnectedFlag = false;
let client = null;

function selectWorkingServer() {
  return servers[currentServerIndex];
}

function connectToXRPL(onConnected, onDisconnected, onLedgerClosed, onTransaction) {
  const serverUrl = selectWorkingServer();
  const options = serverUrl.includes('rich-list') ? { rejectUnauthorized: false } : {};

  if (!client) {
    client = new Client(serverUrl, options);
  }

  client.connect().then(() => {
    console.log(`Connected to XRPL at ${serverUrl}`);
    isConnectedFlag = true;

    client.on('disconnected', () => {
      console.log('Disconnected from XRPL, attempting to reconnect...');
      isConnectedFlag = false;
      setTimeout(() => connectToXRPL(onConnected, onDisconnected, onLedgerClosed, onTransaction, 0), 5000);
    });

    // Subscribe to streams
    client.request({ command: 'subscribe', streams: ['transactions'] }).then(() => {
      console.log('Subscribed to transactions');
    }).catch((err) => {
      console.error('Subscribe transactions failed:', err);
    });

    client.request({ command: 'subscribe', streams: ['ledger'] }).then(() => {
      console.log('Subscribed to ledger');
    }).catch((err) => {
      console.error('Subscribe ledger failed:', err);
    });

    // Attach event handlers
    if (onLedgerClosed) client.on('ledgerClosed', onLedgerClosed);
    if (onTransaction) client.on('transaction', onTransaction);

    if (onConnected) onConnected();
  }).catch((err) => {
    console.error(`Connection failed to ${serverUrl}:`, err);
    isConnectedFlag = false;
    currentServerIndex = (currentServerIndex + 1) % servers.length;
    setTimeout(() => connectToXRPL(onConnected, onDisconnected, onLedgerClosed, onTransaction), 5000);
  });
}

function getClient() {
  return client;
}

function getIsConnected() {
  return isConnectedFlag && client && client.isConnected();
}

module.exports = {
  connectToXRPL,
  getClient,
  getIsConnected
};