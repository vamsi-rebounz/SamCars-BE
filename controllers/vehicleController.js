const pool = require('../config/db');
const { validateVehicleData } = require('../validators/vehicleValidator');
const { uploadToFirebase } = require('../utils/firebaseUploader');

class VehicleController {
    /**
     * Get vehicle details by ID
     * @param {object} req - Express request object
     * @param {object} res - Express response object
     */
    static async getVehicleById(req, res) {
        try {
            const { id } = req.query;
            const client = await pool.connect();

            try {
                // Get vehicle details including make, model, features, and images
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
                        v.vin,
                        v.condition::text,
                        v.is_featured as featured,
                        CASE 
                            WHEN v.status = 'available' THEN true
                            ELSE false
                        END as available,
                        vi.image_urls as images,
                        json_build_object(
                            'name', u.first_name || ' ' || u.last_name,
                            'email', u.email,
                            'phone', u.phone
                        ) as dealer_info
                    FROM vehicles v
                    JOIN vehicle_makes vm ON v.make_id = vm.make_id
                    JOIN vehicle_models vmod ON v.model_id = vmod.model_id
                    LEFT JOIN vehicle_images vi ON v.vehicle_id = vi.vehicle_id
                    LEFT JOIN users u ON u.role = 'sales'
                    WHERE v.vehicle_id = $1
                    LIMIT 1
                `;

                const vehicleResult = await client.query(vehicleQuery, [id]);

                if (vehicleResult.rows.length === 0) {
                    return res.status(404).json({
                        status: 'error',
                        message: 'Vehicle not found'
                    });
                }

                // Get vehicle features
                const featuresQuery = `
                    SELECT array_agg(vf.name) as features
                    FROM vehicle_features vf
                    JOIN vehicle_feature_mapping vfm ON vf.feature_id = vfm.feature_id
                    WHERE vfm.vehicle_id = $1
                `;

                const featuresResult = await client.query(featuresQuery, [id]);
                
                // Get vehicle tags
                const tagsQuery = `
                    SELECT array_agg(vt.name) as tags
                    FROM vehicle_tags vt
                    JOIN vehicle_tag_mapping vtm ON vt.tag_id = vtm.tag_id
                    WHERE vtm.vehicle_id = $1
                `;

                const tagsResult = await client.query(tagsQuery, [id]);

                // Combine all data
                const vehicleData = {
                    ...vehicleResult.rows[0],
                    features: featuresResult.rows[0].features || [],
                    tags: tagsResult.rows[0].tags || [],
                    images: vehicleResult.rows[0].images || []
                };

                res.status(200).json({
                    status: 'success',
                    data: vehicleData
                });

            } finally {
                client.release();
            }
        } catch (error) {
            console.error('Error fetching vehicle:', error);
            res.status(500).json({
                status: 'error',
                message: 'Failed to fetch vehicle details'
            });
        }
    }
}

module.exports = VehicleController; 