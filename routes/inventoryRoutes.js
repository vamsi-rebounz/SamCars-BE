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

// Add logging middleware
const logRequest = (req, res, next) => {
    console.log('Request body:', req.body);
    console.log('Request files:', req.files);
    next();
};

// Test endpoint for inventory routes
router.get('/test', (req, res) => {
    res.json({ message: 'Inventory routes are accessible' });
});

// Test endpoint for admin authentication
router.get('/test-admin', authenticateToken, isAdmin, (req, res) => {
    console.log('Admin test endpoint accessed by user:', {
        id: req.user.user_id,
        email: req.user.email,
        role: req.user.role
    });
    res.json({
        success: true,
        message: 'Admin authentication successful',
        user: {
            id: req.user.user_id,
            email: req.user.email,
            role: req.user.role
        }
    });
});

// Inventory routes starts here
// Add vehicle
router.post(
    '/add-vehicle',
    authenticateToken,
    isAdmin,
    upload.array('images', 10),
    handleMulterError,
    logRequest,
    InventoryController.addVehicle
);

// Update vehicle
router.put(
    '/vehicles/update',
    authenticateToken,
    isAdmin,
    upload.array('images', 10),
    handleMulterError,
    logRequest,
    InventoryController.updateVehicle
);

module.exports = router; 