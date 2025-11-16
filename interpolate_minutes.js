const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('xrp_prices.db');

db.all('SELECT DISTINCT date(time) as date, price FROM xrp_price WHERE ledger = 0 ORDER BY date', (err, rows) => {
  if (err) {
    console.error(err);
    return;
  }

  db.serialize(() => {
    let inserted = 0;
    rows.forEach(row => {
      const date = row.date;
      const price = row.price;
      const stmt = db.prepare('INSERT OR IGNORE INTO xrp_price (price, time, ledger) VALUES (?, ?, ?)');
      for (let hour = 0; hour < 24; hour++) {
        for (let minute = 0; minute < 60; minute++) {
          const time = `${date}T${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:00.000Z`;
          stmt.run(price, time, 0);
          inserted++;
        }
      }
      stmt.finalize();
    });

    console.log(`Inserted ${inserted} minute entries`);
    db.close();
  });
});