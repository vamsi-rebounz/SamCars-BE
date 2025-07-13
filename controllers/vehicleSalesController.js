const pool = require('../config/db');
const VehicleSalesModel = require('../models/vehicleSalesModel');

const VehicleSalesController = {
  async sellVehicle(req, res) {
    try {
      const data = req.body;

      // Basic required fields check
      if (!data.vehicle_id || !data.seller_email || !data.sale_price || !data.asking_price) {
        return res.status(400).json({ error: 'Missing required fields: vehicle_id, seller_email, sale_price, asking_price are required.' });
      }

      if (!data.buyer_email && !data.buyer_info) {
        return res.status(400).json({ error: 'Provide buyer_email or buyer_info.' });
      }

      const client = await pool.connect();

      try {
        // Lookup seller_id by email
        const sellerRes = await client.query('SELECT user_id FROM USERS WHERE email = $1', [data.seller_email]);
        if (sellerRes.rows.length === 0) {
          return res.status(400).json({ error: 'Seller email not found.' });
        }
        const seller_id = sellerRes.rows[0].user_id;

        // Lookup buyer_id by buyer_email if provided and buyer_info not provided
        let buyer_id = null;
        if (data.buyer_email && !data.buyer_info) {
          const buyerRes = await client.query('SELECT user_id FROM USERS WHERE email = $1', [data.buyer_email]);
          if (buyerRes.rows.length === 0) {
            return res.status(400).json({ error: 'Buyer email not found.' });
          }
          buyer_id = buyerRes.rows[0].user_id;
        }

        // Prepare data for model
        const saleData = {
          ...data,
          seller_id,
          buyer_id,
        };

        const result = await VehicleSalesModel.recordSale(saleData);
        res.status(201).json({ message: 'Vehicle sold successfully.', sale: result });

      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Error in sellVehicle:', error);
      res.status(500).json({ error: 'Failed to record sale.' });
    }
  }
};

module.exports = VehicleSalesController;