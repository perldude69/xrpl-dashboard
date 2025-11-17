const { Client } = require('xrpl');
const { servers, RLUSD_CURRENCY, RLUSD_ISSUER, ORACLE_ACCOUNT } = require('./config');
const { insertPrice } = require('./db');

let currentServerIndex = 0;
let isConnected = false;
let lastLedgerIndex = null;
module.exports.client = null;

function selectWorkingServer() {
  return servers[currentServerIndex];
}

function connectToXRPL(io, userData, filters, currentLedgerTxs, retryCount = 0) {
  const serverUrl = selectWorkingServer();
  const options = serverUrl.includes('rich-list') ? { rejectUnauthorized: false } : {};

  if (!module.exports.client) {
    module.exports.client = new Client(serverUrl, options);
  }
  const client = module.exports.client;

  client.connect().then(() => {
    console.log(`Connected to XRPL at ${serverUrl}`);
    isConnected = true;

    client.on('disconnected', () => {
      console.log('Disconnected from XRPL, attempting to reconnect...');
      isConnected = false;
      setTimeout(() => connectToXRPL(io, userData, filters, currentLedgerTxs, 0), 5000);
    });

    client.request({ command: 'subscribe', streams: ['ledger'] }).then(() => {
      console.log('Subscribed to ledger streams');
    client.on('ledgerClosed', (ledger) => {
      lastLedgerIndex = ledger.ledger_index;
      console.log('Last ledger received:', lastLedgerIndex);
      processLedger(ledger, io, userData, filters, currentLedgerTxs);
    });

    client.on('transaction', (tx) => {
      // Process for panels
      io.sockets.sockets.forEach(socket => {
        if (socket.panels) {
          socket.panels.forEach(panel => {
            const txJson = tx.tx_json;
            let amount = 0;
            let matches = false;

            if (panel.currency === 'XRP' && txJson.TransactionType === 'Payment' && typeof txJson.Amount === 'string') {
              amount = parseInt(txJson.Amount) / 1000000;
              matches = amount > panel.limit;
            } else if (txJson.Amount && typeof txJson.Amount === 'object' && txJson.Amount.currency === panel.currency && (!panel.issuer || txJson.Amount.issuer === panel.issuer)) {
              amount = parseFloat(txJson.Amount.value);
              matches = amount > panel.limit;
            }

            if (matches) {
              socket.emit(`panelTransaction:${panel.id}`, {
                ledger: txJson.ledger_index || tx.ledger_index,
                sender: txJson.Account,
                receiver: txJson.Destination,
                amount,
                timestamp: new Date().toISOString()
              });
            }
          });
        }
      });
    });
      backfillPrices();
    }).catch((err) => {
      console.error('Subscribe failed:', err);
      currentServerIndex = (currentServerIndex + 1) % servers.length;
      console.log('Cycling to next server due to subscribe failure');
      connectToXRPL(io, userData, filters, currentLedgerTxs, retryCount + 1);
    });

  }).catch((err) => {
    console.error(`Connection failed to ${serverUrl}:`, err);
    isConnected = false;
    currentServerIndex = (currentServerIndex + 1) % servers.length;

    if (retryCount < 10) {
      setTimeout(() => connectToXRPL(io, userData, filters, currentLedgerTxs, retryCount + 1), 5000);
    } else {
      console.error('Max retries reached');
    }
  });
}

function processLedger(ledger, io, userData, filters, currentLedgerTxs) {
  console.log('Processing ledger', ledger.ledger_index);
  if (!module.exports.client) return;

  module.exports.client.request({
    command: 'ledger',
    ledger_index: ledger.ledger_index,
    transactions: true
  }).then((ledgerData) => {
    const transactions = ledgerData.result.ledger.transactions || [];
    const fullTransactions = transactions;

    // Update current ledger transactions for inspection
    currentLedgerTxs.length = 0; // clear previous
    currentLedgerTxs.push(...fullTransactions);

    // Process real-time price updates
    fullTransactions.forEach(tx => {
      const txJson = tx.tx_json || tx;
      if (txJson.TransactionType === 'TrustSet' && txJson.Account === ORACLE_ACCOUNT && txJson.LimitAmount && txJson.LimitAmount.currency === 'USD') {
        const price = parseFloat(txJson.LimitAmount.value);
        if (!isNaN(price) && price > 0) {
          const timestamp = tx.close_time_iso || (txJson.date ? txJson.date * 1000 + 946684800000 : null);
          if (timestamp) {
            const date = new Date(timestamp);
            if (!isNaN(date.getTime())) {
              insertPrice(price, date.toISOString(), txJson.ledger_index);
              io.emit('priceUpdate', price);
            }
          }
        }
      }
    });

    // Process transactions for wallet activities
    processWalletActivities(fullTransactions, userData, io, ledger.ledger_index);

    // Ledger statistics
    const { getLatestPrice } = require('./db');
    getLatestPrice((err, price) => {
      io.emit('ledgerInfo', {
        ledger: ledger.ledger_index,
        txCount: ledger.txn_count || 0,
        xrpPayments: 0, // TODO: estimate or calculate from stream
        totalXRP: 0,
        totalBurned: 0,
        latestPrice: price
      });
    });
  }).catch((err) => {
    console.error('Ledger fetch failed:', err);
    // Emit with defaults to update menu
    const { getLatestPrice } = require('./db');
    getLatestPrice((err2, price) => {
      io.emit('ledgerInfo', {
        ledger: ledger.ledger_index,
        txCount: 0,
        xrpPayments: 0,
        totalXRP: 0,
        totalBurned: 0,
        latestPrice: price
      });
    });
  });
}

