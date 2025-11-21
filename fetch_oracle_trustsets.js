const { Client } = require('xrpl');

async function fetchTrustSetPrices() {
  const client = new Client('wss://s1.ripple.com');
  await client.connect();
  console.log('Connected to s1.ripple.com');

  const account = 'rXUMMaPpZqPutoRszR29jtC8amWq3APkx';
  const results = [];
  let marker = null;
  let backoffDelay = 1000; // start with 1s
  let requestCount = 0;

  do {
    try {
      const request = {
        command: 'account_tx',
        account,
        ledger_index_min: 100324200,
        ledger_index_max: -1,
        forward: false,
        limit: 100
      };
      if (marker) request.marker = marker;

      const response = await client.request(request);
      requestCount++;

      // Process transactions
      for (const tx of response.result.transactions) {
        if (results.length === 0) console.log("Sample tx hash:", tx.hash, "tx_json hash:", tx.tx_json.hash);

        if (tx.tx_json.TransactionType === 'TrustSet' && tx.tx_json.LimitAmount) {
          results.push({
            price: parseFloat(tx.tx_json.LimitAmount.value),
            hash: tx.tx_json.hash,
            ledger_index: tx.tx_json.ledger_index
          });
        }
      }

      marker = response.result.marker;

      // Rate limiting: 200ms delay
      if (marker) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      // Reset backoff on success
      backoffDelay = 1000;

    } catch (error) {
      console.error('Error:', error.message);
      if (error.message.includes('tooBusy')) {
        console.log(`Too busy, backing off for ${backoffDelay}ms`);
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
        backoffDelay *= 2; // exponential backoff
      } else {
        throw error;
      }
    }
  } while (marker);

  await client.disconnect();
  console.log(`Total requests: ${requestCount}`);
  return results;
}

async function main() {
  try {
    const prices = await fetchTrustSetPrices();
    console.log(`Total TrustSet transactions: ${prices.length}`);

    if (prices.length > 1000) {
      const sortedPrices = prices.sort((a, b) => a.price - b.price);
      const minPrice = sortedPrices[0].price;
      const maxPrice = sortedPrices[sortedPrices.length - 1].price;
      const first5 = prices.slice(0, 5);
      const last5 = prices.slice(-5);

      console.log(`Count: ${prices.length}`);
      console.log(`Min price: ${minPrice}`);
      console.log(`Max price: ${maxPrice}`);
      console.log('First 5:', first5);
      console.log('Last 5:', last5);
    } else {
      console.log('All prices:', prices);
    }
  } catch (error) {
    console.error('Main error:', error);
  }
}

main();
