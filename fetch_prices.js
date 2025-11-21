const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('xrp_prices.db');

function parseCSV() {
  const csv = fs.readFileSync('xrp_prices.csv', 'utf8');
  const lines = csv.split('\n');
  const header = lines[0].split(',');
  const priceIndex = header.indexOf('PriceUSD');
  const timeIndex = header.indexOf('time');

  let inserted = 0;
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    if (cols[priceIndex] && cols[priceIndex] !== '') {
      const price = parseFloat(cols[priceIndex]);
      if (!isNaN(price) && price > 0) {
        const time = cols[timeIndex] + 'T00:00:00.000Z'; // assume midnight
        db.run('INSERT OR IGNORE INTO xrp_price (price, time, ledger) VALUES (?, ?, ?)', [price, time, 0], function(err) {
          if (err) console.error('Insert error:', err);
          else inserted++;
        });
      }
    }
  }

  console.log(`Inserted ${inserted} prices from CSV`);
  db.close();
}

function loadPrices() {
  db.serialize(() => {
    parseCSV();
  });
}

module.exports = { parseCSV, loadPrices };