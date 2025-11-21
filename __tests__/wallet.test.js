const { setupWalletSocket } = require('../src/sockets/walletSocket');
const { getLatestPrice } = require("../src/models/priceModel");

const mockClient = {
  connect: jest.fn().mockResolvedValue(),
  disconnect: jest.fn().mockResolvedValue(),
  request: jest.fn()
};

// Mock xrpl Client
jest.mock('xrpl', () => ({
  Client: jest.fn().mockImplementation(() => mockClient)
}));
// Mock models module
jest.mock("../src/models/priceModel", () => ({
  getLatestPrice: jest.fn()
}));

describe('walletSocket.js', () => {
  test('should export setupWalletSocket function', () => {
    expect(typeof setupWalletSocket).toBe('function');
  });

  // Note: Full testing of setupWalletSocket requires complex mocking of Socket.IO
  // The function sets up event handlers on the io object and manages userData
  // Basic functionality is tested through the export check
});

describe('setupWalletSocket', () => {
  let mockIo;
  let mockSocket;
  let userData;

  beforeEach(() => {
    getLatestPrice.mockImplementation((callback) => callback(null, 0.5));
    jest.clearAllMocks();
    userData = {};
    mockSocket = {
      id: 'testSocketId',
      on: jest.fn(),
      emit: jest.fn()
    };
    mockIo = {
      on: jest.fn()
    };
  });
    test('should set up socket event handlers', () => {
      setupWalletSocket(mockIo, userData);

      expect(mockIo.on).toHaveBeenCalledWith('connection', expect.any(Function));
    });

    test('should initialize user data on connection', () => {
      setupWalletSocket(mockIo, userData);

      const connectionCallback = mockIo.on.mock.calls.find(call => call[0] === 'connection')[1];
      connectionCallback(mockSocket);

      expect(userData[mockSocket.id]).toEqual({
        socket: mockSocket,
        addresses: [],
        nicknames: {},
        alerts: {},
        lastProcessedLedger: null
      });
    });

    test('should handle disconnect', () => {
      setupWalletSocket(mockIo, userData);

      const connectionCallback = mockIo.on.mock.calls.find(call => call[0] === 'connection')[1];
      connectionCallback(mockSocket);

      const disconnectCallback = mockSocket.on.mock.calls.find(call => call[0] === 'disconnect')[1];
      disconnectCallback();

      expect(userData[mockSocket.id]).toBeUndefined();
    });

    test('should handle updateWalletData', () => {
      setupWalletSocket(mockIo, userData);

      const connectionCallback = mockIo.on.mock.calls.find(call => call[0] === 'connection')[1];
      connectionCallback(mockSocket);

      const updateCallback = mockSocket.on.mock.calls.find(call => call[0] === 'updateWalletData')[1];
      updateCallback({ addresses: ['testAddress'] });

      expect(userData[mockSocket.id].addresses).toEqual(['testAddress']);
    });

    test('should handle setWatchedAddresses', () => {
      setupWalletSocket(mockIo, userData);

      const connectionCallback = mockIo.on.mock.calls.find(call => call[0] === 'connection')[1];
      connectionCallback(mockSocket);

      const setWatchedCallback = mockSocket.on.mock.calls.find(call => call[0] === 'setWatchedAddresses')[1];
      setWatchedCallback(['testAddress']);

      expect(userData[mockSocket.id].addresses).toEqual(['testAddress']);
    });

    test('should handle invalid address in setWatchedAddresses', () => {
      mockClient.request.mockRejectedValue(new Error('Account not found'));

      setupWalletSocket(mockIo, userData);

      const connectionCallback = mockIo.on.mock.calls.find(call => call[0] === 'connection')[1];
      connectionCallback(mockSocket);

      const setWatchedCallback = mockSocket.on.mock.calls.find(call => call[0] === 'setWatchedAddresses')[1];
      setWatchedCallback(['invalidAddress']);

      expect(userData[mockSocket.id].addresses).toEqual(['invalidAddress']);
    });

    test('should handle trackWalletActivity', () => {
      setupWalletSocket(mockIo, userData);

      const connectionCallback = mockIo.on.mock.calls.find(call => call[0] === 'connection')[1];
      connectionCallback(mockSocket);

      const trackCallback = mockSocket.on.mock.calls.find(call => call[0] === 'trackWalletActivity')[1];
      trackCallback({ addresses: ['testAddress'], minThreshold: 1 });

      expect(userData[mockSocket.id].addresses).toEqual(['testAddress']);
    });

    test('should handle exportData', () => {
      setupWalletSocket(mockIo, userData);

      const connectionCallback = mockIo.on.mock.calls.find(call => call[0] === 'connection')[1];
      connectionCallback(mockSocket);

      const exportCallback = mockSocket.on.mock.calls.find(call => call[0] === 'exportData')[1];
      exportCallback();

      expect(mockSocket.emit).toHaveBeenCalledWith('exportDataResponse', {
        addresses: [],
        nicknames: {},
        alerts: {}
      });
    });

    test('should handle importData', () => {
      setupWalletSocket(mockIo, userData);

      const connectionCallback = mockIo.on.mock.calls.find(call => call[0] === 'connection')[1];
      connectionCallback(mockSocket);

      const importCallback = mockSocket.on.mock.calls.find(call => call[0] === 'importData')[1];
      importCallback({ addresses: ['importedAddress'] });

      expect(userData[mockSocket.id].addresses).toEqual(['importedAddress']);
    });

    test('should initialize user data on connection', () => {
      wallet.handleWalletConnections(mockIo, userData);

      const connectionCallback = mockIo.on.mock.calls.find(call => call[0] === 'connection')[1];
      connectionCallback(mockSocket);

      expect(userData[mockSocket.id]).toEqual({
        socket: mockSocket,
        addresses: [],
        nicknames: {},
        alerts: {},
        lastProcessedLedger: null
      });
    });

    test('should handle disconnect', () => {
      wallet.handleWalletConnections(mockIo, userData);

      const connectionCallback = mockIo.on.mock.calls.find(call => call[0] === 'connection')[1];
      connectionCallback(mockSocket);
      userData[mockSocket.id] = { test: 'data' };

      // Simulate disconnect event
      const disconnectCallback = mockSocket.on.mock.calls.find(call => call[0] === 'disconnect')[1];
      disconnectCallback();

      expect(userData[mockSocket.id]).toBeUndefined();
    });

    test('should handle updateWalletData', () => {
      wallet.handleWalletConnections(mockIo, userData);

      const connectionCallback = mockIo.on.mock.calls.find(call => call[0] === 'connection')[1];
      connectionCallback(mockSocket);
      const newData = {
        addresses: ['rTest1'],
        nicknames: { rTest1: 'Test' }
      };

      const updateCallback = mockSocket.on.mock.calls.find(call => call[0] === 'updateWalletData')[1];
      updateCallback(newData);

      expect(userData[mockSocket.id]).toEqual({
        socket: mockSocket,
        addresses: ['rTest1'],
        nicknames: { rTest1: 'Test' },
        alerts: {},
        lastProcessedLedger: null
      });
    });

    test('should handle setWatchedAddresses', async () => {
      mockClient.request.mockResolvedValue({
        result: {
          account_data: {
            Balance: '1000000000', // 1000 XRP in drops
            Sequence: 123
          }
        }
      });

      wallet.handleWalletConnections(mockIo, userData);

      const connectionCallback = mockIo.on.mock.calls.find(call => call[0] === 'connection')[1];
      connectionCallback(mockSocket);
const setAddressesCallback = mockSocket.on.mock.calls.find(call => call[0] === "setWatchedAddresses")[1];

await setAddressesCallback(['rTest1']);

       expect(mockSocket.emit).toHaveBeenCalledWith("balances", [
         {
           address: "rTest1",
           balance: 1000,
           sequence: 123,
           usdValue: "500.00"
         }
       ]);
       expect(userData[mockSocket.id].addresses).toEqual(['rTest1']);
    });

    test('should handle invalid address in setWatchedAddresses', async () => {
      mockClient.request.mockRejectedValue(new Error('Account not found'));

      wallet.handleWalletConnections(mockIo, userData);

      const connectionCallback = mockIo.on.mock.calls.find(call => call[0] === 'connection')[1];
      connectionCallback(mockSocket);

      const setAddressesCallback = mockSocket.on.mock.calls.find(call => call[0] === 'setWatchedAddresses')[1];
      await setAddressesCallback(['invalid_address']);

expect(mockSocket.emit).toHaveBeenCalledWith("balances", [
         {
           address: "invalid_address",
           balance: "Invalid",
           sequence: null,
           usdValue: "N/A"
         }
       ]);
    });

    test('should handle trackWalletActivity', () => {
      wallet.handleWalletConnections(mockIo, userData);

      const connectionCallback = mockIo.on.mock.calls.find(call => call[0] === 'connection')[1];
      connectionCallback(mockSocket);

      const config = {
        addresses: ['rTest1', 'rTest2'],
        minThreshold: 10,
        startLedger: 1000
      };

      const trackCallback = mockSocket.on.mock.calls.find(call => call[0] === 'trackWalletActivity')[1];
      trackCallback(config);

      expect(mockSocket.emit).toHaveBeenCalledWith('walletTrackingStarted', {
        message: 'Tracking wallet activities for 2 addresses',
        addresses: ['rTest1', 'rTest2']
      });
      expect(userData[mockSocket.id].addresses).toEqual(['rTest1', 'rTest2']);
      expect(userData[mockSocket.id].lastProcessedLedger).toBe(1000);
    });

    test('should handle exportData', () => {
      wallet.handleWalletConnections(mockIo, userData);

      const connectionCallback = mockIo.on.mock.calls.find(call => call[0] === 'connection')[1];
      connectionCallback(mockSocket);
      userData[mockSocket.id] = {
        addresses: ['rTest1'],
        nicknames: { rTest1: 'Test' },
        alerts: { alert1: 'test' }
      };

      const exportCallback = mockSocket.on.mock.calls.find(call => call[0] === 'exportData')[1];
      exportCallback();

      expect(mockSocket.emit).toHaveBeenCalledWith('exportDataResponse', {
        addresses: ['rTest1'],
        nicknames: { rTest1: 'Test' },
        alerts: { alert1: 'test' }
      });
    });

    test('should handle importData', () => {
      wallet.handleWalletConnections(mockIo, userData);

      const connectionCallback = mockIo.on.mock.calls.find(call => call[0] === 'connection')[1];
      connectionCallback(mockSocket);
      const importData = {
        addresses: ['rImported'],
        nicknames: { rImported: 'Imported' },
        alerts: { alert1: 'imported' }
      };

      const importCallback = mockSocket.on.mock.calls.find(call => call[0] === 'importData')[1];
      importCallback(importData);

      expect(userData[mockSocket.id].addresses).toEqual(['rImported']);
      expect(userData[mockSocket.id].nicknames).toEqual({ rImported: 'Imported' });
      expect(userData[mockSocket.id].alerts).toEqual({ alert1: 'imported' });
      expect(mockSocket.emit).toHaveBeenCalledWith('walletData', userData[mockSocket.id]);
    });
  });