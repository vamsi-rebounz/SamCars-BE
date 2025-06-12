const pool = require('../config/db');

class AuctionModel {
  static async addAuctionPurchase(vehicleId, purchaseData) {
    const query = `
      INSERT INTO auction_vehicles (
        vehicle_id, purchase_date, purchase_price, additional_costs, 
        list_price, status, notes
      ) 
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
  
    const values = [
      vehicleId,
      purchaseData.purchase_date,
      purchaseData.purchase_price,
      purchaseData.additional_costs || 0,
      purchaseData.list_price || null,
      'auction',
      purchaseData.notes || null
    ];
  
    const { rows } = await pool.query(query, values);
    return rows[0];
  }

  /**
     * Updates the status of a vehicle.
     * @param {number} vehicleId - The ID of the vehicle to update.
     * @param {string} status - The new status (e.g., 'auction').
     * @param {object} client - PostgreSQL client for transaction.
     */
  static async updateVehicleStatus(vehicleId, status, client) {
    const query = `
        UPDATE VEHICLES
        SET status = $1, updated_at = CURRENT_TIMESTAMP
        WHERE vehicle_id = $2;
    `;
    await client.query(query, [status, vehicleId]);
}
  static async findByVehicleId(vehicleId) {
    const { rows } = await pool.query(
      'SELECT * FROM auction_vehicles WHERE vehicle_id = $1',
      [vehicleId]
    );
    return rows[0];
  }

  static async 
}

module.exports = AuctionModel;