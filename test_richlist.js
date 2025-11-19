const { Client } = require('xrpl');

async function testRichList() {
  const client = new Client('wss://s2.ripple.com');

  try {
    await client.connect();
    console.log('Connected to rich-list.info');

    // Subscribe to ledger streams
    const subscribeResponse = await client.request({ command: 'subscribe', streams: ['ledger'] });
    console.log('Subscribe response:', subscribeResponse);

    // Listen for ledger events
    client.on('ledgerClosed', (ledger) => {
      console.log('Ledger event received:', ledger);
    });

    // Request current ledger
    const ledgerResponse = await client.request({ command: 'ledger_current' });
    console.log('Ledger current response:', ledgerResponse);

    // Request ledger with transactions
    const ledgerIndex = ledgerResponse.result.ledger_current_index;
    const ledgerTxResponse = await client.request({ command: 'ledger', ledger_index: ledgerIndex, transactions: true });
    console.log('Ledger with transactions response sample:', ledgerTxResponse.result.ledger.transactions.slice(0, 2));

    // Wait a bit for events
    setTimeout(async () => {
      await client.disconnect();
      console.log('Disconnected after 60 seconds');
    }, 60000);

  } catch (err) {
    console.error('Error:', err);
  }
}

testRichList();