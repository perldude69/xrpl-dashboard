const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const xrpl = require('./xrpl');
const { handleWalletConnections } = require('./wallet');
const { getGraphData, getLatestPrice } = require('./db');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static('public'));

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

const userData = {};

handleWalletConnections(io, userData);

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  socket.emit('test', 'hello');

  socket.on('getLatestPrice', () => {
    getLatestPrice((err, price) => {
      if (!err && price) {
        socket.emit('latestPrice', price);
      }
    });
  });

  socket.on('getGraphData', ({ period, interval }) => {
    getGraphData(period, interval, (err, data) => {
      if (!err && data) {
        socket.emit('graphData', data);
      }
    });
  });
});

xrpl.connectToXRPL();

console.log('xrpl.client after connect:', xrpl.client);
xrpl.client.on('ledgerClosed', (ledger) => {
  console.log('Ledger closed event received for ledger', ledger.ledger_index);
  xrpl.processLedger(ledger, io, userData);
});

server.listen(3000, () => {
  console.log('Server running on port 3000');
  xrpl.backfillPrices();
});