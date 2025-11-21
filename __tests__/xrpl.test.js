const { Client } = require('xrpl');

// Mock xrpl Client
jest.mock('xrpl', () => ({
  Client: jest.fn().mockImplementation(() => ({
    connect: jest.fn(() => new Promise(() => {})), // Never resolve to prevent .then
    disconnect: jest.fn(),
    request: jest.fn(() => new Promise(() => {})), // Never resolve to prevent .then
    on: jest.fn(),
    isConnected: jest.fn().mockReturnValue(true)
  }))
}));

// Mock models
jest.mock('../src/models/priceModel', () => ({
  insertPrice: jest.fn(),
  getLatestPrice: jest.fn()
}));

const priceService = require('../src/services/priceService');
const { insertPrice, getLatestPrice } = require('../src/models/priceModel');

describe('priceService.js', () => {
  let mockIo;

  beforeEach(() => {
    jest.clearAllMocks();
    mockIo = {
      emit: jest.fn(),
      sockets: {
        sockets: new Map()
      }
    };
  });

  describe('emitPriceUpdateInternal', () => {
    beforeEach(() => {
      // Reset module state
      priceService.setTestIO(mockIo);
      priceService.setTestPriceEmitter(null);
    });

    test('should emit price update for valid price', () => {
      priceService.emitPriceUpdateInternal(12.34, 123);

      expect(mockIo.emit).toHaveBeenCalledWith('priceUpdate', 12.34);
      expect(mockIo.emit).toHaveBeenCalledWith('priceUpdateMeta', {
        price: 12.34,
        source: 'oracle',
        timestamp: expect.any(String),
        ledger: 123
      });
      expect(insertPrice).toHaveBeenCalledWith(12.34, expect.any(String), 123);
    });

    test('should not emit for invalid price', () => {
      priceService.emitPriceUpdateInternal(null, 123);
      priceService.emitPriceUpdateInternal(0, 123);
      priceService.emitPriceUpdateInternal(-1, 123);

      expect(mockIo.emit).not.toHaveBeenCalled();
      expect(insertPrice).not.toHaveBeenCalled();
    });

    test('should debounce duplicate prices', () => {
      priceService.emitPriceUpdateInternal(12.34, 123);
      priceService.emitPriceUpdateInternal(12.34, 124);

      expect(mockIo.emit).toHaveBeenCalledTimes(2); // priceUpdate and priceUpdateMeta
    });

    test('should call test price emitter if set', () => {
      const mockEmitter = jest.fn();
      priceService.setTestPriceEmitter(mockEmitter);

      priceService.emitPriceUpdateInternal(12.34, 123);

      expect(mockEmitter).toHaveBeenCalledWith(12.34);
    });
  });

  describe('backfillPrices', () => {
    beforeEach(() => {
      mockClient.request.mockResolvedValue({
        result: {
          transactions: [
            {
              tx_json: {
                TransactionType: 'TrustSet',
                Account: 'rXUMMaPpZqPutoRszR29jtC8amWq3APkx',
                LimitAmount: { currency: 'USD', value: '11.50' }
              },
              close_time_iso: '2023-01-01T00:00:00Z'
            }
          ]
        }
      });
    });

    test('should request account_tx and insert prices', async () => {
      await priceService.backfillPrices(mockClient);

      expect(mockClient.request).toHaveBeenCalledWith({
        command: 'account_tx',
        account: 'rXUMMaPpZqPutoRszR29jtC8amWq3APkx',
        limit: 100,
        forward: false
      });
      expect(insertPrice).toHaveBeenCalledWith(11.5, '2023-01-01T00:00:00.000Z', undefined);
    });

    test('should handle request error', async () => {
      mockClient.request.mockRejectedValue(new Error('Request failed'));

      await expect(priceService.backfillPrices(mockClient)).resolves.toBeUndefined();
    });
  });

  describe('pollOraclePrice', () => {
    beforeEach(() => {
      mockClient.isConnected.mockReturnValue(true);
      mockClient.request.mockResolvedValue({
        result: {
          transactions: [
            {
              tx: {
                ledger_index: 123,
                TransactionType: 'TrustSet',
                Account: 'rXUMMaPpZqPutoRszR29jtC8amWq3APkx',
                LimitAmount: { currency: 'USD', value: '12.00' }
              },
              close_time_human: '2023-01-01T00:00:00Z'
            }
          ]
        }
      });
      getLatestPrice.mockResolvedValue(10.00);
    });

    test('should poll and insert new price', async () => {
      await priceService.pollOraclePrice(mockClient, mockIo);

      expect(mockClient.request).toHaveBeenCalledWith({
        command: 'account_tx',
        account: 'rXUMMaPpZqPutoRszR29jtC8amWq3APkx',
        limit: 1,
        forward: false
      });
      expect(getLatestPrice).toHaveBeenCalled();
      expect(insertPrice).toHaveBeenCalledWith(12, expect.any(String), 123);
    });

    test('should not insert if price not significantly different', async () => {
      getLatestPrice.mockResolvedValue(12.0001);

      await priceService.pollOraclePrice(mockClient, mockIo);

      expect(insertPrice).not.toHaveBeenCalled();
    });
      expect(insertPrice).toHaveBeenCalledWith(12.34, expect.any(String), 123);
    });

    test('should not emit for invalid price', () => {
      xrplModule.emitPriceUpdateInternal(0, 123);
      xrplModule.emitPriceUpdateInternal(-1, 123);
      xrplModule.emitPriceUpdateInternal(NaN, 123);

      expect(mockIo.emit).not.toHaveBeenCalled();
    });

    test('should debounce duplicate prices', () => {
      xrplModule.emitPriceUpdateInternal(10.0, 123);
      xrplModule.emitPriceUpdateInternal(10.0, 124); // Same price, should be debounced

      expect(mockIo.emit).toHaveBeenCalledTimes(2); // Only first emission
    });

    test('should call test price emitter if set', () => {
      const mockEmitter = jest.fn();
      xrplModule.setTestPriceEmitter(mockEmitter);

      xrplModule.emitPriceUpdateInternal(15.0, 125);

      expect(mockEmitter).toHaveBeenCalledWith(15.0);
    });
  });

  // parsePriceFromTx is tested indirectly through backfillPrices and pollOraclePrice

  describe('backfillPrices', () => {
    test('should request account_tx and insert prices', async () => {
      mockClient.request.mockResolvedValue({
        result: {
          transactions: [
            {
              tx_json: {
                TransactionType: 'TrustSet',
                Account: 'rXUMMaPpZqPutoRszR29jtC8amWq3APkx',
                LimitAmount: { currency: 'USD', value: '10.0' },
                ledger_index: 100
              },
              close_time_iso: '2023-01-01T00:00:00.000Z'
            }
          ]
        }
      });

      priceService.backfillPrices(mockClient);

      await new Promise(resolve => setTimeout(resolve, 0)); // Wait for async

      expect(mockClient.request).toHaveBeenCalledWith({
        command: 'account_tx',
        account: 'rXUMMaPpZqPutoRszR29jtC8amWq3APkx',
        limit: 100,
        forward: false
      });
      expect(insertPrice).toHaveBeenCalledWith(10.0, '2023-01-01T00:00:00.000Z', 100);
    });

    test('should handle request error', async () => {
      mockClient.request.mockRejectedValue(new Error('Request failed'));

      priceService.backfillPrices(mockClient);

      await new Promise(resolve => setTimeout(resolve, 0));

      // Should not throw, just log error
      expect(mockClient.request).toHaveBeenCalled();
    });
  });

  describe('pollOraclePrice', () => {
    test('should poll and insert new price', async () => {
      mockClient.request.mockResolvedValue({
        result: {
          transactions: [
            {
              tx: {
                TransactionType: 'TrustSet',
                Account: 'rXUMMaPpZqPutoRszR29jtC8amWq3APkx',
                LimitAmount: { currency: 'USD', value: '11.0' },
                ledger_index: 200
              },
              close_time_human: '2023-01-02T00:00:00.000Z'
            }
          ]
        }
      });

      getLatestPrice.mockImplementation(cb => cb(null, 9.0));

      await priceService.pollOraclePrice(mockClient, mockIo);

      expect(mockClient.request).toHaveBeenCalledWith({
        command: 'account_tx',
        account: 'rXUMMaPpZqPutoRszR29jtC8amWq3APkx',
        limit: 1,
        forward: false
      });
      expect(insertPrice).toHaveBeenCalledWith(11.0, '2023-01-02T00:00:00.000Z', 200);
    });

    test('should not insert if price not significantly different', async () => {
      mockClient.request.mockResolvedValue({
        result: {
          transactions: [
            {
              tx: {
                TransactionType: 'TrustSet',
                Account: 'rXUMMaPpZqPutoRszR29jtC8amWq3APkx',
                LimitAmount: { currency: 'USD', value: '10.00005' },
                ledger_index: 200
              },
              close_time_human: '2023-01-02T00:00:00.000Z'
            }
          ]
        }
      });

      getLatestPrice.mockImplementation(cb => cb(null, 10.0));

      await priceService.pollOraclePrice(mockClient, mockIo);

      expect(insertPrice).not.toHaveBeenCalled();
    });
  });
});