const express = require('express');
const router = express.Router();
const VehicleSalesController = require('../controllers/vehicleSalesController');

// Route: POST /sales/sell
router.post('/sell', VehicleSalesController.sellVehicle);

module.exports = router;