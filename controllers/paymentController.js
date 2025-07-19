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
    console.log('=== WEBHOOK RECEIVED ===');
    console.log('Method:', req.method);
    console.log('Path:', req.path);
    console.log('Headers:', JSON.stringify(req.headers, null, 2));
    console.log('Body length:', req.body ? req.body.length : 0);
    console.log('Body preview:', req.body ? req.body.toString().substring(0, 200) + '...' : 'No body');
    console.log('========================');

    const sig = req.headers['stripe-signature'];
    let event;

    try {
      event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
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

      // Skip processing if no user_id (test events or invalid data)
      if (!userId) {
        console.log('Skipping payment processing - no user_id provided in metadata');
        return res.json({ received: true, skipped: 'No user_id in metadata' });
      }

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

  // Get all payments for admin dashboard
  async getAllPayments(req, res) {
    try {
      const { page = 1, limit = 10, status, type } = req.query;
      const offset = (page - 1) * limit;

      let query = `
        SELECT 
          p.payment_id as id,
          p.amount,
          p.currency,
          p.description,
          p.payment_method,
          p.transaction_id,
          p.status,
          p.receipt_url,
          p.created_at as date,
          p.vehicle_id,
          p.is_manual,
          u.first_name || ' ' || u.last_name as customer,
          u.email
        FROM payments p
        LEFT JOIN users u ON p.user_id = u.user_id
      `;

      const whereConditions = [];
      const queryParams = [];

      if (status && status !== 'all') {
        whereConditions.push(`p.status = $${queryParams.length + 1}`);
        queryParams.push(status);
      }

      if (type && type !== 'all') {
        if (type === 'vehicle hold') {
          whereConditions.push(`p.description ILIKE $${queryParams.length + 1}`);
          queryParams.push('%hold%');
        } else if (type === 'vehicle purchase') {
          whereConditions.push(`p.description ILIKE $${queryParams.length + 1}`);
          queryParams.push('%purchase%');
        } else if (type === 'service') {
          whereConditions.push(`p.service_id IS NOT NULL`);
        } else if (type === 'stripe') {
          whereConditions.push(`p.transaction_id LIKE $${queryParams.length + 1}`);
          queryParams.push('pi_%');
        }
      }

      if (whereConditions.length > 0) {
        query += ` WHERE ${whereConditions.join(' AND ')}`;
      }

      query += ` ORDER BY p.created_at DESC LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
      queryParams.push(limit, offset);

      const result = await pool.query(query, queryParams);

      // Enhanced response with vehicle information and better payment type detection
      const payments = result.rows.map(payment => {
        // Determine payment type more accurately
        let paymentType = 'other';
        if (payment.description && payment.description.toLowerCase().includes('hold')) {
          paymentType = 'vehicle hold';
        } else if (payment.vehicle_id) {
          paymentType = 'vehicle purchase';
        } else if (payment.description && payment.description.toLowerCase().includes('service')) {
          paymentType = 'service';
        }

        // Determine if it's a Stripe payment
        const isStripePayment = !!(payment.transaction_id && payment.transaction_id.startsWith('pi_'));

        // Build vehicle information (simplified for now)
        const vehicle = payment.vehicle_id ? {
          id: payment.vehicle_id,
          make: null,
          model: null,
          year: null,
          stockNumber: null
        } : null;

        return {
          id: payment.id,
          customer: payment.customer || 'Guest User',
          email: payment.email || 'N/A',
          amount: parseFloat(payment.amount),
          description: payment.description,
          type: paymentType,
          date: payment.date,
          status: payment.status,
          paymentMethod: payment.payment_method,
          transactionId: payment.transaction_id,
          receiptUrl: payment.receipt_url,
          is_manual: payment.is_manual,
          is_stripe: isStripePayment,
          vehicle: vehicle
        };
      });

      res.json({
        success: true,
        data: {
          payments,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: result.rows.length,
            pages: 1
          }
        }
      });

    } catch (error) {
      console.error('Error fetching payments:', error);
      console.error('Error stack:', error.stack);
      res.status(500).json({ error: 'Failed to fetch payments' });
    }
  }

  // Add manual payment
  async addManualPayment(req, res) {
    try {
      console.log('Received manual payment request:', req.body);
      
      const {
        user_id,
        amount,
        payment_method,
        description,
        status = 'completed',
        date,
        vehicle_id,
        service_id
      } = req.body;

      console.log('Parsed fields:', { user_id, amount, payment_method, description, status, date, vehicle_id, service_id });

      if (!user_id || !amount || !payment_method || !description) {
        console.log('Missing required fields:', { user_id, amount, payment_method, description });
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const query = `
        INSERT INTO payments (
          user_id, amount, currency, description, payment_method,
          status, vehicle_id, service_id, is_manual, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)
        RETURNING payment_id
      `;

      const values = [
        user_id,
        amount,
        'USD',
        description,
        payment_method,
        status,
        vehicle_id || null,
        service_id || null,
        true,
        date ? new Date(date) : new Date()
      ];

      const result = await pool.query(query, values);

      // If this is a vehicle hold payment, update vehicle status
      if (vehicle_id && description.toLowerCase().includes('hold')) {
        const updateVehicleQuery = `
          UPDATE VEHICLES 
          SET status = 'reserved', updated_at = NOW() 
          WHERE vehicle_id = $1
        `;
        await pool.query(updateVehicleQuery, [vehicle_id]);
      }

      console.log('Payment inserted successfully with ID:', result.rows[0].payment_id);
      
      res.status(201).json({
        success: true,
        message: 'Manual payment added successfully',
        payment_id: result.rows[0].payment_id
      });
    } catch (error) {
      console.error('Error adding manual payment:', error);
      console.error('Error stack:', error.stack);
      res.status(500).json({ error: 'Failed to add manual payment' });
    }
  }
}

module.exports = new PaymentController();
