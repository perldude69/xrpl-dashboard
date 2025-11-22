const http = require('http');
const socketIo = require('socket.io');
const { hasHistoricalData } = require('./models/priceModel');
const { populateDB } = require('../populate_db'); // Keep outside src for now
const { setupSockets } = require('./sockets');
const { connectToXRPL, getClient } = require('./services/xrplClient');
const { processLedger } = require('./services/ledgerService');
const { handleTransaction: handlePriceTransaction } = require('./services/priceService');
const { backfillPrices, pollOraclePrice, setTestIO, setTestPriceEmitter } = require('./services/priceService');

let userData = {};
let filters = {
  xrp: { currency: 'XRP', limit: 10000000 },
  rlusd: { currency: '524C555344000000000000000000000000000000', limit: 10 }
};
let currentLedgerTxs = [];

function createServer(app) {
  const server = http.createServer(app);
  const io = socketIo(server);

  // Set up socket handlers
  const { handlePanelTransaction } = setupSockets(io, userData, filters);

  // XRPL connection and processing logic
  connectToXRPL(
    () => {
      // After setup, initialize backfill and polling
      backfillPrices(getClient());
      setInterval(() => pollOraclePrice(getClient(), io), 30000);
    },
    null, // onDisconnected
    (ledger) => processLedger(getClient(), ledger, io), // onLedgerClosed
    (tx) => {
      handlePriceTransaction(tx);
      handlePanelTransaction(tx);
    }
  );

  // Test hooks
  setTestIO(io);

  return { server, io };
}

async function startServer(port) {
  const app = require('./app');
  const { server } = createServer(app);

  if (process.env.NODE_ENV !== 'test') {
    const hasData = await new Promise((resolve, reject) => {
      hasHistoricalData((err, data) => {
        if (err) reject(err);
        else resolve(data);
      });
    });

    if (!hasData) {
      console.log('No historical data found, starting backfill...');
      await populateDB();
      console.log('Backfill complete.');
    }

    server.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  }

  return server;
}

module.exports = { createServer, startServer };