const pool = require('../config/db');
const { getStorage } = require('firebase-admin/storage');
const { uploadToFirebase } = require('../utils/firebaseUploader');
const { deleteFromFirebase } = require('../utils/firebaseDeleter');

class InventoryModel {

    /**
     * Inserts a new vehicle into the database, handling makes, models, tags, and image uploads.
     * @param {object} vehicleData - Data for the vehicle to be added.
     * @param {Array<object>} files - Array of image files to upload.
     * @returns {Promise<number>} The ID of the newly created vehicle.
     */
    static async addVehicle(vehicleData, files) {
        const client = await pool.connect();
        try {
            console.log('Starting addVehicle transaction.');
            console.log('Received vehicle data in model:', JSON.stringify(vehicleData, null, 2));
            console.log('Received files in model:', vehicleData.images ? vehicleData.images.length : 0, 'files');

            await client.query('BEGIN');

            // 1. Get or create make and model
            let make_id;
            const makeResult = await client.query(
                'INSERT INTO vehicle_makes (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING make_id',
                [vehicleData.make]
            );
            make_id = makeResult.rows[0].make_id;

            let model_id;
            const modelResult = await client.query(
                'INSERT INTO vehicle_models (make_id, name) VALUES ($1, $2) ON CONFLICT (make_id, name) DO UPDATE SET name = EXCLUDED.name RETURNING model_id',
                [make_id, vehicleData.model]
            );
            model_id = modelResult.rows[0].model_id;

            // 2. Insert into vehicles table
            const insertVehicleQuery = `
                INSERT INTO vehicles (
                    vin, make_id, model_id, year, price, mileage, 
                    exterior_color, interior_color, transmission, fuel_type, 
                    engine, body_type, condition, status, description, 
                    stock_number, location, is_featured
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
                RETURNING vehicle_id, created_at, updated_at
            `;

            const vehicleValues = [
                vehicleData.vin || null,
                make_id,
                model_id,
                vehicleData.year || null,
                vehicleData.price || null,
                vehicleData.mileage || null,
                vehicleData.exterior_color || null,
                vehicleData.interior_color || null,
                vehicleData.transmission || null,
                vehicleData.fuel_type || null,
                vehicleData.engine || null,
                vehicleData.body_type || null,
                vehicleData.condition || null,
                vehicleData.status || 'available',
                vehicleData.description || null,
                vehicleData.stock_number || null,
                vehicleData.location || null,
                vehicleData.is_featured === true
            ];

            console.log('Executing insertVehicleQuery with values:', vehicleValues);
            const vehicleResult = await client.query(insertVehicleQuery, vehicleValues);
            const newVehicle = vehicleResult.rows[0];

            // 3. Handle tags
            if (vehicleData.tags && Array.isArray(vehicleData.tags) && vehicleData.tags.length > 0) {
                console.log('Processing tags:', vehicleData.tags);
                for (const tagName of vehicleData.tags) {
                    const tagResult = await client.query(
                        'INSERT INTO vehicle_tags (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING tag_id',
                        [tagName]
                    );
                    const tagId = tagResult.rows[0].tag_id;

                    await client.query(
                        'INSERT INTO vehicle_tag_mapping (vehicle_id, tag_id) VALUES ($1, $2) ON CONFLICT (vehicle_id, tag_id) DO NOTHING',
                        [newVehicle.vehicle_id, tagId]
                    );
                }
            }

            // 4. Handle images
            if (files && files.length > 0) {
                console.log('Processing images:', files.length, 'files');
                const imageUrls = await uploadToFirebase(files);
                console.log('Uploaded image URLs:', imageUrls);
                
                await client.query(
                    `INSERT INTO vehicle_images (vehicle_id, image_urls)
                     VALUES ($1, $2::text[])
                     ON CONFLICT (vehicle_id) DO UPDATE 
                     SET image_urls = array_cat(vehicle_images.image_urls, $2::text[]),
                         updated_at = CURRENT_TIMESTAMP`,
                    [newVehicle.vehicle_id, imageUrls]
                );
            }

            await client.query('COMMIT');

            // Fetch the complete new vehicle data for response
            const completeVehicleQuery = `
                SELECT 
                    v.*,
                    vm.name as make,
                    vmd.name as model,
                    COALESCE(array_agg(DISTINCT vt.name) FILTER (WHERE vt.name IS NOT NULL), '{}'::text[]) as tags,
                    COALESCE(vi.image_urls, '{}'::text[]) as images
                FROM vehicles v
                LEFT JOIN vehicle_makes vm ON v.make_id = vm.make_id
                LEFT JOIN vehicle_models vmd ON v.model_id = vmd.model_id
                LEFT JOIN vehicle_tag_mapping vtm ON v.vehicle_id = vtm.vehicle_id
                LEFT JOIN vehicle_tags vt ON vtm.tag_id = vt.tag_id
                LEFT JOIN vehicle_images vi ON v.vehicle_id = vi.vehicle_id
                WHERE v.vehicle_id = $1
                GROUP BY v.vehicle_id, vm.name, vmd.name, vi.image_urls
            `;
            
            const completeVehicleResult = await client.query(completeVehicleQuery, [newVehicle.vehicle_id]);
            const completeVehicle = completeVehicleResult.rows[0];

            console.log('Vehicle added successfully. New Vehicle:', completeVehicle);

            return {
                success: true,
                vehicle: completeVehicle
            };

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Error in addVehicle model:', error);
            return {
                success: false,
                error: error.message
            };
        } finally {
            client.release();
        }
    }

