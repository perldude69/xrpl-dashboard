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

          // XRP Payments: robust extraction of delivered_amount
          const shouldLog = process.env.DEBUG_PANEL_XRP === '1' || process.env.DEBUG_PANEL_XRP === 'true';
          if (panel.currency === 'XRP' &&
              txJson.TransactionType === 'Payment' && tx.meta && tx.meta.delivered_amount) {
            let computed = null;
            const da = tx.meta.delivered_amount;
            if (typeof da === 'string') {
              // drops string to XRP
              const v = parseFloat(da);
              if (!Number.isNaN(v)) computed = v / 1000000;
            } else if (typeof da === 'object' && da.currency === 'XRP' && da.value !== undefined) {
              const v = parseFloat(da.value);
              if (!Number.isNaN(v)) computed = v;
            }
            // Fallback: try Amount reason if delivered_amount isn’t usable
            if (computed === null) {
              const amt = txJson.Amount;
              if (typeof amt === 'string') {
                const v = parseFloat(amt);
                if (!Number.isNaN(v)) computed = v / 1000000;
              } else if (amt && typeof amt === 'object') {
                if (amt.currency === 'XRP' && amt.value !== undefined) {
                  const v = parseFloat(amt.value);
                  if (!Number.isNaN(v)) computed = v;
                }
              }
            }
            if (computed !== null) {
              amount = computed;
              matches = amount > panel.limit;
              if (shouldLog) {
                console.log(`[DEBUG XRP PANEL] Panel ${panel.id}: ledger=${txJson.ledger_index || tx.ledger_index}, sender=${txJson.Account}, amount=${amount}`);
              }
            }
          }

          // Fallbacks for non-XRP or alternative delivered_amount representations
          if (!matches && panel.currency !== 'XRP' && tx.meta && tx.meta.delivered_amount) {
            if (typeof tx.meta.delivered_amount === 'object') {
              if (tx.meta.delivered_amount.currency === panel.currency &&
                  (!panel.issuer || tx.meta.delivered_amount.issuer === panel.issuer)) {
                amount = parseFloat(tx.meta.delivered_amount.value);
                matches = amount > panel.limit;
              }
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