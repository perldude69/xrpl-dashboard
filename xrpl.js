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
    currentServerIndex = (currentServerIndex + 1) % servers.length;  // Cycle to next server
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

    // Fetch full transactions with delay to avoid rate limits
    const fullTransactions = [];
    for (const hash of txHashes) {
      try {
        const txResponse = await module.exports.client.request({ command: 'tx', transaction: hash });
        fullTransactions.push(txResponse.result);
      } catch (err) {
        console.error('Failed to fetch tx:', hash, err);
      }
      // Add delay to reduce load
      await new Promise(resolve => setTimeout(resolve, 100));  // 100ms delay
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

      // Check for price updates from oracle
      if (json.Account === ORACLE_ACCOUNT) {
        const price = parsePriceFromTx(tx);
        if (price) {
          io.emit('latestPrice', price);
        }
      }

      if (json.TransactionType === 'Payment') {
        xrpPayments++;  // Increment payment count
        // Check all filters
        let amt = json.Amount;
        if (!amt) amt = meta.delivered_amount;
        if (typeof amt === 'string') {
          const xrpAmount = parseInt(amt) / 1000000;
          totalXRP += xrpAmount;  // Accumulate XRP amount
        }
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

async function backfillPrices() {
  if (!isConnected) {
    console.log('XRPL client not connected, skipping backfill');
    return;
  }
  // Use a public server for historical data since rich-list.info has limited history
  const publicClient = new (require('xrpl').Client)('wss://s1.ripple.com');
  try {
    await publicClient.connect();
    console.log('Connected to public server for backfill');
    fetchPricesRecursive(publicClient, null, 0);
  } catch (err) {
    console.error('Failed to connect to public server for backfill:', err);
  }
}

function fetchPricesRecursive(client, marker, depth) {
  const req = {
    command: 'account_tx',
    account: ORACLE_ACCOUNT,
    limit: 50,
    forward: false
  };
  if (marker) req.marker = marker;
  client.request(req).then((response) => {
    const transactions = response.result.transactions;
    console.log(`Backfilling prices from ${transactions.length} oracle transactions (depth ${depth})`);
    let inserted = 0;
    for (const tx of transactions) {
      const price = parsePriceFromTx(tx);
      if (price) {
        let time = tx.close_time_iso || tx.close_time_human;
        if (!time) {
          time = new Date((tx.tx_json.date + 946684800) * 1000).toISOString();
        }
        insertPrice(price, time, tx.ledger_index, (err) => {
          if (err) console.error('Error inserting price:', err);
        });
        inserted++;
      }
    }
    console.log(`Inserted ${inserted} prices`);
    if (response.result.marker && depth < 5) {  // Limit to 5 pages
      setTimeout(() => fetchPricesRecursive(client, response.result.marker, depth + 1), 1000);  // Delay to avoid rate limits
    } else {
      console.log('Backfill completed');
      client.disconnect().catch(console.error);  // Close the public connection after backfill
    }
  }).catch((err) => {
    console.error('Error backfilling prices:', err);
    client.disconnect().catch(console.error);
  });
}

function parsePriceFromTx(tx) {
  if (tx.tx_json.Memos) {
    for (const memo of tx.tx_json.Memos) {
      const type = memo.Memo?.MemoType;
      const data = memo.Memo?.MemoData;
      if (data) {
        if (type === '787061727469636C65' || type === '7072696365') {  // 'xparticle' or 'price'
          try {
            const decoded = Buffer.from(data, 'hex').toString();
            const price = parseFloat(decoded);
            if (!isNaN(price) && price > 0) return price;
          } catch (e) {
            console.error('Error decoding memo:', e);
          }
        } else if (type && type.startsWith('72617465733A')) {  // 'rates:'
          try {
            const decoded = Buffer.from(data, 'hex').toString();
            const prices = decoded.split(';').map(p => parseFloat(p)).filter(p => !isNaN(p) && p > 0);
            if (prices.length > 0) {
              // Take the first price as representative
              return prices[0];
            }
          } catch (e) {
            console.error('Error decoding rates memo:', e);
          }
        }
      }
    }
  }
  return null;
}

module.exports = {
  connectToXRPL,
  processLedger,
  backfillPrices,
  isConnected: () => isConnected
};