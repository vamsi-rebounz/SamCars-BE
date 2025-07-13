// routes/PaymentRoutes.js
const express = require('express');
const router = express.Router();
const PaymentController = require('../controllers/paymentController');

// For Stripe webhook, need raw body so disable body parser for this route in main app
router.post('/webhook', express.raw({ type: 'application/json' }), PaymentController.handleStripeWebhook.bind(PaymentController));

// Other routes
router.post('/create-checkout-session', express.json(), PaymentController.createCheckoutSession.bind(PaymentController));

module.exports = router;
