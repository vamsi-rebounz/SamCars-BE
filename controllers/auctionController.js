// controllers/auctionController.js
const pool = require('../config/db');

const AuctionController = {
  /**
   * Add a new auction vehicle purchase
   * @param {object} req - Express request object
   * @param {object} res - Express response object
   */
  async addAuctionVehicle(req, res) {
    const client = await pool.connect();
    try {
      const {
        make,
        model,
        year,
        vin,
        purchase_date,
        purchase_price,
        additional_costs,
        list_price,
        status,
        notes
      } = req.fields;

      if (!make || !model || !year || !vin || !purchase_date || !purchase_price || !list_price || !status) {
        return res.status(400).json({
          status: 'error',
          message: 'Missing required fields. Ensure make, model, year, vin, purchase_date, purchase_price, list_price, and status are provided.'
        });
      }

      const parsedPurchasePrice = parseFloat(purchase_price);
      const parsedAdditionalCosts = additional_costs ? parseFloat(additional_costs) : 0;
      const parsedListPrice = parseFloat(list_price);
      const parsedYear = parseInt(year);

      if (isNaN(parsedPurchasePrice) || isNaN(parsedAdditionalCosts) || isNaN(parsedListPrice) || isNaN(parsedYear)) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid numeric values provided for price fields or year.'
        });
      }

      await client.query('BEGIN');

      // Handle make
      let make_id;
      const makeResult = await client.query('SELECT make_id FROM vehicle_makes WHERE name = $1', [make]);
      if (makeResult.rows.length > 0) {
        make_id = makeResult.rows[0].make_id;
      } else {
        const newMake = await client.query('INSERT INTO vehicle_makes (name) VALUES ($1) RETURNING make_id', [make]);
        make_id = newMake.rows[0].make_id;
      }

      // Handle model
      let model_id;
      const modelResult = await client.query('SELECT model_id FROM vehicle_models WHERE make_id = $1 AND name = $2', [make_id, model]);
      if (modelResult.rows.length > 0) {
        model_id = modelResult.rows[0].model_id;
      } else {
        const newModel = await client.query('INSERT INTO vehicle_models (make_id, name) VALUES ($1, $2) RETURNING model_id', [make_id, model]);
        model_id = newModel.rows[0].model_id;
      }

      // Insert vehicle
      const vehicleInsert = await client.query(
        `INSERT INTO vehicles (vin, make_id, model_id, year, price, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, 'available', NOW(), NOW())
         RETURNING vehicle_id`,
        [vin, make_id, model_id, parsedYear, parsedListPrice]
      );

      const vehicle_id = vehicleInsert.rows[0].vehicle_id;

      // Insert auction record
      const auctionInsert = await client.query(
        `INSERT INTO auction_vehicles (
          vehicle_id, purchase_date, purchase_price, additional_costs,
          list_price, status, notes, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, NOW(), NOW()
        ) RETURNING *`,
        [
          vehicle_id,
          purchase_date,
          parsedPurchasePrice,
          parsedAdditionalCosts,
          parsedListPrice,
          status,
          notes || null
        ]
      );

      await client.query('COMMIT');

      res.status(201).json({
        status: 'success',
        message: 'Auction vehicle added successfully',
        data: auctionInsert.rows[0]
      });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error adding auction vehicle:', error);
      let message = error.message;
      if (message.includes('vehicle_status')) {
        message = 'Invalid status. Please use a value allowed by the vehicle_status ENUM in your database.';
      }
      res.status(500).json({
        status: 'error',
        message: 'Failed to add auction vehicle',
        details: message
      });
    } finally {
      client.release();
    }
  }
};

module.exports = AuctionController;
