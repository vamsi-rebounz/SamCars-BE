const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/authMiddleware');

// Auth routes
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/logout', authenticateToken, authController.logout);
router.post('/refresh-token', authController.refreshToken);

// Email verification routes
router.post('/request-verification', authenticateToken, authController.requestEmailVerification);
router.post('/verify-email', authController.verifyEmail);

// Password reset routes
router.post('/request-password-reset', authController.requestPasswordReset);
router.post('/reset-password', authController.resetPassword);

module.exports = router;
