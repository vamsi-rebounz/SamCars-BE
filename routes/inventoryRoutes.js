const express = require('express');
const router = express.Router();
const multer = require('multer');
const InventoryController = require('../controllers/inventoryController');
// const { authenticateToken, isAdmin } = require('../middleware/authMiddleware');

// Configure multer for memory storage
const storage = multer.memoryStorage();

// Configure multer upload settings
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit per file
        files: 10 // Maximum 10 files
    },
    fileFilter: (req, file, cb) => {
        // Accept only image files
        if (!file.originalname.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
            return cb(new Error('Only image files are allowed!'), false);
        }
        if (!file.mimetype.startsWith('image/')) {
            return cb(new Error('Only image files are allowed!'), false);
        }
        cb(null, true);
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

// Inventory routes
router.post(
    '/add-vehicle',
    // authenticateToken,
    // isAdmin,
    upload.array('images', 10),
    handleMulterError,
    InventoryController.addVehicle
);

module.exports = router; 