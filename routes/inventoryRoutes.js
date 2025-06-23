const express = require('express');
const router = express.Router();
const InventoryController = require('../controllers/inventoryController');
const { authenticateToken, isAdmin } = require('../middleware/authMiddleware');
const { upload, handleMulterError } = require('../middleware/multerMiddleware');

// * Admin authorized routes *

// Add vehicle to inventory
router.post(
    '/add-vehicle',
    upload.array('images', 10),
    handleMulterError,
    // authenticateToken,
    // isAdmin,
    InventoryController.addVehicle
);

// Update vehicle in inventory
router.put(
    '/vehicles/update',
    upload.array('images', 10),
    handleMulterError,
    // authenticateToken,
    // isAdmin,
    InventoryController.updateVehicle
);

// Fetch vehicles with filters
router.get(
    '/fetch-vehicles',
    // authenticateToken,
    // isAdmin,
    InventoryController.getInventory
);

// Delete vehicle from inventory
router.delete(
    '/vehicles/delete/:id',
    // authenticateToken,
    // isAdmin,
    InventoryController.deleteVehicle
);
module.exports = router; 