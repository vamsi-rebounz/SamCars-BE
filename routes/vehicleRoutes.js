const express = require('express');
const router = express.Router();
const VehicleController = require('../controllers/vehicleController');
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');

// Get vehicle by ID
router.get('/fetch-by-id', 
    //authenticateToken,
    VehicleController.getVehicleById
);

module.exports = router;