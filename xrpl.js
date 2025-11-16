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
    client.on('disconnected', () => {});
    client.request({ command: 'subscribe', streams: ['ledger'] }).then(() => {
      backfillPrices();
    }).catch(console.error);
  }).catch((err) => {
    console.error(`Connection failed to ${servers[currentServerIndex]}:`, err);
    isConnected = false;
    if (retryCount < 10) {
      setTimeout(() => connectToXRPL(retryCount + 1), 5000);
    } else {
      console.error('Max retries reached');
    }
  });
}

function processLedger(ledger, io, userData, filters) {
  if (!io) {
    console.error('io is undefined in processLedger');
    return;
  }
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
      const json = tx.tx_json;
      const meta = tx.meta;
      totalBurned += parseInt(json.Fee) || 0;
      if (json.TransactionType === 'Payment') {
        // Check all filters
        let amt = json.Amount;
        if (!amt) amt = meta.delivered_amount;
        for (const [key, f] of Object.entries(filters)) {
          let matches = false;
          let amount = 0;
          if (f.currency === 'XRP' && typeof amt === 'string') {
            amount = parseInt(amt) / 1000000;
            matches = amount > f.limit;
          } else if (typeof amt === 'object' && amt.currency === f.currency && (!f.issuer || amt.issuer === f.issuer)) {
            amount = parseFloat(amt.value);
            matches = amount > f.limit;
          }
          if (matches) {
            let eventName;
            if (key === 'xrp') {
              eventName = 'newTransaction';
            } else if (key === 'rlusd') {
              eventName = 'newRLUSDTransaction';
            } else {
              eventName = 'new' + key + 'Transaction';
            }
            io.emit(eventName, {
              ledger: ledger.ledger_index,
              sender: json.Account,
              receiver: json.Destination,
              amount,
              timestamp: new Date().toISOString()
            });
          }
        }
      }
    }

    for (const [socketId, data] of Object.entries(userData)) {
      if (!data.socket || typeof data.socket.emit !== 'function') continue;
      for (const tx of fullTransactions) {
        const json = tx.tx_json;
        if (data.addresses.includes(json.Account) || data.addresses.includes(json.Destination)) {
          data.socket.emit('walletActivity', {
            ledger: ledger.ledger_index,
            account: json.Account,
            destination: json.Destination,
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
  if (!module.exports.client || !isConnected) {
    console.log('XRPL client not connected, skipping backfill');
    return;
  }
  fetchPricesRecursive(null, 0);
}

function fetchPricesRecursive(marker, depth) {
  const req = {
    command: 'account_tx',
    account: ORACLE_ACCOUNT,
    limit: 50,
    forward: false
  };
  if (marker) req.marker = marker;
  module.exports.client.request(req).then((response) => {
    const transactions = response.result.transactions;
    console.log(`Backfilling prices from ${transactions.length} oracle transactions (depth ${depth})`);
    let inserted = 0;
    for (const tx of transactions) {
      const price = parsePriceFromTx(tx);
      if (price) {
        insertPrice(price, new Date(tx.close_time_human).toISOString(), tx.tx.ledger_index, (err) => {
          if (err) console.error('Error inserting price:', err);
        });
        inserted++;
      }
    }
    console.log(`Inserted ${inserted} prices`);
    if (response.result.marker && depth < 5) {  // Limit to 5 pages
      setTimeout(() => fetchPricesRecursive(response.result.marker, depth + 1), 1000);  // Delay to avoid rate limits
    } else {
      console.log('Backfill completed');
    }
  }).catch((err) => {
    console.error('Error backfilling prices:', err);
  });
}

function parsePriceFromTx(tx) {
  if (tx.tx.Memos) {
    for (const memo of tx.tx.Memos) {
      const type = memo.Memo?.MemoType;
      const data = memo.Memo?.MemoData;
      if (data && (type === '787061727469636C65' || type === '7072696365')) {  // 'xparticle' or 'price'
        try {
          const decoded = Buffer.from(data, 'hex').toString();
          const price = parseFloat(decoded);
          if (!isNaN(price) && price > 0) return price;
        } catch (e) {
          console.error('Error decoding memo:', e);
        }
      }
    }
  }
  return null;
}
  module.exports.client.request({
    command: 'account_tx',
    account: ORACLE_ACCOUNT,
    limit: 50,
    forward: false
  }).then((response) => {
    const transactions = response.result.transactions;
    console.log(`Backfilling prices from ${transactions.length} oracle transactions`);
    for (const tx of transactions) {
      if (tx.tx.TransactionType === 'Payment' && tx.tx.Memos) {
        for (const memo of tx.tx.Memos) {
          if (memo.Memo.MemoType === '787061727469636C65' && memo.Memo.MemoData) {  // 'xparticle' in hex
            try {
              const price = parseFloat(Buffer.from(memo.Memo.MemoData, 'hex').toString());
              if (!isNaN(price)) {
                insertPrice(price, new Date(tx.close_time_human).toISOString(), tx.tx.ledger_index, (err) => {
                  if (err) console.error('Error inserting price:', err);
                });
              }
            } catch (e) {
              console.error('Error parsing price memo:', e);
            }
          }
        }
      }
    }
    console.log('Backfill completed');
  }).catch((err) => {
    console.error('Error backfilling prices:', err);
  });
}

module.exports = {
  connectToXRPL,
  processLedger,
  backfillPrices,
  isConnected: () => isConnected
};