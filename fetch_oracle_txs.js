const { Client } = require('xrpl');

const ACCOUNT = 'rXUMMaPpZqPutoRszR29jtC8amWq3APkx';
const LEDGER_MIN = 100324200;
const LEDGER_MAX = -1;
const LIMIT = 100;

async function fetchOracleTransactions() {
  const client = new Client('wss://s1.ripple.com');
  await client.connect();

  let marker = null;
  let allTransactions = [];
  let retryDelay = 1000; // start with 1s for backoff

  let page = 0;
  while (true) {
    try {
      const request = {
        command: 'account_tx',
        account: ACCOUNT,
        ledger_index_min: LEDGER_MIN,
        ledger_index_max: -1,
        forward: false,
        limit: LIMIT
      };

      if (marker) {
        request.marker = marker;
      }

      const response = await client.request(request);

      // Log first tx
      if (page === 0) {
        const firstTx = response.result.transactions[0];
        console.log('First tx_json:', JSON.stringify(firstTx.tx_json, null, 2));
      }

      // Filter transactions
      const filtered = response.result.transactions.filter(tx => {
        const txn = tx.tx_json;
        if (!txn || !txn.TransactionType || !txn.LimitAmount) return false;
        return txn.TransactionType === 'TrustSet' && parseFloat(txn.LimitAmount.value) > 3.00;
      });

      // Collect data
      filtered.forEach(tx => {
        const txn = tx.tx_json;
        allTransactions.push({
          price: txn.LimitAmount.value,
          hash: txn.hash,
          ledger_index: txn.ledger_index
        });
      });

      console.log(`Fetched ${response.result.transactions.length} txs, filtered ${filtered.length}, total collected: ${allTransactions.length}`);

      // Check for more pages
      if (response.result.marker) {
        marker = response.result.marker;
        // Rate limiting: 200ms delay
        await new Promise(resolve => setTimeout(resolve, 200));
      } else {
        break;
      }

      // Reset retry delay on success
      retryDelay = 1000;
      page++;

      if (page > 5) break; // limit for testing

    } catch (error) {
      if (error.data && error.data.error === 'tooBusy') {
        console.log(`Too busy, retrying in ${retryDelay}ms`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        retryDelay *= 2; // exponential backoff
      } else {
        console.error('Error:', error);
        throw error;
      }
    }
  }

  await client.disconnect();

  // Process results
  const count = allTransactions.length;
  if (count > 1000) {
    const prices = allTransactions.map(t => parseFloat(t.price));
    const maxPrice = Math.max(...prices);
    const minPrice = Math.min(...prices);
    const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
    console.log(`Total transactions: ${count}`);
    console.log(`Highest price: ${maxPrice}`);
    console.log(`Lowest price: ${minPrice}`);
    console.log(`Average price: ${avgPrice.toFixed(4)}`);
  } else {
    console.log(JSON.stringify(allTransactions, null, 2));
  }
}

fetchOracleTransactions().catch(console.error);
