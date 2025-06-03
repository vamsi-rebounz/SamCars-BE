// routes/userRoutes.js
const express = require('express');
const UserController = require('../controllers/userController');
const { authenticateToken, authorizeRoles, isAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

// Public Routes
router.post('/register', UserController.registerUser);
router.post('/login', UserController.loginUser);
router.post('/password-reset', UserController.requestPasswordReset);

// Protected Route Examples
router.get('/fetch-by-id', authenticateToken, UserController.fetchUserById);
router.get('/adminDashboard', authenticateToken, isAdmin, (req, res) => {
    res.json({ message: 'Welcome, Admin!' });
});

module.exports = router;
