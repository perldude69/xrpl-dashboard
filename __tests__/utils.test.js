// Mock the models module
jest.mock('../src/models/priceModel', () => ({
  getLatestPrice: jest.fn()
}));

const { safeParseXRP, emitLedgerInfo, XRP_DROPS_PER_XRP } = require('../src/utils/xrplUtils');
const { getLatestPrice } = require('../src/models/priceModel');

describe('xrplUtils.js', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('safeParseXRP', () => {
    test('should parse valid string amount', () => {
      expect(safeParseXRP('1000000')).toBe(1);
      expect(safeParseXRP('500000')).toBe(0.5);
      expect(safeParseXRP('0')).toBe(0);
    });

    test('should parse valid number amount', () => {
      expect(safeParseXRP(1000000)).toBe(1);
      expect(safeParseXRP(500000)).toBe(0.5);
    });

    test('should return 0 for invalid input', () => {
      expect(safeParseXRP('invalid')).toBe(0);
      expect(safeParseXRP(null)).toBe(0);
      expect(safeParseXRP(undefined)).toBe(0);
      expect(safeParseXRP('')).toBe(0);
      expect(utils.safeParseXRP(NaN)).toBe(0);
    });
  });

  describe('emitLedgerInfo', () => {
    let mockIo;

    beforeEach(() => {
      mockIo = {
        emit: jest.fn()
      };
    });

    test('should emit ledger info with price', () => {
      const ledger = { ledger_index: 123, txn_count: 10 };
      getLatestPrice.mockImplementation((callback) => {
        callback(null, 12.34);
      });

      emitLedgerInfo(mockIo, ledger, 5, 100.5);

      expect(getLatestPrice).toHaveBeenCalledWith(expect.any(Function));
      expect(mockIo.emit).toHaveBeenCalledWith('ledgerInfo', {
        ledger: 123,
        txCount: 10,
        xrpPayments: 5,
        totalXRP: 0,
        totalBurned: 100.5,
        latestPrice: 12.34
      });
    });

    test('should emit ledger info without price when error', () => {
      const ledger = { ledger_index: 456, txn_count: 20 };
      getLatestPrice.mockImplementation((callback) => {
        callback(new Error('DB error'), null);
      });

      emitLedgerInfo(mockIo, ledger, 0, 0);

      expect(mockIo.emit).toHaveBeenCalledWith('ledgerInfo', {
        ledger: 456,
        txCount: 20,
        xrpPayments: 0,
        totalXRP: 0,
        totalBurned: 0,
        latestPrice: null
      });
    });

    test('should use default values for optional parameters', () => {
      const ledger = { ledger_index: 789 };
      getLatestPrice.mockImplementation((callback) => {
        callback(null, null);
      });

      emitLedgerInfo(mockIo, ledger);

      expect(mockIo.emit).toHaveBeenCalledWith('ledgerInfo', {
        ledger: 789,
        txCount: 0,
        xrpPayments: 0,
        totalXRP: 0,
        totalBurned: 0,
        latestPrice: null
      });
    });
  });
});