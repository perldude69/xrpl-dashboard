const express = require('express');
const path = require('path');
const routes = require('./routes');

const app = express();

// Middleware
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use('/', routes);

module.exports = app;