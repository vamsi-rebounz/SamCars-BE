// controllers/PaymentController.js
const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const pool = require('../config/db');
const VehicleModel = require('../models/vehicleModel');

class PaymentController {
  // Create checkout session (same as before)
  async createCheckoutSession(req, res) {
    const { vehicle_id, user_id: user_id } = req.body;
    if (!vehicle_id ) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const vehicle = await VehicleModel.getVehicleById(vehicle_id);
    if (!vehicle) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }

    try {
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Hold Payment for ${vehicle.make} ${vehicle.model} ${vehicle.year}`,
              metadata: { vehicle_id, user_id },
            },
            unit_amount: vehicle.price * 0.05,
          },
          quantity: 1,
        }],
        mode: 'payment',
        success_url: `${process.env.FRONTEND_URL}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.FRONTEND_URL}/payment-cancelled`,
      });
      res.json({ url: session.url });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to create checkout session' });
    }
  }

  // Stripe webhook handler to save payment on success
  async handleStripeWebhook(req, res) {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
      event = stripe.webhooks.constructEvent(req.rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      console.log(`⚠️  Webhook signature verification failed.`, err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the checkout.session.completed event
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;

      // Retrieve payment details
      const paymentIntentId = session.payment_intent;
      const customerEmail = session.customer_details?.email || null;
      const amountTotal = session.amount_total / 100; // Convert cents to dollars
      const currency = session.currency.toUpperCase();
      const metadata = session.metadata || {};
      const vehicleId = metadata.vehicleId ? parseInt(metadata.vehicleId) : null;
      const userId = metadata.userId ? parseInt(metadata.userId) : null;

      try {
        // Retrieve PaymentIntent for more details
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

        // Save payment to your DB
        const query = `
          INSERT INTO payments (
            user_id, amount, currency, description, payment_method,
            transaction_id, status, receipt_url, vehicle_id,
            created_at, updated_at
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW(),NOW())
          RETURNING payment_id
        `;
        const values = [
          userId,
          amountTotal,
          currency,
          paymentIntent.description || `Hold payment for vehicle ${vehicleId}`,
          paymentIntent.payment_method_types[0],
          paymentIntent.id,
          paymentIntent.status,
          paymentIntent.charges.data[0]?.receipt_url || null,
          vehicleId
        ];

        const result = await pool.query(query, values);
        console.log('Payment saved with ID:', result.rows[0].payment_id);

      } catch (dbErr) {
        console.error('DB error saving payment:', dbErr);
      }
    }

    // Return a 200 response to acknowledge receipt of the event
    res.json({ received: true });
  }
}

module.exports = new PaymentController();
