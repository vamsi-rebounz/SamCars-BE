// routes/auctionRoutes.js
const express = require('express');
const AuctionController = require('../controllers/auctionController');
const { authenticateToken, isAdmin } = require('../middleware/authMiddleware');
const { upload, handleMulterError } = require('../middleware/multerMiddleware');
const router = express.Router();

// Public Routes
router.post('/vehicles/add-new',
    upload.array('images', 10),
    // authenticateToken,
    // isAdmin,
    AuctionController.addAuctionPurchase
);

router.get('/fetch-all',
    // authenticateToken,
    // isAdmin,
    AuctionController.getAuctionVehicles
);

router.get('/dashboard-summary',
    // authenticateToken,
    // isAdmin,
    AuctionController.getAuctionDashboardSummary
);

module.exports = router;