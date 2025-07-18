// routes/PaymentRoutes.js
const express = require('express');
const router = express.Router();
const PaymentController = require('../controllers/paymentController');

// Webhook route - raw body is handled at app level
router.post('/webhook', PaymentController.handleStripeWebhook.bind(PaymentController));

// Other routes with JSON parsing
router.post('/create-checkout-session', PaymentController.createCheckoutSession.bind(PaymentController));

module.exports = router;
