const { Client } = require('xrpl');
const sqlite3 = require('sqlite3').verbose();

const client = new Client('wss://s1.ripple.com');
const db = new sqlite3.Database('xrp_prices.db');

db.run('CREATE TABLE IF NOT EXISTS xrp_price (id INTEGER PRIMARY KEY AUTOINCREMENT, price REAL, time TEXT, ledger INTEGER)');

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

async function populateDB() {
  await client.connect();
  console.log('Connected to XRPL');

  const account = 'rXUMMaPpZqPutoRszR29jtC8amWq3APkx';
  let marker = {"ledger":99722300,"seq":34};
  let count = 0;
  let pendingInserts = 0;  // Track pending operations

  const insertCallback = (resolve) => {
    count++;
    pendingInserts--;
    if (pendingInserts === 0) {
      console.log(`Finished populating DB with ${count} entries`);
      client.disconnect();
      db.close();
      resolve();
    }
  };

  return new Promise(async (resolve) => {
    do {
      const request = {
        command: 'account_tx',
        account: account,
        limit: 400,
        forward: false
      };
      if (marker) request.marker = marker;

      try {
        const result = await client.request(request);
        const transactions = result.result.transactions;

        for (const tx of transactions) {
          if (tx.tx_json) {
            let price = null;
            let time = tx.close_time_human || new Date((tx.tx_json.date + 946684800) * 1000).toISOString();
            let ledger = tx.ledger_index;

            if (tx.tx_json.LimitAmount) {
              price = parseFloat(tx.tx_json.LimitAmount.value);
            } else if (tx.tx_json.TransactionType === 'OfferCreate' && tx.tx_json.TakerPays && tx.tx_json.TakerGets) {
              if (tx.tx_json.TakerPays.currency === 'XRP' && tx.tx_json.TakerGets.currency === 'USD') {
                const xrpDrops = parseFloat(tx.tx_json.TakerPays.value);
                const usdAmount = parseFloat(tx.tx_json.TakerGets.value);
                price = usdAmount * 1000000 / xrpDrops;
              } else if (tx.tx_json.TakerPays.currency === 'USD' && (!tx.tx_json.TakerGets.currency || tx.tx_json.TakerGets.currency === 'XRP')) {
                const usdAmount = parseFloat(tx.tx_json.TakerPays.value);
                const xrpDrops = parseFloat(tx.tx_json.TakerGets.value);
                price = usdAmount / (xrpDrops / 1000000);
              }
            }

          if (price === null) {
            // Try parsing from memos if not from tx_json
            price = parsePriceFromTx(tx);
          }
          if (price !== null) {
            db.run('INSERT INTO xrp_price (price, time, ledger) VALUES (?, ?, ?)', [price, time, ledger], function(err) {
              if (err) console.error('Insert error:', err);
              else count++;
            });
          }
          }
        }

        marker = result.result.marker;
        console.log(`Processed ${transactions.length} transactions, total inserted: ${count}`);
      } catch (err) {
        console.error('Error fetching transactions:', err);
        break;
      }
    } while (marker);

    // If no inserts were pending, resolve immediately
    if (pendingInserts === 0) {
      console.log(`Finished populating DB with ${count} entries`);
      await client.disconnect();
      db.close();
      resolve();
    }
  });
}

populateDB().catch(console.error);