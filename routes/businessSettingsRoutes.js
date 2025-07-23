const express = require('express');
const router = express.Router();
const businessSettingsController = require('../controllers/businessSettingsController');
const { authenticateToken, isAdmin } = require('../middleware/authMiddleware');

// Get business settings (public)
router.get('/', businessSettingsController.getBusinessSettings);

// Update business settings (admin only)
router.put('/', authenticateToken, isAdmin, businessSettingsController.updateBusinessSettings);

module.exports = router; 