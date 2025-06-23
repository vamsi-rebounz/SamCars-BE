// routes/auctionRoutes.js
const express = require('express');
const AuctionController = require('../controllers/auctionController');
const { authenticateToken, isAdmin } = require('../middleware/authMiddleware');
const { upload, handleMulterError } = require('../middleware/multerMiddleware');
const router = express.Router();

// * Admin authorized routes *

// Create a new auction 
router.post(
    '/add-new',
    upload.array('images', 10),
    handleMulterError,
    // authenticateToken,
    // isAdmin,
    AuctionController.addAuctionPurchase
);

// Fetch all auction purchases
router.get(
    '/fetch-all',
    // authenticateToken,
    // isAdmin,
    AuctionController.getAuctionVehicles
);

// Fetch auction purchases summary statistics
router.get(
    '/dashboard-summary',
    // authenticateToken,
    // isAdmin,
    AuctionController.getAuctionDashboardSummary
);

// Update auction purchase
router.put(
    '/update',
    upload.array('images', 10),
    handleMulterError,
    // authenticateToken,
    // isAdmin,
    AuctionController.updateAuctionPurchase
);

// Delete auction purchase
router.delete(
    '/delete/:id',
    // authenticateToken,
    // isAdmin,
    AuctionController.deleteAuctionPurchase
);

module.exports = router;