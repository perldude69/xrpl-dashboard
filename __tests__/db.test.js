const sqlite3 = require('sqlite3').verbose();

// Mock sqlite3
jest.mock('sqlite3', () => {
  const mockDb = {
    get: jest.fn(),
    run: jest.fn(),
    all: jest.fn(),
    serialize: jest.fn((cb) => cb()),
    close: jest.fn()
  };
  return {
    verbose: () => ({
      Database: jest.fn(() => mockDb)
    })
  };
});

const { getLatestPrice, insertPrice, getGraphData, hasHistoricalData } = require('../src/models/priceModel');

describe('priceModel.js', () => {
  let mockDb;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDb = new (require('sqlite3').verbose().Database)();
  });

  describe('getLatestPrice', () => {
    test('should return price when data exists', (done) => {
      mockDb.get.mockImplementation((query, callback) => {
        callback(null, { price: 12.34 });
      });

      dbModule.getLatestPrice((err, price) => {
        expect(err).toBeNull();
        expect(price).toBe(12.34);
        expect(mockDb.get).toHaveBeenCalledWith(
          'SELECT price FROM xrp_price ORDER BY ledger DESC LIMIT 1',
          expect.any(Function)
        );
        done();
      });
    });

    test('should return null when no data exists', (done) => {
      mockDb.get.mockImplementation((query, callback) => {
        callback(null, null);
      });

      dbModule.getLatestPrice((err, price) => {
        expect(err).toBeNull();
        expect(price).toBeNull();
        done();
      });
    });

    test('should handle database error', (done) => {
      const dbError = new Error('Database error');
      mockDb.get.mockImplementation((query, callback) => {
        callback(dbError);
      });

      dbModule.getLatestPrice((err, price) => {
        expect(err).toBe(dbError);
        expect(price).toBeNull(); // db.get returns null when error
        done();
      });
    });
  });

  describe('insertPrice', () => {
    test('should insert price without callback', () => {
      dbModule.insertPrice(10.5, '2023-01-01T00:00:00Z', 123);

      expect(mockDb.run).toHaveBeenCalledWith(
        'INSERT OR IGNORE INTO xrp_price (price, time, ledger) VALUES (?, ?, ?)',
        [10.5, '2023-01-01T00:00:00Z', 123]
      );
    });

    test('should insert price with callback', (done) => {
      mockDb.run.mockImplementation((query, params, callback) => {
        callback.call({ changes: 1 }, null);
      });

      dbModule.insertPrice(10.5, '2023-01-01T00:00:00Z', 123, (err, inserted) => {
        expect(err).toBeNull();
        expect(inserted).toBe(true);
        done();
      });
    });

    test('should handle insert error', (done) => {
      const dbError = new Error('Insert error');
      mockDb.run.mockImplementation((query, params, callback) => {
        callback.call({ changes: 0 }, dbError);
      });

      dbModule.insertPrice(10.5, '2023-01-01T00:00:00Z', 123, (err, inserted) => {
        expect(err).toBe(dbError);
        expect(inserted).toBe(false);
        done();
      });
    });
  });

  describe('hasHistoricalData', () => {
    test('should return true when data exists', (done) => {
      mockDb.get.mockImplementation((query, callback) => {
        callback(null, { count: 5 });
      });

      dbModule.hasHistoricalData((err, hasData) => {
        expect(err).toBeNull();
        expect(hasData).toBe(true);
        done();
      });
    });

    test('should return false when no data exists', (done) => {
      mockDb.get.mockImplementation((query, callback) => {
        callback(null, { count: 0 });
      });

      dbModule.hasHistoricalData((err, hasData) => {
        expect(err).toBeNull();
        expect(hasData).toBe(false);
        done();
      });
    });

    test('should handle database error', (done) => {
      const dbError = new Error('Database error');
      mockDb.get.mockImplementation((query, callback) => {
        callback(dbError);
      });

      dbModule.hasHistoricalData((err, hasData) => {
        expect(err).toBe(dbError);
        expect(hasData).toBe(false);
        done();
      });
    });
  });

  describe('getGraphData', () => {
    test('should return graph data for specific period', (done) => {
      const mockRows = [
        { label: '2023-01-01T00:00:00.000Z', avg_price: 10.5 },
        { label: '2023-01-02T00:00:00.000Z', avg_price: 11.0 }
      ];

      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, mockRows);
      });

      mockDb.get.mockImplementation((query, callback) => {
        callback(null, { price: 11.0 });
      });

      dbModule.getGraphData('30d', '1d', (err, data) => {
        expect(err).toBeNull();
        expect(data).toEqual({
          labels: ['2023-01-01T00:00:00.000Z', '2023-01-02T00:00:00.000Z'],
          prices: [10.5, 11.0],
          latestPrice: 11.0
        });
        done();
      });
    });

    test('should return graph data for all period', (done) => {
      const mockRows = [
        { label: '2023-01-01T00:00:00.000Z', avg_price: 10.5 }
      ];

      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, mockRows);
      });

      mockDb.get.mockImplementation((query, callback) => {
        callback(null, { price: 10.5 });
      });

      dbModule.getGraphData('all', '1d', (err, data) => {
        expect(err).toBeNull();
        expect(data.labels).toEqual(['2023-01-01T00:00:00.000Z']);
        expect(data.prices).toEqual([10.5]);
        expect(data.latestPrice).toBe(10.5);
        done();
      });
    });

    test('should handle database error', (done) => {
      const dbError = new Error('Database error');
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(dbError);
      });

      dbModule.getGraphData('30d', '1d', (err, data) => {
        expect(err).toBe(dbError);
        expect(data).toBeNull(); // db.all returns null when error
        done();
      });
    });
  });
});