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

router.post(
    '/login', 
    UserController.loginUser
);

router.post(
    '/password-reset', 
    UserController.requestPasswordReset
);

// * Protected Routes *
router.get(
    '/fetch-by-id', 
    // authenticateToken, 
    UserController.fetchUserById);

module.exports = router;