    /**
     * Updates vehicle details in the database, handling makes, models, features, tags, and image uploads/deletions.
     * @param {number} vehicle_id - The ID of the vehicle to update.
     * @param {object} vehicleData - Updated data for the vehicle.
     * @param {Array<object>} files - Array of new image files to upload.
     * @returns {Promise<void>}
     */
    static async updateVehicle(vehicle_id, vehicleData, files) {
        const client = await pool.connect();
        try {
            console.log('Starting vehicle update transaction for ID:', vehicle_id);
            console.log('Vehicle data received for update:', JSON.stringify(vehicleData, null, 2));
            console.log('Files received for update:', files);

            await client.query('BEGIN');

            // 1. Get or create make and model
            let make_id;
            const makeResult = await client.query(
                'INSERT INTO vehicle_makes (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING make_id',
                [vehicleData.make]
            );
            make_id = makeResult.rows[0].make_id;

            let model_id;
            const modelResult = await client.query(
                'INSERT INTO vehicle_models (make_id, name) VALUES ($1, $2) ON CONFLICT (make_id, name) DO UPDATE SET name = EXCLUDED.name RETURNING model_id',
                [make_id, vehicleData.model]
            );
            model_id = modelResult.rows[0].model_id;

            // Validate transmission if provided
            if (vehicleData.transmission) {
                const validTransmissions = ['automatic', 'manual', 'cvt', 'semi_automatic'];
                const transmissionValue = vehicleData.transmission.toLowerCase();
                if (!validTransmissions.includes(transmissionValue)) {
                    throw new Error(`Invalid transmission type. Must be one of: ${validTransmissions.join(', ')}`);
                }
            }

            // Validate fuel_type if provided
            if (vehicleData.fuel_type) {
                const validFuelTypes = ['gasoline', 'diesel', 'electric', 'hybrid', 'plug_in_hybrid'];
                const fuelTypeValue = vehicleData.fuel_type.toLowerCase();
                if (!validFuelTypes.includes(fuelTypeValue)) {
                    throw new Error(`Invalid fuel type. Must be one of: ${validFuelTypes.join(', ')}`);
                }
                // Update the fuel_type value to ensure it's lowercase
                vehicleData.fuel_type = fuelTypeValue;
            }

            // Validate condition if provided
            if (vehicleData.condition) {
                console.log('Received condition value:', vehicleData.condition, 'Type:', typeof vehicleData.condition);
                const validConditions = ['new', 'used', 'certified_pre_owned', 'excellent', 'good', 'fair'];
                // Ensure condition is a string and not an array
                const conditionValue = Array.isArray(vehicleData.condition) 
                    ? String(vehicleData.condition[0]).toLowerCase()
                    : String(vehicleData.condition).toLowerCase();
                
                if (!validConditions.includes(conditionValue)) {
                    throw new Error(`Invalid condition. Must be one of: ${validConditions.join(', ')}`);
                }
                // Update the condition value to ensure it's lowercase
                vehicleData.condition = conditionValue;
            }

            // 2. Update vehicle
            const updateVehicleQuery = `
                UPDATE vehicles
                SET 
                    make_id = $1,
                    model_id = $2,
                    year = $3,
                    price = $4,
                    mileage = $5,
                    vin = $6,
                    exterior_color = $7,
                    interior_color = $8,
                    transmission = CASE 
                        WHEN $9::text = '' THEN transmission
                        WHEN $9::text IS NULL THEN transmission
                        ELSE $9::transmission_type
                    END,
                    fuel_type = CASE 
                        WHEN $10::text = '' THEN fuel_type
                        WHEN $10::text IS NULL THEN fuel_type
                        ELSE $10::fuel_type
                    END,
                    engine = $11,
                    body_type = $12,
                    condition = CASE 
                        WHEN $13::text = '' THEN condition
                        WHEN $13::text IS NULL THEN condition
                        ELSE $13::vehicle_condition
                    END,
                    status = $14,
                    description = $15,
                    stock_number = $16,
                    location = $17,
                    is_featured = $18,
                    updated_at = CURRENT_TIMESTAMP
                WHERE vehicle_id = $19
                RETURNING *
            `;

            const vehicleValues = [
                make_id,
                model_id,
                vehicleData.year,
                vehicleData.price,
                vehicleData.mileage,
                vehicleData.vin,
                vehicleData.exterior_color || null,
                vehicleData.interior_color || null,
                vehicleData.transmission || null,
                vehicleData.fuel_type || null,
                vehicleData.engine || null,
                vehicleData.body_type || null,
                vehicleData.condition || null,
                vehicleData.status || 'available',
                vehicleData.description || null,
                vehicleData.stock_number || null,
                vehicleData.location || null,
                vehicleData.is_featured === true,
                vehicle_id
            ];

            console.log('Executing updateVehicle query with values:', vehicleValues);
            const vehicleResult = await client.query(updateVehicleQuery, vehicleValues);
            const updatedVehicle = vehicleResult.rows[0];

            // 3. Handle tags
            if (vehicleData.tags && Array.isArray(vehicleData.tags)) {
                console.log('Processing tags:', vehicleData.tags);
                
                // First, remove all existing tag mappings for this vehicle
                await client.query(
                    'DELETE FROM vehicle_tag_mapping WHERE vehicle_id = $1',
                    [vehicle_id]
                );
                
                // Then insert new tag mappings
                for (const tagName of vehicleData.tags) {
                    // First ensure the tag exists
                    const tagResult = await client.query(
                        'INSERT INTO vehicle_tags (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING tag_id',
                        [tagName]
                    );
                    const tagId = tagResult.rows[0].tag_id;

                    // Then create the mapping
                    await client.query(
                        'INSERT INTO vehicle_tag_mapping (vehicle_id, tag_id) VALUES ($1, $2) ON CONFLICT (vehicle_id, tag_id) DO NOTHING',
                        [vehicle_id, tagId]
                    );
                }
            }

            // 4. Handle images
            if (files && files.length > 0) {
                // Upload new images to Firebase
                const imageUrls = await uploadToFirebase(files);
                
                // Update vehicle_images table
                await client.query(
                    `INSERT INTO vehicle_images (vehicle_id, image_urls)
                     VALUES ($1, $2)
                     ON CONFLICT (vehicle_id) 
                     DO UPDATE SET 
                        image_urls = CASE 
                            WHEN vehicle_images.image_urls IS NULL THEN $2
                            ELSE array_cat(vehicle_images.image_urls, $2)
                        END,
                        updated_at = CURRENT_TIMESTAMP`,
                    [vehicle_id, imageUrls]
                );
            }

            await client.query('COMMIT');

            // Get the complete updated vehicle data
            const completeVehicleQuery = `
                SELECT 
                    v.*,
                    vm.name as make,
                    vmd.name as model,
                    COALESCE(array_agg(DISTINCT vt.name) FILTER (WHERE vt.name IS NOT NULL), '{}'::text[]) as tags,
                    COALESCE(vi.image_urls, '{}'::text[]) as images
                FROM vehicles v
                LEFT JOIN vehicle_makes vm ON v.make_id = vm.make_id
                LEFT JOIN vehicle_models vmd ON v.model_id = vmd.model_id
                LEFT JOIN vehicle_tag_mapping vtm ON v.vehicle_id = vtm.vehicle_id
                LEFT JOIN vehicle_tags vt ON vtm.tag_id = vt.tag_id
                LEFT JOIN vehicle_images vi ON v.vehicle_id = vi.vehicle_id
                WHERE v.vehicle_id = $1
                GROUP BY v.vehicle_id, vm.name, vmd.name, vi.image_urls
            `;
            
            const completeVehicleResult = await client.query(completeVehicleQuery, [vehicle_id]);
            const completeVehicle = completeVehicleResult.rows[0];

            console.log('Vehicle update completed successfully. Updated Vehicle:', completeVehicle);

            return {
                success: true,
                vehicle: completeVehicle
            };

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Error in updateVehicle model:', error);
            return {
                success: false,
                error: error.message
            };
        } finally {
            client.release();
        }
    }


