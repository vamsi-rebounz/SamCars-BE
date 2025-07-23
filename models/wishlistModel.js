const pool = require('../config/db');

class WishlistModel {
    /**
     * Add a vehicle to user's wishlist
     * @param {number} userId - User ID
     * @param {number} vehicleId - Vehicle ID
     * @returns {Promise<Object>} - Created wishlist item
     */
    static async addToWishlist(userId, vehicleId) {
        const query = `
            INSERT INTO user_wishlist (user_id, vehicle_id, created_at)
            VALUES ($1, $2, CURRENT_TIMESTAMP)
            RETURNING *
        `;
        const { rows } = await pool.query(query, [userId, vehicleId]);
        return rows[0];
    }

    /**
     * Remove a vehicle from user's wishlist
     * @param {number} userId - User ID
     * @param {number} vehicleId - Vehicle ID
     * @returns {Promise<boolean>} - True if removed, false if not found
     */
    static async removeFromWishlist(userId, vehicleId) {
        const query = `
            DELETE FROM user_wishlist
            WHERE user_id = $1 AND vehicle_id = $2
            RETURNING *
        `;
        const { rows } = await pool.query(query, [userId, vehicleId]);
        return rows.length > 0;
    }

    /**
     * Get user's wishlist with vehicle details
     * @param {number} userId - User ID
     * @returns {Promise<Array>} - Array of wishlist items with vehicle details
     */
    static async getWishlist(userId) {
        const query = `
            SELECT 
                v.*,
                vi.image_urls,
                vi.primary_image_index,
                vm.name as make,
                vmo.name as model,
                ARRAY_REMOVE(ARRAY_AGG(DISTINCT vt.name), NULL) as tags,
                ARRAY_REMOVE(ARRAY_AGG(DISTINCT vf.name), NULL) as features,
                uw.created_at as added_to_wishlist_at
            FROM user_wishlist uw
            JOIN vehicles v ON uw.vehicle_id = v.vehicle_id
            JOIN vehicle_makes vm ON v.make_id = vm.make_id
            JOIN vehicle_models vmo ON v.model_id = vmo.model_id
            LEFT JOIN vehicle_images vi ON v.vehicle_id = vi.vehicle_id
            LEFT JOIN vehicle_tag_mapping vtm ON v.vehicle_id = vtm.vehicle_id
            LEFT JOIN vehicle_tags vt ON vtm.tag_id = vt.tag_id
            LEFT JOIN vehicle_feature_mapping vfm ON v.vehicle_id = vfm.vehicle_id
            LEFT JOIN vehicle_features vf ON vfm.feature_id = vf.feature_id
            WHERE uw.user_id = $1
            GROUP BY v.vehicle_id, vi.image_urls, vi.primary_image_index, vm.name, vmo.name, uw.created_at
            ORDER BY uw.created_at DESC
        `;
        const { rows } = await pool.query(query, [userId]);
        return rows;
    }

    /**
     * Check if a vehicle is in user's wishlist
     * @param {number} userId - User ID
     * @param {number} vehicleId - Vehicle ID
     * @returns {Promise<boolean>} - True if in wishlist, false otherwise
     */
    static async isInWishlist(userId, vehicleId) {
        const query = `
            SELECT EXISTS(
                SELECT 1 FROM user_wishlist
                WHERE user_id = $1 AND vehicle_id = $2
            )
        `;
        const { rows } = await pool.query(query, [userId, vehicleId]);
        return rows[0].exists;
    }
}

module.exports = WishlistModel; 