// controllers/PaymentController.js
const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const pool = require('../config/db');
const VehicleModel = require('../models/vehicleModel');
const crypto = require('crypto');
const bcrypt = require('bcrypt');

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
          p.user_id,
          p.amount,
          p.currency,
          p.description,
          p.payment_method,
          p.transaction_id,
          p.status,
          p.receipt_url,
          p.created_at as date,
          p.vehicle_id,
          p.service_id,
          p.type,
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
          whereConditions.push(`p.type = $${queryParams.length + 1}`);
          queryParams.push('vehicle_hold');
        } else if (type === 'vehicle purchase') {
          whereConditions.push(`p.type = $${queryParams.length + 1}`);
          queryParams.push('vehicle_purchase');
        } else if (type === 'service') {
          whereConditions.push(`p.type = $${queryParams.length + 1}`);
          queryParams.push('service');
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
      const payments = await Promise.all(result.rows.map(async payment => {
        // Determine payment type more accurately - use type field if available, otherwise infer from description/vehicle_id
        let paymentType = 'other';
        
        // First check if we have a stored type field
        if (payment.type) {
          // Map frontend types to backend display types
          if (payment.type === 'vehicle_hold') {
            paymentType = 'vehicle hold';
          } else if (payment.type === 'vehicle_purchase') {
            paymentType = 'vehicle purchase';
          } else if (payment.type === 'service') {
            paymentType = 'service';
          } else {
            paymentType = payment.type; // Use as-is if it's already in the right format
          }
        } else {
          // Fallback to description-based detection
          if (payment.description && payment.description.toLowerCase().includes('hold')) {
            paymentType = 'vehicle hold';
          } else if (payment.vehicle_id) {
            paymentType = 'vehicle purchase';
          } else if (payment.description && payment.description.toLowerCase().includes('service')) {
            paymentType = 'service';
          }
        }

        // Determine if it's a Stripe payment
        const isStripePayment = !!(payment.transaction_id && payment.transaction_id.startsWith('pi_'));

        // Build vehicle information with complete details
        let vehicle = null;
        if (payment.vehicle_id) {
          try {
            // Fetch complete vehicle details
            const vehicleQuery = `
              SELECT vehicle_id, make, model, year, stock_number, vin, status
              FROM vehicles 
              WHERE vehicle_id = $1
            `;
            const vehicleResult = await pool.query(vehicleQuery, [payment.vehicle_id]);
            
            if (vehicleResult.rows.length > 0) {
              const vehicleData = vehicleResult.rows[0];
              vehicle = {
                id: vehicleData.vehicle_id,
                make: vehicleData.make,
                model: vehicleData.model,
                year: vehicleData.year,
                stockNumber: vehicleData.stock_number,
                vin: vehicleData.vin,
                status: vehicleData.status
              };
            } else {
              // Fallback to basic vehicle info if not found
              vehicle = {
                id: payment.vehicle_id,
                make: null,
                model: null,
                year: null,
                stockNumber: null,
                vin: null,
                status: null
              };
            }
          } catch (vehicleError) {
            console.error('Error fetching vehicle details:', vehicleError);
            // Fallback to basic vehicle info on error
            vehicle = {
              id: payment.vehicle_id,
              make: null,
              model: null,
              year: null,
              stockNumber: null,
              vin: null,
              status: null
            };
          }
        }

        return {
          id: payment.id,
          user_id: payment.user_id, // Add user_id to response
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
          vehicle_id: payment.vehicle_id, // Add vehicle_id to response
          service_id: payment.service_id, // Add service_id to response
          vehicle: vehicle
        };
      }));

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

  // Helper function to update vehicle status based on payment type and status
  async updateVehicleStatus(vehicleId, paymentType, description, paymentStatus, oldVehicleId = null) {
    if (!vehicleId) return;

    try {
      console.log('Updating vehicle status:', { vehicleId, paymentType, description, paymentStatus, oldVehicleId });

      // If vehicle changed, reset old vehicle status to available
      if (oldVehicleId && oldVehicleId !== vehicleId) {
        const resetOldVehicleQuery = `
          UPDATE vehicles 
          SET status = 'available', updated_at = NOW() 
          WHERE vehicle_id = $1
        `;
        await pool.query(resetOldVehicleQuery, [oldVehicleId]);
        console.log('Reset old vehicle status to available:', oldVehicleId);
      }

      // Determine new status based on payment type and status
      let newStatus = 'available'; // default

      if (paymentType === 'vehicle_hold' || 
          (description && description.toLowerCase().includes('hold'))) {
        newStatus = 'reserved';
      } else if (paymentType === 'vehicle_purchase' || 
                 (description && description.toLowerCase().includes('purchase'))) {
        // Mark as sold if payment type is purchase (regardless of status)
        newStatus = 'sold';
      } else if (paymentType === 'service' || 
                 (description && description.toLowerCase().includes('service'))) {
        newStatus = 'available'; // Service payments don't change vehicle status
      }

      // Update vehicle status
      const updateVehicleQuery = `
        UPDATE vehicles 
        SET status = $1, updated_at = NOW() 
        WHERE vehicle_id = $2
      `;
      await pool.query(updateVehicleQuery, [newStatus, vehicleId]);
      
      console.log('Updated vehicle status:', { vehicleId, newStatus, paymentType, paymentStatus });
    } catch (error) {
      console.error('Error updating vehicle status:', error);
      // Don't throw error to avoid breaking payment process
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
        type,
        vehicle_id,
        service_id,
        customer_data // New field for unregistered customer data
      } = req.body;

      console.log('Parsed fields:', { user_id, amount, payment_method, description, status, date, vehicle_id, service_id, customer_data });

      if (!amount || !payment_method || !description) {
        console.log('Missing required fields:', { amount, payment_method, description });
        return res.status(400).json({ error: 'Missing required fields' });
      }

      let finalUserId = user_id;

      // If customer_data is provided and user_id is not, create a new user
      if (customer_data && !user_id && customer_data.first_name && customer_data.last_name && customer_data.email) {
        try {
          const { first_name, last_name, email, phone } = customer_data;
          
          // Check if user already exists
          const existingUserQuery = 'SELECT user_id FROM users WHERE email = $1';
          const existingUserResult = await pool.query(existingUserQuery, [email]);
          
          if (existingUserResult.rows.length > 0) {
            finalUserId = existingUserResult.rows[0].user_id;
          } else {
            // Create new user
            const createUserQuery = `
              INSERT INTO users (
                first_name, last_name, email, phone, 
                password, role, email_verified, is_active, token_version,
                created_at, updated_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
              RETURNING user_id
            `;
            
            // Generate a random password for the user (they can reset it later)
            const randomPassword = crypto.randomBytes(16).toString('hex');
            const hashedPassword = await bcrypt.hash(randomPassword, 10);
            
            const userValues = [
              first_name,
              last_name,
              email,
              phone || null,
              hashedPassword,
              'customer',
              true, // Mark as verified since admin is creating the account
              true, // is_active
              0     // token_version
            ];
            
            const newUserResult = await pool.query(createUserQuery, userValues);
            finalUserId = newUserResult.rows[0].user_id;
            
            console.log('Created new user for manual payment:', { user_id: finalUserId, email });
          }
        } catch (userError) {
          console.error('Error creating user for manual payment:', userError);
          return res.status(500).json({ error: 'Failed to create user account' });
        }
      }

      // If no user_id and no valid customer_data, return error
      if (!finalUserId && (!customer_data || !customer_data.first_name || !customer_data.last_name || !customer_data.email)) {
        return res.status(400).json({ error: 'User ID is required or valid customer data must be provided' });
      }

      const query = `
        INSERT INTO payments (
          user_id, amount, currency, description, payment_method,
          status, vehicle_id, service_id, type, is_manual, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11)
        RETURNING payment_id
      `;

      const values = [
        finalUserId,
        amount,
        'USD',
        description,
        payment_method,
        status,
        vehicle_id || null,
        service_id || null,
        type || 'service',
        true,
        date ? new Date(date) : new Date()
      ];

      const result = await pool.query(query, values);

      // Update vehicle status based on payment type
      if (vehicle_id) {
        // Use provided type or determine from description
        let paymentType = type || 'service';
        if (!type) {
          if (description.toLowerCase().includes('hold')) {
            paymentType = 'vehicle_hold';
          } else if (description.toLowerCase().includes('purchase')) {
            paymentType = 'vehicle_purchase';
          }
        }
        
        await this.updateVehicleStatus(vehicle_id, paymentType, description, status);
      }

      console.log('Payment inserted successfully with ID:', result.rows[0].payment_id);
      
      res.status(201).json({
        success: true,
        message: 'Manual payment added successfully',
        payment_id: result.rows[0].payment_id,
        user_id: finalUserId
      });
    } catch (error) {
      console.error('Error adding manual payment:', error);
      console.error('Error stack:', error.stack);
      res.status(500).json({ error: 'Failed to add manual payment' });
    }
  }

  // Update payment
  async updatePayment(req, res) {
    try {
      const { id } = req.params;
      const {
        user_id,
        amount,
        payment_method,
        description,
        status,
        date,
        type,
        vehicle_id,
        service_id,
        customer_data
      } = req.body;

      console.log('Updating payment:', { id, user_id, amount, payment_method, description, status, date, vehicle_id, service_id });

      if (!amount || !payment_method || !description) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      let finalUserId = user_id;

      // If customer_data is provided and user_id is not, create a new user
      if (customer_data && !user_id && customer_data.first_name && customer_data.last_name && customer_data.email) {
        try {
          const { first_name, last_name, email, phone } = customer_data;
          
          // Check if user already exists
          const existingUserQuery = 'SELECT user_id FROM users WHERE email = $1';
          const existingUserResult = await pool.query(existingUserQuery, [email]);
          
          if (existingUserResult.rows.length > 0) {
            finalUserId = existingUserResult.rows[0].user_id;
          } else {
            // Create new user
            const createUserQuery = `
              INSERT INTO users (
                first_name, last_name, email, phone, 
                password, role, email_verified, is_active, token_version,
                created_at, updated_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
              RETURNING user_id
            `;
            
            // Generate a random password for the user (they can reset it later)
            const randomPassword = crypto.randomBytes(16).toString('hex');
            const hashedPassword = await bcrypt.hash(randomPassword, 10);
            
            const userValues = [
              first_name,
              last_name,
              email,
              phone || null,
              hashedPassword,
              'customer',
              true, // Mark as verified since admin is creating the account
              true, // is_active
              0     // token_version
            ];
            
            const newUserResult = await pool.query(createUserQuery, userValues);
            finalUserId = newUserResult.rows[0].user_id;
            
            console.log('Created new user for payment update:', { user_id: finalUserId, email });
          }
        } catch (userError) {
          console.error('Error creating user for payment update:', userError);
          return res.status(500).json({ error: 'Failed to create user account' });
        }
      }

      // If no user_id and no valid customer_data, return error
      if (!finalUserId && (!customer_data || !customer_data.first_name || !customer_data.last_name || !customer_data.email)) {
        return res.status(400).json({ error: 'User ID is required or valid customer data must be provided' });
      }

      // Check if payment exists and get current data
      const checkQuery = 'SELECT payment_id, vehicle_id FROM payments WHERE payment_id = $1';
      const checkResult = await pool.query(checkQuery, [id]);
      
      if (checkResult.rows.length === 0) {
        return res.status(404).json({ error: 'Payment not found' });
      }

      const oldVehicleId = checkResult.rows[0].vehicle_id;

      const updateQuery = `
        UPDATE payments 
        SET user_id = $1, amount = $2, currency = $3, description = $4, 
            payment_method = $5, status = $6, vehicle_id = $7, service_id = $8, 
            type = $9, updated_at = NOW()
        WHERE payment_id = $10
        RETURNING payment_id
      `;

      const values = [
        finalUserId,
        amount,
        'USD',
        description,
        payment_method,
        status,
        vehicle_id || null,
        service_id || null,
        type || 'service',
        id
      ];

      const result = await pool.query(updateQuery, values);

      // Update vehicle status based on payment type
      if (vehicle_id) {
        // Use provided type or determine from description
        let paymentType = type || 'service';
        if (!type) {
          if (description.toLowerCase().includes('hold')) {
            paymentType = 'vehicle_hold';
          } else if (description.toLowerCase().includes('purchase')) {
            paymentType = 'vehicle_purchase';
          }
        }
        
        await this.updateVehicleStatus(vehicle_id, paymentType, description, status, oldVehicleId);
      } else if (oldVehicleId) {
        // If vehicle was removed, reset old vehicle status to available
        await this.updateVehicleStatus(null, 'service', description, status, oldVehicleId);
      }

      // Fetch the updated payment with complete information
      const fetchUpdatedPaymentQuery = `
        SELECT 
          p.payment_id as id,
          p.user_id,
          p.amount,
          p.currency,
          p.description,
          p.payment_method,
          p.transaction_id,
          p.status,
          p.receipt_url,
          p.created_at as date,
          p.vehicle_id,
          p.service_id,
          p.type,
          p.is_manual,
          u.first_name || ' ' || u.last_name as customer,
          u.email
        FROM payments p
        LEFT JOIN users u ON p.user_id = u.user_id
        WHERE p.payment_id = $1
      `;
      
      const updatedPaymentResult = await pool.query(fetchUpdatedPaymentQuery, [id]);
      const updatedPayment = updatedPaymentResult.rows[0];

      // Process the updated payment similar to getAllPayments
      let paymentType = 'other';
      
      // First check if we have a stored type field
      if (updatedPayment.type) {
        // Map frontend types to backend display types
        if (updatedPayment.type === 'vehicle_hold') {
          paymentType = 'vehicle hold';
        } else if (updatedPayment.type === 'vehicle_purchase') {
          paymentType = 'vehicle purchase';
        } else if (updatedPayment.type === 'service') {
          paymentType = 'service';
        } else {
          paymentType = updatedPayment.type; // Use as-is if it's already in the right format
        }
      } else {
        // Fallback to description-based detection
        if (updatedPayment.description && updatedPayment.description.toLowerCase().includes('hold')) {
          paymentType = 'vehicle hold';
        } else if (updatedPayment.vehicle_id) {
          paymentType = 'vehicle purchase';
        } else if (updatedPayment.description && updatedPayment.description.toLowerCase().includes('service')) {
          paymentType = 'service';
        }
      }

      const isStripePayment = !!(updatedPayment.transaction_id && updatedPayment.transaction_id.startsWith('pi_'));

      // Build vehicle information with complete details
      let vehicle = null;
      if (updatedPayment.vehicle_id) {
        try {
          // Fetch complete vehicle details
          const vehicleQuery = `
            SELECT vehicle_id, make, model, year, stock_number, vin, status
            FROM vehicles 
            WHERE vehicle_id = $1
          `;
          const vehicleResult = await pool.query(vehicleQuery, [updatedPayment.vehicle_id]);
          
          if (vehicleResult.rows.length > 0) {
            const vehicleData = vehicleResult.rows[0];
            vehicle = {
              id: vehicleData.vehicle_id,
              make: vehicleData.make,
              model: vehicleData.model,
              year: vehicleData.year,
              stockNumber: vehicleData.stock_number,
              vin: vehicleData.vin,
              status: vehicleData.status
            };
          } else {
            // Fallback to basic vehicle info if not found
            vehicle = {
              id: updatedPayment.vehicle_id,
              make: null,
              model: null,
              year: null,
              stockNumber: null,
              vin: null,
              status: null
            };
          }
        } catch (vehicleError) {
          console.error('Error fetching vehicle details:', vehicleError);
          // Fallback to basic vehicle info on error
          vehicle = {
            id: updatedPayment.vehicle_id,
            make: null,
            model: null,
            year: null,
            stockNumber: null,
            vin: null,
            status: null
          };
        }
      }

      const processedPayment = {
        id: updatedPayment.id,
        user_id: updatedPayment.user_id,
        customer: updatedPayment.customer || 'Guest User',
        email: updatedPayment.email || 'N/A',
        amount: parseFloat(updatedPayment.amount),
        description: updatedPayment.description,
        type: paymentType,
        date: updatedPayment.date,
        status: updatedPayment.status,
        paymentMethod: updatedPayment.payment_method,
        transactionId: updatedPayment.transaction_id,
        receiptUrl: updatedPayment.receipt_url,
        is_manual: updatedPayment.is_manual,
        is_stripe: isStripePayment,
        vehicle_id: updatedPayment.vehicle_id,
        service_id: updatedPayment.service_id,
        vehicle: vehicle
      };

      console.log('Payment updated successfully with ID:', result.rows[0].payment_id);
      
      res.json({
        success: true,
        message: 'Payment updated successfully',
        payment: processedPayment
      });
    } catch (error) {
      console.error('Error updating payment:', error);
      console.error('Error stack:', error.stack);
      res.status(500).json({ error: 'Failed to update payment' });
    }
  }

  // Delete payment
  async deletePayment(req, res) {
    try {
      const { id } = req.params;
      console.log('Deleting payment:', { id });

      // Check if payment exists and get vehicle_id
      const checkQuery = 'SELECT payment_id, vehicle_id, description FROM payments WHERE payment_id = $1';
      const checkResult = await pool.query(checkQuery, [id]);
      
      if (checkResult.rows.length === 0) {
        return res.status(404).json({ error: 'Payment not found' });
      }

      const paymentToDelete = checkResult.rows[0];
      const vehicleId = paymentToDelete.vehicle_id;

      const deleteQuery = 'DELETE FROM payments WHERE payment_id = $1 RETURNING payment_id';
      const result = await pool.query(deleteQuery, [id]);

      // If payment had a vehicle, reset vehicle status to available
      if (vehicleId) {
        try {
          const resetVehicleQuery = `
            UPDATE vehicles 
            SET status = 'available', updated_at = NOW() 
            WHERE vehicle_id = $1
          `;
          await pool.query(resetVehicleQuery, [vehicleId]);
          console.log('Reset vehicle status to available after payment deletion:', vehicleId);
        } catch (vehicleError) {
          console.error('Error resetting vehicle status after payment deletion:', vehicleError);
          // Don't throw error to avoid breaking payment deletion
        }
      }

      console.log('Payment deleted successfully with ID:', result.rows[0].payment_id);
      
      res.json({
        success: true,
        message: 'Payment deleted successfully',
        payment_id: result.rows[0].payment_id
      });
    } catch (error) {
      console.error('Error deleting payment:', error);
      console.error('Error stack:', error.stack);
      res.status(500).json({ error: 'Failed to delete payment' });
    }
  }
}

module.exports = new PaymentController();
