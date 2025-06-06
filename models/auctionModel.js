const pool = require('../config/db');

const AuctionModel = {
  /**
   * Inserts a new auction vehicle into the database.
   * @param {Object} auctionData - The auction vehicle data.
   * @returns {Object} - Inserted vehicle data.
   */
  async createAuctionVehicle(auctionData) {
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
      } = auctionData;

      const insertQuery = `
        INSERT INTO auction_vehicles (
          make, model, year, vin,
          purchase_date, purchase_price,
          additional_costs, list_price,
          status, notes
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `;

      const result = await client.query(insertQuery, [
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
      ]);

      return result.rows[0];
    } catch (err) {
      console.error('Error inserting auction vehicle:', err);
      throw new Error('Could not insert auction vehicle.');
    } finally {
      client.release();
    }
  }
};

module.exports = AuctionModel;
