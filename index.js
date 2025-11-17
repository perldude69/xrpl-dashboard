const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const xrpl = require('./xrpl');
const { handleWalletConnections } = require('./wallet');
const { getGraphData, getLatestPrice, hasHistoricalData } = require('./db');
const { populateDB } = require('./populate_db');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static('public'));

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

app.get('/graph', (req, res) => {
  const period = req.query.period || '30d';
  const interval = req.query.interval || '4h';
  getGraphData(period, interval, (err, data) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json(data);
  });
});

const userData = {};
let filters = {
  xrp: { currency: 'XRP', limit: 10000000 },
  rlusd: { currency: '524C555344000000000000000000000000000000', limit: 10 }
};
let currentLedgerTxs = [];

handleWalletConnections(io, userData);

function safelyProcessTransaction(tx) {
  try {
    const txJson = tx.tx_json || {};
    
    return {
      from: txJson.Account || 'N/A',
      to: txJson.Destination || 'N/A',
      type: txJson.TransactionType || 'Unknown',
      currency: (function() {
        if (txJson.TransactionType === 'Payment') {
          if (typeof txJson.Amount === 'string') return 'XRP';
          if (txJson.Amount && typeof txJson.Amount === 'object') {
            return txJson.Amount.currency || 'Unknown';
          }
        }
        return 'Unknown';
      })(),
      amount: (function() {
        if (txJson.TransactionType === 'Payment') {
          if (typeof txJson.Amount === 'string') {
            return `${(parseInt(txJson.Amount) / 1000000).toFixed(6)} XRP`;
          }
          if (txJson.Amount && typeof txJson.Amount === 'object') {
            return `${txJson.Amount.value || 0} ${txJson.Amount.currency || 'Unknown'}`;
          }
        }
        return 'N/A';
      })()
    };
  } catch (error) {
    console.error('Transaction processing error:', error);
    return null;
  }
}

io.on('connection', (socket) => {
  socket.on('requestLedgerInspection', () => {
    if (currentLedgerTxs.length === 0) {
      socket.emit('inspectLedgerResponse', {
        transactions: [],
        message: 'No ledger data available yet. Ledger fetch may have failed on this server.'
      });
      return;
    }
    const processedTransactions = currentLedgerTxs
      .map(safelyProcessTransaction)
      .filter(tx => tx !== null);

    socket.emit('inspectLedgerResponse', {
      transactions: processedTransactions
    });
  });

  socket.on('updatePanels', (panels) => {
    console.log('Received updatePanels:', panels);
    // Store panels for this socket
    socket.panels = panels;
  });

  // Other event handlers remain the same
});

// XRPL connection and processing logic
xrpl.connectToXRPL(io, userData, filters, currentLedgerTxs);

// Periodic price updates (backup)
setInterval(() => {
  const { getLatestPrice } = require('./db');
  getLatestPrice((err, price) => {
    if (!err && price) {
      io.emit('priceUpdate', price);
    }
  });
}, 60000); // every minute

const PORT = process.env.PORT || 3000;

(async () => {
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

  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
})();

module.exports = {
  client: xrpl.client,
  safelyProcessTransaction  // Expose for potential testing
};