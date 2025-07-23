// routes/userRoutes.js
const express = require('express');
const UserController = require('../controllers/userController');
const { authenticateToken, isAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

// Protected Routes - User Profile Management
router.get('/profile', authenticateToken, UserController.fetchUserById);
router.put('/profile/update', authenticateToken, UserController.updateUserProfile);

// Admin Routes
router.get('/list', authenticateToken, isAdmin, UserController.listUsers);
router.get('/:userId', authenticateToken, isAdmin, UserController.fetchUserById);
router.put('/:userId/status', authenticateToken, isAdmin, UserController.updateUserStatus);

module.exports = router;
