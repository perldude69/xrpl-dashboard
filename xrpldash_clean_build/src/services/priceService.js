const { ORACLE_ACCOUNT } = require('../config');
const { insertPrice, getLatestPrice } = require('../models/priceModel');

let ioInstance = null;
let testPriceEmitter = null;
let lastEmittedPrice = null;
let lastRealTimePriceEmit = 0;

function setTestIO(io) { ioInstance = io; }
function setTestPriceEmitter(fn) { testPriceEmitter = fn; }

function emitPriceUpdateInternal(priceRaw, ledgerIndex) {
  const price = (typeof priceRaw === 'number') ? priceRaw : parseFloat(priceRaw);
  if (!Number.isFinite(price) || price <= 0) return;
  const now = Date.now();
  if (lastEmittedPrice !== null && price === lastEmittedPrice && (now - lastRealTimePriceEmit) < 1000) {
    return;
  }
  lastEmittedPrice = price;
  lastRealTimePriceEmit = now;

  insertPrice(price, new Date().toISOString(), ledgerIndex);
  if (ioInstance && ioInstance.emit) {
    ioInstance.emit('priceUpdate', price);
    ioInstance.emit('priceUpdateMeta', { price, source: 'oracle', timestamp: new Date().toISOString(), ledger: ledgerIndex });
  }
  if (process.env.XRPL_PRICE_TEST) {
    console.log('[PRICE-TEST] Emitted', price, 'ledger', ledgerIndex);
  }
  if (typeof testPriceEmitter === 'function') {
    testPriceEmitter(price);
  }
}

function parsePriceFromTx(tx) {
  if (!tx.tx_json) return null;
  if (tx.tx_json.TransactionType === 'TrustSet' && tx.tx_json.LimitAmount && tx.tx_json.LimitAmount.currency === 'USD') {
    const price = parseFloat(tx.tx_json.LimitAmount.value);
    if (isNaN(price) || price <= 0) return null;
    const timestamp = tx.close_time_iso || (tx.tx_json.date ? tx.tx_json.date * 1000 + 946684800000 : null);
    if (!timestamp) return null;
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return null;
    return {
      price,
      time: date.toISOString(),
      ledger: tx.tx_json.ledger_index || tx.ledger_index
    };
  }
  return null;
}

function backfillPrices(client) {
  if (!client) return;

  client.request({
    command: 'account_tx',
    account: ORACLE_ACCOUNT,
    limit: 100,
    forward: false
  }).then((response) => {
    for (const tx of response.result.transactions) {
      if (tx.tx_json) {
        const price = parsePriceFromTx(tx);
        if (price) {
          insertPrice(price.price, price.time, price.ledger);
        }
      }
    }
  }).catch((err) => {
    console.error('Backfill prices error:', err);
  });
}

async function pollOraclePrice(client, io) {
  if (!client || !client.isConnected()) return;
  try {
    const response = await client.request({
      command: 'account_tx',
      account: ORACLE_ACCOUNT,
      limit: 1,
      forward: false
     });

    const tx = response.result.transactions[0];
    if (tx && tx.tx) {
      const priceData = parsePriceFromTx({ tx_json: tx.tx, close_time_iso: tx.close_time_human, ledger_index: tx.tx.ledger_index });
      if (priceData) {
        getLatestPrice((err, latest) => {
          if (!err && (!latest || Math.abs(priceData.price - latest) > 0.0001)) {
            insertPrice(priceData.price, priceData.time, priceData.ledger);
        if (typeof testPriceEmitter === 'function') { testPriceEmitter(priceData.price); }
            console.log('Polled new price:', priceData.price);
          }
        });
      }
    }
  } catch (err) {
    console.error('Poll oracle error:', err);
  }
}

function handleTransaction(tx) {
  // Real-time price updates
  if (tx.tx_json.TransactionType === 'TrustSet' && tx.tx_json.Account === ORACLE_ACCOUNT && tx.tx_json.LimitAmount && tx.tx_json.LimitAmount.currency === 'USD') {
    if (process.env.XRPL_PRICE_SINGLE_PATH !== 'true') {
      emitPriceUpdateInternal(tx.tx_json.LimitAmount.value, tx.tx_json.ledger_index);
    }
  }
}

module.exports = {
  setTestIO,
  setTestPriceEmitter,
  emitPriceUpdateInternal,
  parsePriceFromTx,
  backfillPrices,
  pollOraclePrice,
  handleTransaction
};