// Mock xrpl to prevent async connect in xrpl.js
jest.mock('xrpl', () => ({
  Client: jest.fn(() => ({
    connect: jest.fn(() => Promise.resolve()),
    request: jest.fn(),
    on: jest.fn(),
    disconnect: jest.fn()
  }))
}));

const { safelyProcessTransaction } = require('../src/services/transactionService');

describe('index.js', () => {
  describe('safelyProcessTransaction', () => {
    test('should return null for invalid transaction', () => {
      expect(safelyProcessTransaction(null)).toBeNull();
      expect(safelyProcessTransaction(undefined)).toBeNull();
      expect(safelyProcessTransaction({})).toBeNull();
      expect(safelyProcessTransaction('invalid')).toBeNull();
    });

    test('should process Payment transaction with XRP amount', () => {
      const tx = {
        tx_json: {
          Account: 'rTest1',
          Destination: 'rTest2',
          TransactionType: 'Payment',
          Amount: '1000000' // 1 XRP
        }
      };

      const result = safelyProcessTransaction(tx);
      expect(result).toEqual({
        from: 'rTest1',
        to: 'rTest2',
        type: 'Payment',
        currency: 'XRP',
        amount: '1.000000 XRP'
      });
    });

    test('should process Payment transaction with IOU amount', () => {
      const tx = {
        tx_json: {
          Account: 'rTest1',
          Destination: 'rTest2',
          TransactionType: 'Payment',
          Amount: {
            currency: 'USD',
            value: '100',
            issuer: 'rIssuer'
          }
        }
      };

      const result = safelyProcessTransaction(tx);
      expect(result).toEqual({
        from: 'rTest1',
        to: 'rTest2',
        type: 'Payment',
        currency: 'USD',
        amount: '100 USD'
      });
    });

    test('should process TrustSet transaction', () => {
      const tx = {
        tx_json: {
          Account: 'rTest1',
          TransactionType: 'TrustSet',
          LimitAmount: {
            currency: 'USD',
            value: '1000',
            issuer: 'rIssuer'
          }
        }
      };

      const result = safelyProcessTransaction(tx);
      expect(result).toEqual({
        from: 'rTest1',
        to: 'rIssuer',
        type: 'TrustSet',
        currency: 'USD',
        amount: '1000'
      });
    });

    test('should process OfferCreate transaction with TakerPays object', () => {
      const tx = {
        tx_json: {
          Account: 'rTest1',
          TransactionType: 'OfferCreate',
          TakerPays: {
            currency: 'USD',
            value: '500'
          }
        }
      };

      const result = safelyProcessTransaction(tx);
      expect(result).toEqual({
        from: 'rTest1',
        to: 'N/A',
        type: 'OfferCreate',
        currency: 'USD',
        amount: '500'
      });
    });

    test('should process OfferCreate transaction with TakerPays string', () => {
      const tx = {
        tx_json: {
          Account: 'rTest1',
          TransactionType: 'OfferCreate',
          TakerPays: '2000000' // 2 XRP
        }
      };

      const result = safelyProcessTransaction(tx);
      expect(result).toEqual({
        from: 'rTest1',
        to: 'N/A',
        type: 'OfferCreate',
        currency: 'XRP',
        amount: '2.000000 XRP'
      });
    });

    test('should process OfferCancel transaction', () => {
      const tx = {
        tx_json: {
          Account: 'rTest1',
          TransactionType: 'OfferCancel',
          OfferSequence: 123
        }
      };

      const result = safelyProcessTransaction(tx);
      expect(result).toEqual({
        from: 'rTest1',
        to: 'N/A',
        type: 'OfferCancel',
        currency: 'N/A',
        amount: 'Offer Sequence: 123'
      });
    });

    test('should process AccountSet transaction', () => {
      const tx = {
        tx_json: {
          Account: 'rTest1',
          TransactionType: 'AccountSet'
        }
      };

      const result = safelyProcessTransaction(tx);
      expect(result).toEqual({
        from: 'rTest1',
        to: 'N/A',
        type: 'AccountSet',
        currency: 'N/A',
        amount: 'Account Settings'
      });
    });

    test('should handle unknown transaction type with Amount string', () => {
      const tx = {
        tx_json: {
          Account: 'rTest1',
          Destination: 'rTest2',
          TransactionType: 'UnknownType',
          Amount: '500000' // 0.5 XRP
        }
      };

      const result = safelyProcessTransaction(tx);
      expect(result).toEqual({
        from: 'rTest1',
        to: 'rTest2',
        type: 'UnknownType',
        currency: 'XRP',
        amount: '0.500000 XRP'
      });
    });

    test('should handle unknown transaction type with Amount object', () => {
      const tx = {
        tx_json: {
          Account: 'rTest1',
          Destination: 'rTest2',
          TransactionType: 'UnknownType',
          Amount: {
            currency: 'EUR',
            value: '200'
          }
        }
      };

      const result = safelyProcessTransaction(tx);
      expect(result).toEqual({
        from: 'rTest1',
        to: 'rTest2',
        type: 'UnknownType',
        currency: 'EUR',
        amount: '200 EUR'
      });
    });

    test('should handle missing fields gracefully', () => {
      const tx = {
        tx_json: {
          TransactionType: 'Payment'
        }
      };

      const result = safelyProcessTransaction(tx);
      expect(result).toEqual({
        from: 'N/A',
        to: 'N/A',
        type: 'Payment',
        currency: 'N/A',
        amount: 'N/A'
      });
    });

    test('should handle transaction processing error', () => {
      const tx = {
        tx_json: null // This will cause an error
      };

      const result = safelyProcessTransaction(tx);
      expect(result).toBeNull();
    });
  });
});