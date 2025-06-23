// routes/auctionRoutes.js
const express = require('express');
const AuctionController = require('../controllers/auctionController');
const { authenticateToken, isAdmin } = require('../middleware/authMiddleware');
const { upload, handleMulterError } = require('../middleware/multerMiddleware');
const router = express.Router();

// * Admin authorized routes *
router.post(
    '/add-new',
    upload.array('images', 10),
    handleMulterError,
    // authenticateToken,
    // isAdmin,
    AuctionController.addAuctionPurchase
);

router.get(
    '/fetch-all',
    // authenticateToken,
    // isAdmin,
    AuctionController.getAuctionVehicles
);

router.get(
    '/dashboard-summary',
    // authenticateToken,
    // isAdmin,
    AuctionController.getAuctionDashboardSummary
);

router.put(
    '/update',
    upload.array('images', 10),
    handleMulterError,
    // authenticateToken,
    // isAdmin,
    AuctionController.updateAuctionPurchase
);

module.exports = router;