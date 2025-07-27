const express = require('express');
const router = express.Router();
const InventoryController = require('../controllers/inventoryController');
const { authenticateToken, isAdmin, tryAuthenticateToken } = require('../middleware/authMiddleware');
const { upload, handleMulterError } = require('../middleware/multerMiddleware');

// * Admin authorized routes *

// Add vehicle to inventory
router.post(
    '/add-vehicle',
    upload.array('images', 10),
    handleMulterError,
    authenticateToken,
    isAdmin,
    InventoryController.addVehicle
);

// Update vehicle in inventory
router.put(
    '/vehicles/update',
    upload.array('images', 10),
    handleMulterError,
    authenticateToken,
    isAdmin,
    InventoryController.updateVehicle
);

// Fetch vehicles with filters
router.get(
    '/',
    tryAuthenticateToken,
    // isAdmin,
    InventoryController.getInventory
);

// Get dropdown options for makes, models, and years
router.get(
    '/dropdown-options',
    InventoryController.getDropdownOptions
);

// Get vehicle categories
router.get(
    '/categories',
    InventoryController.getCategories
);

// Get vehicle statuses
router.get(
    '/statuses',
    InventoryController.getVehicleStatuses
);

// Delete vehicle from inventory
router.delete(
    '/vehicles/delete/:id',
    authenticateToken,
    isAdmin,
    InventoryController.deleteVehicle
);
module.exports = router; 