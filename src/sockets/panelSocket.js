function setupPanelSocket(io, filters) {
  io.on('connection', (socket) => {
    socket.on('updatePanels', (panels) => {
      console.log('Received updatePanels:', panels);
      // Store panels for this socket
      socket.panels = panels;
    });
  });

  // Transaction handler for panel events
  function handleTransaction(tx) {
    const txJson = tx.tx_json;
    // Emit panel events if any sockets have panels
    io.sockets.sockets.forEach(socket => {
      if (socket.panels) {
        socket.panels.forEach(panel => {
          let amount = 0;
          let matches = false;

          if (panel.currency === 'XRP' &&
              txJson.TransactionType === 'Payment' &&
              tx.meta && tx.meta.delivered_amount &&
              typeof tx.meta.delivered_amount === 'string') {
            amount = parseInt(tx.meta.delivered_amount) / 1000000;
            matches = amount > panel.limit;
          } else if (tx.meta && tx.meta.delivered_amount &&
                      typeof tx.meta.delivered_amount === 'object') {
            if (tx.meta.delivered_amount.currency === panel.currency &&
                (!panel.issuer || tx.meta.delivered_amount.issuer === panel.issuer)) {
              amount = parseFloat(tx.meta.delivered_amount.value);
              matches = amount > panel.limit;
            }
          }

          if (matches) {
            socket.emit('panelTransaction:' + panel.id, {
              ledger: txJson.ledger_index || tx.ledger_index,
              sender: txJson.Account,
              receiver: txJson.Destination,
              amount,
              timestamp: new Date().toISOString()
            });
          }
        });

      }
    });
  }

  return { handleTransaction };
}

module.exports = { setupPanelSocket };