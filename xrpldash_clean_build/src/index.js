const { startServer } = require('./server');

const PORT = process.env.PORT || 3000;

if (require.main === module) {
  startServer(PORT);
}

module.exports = { startServer };