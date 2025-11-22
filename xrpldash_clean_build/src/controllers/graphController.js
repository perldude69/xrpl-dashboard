const { getGraphData } = require('../models/priceModel');

function getGraph(req, res) {
  const period = req.query.period || '30d';
  const interval = req.query.interval || '4h';
  getGraphData(period, interval, (err, data) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json(data);
  });
}

module.exports = { getGraph };