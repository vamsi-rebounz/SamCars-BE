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
            await client.query('BEGIN');

            const {
                make,
                model,
                year,
                price,
                mileage,
                vin,
                exterior_color,
                interior_color,
                transmission,
                body_type,
                description,
                tags
            } = vehicleData;

            // 1. First check if make exists, if not create it
            let makeResult = await client.query(
                'SELECT make_id FROM VEHICLE_MAKES WHERE name = $1',
                [make]
            );

            let make_id;
            if (makeResult.rows.length === 0) {
                const newMake = await client.query(
                    'INSERT INTO VEHICLE_MAKES (name) VALUES ($1) RETURNING make_id',
                    [make]
                );
                make_id = newMake.rows[0].make_id;
            } else {
                make_id = makeResult.rows[0].make_id;
            }

            // 2. Check if model exists for this make, if not create it
            let modelResult = await client.query(
                'SELECT model_id FROM VEHICLE_MODELS WHERE make_id = $1 AND name = $2',
                [make_id, model]
            );

            let model_id;
            if (modelResult.rows.length === 0) {
                const newModel = await client.query(
                    'INSERT INTO VEHICLE_MODELS (make_id, name) VALUES ($1, $2) RETURNING model_id',
                    [make_id, model]
                );
                model_id = newModel.rows[0].model_id;
            } else {
                model_id = modelResult.rows[0].model_id;
            }

            // 3. Insert the vehicle
            const vehicleResult = await client.query(
                `INSERT INTO VEHICLES (
                    make_id, model_id, year, price, mileage, vin,
                    exterior_color, interior_color, transmission,
                    body_type, description, status
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'available')
                RETURNING vehicle_id`,
                [
                    make_id, model_id, year, price, mileage, vin,
                    exterior_color, interior_color, transmission,
                    body_type, description
                ]
            );

            const vehicle_id = vehicleResult.rows[0].vehicle_id;

            // 4. Handle tags if provided
            if (tags && tags.length > 0) {
                for (const tag of tags) {
                    // Check if tag exists or create it
                    let tagResult = await client.query(
                        'SELECT tag_id FROM VEHICLE_TAGS WHERE name = $1',
                        [tag]
                    );

                    let tag_id;
                    if (tagResult.rows.length === 0) {
                        const newTag = await client.query(
                            'INSERT INTO VEHICLE_TAGS (name) VALUES ($1) RETURNING tag_id',
                            [tag]
                        );
                        tag_id = newTag.rows[0].tag_id;
                    } else {
                        tag_id = tagResult.rows[0].tag_id;
                    }

                    // Create tag mapping
                    await client.query(
                        'INSERT INTO VEHICLE_TAG_MAPPING (vehicle_id, tag_id) VALUES ($1, $2)',
                        [vehicle_id, tag_id]
                    );
                }
            }

            // 5. Handle image uploads if provided
            if (files && files.length > 0) {
                // Upload all images to Firebase concurrently
                const uploadPromises = files.map(file =>
                    uploadToFirebase(file.buffer, file.originalname, file.mimetype)
                );
                const imageUrls = await Promise.all(uploadPromises);

                // Create metadata for each image
                const imageMetadata = files.map((file, index) => ({
                    originalName: file.originalname,
                    mimeType: file.mimetype,
                    size: file.size,
                    uploadedAt: new Date().toISOString(),
                    url: imageUrls[index]
                }));

                // Insert into vehicle_images with array of URLs and metadata
                await client.query(
                    `INSERT INTO vehicle_images (
                        vehicle_id,
                        image_urls,
                        image_metadata,
                        primary_image_index
                    ) VALUES ($1, $2, $3, $4)`,
                    [
                        vehicle_id,
                        imageUrls,
                        JSON.stringify(imageMetadata),
                        0 // First image is primary by default
                    ]
                );
            }

            await client.query('COMMIT');
            return vehicle_id;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
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
            await client.query('BEGIN');

            // 1. Check if vehicle exists
            const vehicleCheck = await client.query(
                'SELECT vehicle_id FROM vehicles WHERE vehicle_id = $1',
                [vehicle_id]
            );

            if (vehicleCheck.rows.length === 0) {
                throw new Error('Vehicle not found');
            }

            const {
                make,
                model,
                year,
                price,
                mileage,
                vin,
                exterior_color,
                interior_color,
                transmission,
                fuel_type,
                engine,
                condition,
                features,
                is_featured,
                status,
                description,
                tags
            } = vehicleData;


            // 2. Handle make and model updates if provided
            let make_id;
            let model_id; // Initialize model_id here
            if (make) {
                const makeResult = await client.query(
                    'SELECT make_id FROM vehicle_makes WHERE name = $1',
                    [make]
                );
                if (makeResult.rows.length === 0) {
                    const newMake = await client.query(
                        'INSERT INTO vehicle_makes (name) VALUES ($1) RETURNING make_id',
                        [make]
                    );
                    make_id = newMake.rows[0].make_id;
                } else {
                    make_id = makeResult.rows[0].make_id;
                }
            }

            if (model && make_id) { // Ensure make_id is available if model is provided
                const modelResult = await client.query(
                    'SELECT model_id FROM vehicle_models WHERE make_id = $1 AND name = $2',
                    [make_id, model]
                );
                if (modelResult.rows.length === 0) {
                    const newModel = await client.query(
                        'INSERT INTO vehicle_models (make_id, name) VALUES ($1, $2) RETURNING model_id',
                        [make_id, model]
                    );
                    model_id = newModel.rows[0].model_id;
                } else {
                    model_id = modelResult.rows[0].model_id;
                }
            } else if (model && !make_id) {
                // If model is provided but make_id is not (meaning make wasn't updated),
                // we need to get the existing make_id for the vehicle to correctly associate the model.
                const currentVehicleMake = await client.query(
                    'SELECT make_id FROM vehicles WHERE vehicle_id = $1',
                    [vehicle_id]
                );
                if (currentVehicleMake.rows.length > 0) {
                    make_id = currentVehicleMake.rows[0].make_id;
                    const modelResult = await client.query(
                        'SELECT model_id FROM vehicle_models WHERE make_id = $1 AND name = $2',
                        [make_id, model]
                    );
                    if (modelResult.rows.length === 0) {
                        const newModel = await client.query(
                            'INSERT INTO vehicle_models (make_id, name) VALUES ($1, $2) RETURNING model_id',
                            [make_id, model]
                        );
                        model_id = newModel.rows[0].model_id;
                    } else {
                        model_id = modelResult.rows[0].model_id;
                    }
                }
            }


            // 3. Update vehicle basic details
            const updateFields = [];
            const updateValues = [];
            let valueCounter = 1;

            const addUpdateField = (field, value) => {
                // Only add to update if the value is explicitly provided in the update payload
                // and not undefined, allowing nulls to be set if intended.
                if (value !== undefined) {
                    updateFields.push(`${field} = $${valueCounter}`);
                    updateValues.push(value);
                    valueCounter++;
                }
            };

            addUpdateField('make_id', make_id);
            addUpdateField('model_id', model_id);
            addUpdateField('year', year);
            addUpdateField('price', price);
            addUpdateField('mileage', mileage);
            addUpdateField('exterior_color', exterior_color);
            addUpdateField('interior_color', interior_color);
            addUpdateField('transmission', transmission);
            addUpdateField('fuel_type', fuel_type);
            addUpdateField('engine', engine);
            addUpdateField('vin', vin);
            addUpdateField('condition', condition);
            addUpdateField('is_featured', is_featured);
            addUpdateField('status', status);
            addUpdateField('updated_at', new Date());
            addUpdateField('description', description);

            if (updateFields.length > 0) {
                const updateQuery = `
                    UPDATE vehicles
                    SET ${updateFields.join(', ')}
                    WHERE vehicle_id = $${valueCounter}
                `;
                updateValues.push(vehicle_id);
                await client.query(updateQuery, updateValues);
            }

            // 4. Handle features update if provided
            if (features !== undefined) { // Check if features array is provided
                // Remove existing feature mappings
                await client.query(
                    'DELETE FROM vehicle_feature_mapping WHERE vehicle_id = $1',
                    [vehicle_id]
                );

                // Add new features
                const processedFeatures = new Set();
                for (const feature of features) {
                    if (processedFeatures.has(feature)) continue;
                    processedFeatures.add(feature);

                    let featureResult = await client.query(
                        'SELECT feature_id FROM vehicle_features WHERE name = $1',
                        [feature]
                    );

                    let feature_id;
                    if (featureResult.rows.length === 0) {
                        const newFeature = await client.query(
                            'INSERT INTO vehicle_features (name) VALUES ($1) RETURNING feature_id',
                            [feature]
                        );
                        feature_id = newFeature.rows[0].feature_id;
                    } else {
                        feature_id = featureResult.rows[0].feature_id;
                    }

                    await client.query(
                        'INSERT INTO vehicle_feature_mapping (vehicle_id, feature_id) VALUES ($1, $2)',
                        [vehicle_id, feature_id]
                    );
                }
            }

            // 5. Handle image updates if new files are provided
            if (files && files.length > 0) {
                // Fetch current image URLs
                const currentImages = await client.query(
                    'SELECT image_urls FROM vehicle_images WHERE vehicle_id = $1',
                    [vehicle_id]
                );

                if (currentImages.rows.length > 0 && currentImages.rows[0].image_urls) {
                    const oldImageUrls = currentImages.rows[0].image_urls;

                    // Delete each old image from Firebase
                    for (const url of oldImageUrls) {
                        await deleteFromFirebase(url);
                    }

                    // Delete existing image records from the DB
                    await client.query(
                        'DELETE FROM vehicle_images WHERE vehicle_id = $1',
                        [vehicle_id]
                    );
                }

                // Upload new images
                const uploadPromises = files.map(file =>
                    uploadToFirebase(file.buffer, file.originalname, file.mimetype)
                );
                const uploadedImageUrls = await Promise.all(uploadPromises);

                // Create metadata for each new image
                const newImageMetadata = files.map((file, index) => ({
                    originalName: file.originalname,
                    mimeType: file.mimetype,
                    size: file.size,
                    uploadedAt: new Date().toISOString(),
                    url: uploadedImageUrls[index]
                }));

                // Insert new image URLs and metadata into DB
                await client.query(
                    `INSERT INTO vehicle_images (
                        vehicle_id,
                        image_urls,
                        image_metadata,
                        primary_image_index
                    ) VALUES ($1, $2, $3, $4)`,
                    [
                        vehicle_id,
                        uploadedImageUrls,
                        JSON.stringify(newImageMetadata),
                        0 // First image is primary by default for new uploads
                    ]
                );
            }

            // 6. Handle tags update if provided
            if (tags !== undefined) { // Check if tags array is provided
                // Remove existing tag mappings
                await client.query(
                    'DELETE FROM vehicle_tag_mapping WHERE vehicle_id = $1',
                    [vehicle_id]
                );

                // Add new tags
                const processedTags = new Set();
                for (const tag of tags) {
                    if (processedTags.has(tag)) continue;
                    processedTags.add(tag);

                    let tagResult = await client.query(
                        'SELECT tag_id FROM vehicle_tags WHERE name = $1',
                        [tag]
                    );

                    let tag_id;
                    if (tagResult.rows.length === 0) {
                        const newTag = await client.query(
                            'INSERT INTO vehicle_tags (name) VALUES ($1) RETURNING tag_id',
                            [tag]
                        );
                        tag_id = newTag.rows[0].tag_id;
                    } else {
                        tag_id = tagResult.rows[0].tag_id;
                    }

                    await client.query(
                        'INSERT INTO vehicle_tag_mapping (vehicle_id, tag_id) VALUES ($1, $2)',
                        [vehicle_id, tag_id]
                    );
                }
            }

            await client.query('COMMIT');
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
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