    /**
     * Fetches inventory data with filters, pagination, and sorting.
     * @param {object} options - Options for filtering, pagination, and sorting.
     * @param {string} options.category
     * @param {number} options.limit
     * @param {number} options.page
     * @param {string} options.search
     * @param {string} options.sortBy
     * @param {string} options.sortOrder
     * @param {string} options.status
     * @param {Function} buildWhereClauseForInventory - Helper function to build WHERE clause.
     * @returns {Promise<object>} Inventory data, pagination info, and filter statistics.
     */
    static async getInventory({ category, limit, page, search, sortBy, sortOrder, status }, buildWhereClauseForInventory) {
        const parsedLimit = parseInt(limit);
        const parsedPage = parseInt(page);
        const offset = (parsedPage - 1) * parsedLimit;

        const allowedSortFields = {
            date_added: 'di.created_at',
            price: 'v.price',
            year: 'v.year',
            mileage: 'v.mileage',
            make: 'vm.name'
        };

        if (!(sortBy in allowedSortFields)) {
            throw new Error('Invalid sort_by field.');
        }

        const orderByClause = `${allowedSortFields[sortBy]} ${sortOrder.toUpperCase()}`;

        const { whereClause, values, paramIndex } = buildWhereClauseForInventory({ search, status, category });

        let vehicleQuery = `
            SELECT
              v.vehicle_id AS id,
              vm.name AS make,
              vmod.name AS model,
              v.year,
              v.vin,
              v.price,
              v.mileage,
              v.status,
              v.body_type,
              v.is_featured,
              di.date_added,
              COALESCE(
                (SELECT image_urls[primary_image_index + 1] FROM VEHICLE_IMAGES vi WHERE vi.vehicle_id = v.vehicle_id AND vi.is_primary = TRUE LIMIT 1),
                (SELECT image_urls[1] FROM VEHICLE_IMAGES vi WHERE vi.vehicle_id = v.vehicle_id LIMIT 1)
              ) AS image_url,
              v.location,
              ARRAY(
                  SELECT vt.name
                  FROM VEHICLE_TAG_MAPPING vtm
                  JOIN VEHICLE_TAGS vt ON vtm.tag_id = vt.tag_id
                  WHERE vtm.vehicle_id = v.vehicle_id
              ) AS tags
            FROM VEHICLES v
            JOIN VEHICLE_MAKES vm ON v.make_id = vm.make_id
            JOIN VEHICLE_MODELS vmod ON v.model_id = vmod.model_id
            LEFT JOIN DEALER_INVENTORY di ON v.vehicle_id = di.vehicle_id
            ${whereClause}
            ORDER BY ${orderByClause}
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1};
        `;

        const countQuery = `
            SELECT COUNT(*)
            FROM VEHICLES v
            JOIN VEHICLE_MAKES vm ON v.make_id = vm.make_id
            JOIN VEHICLE_MODELS vmod ON v.model_id = vmod.model_id
            ${whereClause};
        `;

        const filterStatsQuery = `
            SELECT
              COUNT(*) FILTER (WHERE v.status = 'available') AS total_available,
              COUNT(*) FILTER (WHERE v.status = 'sold') AS total_sold,
              COUNT(*) FILTER (WHERE v.body_type = 'sedan') AS sedan_count,
              COUNT(*) FILTER (WHERE v.body_type = 'suv') AS suv_count,
              COUNT(*) FILTER (WHERE v.body_type = 'truck') AS truck_count,
              COUNT(*) FILTER (WHERE v.fuel_type = 'electric') AS electric_count,
              COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM VEHICLE_TAG_MAPPING vtm JOIN VEHICLE_TAGS vt ON vtm.tag_id = vt.tag_id WHERE vtm.vehicle_id = v.vehicle_id AND vt.name = 'luxury')) AS luxury_count,
              COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM VEHICLE_TAG_MAPPING vtm JOIN VEHICLE_TAGS vt ON vtm.tag_id = vt.tag_id WHERE vtm.vehicle_id = v.vehicle_id AND vt.name = 'compact')) AS compact_count
            FROM VEHICLES v
            JOIN VEHICLE_MAKES vm ON v.make_id = vm.make_id
            JOIN VEHICLE_MODELS vmod ON v.model_id = vmod.model_id
            ${whereClause};
        `;

        const client = await pool.connect();
        try {
            const vehiclesResult = await client.query(vehicleQuery, [...values, parsedLimit, offset]);
            const vehicles = vehiclesResult.rows.map(row => ({
                id: row.id,
                make: row.make,
                model: row.model,
                year: row.year,
                vin: row.vin,
                price: parseFloat(row.price),
                mileage: row.mileage,
                status: row.status,
                tags: row.tags || [],
                date_added: row.date_added ? new Date(row.date_added).toISOString().split('T')[0] : null,
                image_url: row.image_url,
                body_type: row.body_type,
                is_featured: row.is_featured,
            }));

            const countResult = await client.query(countQuery, values);
            const totalItems = parseInt(countResult.rows[0].count);
            const totalPages = Math.ceil(totalItems / parsedLimit);

            const filterStatsResult = await client.query(filterStatsQuery, values);
            const stats = filterStatsResult.rows[0];

            return {
                vehicles,
                pagination: {
                    current_page: parsedPage,
                    total_pages: totalPages,
                    total_items: totalItems,
                    items_per_page: parsedLimit,
                    has_next: parsedPage < totalPages,
                    has_previous: parsedPage > 1,
                },
                filters: {
                    total_available: parseInt(stats.total_available),
                    total_sold: parseInt(stats.total_sold),
                    categories: {
                        sedan: parseInt(stats.sedan_count),
                        suv: parseInt(stats.suv_count),
                        truck: parseInt(stats.truck_count),
                        electric: parseInt(stats.electric_count),
                        luxury: parseInt(stats.luxury_count || '0'),
                        compact: parseInt(stats.compact_count || '0')
                    }
                }
            };
        } finally {
            client.release();
        }
    }

