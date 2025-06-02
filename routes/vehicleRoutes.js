const express = require('express');
const router = express.Router();
const VehicleController = require('../controllers/vehicleController');

// Get vehicle by ID
router.get('/fetch-by-id', VehicleController.getVehicleById);

module.exports = router;