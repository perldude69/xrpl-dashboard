const { getLatestPrice } = require('../models/priceModel');

const XRP_DROPS_PER_XRP = 1000000;

/**
 * Safely parses an XRP amount in drops and converts to XRP string.
 * @param {string|number} amountStr - The amount in drops.
 * @returns {number} The amount in XRP, or 0 if invalid.
 */
function safeParseXRP(amountStr) {
  const parsed = parseInt(amountStr, 10);
  return isNaN(parsed) ? 0 : parsed / XRP_DROPS_PER_XRP;
}

/**
 * Emits ledger information to all connected clients
 * @param {object} io - Socket.IO instance
 * @param {object} ledger - Ledger data from XRPL
 * @param {number} xrpPayments - Number of XRP payments in the ledger
 * @param {number} totalBurned - Total XRP burned in the ledger
 */
function emitLedgerInfo(io, ledger, xrpPayments = 0, totalBurned = 0) {
  getLatestPrice((err, price) => {
    io.emit('ledgerInfo', {
      ledger: ledger.ledger_index,
      txCount: ledger.txn_count || 0,
      xrpPayments,
      totalXRP: 0,
      totalBurned,
      latestPrice: price
    });
  });
}

module.exports = {
  safeParseXRP,
  emitLedgerInfo,
  XRP_DROPS_PER_XRP
};