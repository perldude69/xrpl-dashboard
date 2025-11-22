const express = require('express');
const router = express.Router();
const path = require('path');
const { getGraph } = require('../controllers/graphController');

// Root route
router.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Graph route
router.get('/graph', getGraph);

module.exports = router;