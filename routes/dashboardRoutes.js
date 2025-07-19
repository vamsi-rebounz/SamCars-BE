// routes/dashboardRoutes.js
const express = require('express');
const router = express.Router();
const DashboardController = require('../controllers/dashboardController');

// Get comprehensive dashboard statistics
router.get('/stats', DashboardController.getDashboardStats);

module.exports = router; 