const fs = require('fs');

// Mock fs
jest.mock('fs', () => ({
  readFileSync: jest.fn(),
  writeFileSync: jest.fn()
}));

let mockDb = {
  serialize: jest.fn((cb) => cb()),
  run: jest.fn(),
  close: jest.fn()
};

// Mock sqlite3
jest.mock('sqlite3', () => ({
  verbose: () => ({
    Database: jest.fn(() => mockDb)
  })
}));

const { parseCSV } = require('../fetch_prices');

describe('fetch_prices.js', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should parse CSV and insert prices', () => {
    const csvData = 'time,PriceUSD\n2023-01-01,10.5\n2023-01-02,11.0\n';
    fs.readFileSync.mockReturnValue(csvData);

    require('../fetch_prices').parseCSV();

    expect(fs.readFileSync).toHaveBeenCalledWith('xrp_prices.csv', 'utf8');
    expect(mockDb.run).toHaveBeenCalledTimes(2);
    expect(mockDb.run).toHaveBeenCalledWith('INSERT OR IGNORE INTO xrp_price (price, time, ledger) VALUES (?, ?, ?)', [10.5, '2023-01-01T00:00:00.000Z', 0], expect.any(Function));
    expect(mockDb.run).toHaveBeenCalledWith('INSERT OR IGNORE INTO xrp_price (price, time, ledger) VALUES (?, ?, ?)', [11.0, '2023-01-02T00:00:00.000Z', 0], expect.any(Function));
  });

  test('should skip empty price values', () => {
    const csvData = 'time,PriceUSD\n2023-01-01,\n2023-01-02,12.0\n';
    fs.readFileSync.mockReturnValue(csvData);

    require('../fetch_prices').parseCSV();

    expect(mockDb.run).toHaveBeenCalledTimes(1);
    expect(mockDb.run).toHaveBeenCalledWith('INSERT OR IGNORE INTO xrp_price (price, time, ledger) VALUES (?, ?, ?)', [12.0, '2023-01-02T00:00:00.000Z', 0], expect.any(Function));
  });

  test('should handle CSV parsing errors gracefully', () => {
    const csvData = 'time,PriceUSD\n2023-01-01,invalid_price\n';
    fs.readFileSync.mockReturnValue(csvData);

    require('../fetch_prices').parseCSV();

    expect(mockDb.run).not.toHaveBeenCalled();
  });
});
