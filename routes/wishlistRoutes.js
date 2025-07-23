const express = require('express');
const router = express.Router();
const WishlistController = require('../controllers/wishlistController');
const { authenticateToken } = require('../middleware/authMiddleware');

// All wishlist routes require authentication
router.use(authenticateToken);

// Get user's wishlist
router.get('/fetch-all', WishlistController.getWishlist);

// Add vehicle to wishlist
router.post('/add', WishlistController.addToWishlist);

// Remove vehicle from wishlist
router.delete('/remove/:vehicle_id', WishlistController.removeFromWishlist);

// Check if vehicle is in wishlist
router.get('/check/:vehicle_id', WishlistController.checkWishlist);

module.exports = router; 