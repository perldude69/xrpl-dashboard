const { emitLedgerInfo } = require('../utils/xrplUtils');

function processLedger(client, ledger, io) {
  if (!client) return;

  client.request({
    command: 'ledger',
    ledger_index: ledger.ledger_index,
    transactions: true,
    expand: true
  }).then((ledgerData) => {
    const transactions = ledgerData.result.ledger.transactions || [];
    let xrpPayments = 0;
    let totalBurned = 0;
     transactions.forEach(tx => {
       if (tx.tx_json.TransactionType === 'Payment' && tx.tx_json.Amount && typeof tx.tx_json.Amount === 'string') {
         xrpPayments++;
       }
       // Sum fees for all transactions (fees are burned)
       totalBurned += parseInt(tx.tx_json.Fee || 0) / 1000000;  // Fee in drops to XRP
      });
      emitLedgerInfo(io, ledger, xrpPayments, totalBurned);
  }).catch((err) => {
    console.error('Ledger fetch for stats failed:', err);
    emitLedgerInfo(io, ledger);
  });
}

module.exports = {
  processLedger
};