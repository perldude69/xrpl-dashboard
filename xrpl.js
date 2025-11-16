const { Client } = require('xrpl');
const { servers, RLUSD_CURRENCY, RLUSD_ISSUER, ORACLE_ACCOUNT } = require('./config');
const { insertPrice } = require('./db');

let currentServerIndex = 0;
let isConnected = false;
module.exports.client = null;

function connectToXRPL(retryCount = 0) {
  if (!module.exports.client) {
    const options = servers[currentServerIndex].includes('rich-list') ? { rejectUnauthorized: false } : {};
    module.exports.client = new Client(servers[currentServerIndex], options);
  }
  const client = module.exports.client;
  client.connect().then(() => {
    isConnected = true;
    client.on('disconnected', () => {});
    client.request({ command: 'subscribe', streams: ['ledger'] }).then(() => {
    }).catch(console.error);
  }).catch((err) => {
    console.error(`Connection failed to ${servers[currentServerIndex]}:`, err);
    isConnected = false;
    currentServerIndex = (currentServerIndex + 1) % servers.length;
    const options = servers[currentServerIndex].includes('rich-list') ? { rejectUnauthorized: false } : {};
    module.exports.client = new Client(servers[currentServerIndex], options);
    if (retryCount < 10) {
      setTimeout(() => connectToXRPL(retryCount + 1), 5000);
    } else {
      console.error('Max retries reached');
    }
  });
}

function processLedger(ledger, io, userData) {
  module.exports.client.request({
    command: 'ledger',
    ledger_index: ledger.ledger_index,
    transactions: true
  }).then(async (ledgerData) => {
    const txHashes = ledgerData.result.ledger.transactions;

    // Fetch full transactions
    const fullTransactions = [];
    for (const hash of txHashes) {
      try {
        const txResponse = await module.exports.client.request({ command: 'tx', transaction: hash });
        fullTransactions.push(txResponse.result);
      } catch (err) {
        console.error('Failed to fetch tx:', hash, err);
      }
    }
    io.emit('ledgerTransactions', fullTransactions);

    let txCount = fullTransactions.length;
    let xrpPayments = 0;
    let totalXRP = 0;
    let totalBurned = 0;

    for (const tx of fullTransactions) {
      totalBurned += parseInt(tx.Fee) || 0;
      if (tx.TransactionType === 'Payment') {
        let amountDrops = 0;
        if (tx.Amount) {
          if (typeof tx.Amount === 'string') {
            amountDrops = parseInt(tx.Amount);
          } else if (typeof tx.Amount === 'object' && tx.Amount.currency === 'XRP') {
            amountDrops = parseInt(tx.Amount.value);
          }
        }
        if (amountDrops > 1e13) {
          const amountXRP = amountDrops / 1000000;
          totalXRP += amountXRP;
          xrpPayments++;
          io.emit('newTransaction', {
            ledger: ledger.ledger_index,
            sender: tx.Account,
            receiver: tx.Destination,
            amount: amountXRP,
            timestamp: new Date().toISOString()
          });
        }
        // Check for RLUSD payments
        if (typeof tx.Amount === 'object' && tx.Amount.currency === RLUSD_CURRENCY && tx.Amount.issuer === RLUSD_ISSUER) {
          const amountRLUSD = parseFloat(tx.Amount.value);
          if (amountRLUSD > 10) {
            io.emit('newRLUSDTransaction', {
              ledger: ledger.ledger_index,
              sender: tx.Account,
              receiver: tx.Destination,
              amount: amountRLUSD,
              timestamp: new Date().toISOString()
            });
          }
        }
      }
    }

    for (const [socketId, data] of Object.entries(userData)) {
      for (const tx of fullTransactions) {
        if (data.addresses.includes(tx.Account) || data.addresses.includes(tx.Destination)) {
          data.socket.emit('walletActivity', {
            ledger: ledger.ledger_index,
            account: tx.Account,
            destination: tx.Destination,
            hash: tx.hash
          });
        }
      }
    }

    // Emit ledger info
    const totalBurnedXRP = totalBurned * 1e-6;
    io.emit('ledgerInfo', {
      ledger: ledger.ledger_index,
      txCount,
      xrpPayments,
      totalXRP,
      totalBurned: totalBurnedXRP
    });
  }).catch((err) => {
    console.error('Error fetching ledger:', err);
  });
}

function backfillPrices() {
  // Simplified backfill, can be expanded
}

module.exports = {
  connectToXRPL,
  processLedger,
  backfillPrices,
  isConnected: () => isConnected
};