const express = require('express');
const router = express.Router();
const VehicleController = require('../controllers/vehicleController');
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');

// Get vehicle by ID
router.get('/fetch-by-id', authenticateToken, VehicleController.getVehicleById);
// Delete vehicle by ID
router.delete('/vehicles/delete/:vehicle_id', VehicleController.deleteVehicle);




module.exports = router;