    /**
   * Deletes a vehicle and all its associated data from the database
   * and related images from Firebase.
   * @param {number} vehicleId - The ID of the vehicle to delete.
   * @returns {object|null} - The deleted vehicle object if successful, null if not found.
   * @throws {Error} - If any database or Firebase operation fails.
   */
    static async deleteVehicle(vehicle_id) {
        let client; // Declare client for finally block scope

        try {
            client = await pool.connect();
            await client.query('BEGIN'); // Start a transaction

            // 1. Fetch image URLs before deleting vehicle data
            const imagesQuery = 'SELECT image_urls FROM VEHICLE_IMAGES WHERE vehicle_id = $1';
            const imagesResult = await client.query(imagesQuery, [vehicle_id]);
            const imageUrlsToDelete = imagesResult.rows.length > 0 ? imagesResult.rows[0].image_urls : [];

            // 2. Delete/Update related records based on foreign key constraints
            await client.query('DELETE FROM VEHICLE_SALES WHERE vehicle_id = $1', [vehicle_id]);
            await client.query('DELETE FROM AUCTION_VEHICLES WHERE vehicle_id = $1', [vehicle_id]);
            await client.query('DELETE FROM TEST_DRIVE_APPOINTMENTS WHERE vehicle_id = $1', [vehicle_id]);
            await client.query('DELETE FROM SERVICE_APPOINTMENTS WHERE vehicle_id = $1', [vehicle_id]);

            // For ON DELETE SET NULL (e.g., PAYMENTS, DOCUMENTS)
            await client.query('UPDATE PAYMENTS SET vehicle_id = NULL WHERE vehicle_id = $1', [vehicle_id]);
            await client.query('UPDATE DOCUMENTS SET vehicle_id = NULL WHERE vehicle_id = $1', [vehicle_id]);

            // 3. Delete the vehicle from the main VEHICLES table
            const deleteVehicleQuery = 'DELETE FROM VEHICLES WHERE vehicle_id = $1 RETURNING *';
            const result = await client.query(deleteVehicleQuery, [vehicle_id]);

            if (result.rows.length === 0) {
                await client.query('ROLLBACK'); // Rollback if vehicle not found
                return null; // Indicate vehicle not found
            }

            // 4. Commit database changes first
            await client.query('COMMIT');

            // 5. Delete images from Firebase Storage (after successful DB commit)
            await deleteFromFirebase(imageUrlsToDelete);

            return result.rows[0]; // Return the deleted vehicle object
        } catch (error) {
            if (client) {
                await client.query('ROLLBACK'); // Rollback on error
            }
            console.error('Error in VehicleModel.deleteVehicle:', error);
            throw error; // Re-throw the error for the controller to handle
        } finally {
            if (client) {
                client.release(); // Release client back to pool
            }
        }
    }
}

module.exports = InventoryModel;