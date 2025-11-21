const { Client } = require('xrpl');

// Mock xrpl Client
let mockClient = {
  connect: jest.fn().mockResolvedValue(),
  disconnect: jest.fn().mockResolvedValue(),
  request: jest.fn()
};

jest.mock('xrpl', () => ({
  Client: jest.fn().mockImplementation(() => mockClient)
}));

const mockDb = {
  run: jest.fn((query, params, callback) => {
    if (callback) callback();
  }),
  serialize: jest.fn((cb) => cb())
};

// Mock sqlite3
jest.mock('sqlite3', () => ({
  verbose: () => ({
    Database: jest.fn(() => mockDb)
  })
}));

const { populateDB } = require('../populate_db');

describe('populate_db.js', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient = new Client();
  });

  describe('parsePriceFromTx', () => {
    // The parsePriceFromTx function is defined inside populateDB, so we need to test it indirectly
    // or extract it. For now, we'll test through populateDB behavior.
  });

  describe('populateDB', () => {
    test('should populate database with price data', async () => {
      // Mock the request with marker and transactions
      mockClient.request.mockResolvedValue({
        result: {
          transactions: [
            {
              tx_json: {
                TransactionType: 'TrustSet',
                LimitAmount: { value: '10.5' },
                ledger_index: 100
              },
              ledger_index: 100,
              close_time_human: '2023-01-01T00:00:00.000Z'
            }
          ],
          marker: null // End the loop
        }
      });

      await populateDB();

      expect(mockClient.connect).toHaveBeenCalled();
      expect(mockClient.request).toHaveBeenCalledWith({
        command: 'account_tx',
        account: 'rXUMMaPpZqPutoRszR29jtC8amWq3APkx',
        limit: 400,
        forward: false,
        marker: {"ledger":99722300,"seq":34}
      });
      expect(mockDb.run).toHaveBeenCalledWith(
        'INSERT INTO xrp_price (price, time, ledger) VALUES (?, ?, ?)',
        [10.5, '2023-01-01T00:00:00.000Z', 100],
        expect.any(Function)
      );
      expect(mockClient.disconnect).toHaveBeenCalled();
    });

    test('should handle OfferCreate transactions', async () => {
      mockClient.request.mockResolvedValue({
        result: {
          transactions: [
            {
              tx_json: {
                TransactionType: 'OfferCreate',
                TakerPays: '1000000', // 1 XRP
                TakerGets: { currency: 'USD', value: '10' },
                ledger_index: 101
              },
              ledger_index: 101,
              close_time_human: '2023-01-02T00:00:00.000Z'
            }
          ],
          marker: null
        }
      });

      await populateDB();

      expect(mockDb.run).toHaveBeenCalledWith(
        'INSERT INTO xrp_price (price, time, ledger) VALUES (?, ?, ?)',
        [10, '2023-01-02T00:00:00.000Z', 101], // 10 USD / 1 XRP = 10
        expect.any(Function)
      );
    });

    test('should parse price from memos', async () => {
      mockClient.request.mockResolvedValue({
        result: {
          transactions: [
            {
              tx_json: {
                TransactionType: 'Payment',
                Memos: [
                  {
                    Memo: {
                      MemoType: '7072696365', // 'price' in hex
                      MemoData: Buffer.from('12.34').toString('hex')
                    }
                  }
                ],
                ledger_index: 102
              },
              ledger_index: 102,
              close_time_human: '2023-01-03T00:00:00.000Z'
            }
          ],
          marker: null
        }
      });

      await populateDB();

      expect(mockDb.run).toHaveBeenCalledWith(
        'INSERT INTO xrp_price (price, time, ledger) VALUES (?, ?, ?)',
        [12.34, '2023-01-03T00:00:00.000Z', 102],
        expect.any(Function)
      );
    });

    test('should handle request errors', async () => {
      mockClient.request.mockRejectedValue(new Error('Request failed'));

      // Should not throw, just log error and continue
      await expect(populateDB()).resolves.toBeUndefined();
    });

    test('should handle database insert errors', async () => {
      mockClient.request.mockResolvedValue({
        result: {
          transactions: [
            {
              tx_json: {
                TransactionType: 'TrustSet',
                LimitAmount: { value: '10.5' },
                ledger_index: 100
              },
              ledger_index: 100,
              close_time_human: '2023-01-01T00:00:00.000Z'
            }
          ],
          marker: null
        }
      });

      mockDb.run.mockImplementation((query, params, callback) => {
        callback(new Error('Insert failed'));
      });

      // Should not throw, just log error
      await expect(populateDB()).resolves.toBeUndefined();
    });
  });
});