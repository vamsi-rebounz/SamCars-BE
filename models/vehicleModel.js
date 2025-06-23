const pool = require('../config/db');

class VehicleModel {
    /**
     * Retrieves comprehensive details for a single vehicle by its ID.
     * Includes make, model, price, mileage, colors, transmission, fuel type, engine, VIN,
     * condition, status, features, tags, images, and associated dealer information.
     * @param {number} vehicleId - The ID of the vehicle to retrieve.
     * @returns {Promise<object|null>} The vehicle data object, or null if not found.
     */
    static async getVehicleById(vehicleId) {
        const client = await pool.connect();
        try {
            // Get vehicle basic details, including make, model, and images
            const vehicleQuery = `
                SELECT
                    v.vehicle_id as id,
                    vm.name as make,
                    vmod.name as model,
                    v.year,
                    v.price,
                    v.mileage,
                    v.exterior_color,
                    v.interior_color,
                    v.transmission::text,
                    v.fuel_type::text,
                    v.engine,
                    v.body_type,
                    v.vin,
                    v.condition::text,
                    v.status,
                    v.description,
                    v.is_featured as featured,
                    v.carfax_link,
                    CASE
                        WHEN v.status = 'available' THEN true
                        ELSE false
                    END as available,
                    vi.image_urls as images
                FROM vehicles v
                JOIN vehicle_makes vm ON v.make_id = vm.make_id
                JOIN vehicle_models vmod ON v.model_id = vmod.model_id
                LEFT JOIN vehicle_images vi ON v.vehicle_id = vi.vehicle_id
                LEFT JOIN users u ON u.role = 'sales' -- Assuming one sales user for demo, adjust as needed
                WHERE v.vehicle_id = $1
                LIMIT 1;
            `;
            const vehicleResult = await client.query(vehicleQuery, [vehicleId]);

            if (vehicleResult.rows.length === 0) {
                return null; // Vehicle not found
            }

            const vehicleData = vehicleResult.rows[0];

            // Get vehicle features
            const featuresQuery = `
                SELECT array_agg(vf.name) as features
                FROM vehicle_features vf
                JOIN vehicle_feature_mapping vfm ON vf.feature_id = vfm.feature_id
                WHERE vfm.vehicle_id = $1;
            `;
            const featuresResult = await client.query(featuresQuery, [vehicleId]);

            // Get vehicle tags
            const tagsQuery = `
                SELECT array_agg(vt.name) as tags
                FROM vehicle_tags vt
                JOIN vehicle_tag_mapping vtm ON vt.tag_id = vtm.tag_id
                WHERE vtm.vehicle_id = $1;
            `;
            const tagsResult = await client.query(tagsQuery, [vehicleId]);

            // Combine all data
            return {
                ...vehicleData,
                features: featuresResult.rows[0]?.features || [], // Use optional chaining for safety
                tags: tagsResult.rows[0]?.tags || [],
                images: vehicleData.images || []
            };

        } finally {
            client.release();
        }
    }
}

module.exports = VehicleModel;