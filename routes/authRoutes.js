const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.post('/request-password-reset', authController.requestPasswordReset);
router.post('/reset-password', authController.resetPassword);

module.exports = router;
