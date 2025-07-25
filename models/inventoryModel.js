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
                condition = 'used', // Default to 'used' if not provided
                status = 'available', // Default to 'available' if not provided
                tags = [],
                features = [],
                carfax_link = null, // Default to null if not provided
                fuel_type,
                location,
                stock_number,
                engine,
                is_bought_in_auction = false,
                seller_name = null,
                seller_email = null,
                seller_phone = null,
                bought_price = null,
                repair_costs = null,
                sold_price = null,
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
    
            // 3. Insert the vehicle with status and condition
            const vehicleResult = await client.query(
                `INSERT INTO VEHICLES (
                    make_id, model_id, year, price, mileage, vin,
                    exterior_color, interior_color, transmission,
                    body_type, description, condition, status, carfax_link, fuel_type, location, stock_number, engine,
                    is_bought_in_auction, seller_name, seller_email, seller_phone, bought_price, repair_costs, sold_price
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18,
                   $19, $20, $21, $22, $23, $24, $25)
                RETURNING vehicle_id`,
                [
                    make_id, model_id, year, price, mileage, vin,
                    exterior_color, interior_color, transmission,
                    body_type, description, condition, status, carfax_link, fuel_type, location, stock_number, engine,
                    is_bought_in_auction, seller_name, seller_email, seller_phone, bought_price, repair_costs, sold_price
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

            // 5. Handle features
            if (features.length > 0) {
                const processedFeatures = new Set(); // To avoid duplicates
                
                for (const feature of features) {
                    if (processedFeatures.has(feature)) continue;
                    processedFeatures.add(feature);

                    let featureResult = await client.query(
                        'SELECT feature_id FROM VEHICLE_FEATURES WHERE name = $1',
                        [feature]
                    );

                    let feature_id;
                    if (featureResult.rows.length === 0) {
                        const newFeature = await client.query(
                            'INSERT INTO VEHICLE_FEATURES (name) VALUES ($1) RETURNING feature_id',
                            [feature]
                        );
                        feature_id = newFeature.rows[0].feature_id;
                    } else {
                        feature_id = featureResult.rows[0].feature_id;
                    }

                    await client.query(
                        'INSERT INTO VEHICLE_FEATURE_MAPPING (vehicle_id, feature_id) VALUES ($1, $2)',
                        [vehicle_id, feature_id]
                    );
                }
            }

    
            // 6. Handle image uploads if provided
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
     * @param {object} client - Database client for transaction management.
     * @param {Array<string>} imagesToDelete - Array of image URLs to delete.
     * @param {Array<string>} existingImages - Array of image URLs to keep.
     * @returns {Promise<void>}
     */
    static async updateVehicle(vehicle_id, vehicleData, files = [], client = pool, imagesToDelete = [], existingImages = []) {
        console.log('InventoryModel.updateVehicle called with:', { 
            vehicle_id, 
            vehicleData, 
            filesCount: files?.length, 
            hasClient: !!client,
            imagesToDeleteCount: imagesToDelete?.length,
            existingImagesCount: existingImages?.length
        });
        
        const shouldReleaseClient = !client;
        if (shouldReleaseClient) {
            client = await pool.connect();
        }
        
        try {
            await client.query('BEGIN');
            console.log('Database transaction started');

            // 1. Check if vehicle exists
            console.log('Checking if vehicle exists with ID:', vehicle_id);
            const vehicleCheck = await client.query(
                'SELECT vehicle_id FROM vehicles WHERE vehicle_id = $1',
                [vehicle_id]
            );
            console.log('Vehicle check result:', vehicleCheck.rows);

            if (vehicleCheck.rows.length === 0) {
                throw new Error('Vehicle not found');
            }
            console.log('Vehicle found, proceeding with update');

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
                status,
                body_type,
                fuel_type,
                condition,
                engine,
                location,
                description,
                tags,
                features,
                is_featured,
                carfax_link,
                created_at,
                updated_at,
                stock_number,
                is_bought_in_auction,
                seller_name,
                seller_email,
                seller_phone,
                bought_price,
                repair_costs,
                sold_price,
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
            addUpdateField('is_bought_in_auction', vehicleData.is_bought_in_auction);
            addUpdateField('seller_name', vehicleData.seller_name);
            addUpdateField('seller_email', vehicleData.seller_email);
            addUpdateField('seller_phone', vehicleData.seller_phone);
            addUpdateField('bought_price', vehicleData.bought_price);
            addUpdateField('repair_costs', vehicleData.repair_costs);
            addUpdateField('sold_price', vehicleData.sold_price);
            // Remove status from here as we'll handle it separately
            addUpdateField('description', description);
            addUpdateField('carfax_link', carfax_link);
            addUpdateField('location', location);
            addUpdateField('body_type', body_type);
            addUpdateField('stock_number', stock_number);
            addUpdateField('created_at', created_at);
            addUpdateField('updated_at', updated_at || new Date());
            
            if (updateFields.length > 0) {
                const updateQuery = `
                    UPDATE vehicles
                    SET ${updateFields.join(', ')}
                    WHERE vehicle_id = $${valueCounter}
                `;
                updateValues.push(vehicle_id);
                await client.query(updateQuery, updateValues);
            }

            // Update status in both tables if status is provided
            if (status !== undefined) {
                await InventoryModel.updateVehicleStatus(vehicle_id, status, client);
            }

            // 4. Handle features update if provided
            if (features !== undefined) { // Check if features array is provided
                // PRODUCTION: Ensure features is always an array (controller must guarantee this)
                if (!Array.isArray(features)) {
                    throw new Error('features must be an array. Controller should ensure this.');
                }
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

            // 5. Handle image updates
            const currentImages = await client.query(
                'SELECT image_urls, image_metadata FROM vehicle_images WHERE vehicle_id = $1',
                [vehicle_id]
            );

            let currentImageUrls = [];
            let currentImageMetadata = [];

            if (currentImages.rows.length > 0) {
                currentImageUrls = currentImages.rows[0].image_urls || [];
                const meta = currentImages.rows[0].image_metadata;
                if (meta) {
                    currentImageMetadata = typeof meta === 'string' ? JSON.parse(meta) : meta;
                } else {
                    currentImageMetadata = [];
                }
            }

            // Handle image deletions
            if (imagesToDelete && imagesToDelete.length > 0) {
                console.log('Deleting images:', imagesToDelete);
                
                // Delete specified images from Firebase
                for (const urlToDelete of imagesToDelete) {
                    await deleteFromFirebase(urlToDelete);
                }

                // Remove deleted images from arrays
                currentImageUrls = currentImageUrls.filter(url => !imagesToDelete.includes(url));
                currentImageMetadata = currentImageMetadata.filter(metadata => !imagesToDelete.includes(metadata.url));
            }

            // Handle new image uploads
            if (files && files.length > 0) {
                console.log('Uploading new images:', files.length);
                
                // Upload new images to Firebase
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

                // Add new images to existing arrays
                currentImageUrls = [...currentImageUrls, ...uploadedImageUrls];
                currentImageMetadata = [...currentImageMetadata, ...newImageMetadata];
            }

            // Update or insert image records in DB
            if (currentImageUrls.length > 0) {
                if (currentImages.rows.length > 0) {
                    // Update existing record
                    await client.query(
                        `UPDATE vehicle_images 
                         SET image_urls = $1, image_metadata = $2 
                         WHERE vehicle_id = $3`,
                        [currentImageUrls, JSON.stringify(currentImageMetadata), vehicle_id]
                    );
                } else {
                    // Insert new record
                    await client.query(
                        `INSERT INTO vehicle_images (
                            vehicle_id,
                            image_urls,
                            image_metadata,
                            primary_image_index
                        ) VALUES ($1, $2, $3, $4)`,
                        [vehicle_id, currentImageUrls, JSON.stringify(currentImageMetadata), 0]
                    );
                }
            } else {
                // No images left, delete the record
                await client.query(
                    'DELETE FROM vehicle_images WHERE vehicle_id = $1',
                    [vehicle_id]
                );
            }

            // 6. Handle tags update if provided
            if (tags !== undefined) { // Check if tags array is provided
                // PRODUCTION: Ensure tags is always an array (controller must guarantee this)
                if (!Array.isArray(tags)) {
                    throw new Error('tags must be an array. Controller should ensure this.');
                }
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
        } 
        catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            if (shouldReleaseClient && client) {
                client.release();
            }
        }
    }

    /**
     * Updates vehicle status in both vehicles and auction_vehicles tables.
     * @param {number} vehicleId - The ID of the vehicle to update.
     * @param {string} status - The new status.
     * @param {object} client - Database client for transaction.
     */
    static async updateVehicleStatus(vehicleId, status, client = pool) {
        const shouldReleaseClient = !client;
        if (shouldReleaseClient) {
            client = await pool.connect();
            await client.query('BEGIN');
        }

        try {
            // Update vehicles table
            const vehicleQuery = `
                UPDATE VEHICLES
                SET status = $1, updated_at = CURRENT_TIMESTAMP
                WHERE vehicle_id = $2;
            `;
            await client.query(vehicleQuery, [status, vehicleId]);

            // Update auction_vehicles table if the vehicle exists there
            const auctionQuery = `
                UPDATE AUCTION_VEHICLES
                SET status = $1, updated_at = CURRENT_TIMESTAMP
                WHERE vehicle_id = $2;
            `;
            await client.query(auctionQuery, [status, vehicleId]);

            if (shouldReleaseClient) {
                await client.query('COMMIT');
            }
        } catch (error) {
            if (shouldReleaseClient) {
                await client.query('ROLLBACK');
            }
            throw error;
        } finally {
            if (shouldReleaseClient) {
                client.release();
            }
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
    static async getInventory({ category, limit, page, search, sortBy, sortOrder, status, auction }, buildWhereClauseForInventory) {
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
    
        const { whereClause, values, paramIndex } = buildWhereClauseForInventory({ search, status, category, auction });
    
        const vehicleQuery = `
            SELECT
                v.vehicle_id AS id,
                vm.name AS make,
                vmod.name AS model,
                v.year,
                v.vin,
                v.price,
                v.mileage,
                v.exterior_color,
                v.interior_color,
                v.transmission,
                v.status,
                v.body_type,
                v.fuel_type,
                v.condition,
                v.location,
                v.engine,
                v.description,
                v.is_featured,
                v.carfax_link,
                v.created_at,
                v.updated_at,
                v.stock_number,
                (
                    SELECT vi.image_urls
                    FROM VEHICLE_IMAGES vi
                    WHERE vi.vehicle_id = v.vehicle_id
                    LIMIT 1
                ) AS image_urls,
                ARRAY(
                    SELECT vt.name
                    FROM VEHICLE_TAG_MAPPING vtm
                    JOIN VEHICLE_TAGS vt ON vtm.tag_id = vt.tag_id
                    WHERE vtm.vehicle_id = v.vehicle_id
                ) AS tags,
                ARRAY(
                    SELECT vf.name
                    FROM VEHICLE_FEATURE_MAPPING vfm
                    JOIN VEHICLE_FEATURES vf ON vfm.feature_id = vf.feature_id
                    WHERE vfm.vehicle_id = v.vehicle_id
                ) AS features,
                v.is_bought_in_auction,
                v.seller_name,
                v.seller_email,
                v.seller_phone,
                v.bought_price,
                v.repair_costs,
                v.sold_price
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
            WITH category_counts AS (
                SELECT
                    'body_type' as category_type,
                    body_type::text as category,
                    COUNT(*) as count
                FROM VEHICLES v
                JOIN VEHICLE_MAKES vm ON v.make_id = vm.make_id
                JOIN VEHICLE_MODELS vmod ON v.model_id = vmod.model_id
                ${whereClause}
                GROUP BY body_type
                HAVING body_type IS NOT NULL
                UNION ALL
                SELECT
                    'fuel_type' as category_type,
                    fuel_type::text as category,
                    COUNT(*) as count
                FROM VEHICLES v
                JOIN VEHICLE_MAKES vm ON v.make_id = vm.make_id
                JOIN VEHICLE_MODELS vmod ON v.model_id = vmod.model_id
                ${whereClause}
                GROUP BY fuel_type
                HAVING fuel_type IS NOT NULL
            )
            SELECT
                COUNT(*) FILTER (WHERE v.status = 'available') AS total_available,
                COUNT(*) FILTER (WHERE v.status = 'sold') AS total_sold,
                (
                    SELECT json_object_agg(
                        category,
                        count
                    )
                    FROM category_counts
                ) as categories
            FROM VEHICLES v
            JOIN VEHICLE_MAKES vm ON v.make_id = vm.make_id
            JOIN VEHICLE_MODELS vmod ON v.model_id = vmod.model_id
            ${whereClause};
        `;

        const client = await pool.connect();
        try {
            const [vehiclesResult, countResult, filterStatsResult] = await Promise.all([
                client.query(vehicleQuery, [...values, parsedLimit, offset]),
                client.query(countQuery, values),
                client.query(filterStatsQuery, values)
            ]);

            const totalItems = parseInt(countResult.rows[0].count);
            const totalPages = Math.ceil(totalItems / parsedLimit);

            return {
                vehicles: vehiclesResult.rows,
                pagination: {
                    current_page: parsedPage,
                    total_pages: totalPages,
                    total_items: totalItems,
                    items_per_page: parsedLimit,
                    has_next: parsedPage < totalPages,
                    has_previous: parsedPage > 1
                },
                filter_stats: {
                    total_available: parseInt(filterStatsResult.rows[0].total_available),
                    total_sold: parseInt(filterStatsResult.rows[0].total_sold),
                    categories: filterStatsResult.rows[0].categories
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
    static async deleteVehicle(vehicle_id, client = pool) {
        let shouldReleaseClient = false;
        
        try {
            // Handle transaction client
            if (client === pool) {
                client = await pool.connect();
                await client.query('BEGIN');
                shouldReleaseClient = true;
            }
    
            // 1. Fetch image URLs before deleting vehicle data
            const imagesResult = await client.query(
                'SELECT image_urls FROM vehicle_images WHERE vehicle_id = $1',
                [vehicle_id]
            );
            const imageUrlsToDelete = imagesResult.rows.length > 0 ? imagesResult.rows[0].image_urls : [];
    
            // 2. Delete/Update related records
            await client.query('DELETE FROM vehicle_sales WHERE vehicle_id = $1', [vehicle_id]);
            await client.query('DELETE FROM auction_vehicles WHERE vehicle_id = $1', [vehicle_id]);
            await client.query('DELETE FROM test_drive_appointments WHERE vehicle_id = $1', [vehicle_id]);
            await client.query('DELETE FROM service_appointments WHERE vehicle_id = $1', [vehicle_id]);
            await client.query('UPDATE payments SET vehicle_id = NULL WHERE vehicle_id = $1', [vehicle_id]);
            await client.query('UPDATE documents SET vehicle_id = NULL WHERE vehicle_id = $1', [vehicle_id]);
    
            // 3. Delete the vehicle
            const result = await client.query(
                'DELETE FROM vehicles WHERE vehicle_id = $1 RETURNING *',
                [vehicle_id]
            );
    
            if (result.rows.length === 0) {
                if (shouldReleaseClient) await client.query('ROLLBACK');
                return null;
            }
    
            if (shouldReleaseClient) {
                await client.query('COMMIT');
            }
    
            // 4. Clean up storage after successful commit
            if (imageUrlsToDelete.length > 0) {
                await Promise.all(imageUrlsToDelete.map(url => deleteFromFirebase(url)));
            }
    
            return result.rows[0];
    
        } catch (error) {
            if (shouldReleaseClient) await client.query('ROLLBACK');
            console.error('Error in VehicleModel.deleteVehicle:', error);
            throw error;
        } finally {
            if (shouldReleaseClient && client) {
                client.release();
            }
        }
    }
}

module.exports = InventoryModel;