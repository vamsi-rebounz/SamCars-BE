// routes/PaymentRoutes.js
const express = require('express');
const router = express.Router();
const PaymentController = require('../controllers/paymentController');

// Webhook route - raw body is handled at app level
router.post('/webhook', PaymentController.handleStripeWebhook.bind(PaymentController));

// Other routes with JSON parsing
router.post('/create-checkout-session', PaymentController.createCheckoutSession.bind(PaymentController));

// Admin routes for payment management
console.log('Registering payment admin routes');
router.get('/admin', PaymentController.getAllPayments.bind(PaymentController));
router.post('/admin/manual', PaymentController.addManualPayment.bind(PaymentController));

// Test route
router.get('/test', (req, res) => {
  res.json({ message: 'Payment routes working' });
});

module.exports = router;
