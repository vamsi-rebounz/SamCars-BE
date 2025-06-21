const express = require('express');
const router = express.Router();
const InventoryController = require('../controllers/inventoryController');
const { authenticateToken, isAdmin } = require('../middleware/authMiddleware');
const { upload, handleMulterError } = require('../middleware/multerMiddleware');

// * Inventory routes starts here *
// * Admin authorized routes *
// Add vehicle
router.post(
    '/add-vehicle',
    upload.array('images', 10),
    handleMulterError,
    // authenticateToken,
    // isAdmin,
    InventoryController.addVehicle
);

// Update vehicle
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

// Delete vehicle
router.delete(
    '/vehicles/delete/:id',
    // authenticateToken,
    // isAdmin,
    InventoryController.deleteVehicle
);
module.exports = router; 