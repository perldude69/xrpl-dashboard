const { setupLedgerSocket } = require('./ledgerSocket');
const { setupWalletSocket } = require('./walletSocket');
const { setupPanelSocket } = require('./panelSocket');

function setupSockets(io, userData, filters) {
  setupLedgerSocket(io);
  setupWalletSocket(io, userData);
  const { handleTransaction: handlePanelTransaction } = setupPanelSocket(io, filters);

  return { handlePanelTransaction };
}

module.exports = { setupSockets };