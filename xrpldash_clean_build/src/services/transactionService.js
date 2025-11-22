const { safeParseXRP } = require('../utils/xrplUtils');

/**
 * Safely processes an XRPL transaction object to extract display-friendly fields.
 * @param {object} tx - The transaction JSON object from XRPL.
 * @returns {object|null} Processed transaction data or null on error.
 */
function safelyProcessTransaction(tx) {
  try {
    if (!tx || typeof tx !== 'object') {
      console.error('Invalid transaction object provided');
      return null;
    }

    const txJson = tx.tx_json;

    let from = txJson.Account || 'N/A';
    let to = txJson.Destination || 'N/A';
    let type = txJson.TransactionType || 'Unknown';
    let currency = 'N/A';
    let amount = 'N/A';

    const transactionHandlers = {
      Payment: (txJson) => {
        if (typeof txJson.Amount === 'string') {
          currency = 'XRP';
          amount = `${safeParseXRP(txJson.Amount).toFixed(6)} XRP`;
        } else if (txJson.Amount && typeof txJson.Amount === 'object') {
          currency = txJson.Amount.currency || 'Unknown';
          amount = `${txJson.Amount.value || 0} ${currency}`;
        }
      },
      TrustSet: (txJson) => {
        if (txJson.LimitAmount) {
          currency = txJson.LimitAmount.currency || 'Unknown';
          amount = txJson.LimitAmount.value || '0';
          to = txJson.LimitAmount.issuer || 'N/A';
        }
      },
      OfferCreate: (txJson) => {
        // For offers, show TakerPays as the amount being offered
        if (txJson.TakerPays && typeof txJson.TakerPays === 'object') {
          currency = txJson.TakerPays.currency || 'XRP';
          amount = txJson.TakerPays.value || (typeof txJson.TakerPays === 'string' ? `${safeParseXRP(txJson.TakerPays).toFixed(6)} XRP` : 'N/A');
        } else if (typeof txJson.TakerPays === 'string') {
          currency = 'XRP';
          amount = `${safeParseXRP(txJson.TakerPays).toFixed(6)} XRP`;
        }
      },
      OfferCancel: (txJson) => {
        currency = 'N/A';
        amount = `Offer Sequence: ${txJson.OfferSequence || 'Unknown'}`;
      },
      AccountSet: (txJson) => {
        currency = 'N/A';
        amount = 'Account Settings';
      },
      default: (txJson) => {
        // For other transaction types, try to extract any amount-like field
        if (txJson.Amount && typeof txJson.Amount === 'string') {
          currency = 'XRP';
          amount = `${safeParseXRP(txJson.Amount).toFixed(6)} XRP`;
        } else if (txJson.Amount && typeof txJson.Amount === 'object') {
          currency = txJson.Amount.currency || 'Unknown';
          amount = `${txJson.Amount.value || 0} ${currency}`;
        }
      }
    };

    const handler = transactionHandlers[txJson.TransactionType] || transactionHandlers.default;
    handler(txJson);

    return {
      from,
      to,
      type,
      currency,
      amount
    };
  } catch (error) {
    console.error('Transaction processing error:', error);
    return null;
  }
}

module.exports = {
  safelyProcessTransaction
};