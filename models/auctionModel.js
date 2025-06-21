// models/auctionModel.js
const pool = require('../config/db');
const { VEHICLE_STATUSES } = require('../constants/enums');

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

  /**
     * Fetches auction vehicles with pagination, search, sorting, and image URLs.
     * @param {object} options - Query options.
     * @param {number} options.limit - Number of items per page.
     * @param {number} options.offset - Number of items to skip.
     * @param {string} options.search - Search term for VIN, make, or model.
     * @param {string} options.sortBy - Column to sort by.
     * @param {string} options.sortOrder - 'ASC' or 'DESC'.
     * @param {string} options.status - Filter by vehicle status.
     * @returns {Promise<{vehicles: Array, totalItems: number}>} - Fetched vehicles and total count.
     */
  static async fetchAuctionVehicles({ limit, offset, search, sortBy, sortOrder, status }) {
    const client = await pool.connect();
    try {
        let query = `
            SELECT
                av.auction_id AS id,
                vm.name AS make,
                vmo.name AS model,
                v.year,
                v.vin,
                av.purchase_date AS "purchaseDate",
                av.purchase_price AS "purchasePrice",
                av.additional_costs AS "additionalCosts",
                av.total_investment AS "totalInvestment",
                av.list_price AS "listPrice",
                av.sold_price AS "soldPrice",
                av.status,
                av.profit,
                av.created_at AS "createdAt",
                av.updated_at AS "updatedAt",
                vi.image_urls AS "imageUrls"  -- NEW: Fetch image URLs
            FROM
                AUCTION_VEHICLES av
            JOIN
                VEHICLES v ON av.vehicle_id = v.vehicle_id
            JOIN
                VEHICLE_MAKES vm ON v.make_id = vm.make_id
            JOIN
                VEHICLE_MODELS vmo ON v.model_id = vmo.model_id
            LEFT JOIN  -- NEW: Left join to images table
                VEHICLE_IMAGES vi ON v.vehicle_id = vi.vehicle_id
        `;

        // Note: The count query does not need to join VEHICLE_IMAGES
        // unless you specifically want to count only vehicles that have images.
        // For total auction vehicles, the current count query is fine.
        let countQuery = `
            SELECT COUNT(*)
            FROM AUCTION_VEHICLES av
            JOIN VEHICLES v ON av.vehicle_id = v.vehicle_id
            JOIN VEHICLE_MAKES vm ON v.make_id = vm.make_id
            JOIN VEHICLE_MODELS vmo ON v.model_id = vmo.model_id
        `;

        const queryParams = [];
        const countParams = [];
        let whereClause = [];
        let paramIndex = 1;

        // Add status filter
        if (status) {
            if (!Object.values(VEHICLE_STATUSES).includes(status)) {
                throw new Error(`Invalid status: ${status}. Allowed: ${Object.values(VEHICLE_STATUSES).join(', ')}`);
            }
            whereClause.push(`av.status = $${paramIndex++}`);
            queryParams.push(status);
            countParams.push(status);
        }

        // Add search filter (VIN, Make, Model)
        if (search) {
            const searchTerm = `%${search.toLowerCase()}%`;
            whereClause.push(`(
                LOWER(v.vin) LIKE $${paramIndex} OR
                LOWER(vm.name) LIKE $${paramIndex} OR
                LOWER(vmo.name) LIKE $${paramIndex}
            )`);
            queryParams.push(searchTerm);
            countParams.push(searchTerm);
            paramIndex++;
        }

        if (whereClause.length > 0) {
            query += ` WHERE ` + whereClause.join(' AND ');
            countQuery += ` WHERE ` + whereClause.join(' AND ');
        }

        // Add sorting
        const allowedSortBy = [
            'id', 'purchase_date', 'purchase_price', 'total_investment',
            'list_price', 'sold_price', 'status', 'profit', 'created_at',
            'updated_at', 'make', 'model', 'year', 'vin'
        ];
        const actualSortBy = sortBy || 'purchase_date'; // Default sort
        const actualSortOrder = (sortOrder && sortOrder.toUpperCase() === 'DESC') ? 'DESC' : 'ASC';

        if (!allowedSortBy.includes(actualSortBy)) {
            throw new Error(`Invalid sortBy parameter: ${sortBy}. Allowed: ${allowedSortBy.join(', ')}`);
        }

        let dbSortBy;
        switch (actualSortBy) {
            case 'id': dbSortBy = 'av.auction_id'; break;
            case 'purchase_date': dbSortBy = 'av.purchase_date'; break;
            case 'purchase_price': dbSortBy = 'av.purchase_price'; break;
            case 'total_investment': dbSortBy = 'av.total_investment'; break;
            case 'list_price': dbSortBy = 'av.list_price'; break;
            case 'sold_price': dbSortBy = 'av.sold_price'; break;
            case 'status': dbSortBy = 'av.status'; break;
            case 'profit': dbSortBy = 'av.profit'; break;
            case 'created_at': dbSortBy = 'av.created_at'; break;
            case 'updated_at': dbSortBy = 'av.updated_at'; break;
            case 'make': dbSortBy = 'vm.name'; break;
            case 'model': dbSortBy = 'vmo.name'; break;
            case 'year': dbSortBy = 'v.year'; break;
            case 'vin': dbSortBy = 'v.vin'; break;
            default: dbSortBy = 'av.purchase_date'; // Fallback
        }

        query += ` ORDER BY ${dbSortBy} ${actualSortOrder}`;

        // Add pagination
        query += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
        queryParams.push(limit, offset);

        const [vehiclesResult, countResult] = await Promise.all([
            client.query(query, queryParams),
            client.query(countQuery, countParams)
        ]);

        const totalItems = parseInt(countResult.rows[0].count);
        const vehicles = vehiclesResult.rows;

        return { vehicles, totalItems };

    } catch (error) {
        console.error('Error fetching auction vehicles:', error);
        throw error;
    } finally {
        client.release();
    }
  }

  /**
     * Fetches summary statistics for the auction dashboard.
     * Calculates total investment, total profit, vehicles purchased, and vehicles sold
     * within a given date range and optional status filter.
     * @param {object} options - Options for filtering the summary.
     * @param {string} options.dateFrom - Start date for filtering (YYYY-MM-DD).
     * @param {string} options.dateTo - End date for filtering (YYYY-MM-DD).
     * @param {string} [options.status] - Optional: Filter by vehicle status.
     * @returns {Promise<{
    * totalInvestment: number,
    * totalProfit: number,
    * vehiclesPurchased: number,
    * vehiclesSold: number
    * }>} - Summary statistics.
  */
  static async getAuctionSummaryStatistics({ dateFrom, dateTo, status }) {
        const client = await pool.connect();
        try {
            // Basic validation for status if provided
            if (status && !Object.values(VEHICLE_STATUSES).includes(status)) {
                throw new Error(`Invalid status: ${status}. Allowed statuses are: ${Object.values(VEHICLE_STATUSES).join(', ')}`);
            }

            // Query to get total investment and vehicles purchased
            let purchasedQuery = `
                SELECT
                    COUNT(*) AS "vehiclesPurchased",
                    COALESCE(SUM(total_investment), 0) AS "totalInvestment"
                FROM
                    AUCTION_VEHICLES
                WHERE
                    purchase_date BETWEEN $1 AND $2
            `;

            // Query to get total profit and vehicles sold
            // FIXED: Using 'updated_at::date' and filtering by 'status = 'sold'' and 'sold_price IS NOT NULL'
            let soldQuery = `
                SELECT
                    COUNT(*) AS "vehiclesSold",
                    COALESCE(SUM(profit), 0) AS "totalProfit"
                FROM
                    AUCTION_VEHICLES
                WHERE
                    status = 'sold'
                    AND sold_price IS NOT NULL
                    AND updated_at::date BETWEEN $1 AND $2
            `;

            const queryParams = [dateFrom, dateTo]; // Parameters for both queries

            // If a status filter is provided, add it to both queries
            // NOTE: This applies the status filter to *both* purchased and sold counts.
            // If you only want the status filter to apply to sold vehicles (e.g., status='sold' only),
            // then remove the 'status' param from purchasedQuery or handle it separately.
            // Given the schema, filtering both by the same status for consistency makes sense.
            if (status) {
                // If status is provided, it applies to both queries.
                // For purchased, it means vehicles purchased within range AND current status.
                // For sold, it means vehicles sold within range AND current status (which will be 'sold').
                purchasedQuery += ` AND status = $3`;
                soldQuery += ` AND status = $3`; // This will be redundant if status is 'sold'
                queryParams.push(status);
            }

            // Execute both queries concurrently
            const [purchasedResult, soldResult] = await Promise.all([
                client.query(purchasedQuery, queryParams),
                client.query(soldQuery, queryParams)
            ]);

            const purchasedData = purchasedResult.rows[0];
            const soldData = soldResult.rows[0];

            return {
                // Ensure values are numbers using parseFloat and handle potential nulls from DB (though COALESCE helps)
                totalInvestment: parseFloat(purchasedData.totalInvestment),
                vehiclesPurchased: parseInt(purchasedData.vehiclesPurchased),
                totalProfit: parseFloat(soldData.totalProfit),
                vehiclesSold: parseInt(soldData.vehiclesSold)
            };

        } catch (error) {
            console.error('Error fetching auction summary statistics:', error);
            throw error; // Re-throw to be caught by the controller
        } finally {
            client.release(); // Always release the client back to the pool
        }
  }
}

module.exports = AuctionModel;