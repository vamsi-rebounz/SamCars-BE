const WishlistModel = require('../models/wishlistModel');

class WishlistController {
    /**
     * Get user's wishlist
     * @param {object} req - Express request object
     * @param {object} res - Express response object
     */
    static async getWishlist(req, res) {
        try {
            const userId = req.user.user_id; // From JWT token
            const wishlist = await WishlistModel.getWishlist(userId);
            
            res.status(200).json({
                status: 'success',
                data: wishlist
            });
        } catch (error) {
            console.error('Error fetching wishlist:', error);
            res.status(500).json({
                status: 'error',
                message: 'Failed to fetch wishlist'
            });
        }
    }

    /**
     * Add vehicle to wishlist
     * @param {object} req - Express request object
     * @param {object} res - Express response object
     */
    static async addToWishlist(req, res) {
        try {
            const userId = req.user.user_id; // From JWT token
            const { vehicle_id } = req.body;

            if (!vehicle_id) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Vehicle ID is required'
                });
            }

            // Check if already in wishlist
            const exists = await WishlistModel.isInWishlist(userId, vehicle_id);
            if (exists) {
                return res.status(409).json({
                    status: 'error',
                    message: 'Vehicle already in wishlist'
                });
            }

            const wishlistItem = await WishlistModel.addToWishlist(userId, vehicle_id);
            res.status(201).json({
                status: 'success',
                message: 'Vehicle added to wishlist',
                data: wishlistItem
            });
        } catch (error) {
            console.error('Error adding to wishlist:', error);
            res.status(500).json({
                status: 'error',
                message: 'Failed to add vehicle to wishlist'
            });
        }
    }

    /**
     * Remove vehicle from wishlist
     * @param {object} req - Express request object
     * @param {object} res - Express response object
     */
    static async removeFromWishlist(req, res) {
        try {
            const userId = req.user.user_id; // From JWT token
            const { vehicle_id } = req.params;

            if (!vehicle_id) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Vehicle ID is required'
                });
            }

            const removed = await WishlistModel.removeFromWishlist(userId, vehicle_id);
            if (!removed) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Vehicle not found in wishlist'
                });
            }

            res.status(200).json({
                status: 'success',
                message: 'Vehicle removed from wishlist'
            });
        } catch (error) {
            console.error('Error removing from wishlist:', error);
            res.status(500).json({
                status: 'error',
                message: 'Failed to remove vehicle from wishlist'
            });
        }
    }

    /**
     * Check if vehicle is in wishlist
     * @param {object} req - Express request object
     * @param {object} res - Express response object
     */
    static async checkWishlist(req, res) {
        try {
            const userId = req.user.user_id; // From JWT token
            const { vehicle_id } = req.params;

            if (!vehicle_id) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Vehicle ID is required'
                });
            }

            const isInWishlist = await WishlistModel.isInWishlist(userId, vehicle_id);
            res.status(200).json({
                status: 'success',
                data: { isInWishlist }
            });
        } catch (error) {
            console.error('Error checking wishlist:', error);
            res.status(500).json({
                status: 'error',
                message: 'Failed to check wishlist status'
            });
        }
    }
}

module.exports = WishlistController; 