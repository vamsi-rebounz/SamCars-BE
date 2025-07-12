// routes/userRoutes.js
const express = require('express');
const UserController = require('../controllers/userController');
const { authenticateToken, isAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

// * Public Routes *
router.post(
    '/register', 
    UserController.registerUser
);

// * Protected Route Examples *
router.get('/fetch-by-id', authenticateToken, UserController.fetchUserById);

router.put('/update-profile', authenticateToken, UserController.updateUserProfile);

router.post(
    '/login', 
    UserController.loginUser
);

// * Protected Routes *
router.get(
    '/fetch-by-id', 
    // authenticateToken, 
    UserController.fetchUserById);

module.exports = router;
