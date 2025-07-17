const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { upload } = require('../middleware/multerMiddleware');

// Public routes
router.post('/register', upload.none(), authController.register);
router.post('/login', authController.login);
router.post('/refresh-token', authController.refreshToken);
router.post('/request-password-reset', authController.requestPasswordReset);
router.post('/reset-password', authController.resetPassword);

// Protected routes
router.post('/logout', authenticateToken, authController.logout);

module.exports = router;
