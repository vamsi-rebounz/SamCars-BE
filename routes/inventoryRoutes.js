const express = require('express');
const router = express.Router();
const multer = require('multer');
const InventoryController = require('../controllers/inventoryController');
const { authenticateToken, isAdmin } = require('../middleware/authMiddleware');

// Configure multer for memory storage
const storage = multer.memoryStorage();

// Configure multer upload settings
const path = require('path');

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024,
        files: 10
    },
    fileFilter: (req, file, cb) => {
        try {
            // Get file extension
            const ext = path.extname(file.originalname).toLowerCase();
            const allowedExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
            
            // Check extension
            if (!allowedExts.includes(ext)) {
                console.log('Invalid extension:', file.originalname);
                return cb(new Error('Invalid file extension. Only jpg, jpeg, png, gif, webp allowed.'), false);
            }
            
            // Check MIME type
            const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
            if (!allowedMimes.includes(file.mimetype)) {
                console.log('Invalid MIME:', file.mimetype);
                return cb(new Error('Invalid file type. Only images allowed.'), false);
            }
            
            // Additional validation: Check if extension matches MIME
            const extToMime = {
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.png': 'image/png',
                '.gif': 'image/gif',
                '.webp': 'image/webp'
            };
            
            if (extToMime[ext] !== file.mimetype) {
                console.log(`MIME mismatch: ${ext} expects ${extToMime[ext]} got ${file.mimetype}`);
                return cb(new Error('File extension does not match content type.'), false);
            }
            
            cb(null, true);
        } catch (err) {
            cb(err);
        }
    }
});

// Error handling middleware for multer
const handleMulterError = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                error: 'File too large',
                message: 'Each file must be less than 5MB'
            });
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({
                error: 'Too many files',
                message: 'Maximum 10 files allowed'
            });
        }
        return res.status(400).json({
            error: 'File upload error',
            message: err.message
        });
    }
    if (err) {
        return res.status(400).json({
            error: 'Invalid file type',
            message: err.message
        });
    }
    next();
};

// Inventory routes starts here
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

router.delete(
    '/vehicles/delete/:id',
    // authenticateToken,
    // isAdmin,
    InventoryController.deleteVehicle
);
module.exports = router; 