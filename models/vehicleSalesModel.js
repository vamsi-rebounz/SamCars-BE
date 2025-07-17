const pool = require('../config/db');
const InventoryModel = require('./inventoryModel');

const VehicleSalesModel = {
  async recordSale(data) {
    const {
      vehicle_id,
      seller_id,
      buyer_id,
      buyer_info, // Optional object
      sale_price,
      asking_price,
      best_time_to_contact,
      preferred_contact_method,
      vehicle_description
    } = data;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Set buyer info
      let finalBuyerId = null;
      let buyerName = null, buyerEmail = null, buyerPhone = null;

      if (buyer_id) {
        finalBuyerId = buyer_id;
      } else if (buyer_info && buyer_info.email) {
        buyerName = buyer_info.name || null;
        buyerEmail = buyer_info.email || null;
        buyerPhone = buyer_info.phone || null;
      }

      // Insert sale
      const result = await client.query(`
        INSERT INTO VEHICLE_SALES (
          vehicle_id, seller_id, buyer_id, buyer_name, buyer_email, buyer_phone,
          sale_price, asking_price, best_time_to_contact, preferred_contact_method,
          vehicle_description
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        RETURNING *;
      `, [
        vehicle_id,
        seller_id,
        finalBuyerId,
        buyerName,
        buyerEmail,
        buyerPhone,
        sale_price,
        asking_price,
        best_time_to_contact,
        preferred_contact_method,
        vehicle_description
      ]);

      // Update vehicle status using the new method
      await InventoryModel.updateVehicleStatus(vehicle_id, 'sold', client);

      await client.query('COMMIT');
      return result.rows[0];
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
};

module.exports = VehicleSalesModel;