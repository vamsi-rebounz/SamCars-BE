// controllers/PaymentController.js
const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const pool = require('../config/db');
const VehicleModel = require('../models/vehicleModel');

class PaymentController {
  // Create checkout session (same as before)
  async createCheckoutSession(req, res) {
    const { vehicle_id, user_id } = req.body;
    console.log('Creating checkout session with:', { vehicle_id, user_id });
    
    if (!vehicle_id) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const vehicle = await VehicleModel.getVehicleById(vehicle_id);
    if (!vehicle) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }

    try {
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        metadata: {
          vehicle_id: vehicle_id.toString(),
          user_id: user_id ? user_id.toString() : null
        },
        line_items: [{
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Hold Payment for ${vehicle.make} ${vehicle.model} ${vehicle.year}`,
              description: `5% holding deposit for vehicle (Stock #${vehicle.stock_number})`,
            },
            unit_amount: Math.round(vehicle.price * 0.05 * 100), // Convert to cents
          },
          quantity: 1,
        }],
        mode: 'payment',
        success_url: `${process.env.FRONTEND_URL}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.FRONTEND_URL}/payment-cancelled`,
      });
      console.log('Created checkout session:', { 
        id: session.id, 
        metadata: session.metadata 
      });
      res.json({ url: session.url });
    } catch (error) {
      console.error('Error creating checkout session:', error);
      res.status(500).json({ error: 'Failed to create checkout session' });
    }
  }

  // Stripe webhook handler to save payment on success
  async handleStripeWebhook(req, res) {
    console.log('Webhook received:', {
      method: req.method,
      path: req.path,
      headers: req.headers,
      rawBody: req.body ? req.body.toString() : null
    });

    const sig = req.headers['stripe-signature'];
    let event;

    try {
      event = stripe.webhooks.constructEvent(req.rawBody || req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
      console.log('Webhook event constructed:', event.type);
    } catch (err) {
      console.error('⚠️ Webhook signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the checkout.session.completed event
    if (event.type === 'checkout.session.completed') {
      console.log('Received checkout.session.completed event:', event.type);
      const session = event.data.object;
      console.log('Session data:', session);

      // Retrieve payment details
      const paymentIntentId = session.payment_intent;
      const customerEmail = session.customer_details?.email || null;
      const amountTotal = session.amount_total / 100; // Convert cents to dollars
      const currency = session.currency.toUpperCase();
      const metadata = session.metadata || {};
      console.log('Session metadata:', metadata);
      
      // Fix: Get vehicle_id from metadata correctly
      const vehicleId = metadata.vehicle_id ? parseInt(metadata.vehicle_id) : null;
      const userId = metadata.user_id ? parseInt(metadata.user_id) : null;
      
      console.log('Parsed IDs:', { vehicleId, userId });

      let client;
      try {
        // Get a client from the pool
        client = await pool.connect();
        console.log('Got database client');

        // Retrieve PaymentIntent for more details
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
        console.log('Payment Intent:', paymentIntent);

        // Begin transaction
        await client.query('BEGIN');
        console.log('Transaction started');

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

        const result = await client.query(query, values);
        console.log('Payment saved with ID:', result.rows[0].payment_id);

        // Update vehicle status to reserved
        if (vehicleId) {
          console.log('Attempting to update vehicle status for ID:', vehicleId);
          
          // First check if vehicle exists
          const checkVehicleQuery = 'SELECT vehicle_id, status FROM VEHICLES WHERE vehicle_id = $1';
          const vehicleCheck = await client.query(checkVehicleQuery, [vehicleId]);
          console.log('Vehicle check result:', vehicleCheck.rows[0]);

          if (vehicleCheck.rows.length === 0) {
            throw new Error(`Vehicle not found with ID: ${vehicleId}`);
          }

          const updateVehicleQuery = `
            UPDATE VEHICLES 
            SET status = 'reserved', updated_at = NOW() 
            WHERE vehicle_id = $1
            RETURNING vehicle_id, status
          `;
          const vehicleResult = await client.query(updateVehicleQuery, [vehicleId]);
          console.log('Vehicle update result:', vehicleResult.rows[0]);
          
          if (vehicleResult.rows.length === 0) {
            throw new Error(`Failed to update vehicle status for ID: ${vehicleId}`);
          } else {
            console.log('Vehicle status successfully updated to reserved for ID:', vehicleId);
          }
        } else {
          console.log('No vehicle ID provided in metadata');
        }

        // Commit transaction
        await client.query('COMMIT');
        console.log('Transaction committed successfully');

      } catch (dbErr) {
        // Rollback transaction on error
        if (client) {
          await client.query('ROLLBACK');
          console.error('Transaction rolled back due to error');
        }
        console.error('Database error:', dbErr);
        console.error('Error stack:', dbErr.stack);
      } finally {
        // Release client back to pool
        if (client) {
          client.release();
          console.log('Database client released');
        }
      }
    }

    // Return a 200 response to acknowledge receipt of the event
    res.json({ received: true });
  }
}

module.exports = new PaymentController();
