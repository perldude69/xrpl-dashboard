const { Client } = require('xrpl');
const { servers, RLUSD_CURRENCY, RLUSD_ISSUER, ORACLE_ACCOUNT } = require('./config');
const { insertPrice, getLatestPrice } = require('./db');

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
    client.on('ledgerClosed', (ledger) => {
      lastLedgerIndex = ledger.ledger_index;
      processLedger(ledger, io, userData, filters, currentLedgerTxs);
    });

    client.request({ command: 'subscribe', streams: ['transactions'] }).then(() => {
      console.log('Subscribed to transactions');
    }).catch((err) => {
      console.error('Subscribe transactions failed:', err);
    });

    client.on('transaction', (tx) => {
      const txJson = tx.tx_json;
      // Process for panels
      io.sockets.sockets.forEach(socket => {
        if (socket.panels) {
          socket.panels.forEach(panel => {
            let amount = 0;
            let matches = false;

            if (panel.currency === 'XRP' &&
                txJson.TransactionType === 'Payment' &&
                tx.meta && tx.meta.delivered_amount &&
                typeof tx.meta.delivered_amount === 'string') {
              amount = parseInt(tx.meta.delivered_amount) / 1000000;
              matches = amount > panel.limit;
            } else if (tx.meta && tx.meta.delivered_amount &&
                      typeof tx.meta.delivered_amount === 'object') {
              if (tx.meta.delivered_amount.currency === panel.currency &&
                  (!panel.issuer || tx.meta.delivered_amount.issuer === panel.issuer)) {
                amount = parseFloat(tx.meta.delivered_amount.value);
                matches = amount > panel.limit;
              }
            }

            if (matches) {
              socket.emit('panelTransaction:' + panel.id, {
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

      // Real-time price updates from oracle
      if (txJson.TransactionType === 'TrustSet' && txJson.Account === ORACLE_ACCOUNT && txJson.LimitAmount && txJson.LimitAmount.currency === 'USD') {
        const price = parseFloat(txJson.LimitAmount.value);
        if (!isNaN(price) && price > 0) {
          insertPrice(price, new Date().toISOString(), txJson.ledger_index);
          console.log('Emitting priceUpdate:', price);
          io.emit('priceUpdate', price);
        }
      }
    });
      backfillPrices();
      // Poll oracle every 30 seconds as fallback
      setInterval(() => pollOraclePrice(io), 30000);
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

async function pollOraclePrice(io) {
  if (!module.exports.client || !module.exports.client.isConnected()) return;
  try {
    const response = await module.exports.client.request({
      command: 'account_tx',
      account: ORACLE_ACCOUNT,
      limit: 1,
      forward: false
    });
    const tx = response.result.transactions[0];
    if (tx && tx.tx) {
      const priceData = parsePriceFromTx({ tx_json: tx.tx, close_time_iso: tx.close_time_human, ledger_index: tx.tx.ledger_index });
      if (priceData) {
      getLatestPrice((err, latest) => {
        if (!err && (!latest || Math.abs(priceData.price - latest) > 0.0001)) {
          insertPrice(priceData.price, priceData.time, priceData.ledger);
          console.log('Polled new price:', priceData.price);
          // Removed emit to avoid conflicts with tx stream
        }
      });
      }
    }
  } catch (err) {
    console.error('Poll oracle error:', err);
  }
}

module.exports = {
  connectToXRPL,
  processLedger,
  backfillPrices,
  isConnected: () => isConnected
};