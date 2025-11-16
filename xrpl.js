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
    console.log(`Connected to XRPL at ${servers[currentServerIndex]}`);
    isConnected = true;
    client.on('disconnected', () => console.log('XRPL client disconnected'));
    client.request({ command: 'subscribe', streams: ['ledger'] }).then(() => {
      console.log('Subscribed to ledger stream');
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
  console.log(`Processing ledger: ${ledger.ledger_index}`);
  module.exports.client.request({
    command: 'ledger',
    ledger_index: ledger.ledger_index,
    transactions: true
  }).then((ledgerData) => {
    const transactions = ledgerData.result.ledger.transactions;
    console.log(`Total transactions in ledger ${ledger.ledger_index}: ${transactions.length}`);

    let txCount = transactions.length;
    let xrpPayments = 0;
    let totalXRP = 0;
    let totalBurned = 0;

    for (const tx of transactions) {
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
      }
    }

    for (const [socketId, data] of Object.entries(userData)) {
      for (const tx of transactions) {
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
    console.log('Emitting ledgerInfo to', io.sockets.sockets.size, 'clients:', { ledger: ledger.ledger_index, txCount, xrpPayments, totalXRP, totalBurned: totalBurnedXRP });
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
  console.log('Backfill completed');
}

module.exports = {
  connectToXRPL,
  processLedger,
  backfillPrices,
  isConnected: () => isConnected
};