const { getClient } = require('../services/xrplClient');
const { safelyProcessTransaction } = require('../services/transactionService');

function setupLedgerSocket(io) {
  io.on('connection', (socket) => {
    socket.on('requestLedgerInspection', async () => {
      try {
        const client = getClient();
        if (!client) return;

        const ledgerData = await client.request({
          command: 'ledger',
          ledger_index: 'validated',
          transactions: true,
          expand: true
        });
        const transactions = ledgerData.result.ledger.transactions || [];
        const processedTransactions = transactions
          .map(safelyProcessTransaction)
          .filter(tx => tx !== null);

        socket.emit('inspectLedgerResponse', {
          transactions: processedTransactions
        });
      } catch (error) {
        console.error('Ledger inspection fetch failed:', error);
        socket.emit('inspectLedgerResponse', {
          transactions: [],
          message: 'Failed to fetch ledger data. Please try again.'
        });
      }
    });

    socket.on('getCurrentLedgerTransactions', async () => {
      try {
        const client = getClient();
        if (!client) return;

        const ledgerData = await client.request({
          command: 'ledger',
          ledger_index: 'validated',
          transactions: true,
          expand: true
        });
        const transactions = ledgerData.result.ledger.transactions || [];
        const processedTransactions = transactions.map(tx => {
          let amount = 'N/A';
          const type = tx.tx_json.TransactionType;
          if (type === 'Payment') {
            const amt = tx.tx_json.Amount || tx.tx_json.DeliverMax;
            if (amt) {
              if (typeof amt === 'string') {
                amount = `${parseInt(amt) / 1000000} XRP`;
              } else if (typeof amt === 'object') {
                amount = `${amt.value} ${amt.currency}`;
              }
            }
          } else if (type === 'OfferCreate') {
            const amt = tx.tx_json.TakerGets;
            if (amt) {
              if (typeof amt === 'string') {
                amount = `${parseInt(amt) / 1000000} XRP`;
              } else if (typeof amt === 'object') {
                amount = `${amt.value} ${amt.currency}`;
              }
            }
          } else if (type === 'TrustSet') {
            const amt = tx.tx_json.LimitAmount;
            if (amt && typeof amt === 'object') {
              amount = `${amt.value} ${amt.currency}`;
            }
          }
          return {
            type: type || 'Unknown',
            account: tx.tx_json.Account || 'N/A',
            amount,
            details: `${tx.tx_json.Destination || tx.tx_json.LimitAmount?.issuer || ''} Fee: ${tx.tx_json.Fee || 'N/A'}`
          };
        });
        socket.emit('currentLedgerTransactions', processedTransactions);
      } catch (error) {
        console.error('Current ledger transactions fetch failed:', error);
        socket.emit('currentLedgerTransactions', []);
      }
    });
  });
}

module.exports = { setupLedgerSocket };