function processWalletActivities(transactions, userData, io, ledgerIndex) {
  Object.values(userData).forEach(user => {
    if (!user.addresses || user.addresses.length === 0) return;

    transactions.forEach(tx => {
      const txJson = tx.tx_json || tx;
      if (user.addresses.includes(txJson.Account) ||
          user.addresses.includes(txJson.Destination)) {
        io.to(user.socket.id).emit('walletActivity', {
          ledger: ledgerIndex,
          account: txJson.Account,
          destination: txJson.Destination,
          amount: txJson.Amount,
          type: txJson.TransactionType
        });
      }
    });
  });
}

function processCurrencyLimitMonitors(transactions, filters, io) {
  console.log(`Processing ${transactions.length} transactions for ${io.sockets.sockets.size} sockets`);
  // Emit to all sockets with matching panels
  io.sockets.sockets.forEach(socket => {
    if (socket.panels) {
      console.log(`Socket has ${socket.panels.length} panels`);
      socket.panels.forEach(panel => {
        transactions.forEach(tx => {
          const txJson = tx.tx_json || tx;
          if (!txJson || typeof txJson !== 'object' || !txJson.TransactionType) {
            console.log('Skipping invalid tx:', tx);
            return;
          }
          console.log('Tx type:', txJson.TransactionType, 'Amount:', txJson.Amount);
          let amount = 0;
          let matches = false;

          if (panel.currency === 'XRP' &&
              txJson.TransactionType === 'Payment' &&
              typeof txJson.Amount === 'string') {
            amount = parseInt(txJson.Amount) / 1000000;
            matches = amount > panel.limit;
            console.log(`XRP Payment: amount ${amount}, limit ${panel.limit}, matches ${matches}`);
          } else if (txJson.Amount &&
                     typeof txJson.Amount === 'object' &&
                     txJson.Amount.currency === panel.currency &&
                     (!panel.issuer || txJson.Amount.issuer === panel.issuer)) {
            amount = parseFloat(txJson.Amount.value);
            matches = amount > panel.limit;
            console.log(`Issued Payment: currency ${txJson.Amount.currency}, amount ${amount}, limit ${panel.limit}, matches ${matches}`);
          }

          if (matches) {
            console.log(`Emitting panelTransaction:${panel.id} for amount ${amount}`);
            socket.emit(`panelTransaction:${panel.id}`, {
              ledger: txJson.ledger_index || tx.ledger_index,
              sender: txJson.Account,
              receiver: txJson.Destination,
              amount,
              timestamp: new Date().toISOString()
            });
          }
        });
      });
    } else {
      console.log('Socket has no panels');
    }
  });
}

function calculateLedgerStatistics(transactions) {
  return {
    txCount: transactions.length,
    xrpPayments: transactions.filter(tx => {
      const txJson = tx.tx_json || tx;
      return txJson.TransactionType === 'Payment' && typeof txJson.Amount === 'string';
    }).length,
    totalXRP: transactions
      .filter(tx => {
        const txJson = tx.tx_json || tx;
        return txJson.TransactionType === 'Payment' && typeof txJson.Amount === 'string';
      })
      .reduce((sum, tx) => {
        const txJson = tx.tx_json || tx;
        return sum + parseInt(txJson.Amount) / 1000000;
      }, 0),
    totalBurned: transactions.reduce((sum, tx) => {
      const txJson = tx.tx_json || tx;
      return sum + (parseInt(txJson.Fee) / 1000000);
    }, 0)
  };
}

async function backfillPrices() {
  if (!module.exports.client) return;

  try {
    const response = await module.exports.client.request({
      command: 'account_tx',
      account: ORACLE_ACCOUNT,
      limit: 100, // fetch last 100 txs
      forward: false // most recent first
    });

    for (const tx of response.result.transactions) {
      if (tx.tx_json) {
        const price = parsePriceFromTx(tx);
        if (price) {
          insertPrice(price.price, price.time, price.ledger);
        }
      }
    }
  } catch (err) {
    console.error('Backfill prices error:', err);
  }
}

function parsePriceFromTx(tx) {
  if (!tx.tx_json) return null;
  if (tx.tx_json.TransactionType === 'TrustSet' && tx.tx_json.LimitAmount && tx.tx_json.LimitAmount.currency === 'USD') {
    const price = parseFloat(tx.tx_json.LimitAmount.value);
    if (isNaN(price) || price <= 0) return null;
    const timestamp = tx.close_time_iso || (tx.tx_json.date ? tx.tx_json.date * 1000 + 946684800000 : null);
    if (!timestamp) return null;
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return null;
    return {
      price,
      time: date.toISOString(),
      ledger: tx.tx_json.ledger_index || tx.ledger_index
    };
  }
  return null;
}

module.exports = {
  connectToXRPL,
  processLedger,
  backfillPrices,
  isConnected: () => isConnected
};