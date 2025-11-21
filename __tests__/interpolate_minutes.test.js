// Mock sqlite3
const mockStmt = {
  run: jest.fn(),
  finalize: jest.fn()
};

const mockRows = [
  { date: '2023-01-01', price: 10.5 },
  { date: '2023-01-02', price: 11.0 }
];

const mockDb = {
  all: jest.fn((query, callback) => callback(null, mockRows)),
  serialize: jest.fn((cb) => cb()),
  prepare: jest.fn(() => mockStmt),
  close: jest.fn()
};

// Mock sqlite3
jest.mock('sqlite3', () => ({
  verbose: () => ({
    Database: jest.fn(() => mockDb)
  })
}));

describe('interpolate_minutes.js', () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should interpolate minute data for each date', () => {
    require('../interpolate_minutes');

    // Should prepare statement for each date
    expect(mockDb.prepare).toHaveBeenCalledTimes(2);
    expect(mockDb.prepare).toHaveBeenCalledWith('INSERT OR IGNORE INTO xrp_price (price, time, ledger) VALUES (?, ?, ?)');

    // Should run 24 * 60 = 1440 inserts per date
    expect(mockStmt.run).toHaveBeenCalledTimes(2880); // 2 dates * 1440 minutes

    expect(mockStmt.finalize).toHaveBeenCalledTimes(2);
    expect(mockDb.close).toHaveBeenCalled();
  });

  test('should handle database error', () => {
    const dbError = new Error('Database error');
    mockDb.all.mockImplementation((query, callback) => {
      callback(dbError);
    });

    // Should not throw, just log error
    expect(() => {
      require('../interpolate_minutes');
    }).not.toThrow();
  });
});