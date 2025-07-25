const express = require('express');
const router = express.Router();
const VehicleController = require('../controllers/vehicleController');
const { tryAuthenticateToken, authorizeRoles } = require('../middleware/authMiddleware');

// Get vehicle by ID
router.get('/:id', 
    tryAuthenticateToken,
    VehicleController.getVehicleById
);

module.exports = router;