const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('xrp_prices.db');
db.run('CREATE TABLE IF NOT EXISTS xrp_price (id INTEGER PRIMARY KEY AUTOINCREMENT, price REAL, time TEXT, ledger INTEGER)');

function getLatestPrice(callback) {
  db.get('SELECT price FROM xrp_price ORDER BY ledger DESC LIMIT 1', (err, row) => {
    callback(err, row ? row.price : null);
  });
}

function insertPrice(price, time, ledger, callback) {
  if (callback) {
    db.run('INSERT OR IGNORE INTO xrp_price (price, time, ledger) VALUES (?, ?, ?)', [price, time, ledger], function(err) {
      callback(err, this.changes > 0);
    });
  } else {
    db.run('INSERT OR IGNORE INTO xrp_price (price, time, ledger) VALUES (?, ?, ?)', [price, time, ledger]);
  }
}

function hasHistoricalData(callback) {
  db.get('SELECT COUNT(*) as count FROM xrp_price WHERE ledger > 0', (err, row) => {
    callback(err, row ? row.count > 0 : false);
  });
}

function getGraphData(period, interval, callback) {
  let startDate = null;
  if (period !== 'all') {
    const days = parseInt(period);
    startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  }
  const intervalSeconds = {
    '1m': 60,
    '1h': 3600,
    '4h': 14400,
    '12h': 43200,
    '1d': 86400
  }[interval] || 14400;
  let query = `
    SELECT
      datetime((strftime('%s', time) / ${intervalSeconds}) * ${intervalSeconds}, 'unixepoch') as label,
      AVG(price) as avg_price
    FROM xrp_price
  `;
  const params = [];
  if (startDate) {
    query += ' WHERE time >= ?';
    params.push(startDate);
  }
  query += ` GROUP BY (strftime('%s', time) / ${intervalSeconds}) ORDER BY label`;
  db.all(query, params, (err, rows) => {
    if (err) {
      callback(err, null);
    } else {
      const labels = rows.map(r => r.label);
      const prices = rows.map(r => r.avg_price);
      getLatestPrice((err2, latestPrice) => {
        callback(null, { labels, prices, latestPrice });
      });
    }
  });
}

module.exports = {
  getLatestPrice,
  insertPrice,
  getGraphData,
  hasHistoricalData
};