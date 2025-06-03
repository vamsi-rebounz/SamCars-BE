const pool = require('../config/db');
const { validateVehicleData } = require('../validators/vehicleValidator');
const { uploadToFirebase } = require('../utils/firebaseUploader');
const { getStorage } = require('firebase-admin/storage');
const { deleteFromFirebase } = require('../utils/firebaseDeleter');

class InventoryController {
    /**
     * Add a new vehicle to the inventory
     * @param {object} req - Express request object
     * @param {object} res - Express response object
     */
    static async addVehicle(req, res) {
        try {
            // Parse form data
            const vehicleData = {
                make: req.body.make,
                model: req.body.model,
                year: parseInt(req.body.year),
                price: parseFloat(req.body.price),
                mileage: req.body.mileage ? parseInt(req.body.mileage) : null,
                vin: req.body.vin,
                exterior_color: req.body.exterior_color,
                interior_color: req.body.interior_color,
                transmission: req.body.transmission,
                body_type: req.body.body_type,
                description: req.body.description,
                tags: req.body.tags ? (typeof req.body.tags === 'string' ? JSON.parse(req.body.tags) : req.body.tags) : []
            };

            console.log('Received vehicle data:', vehicleData);
            console.log('Received files:', req.files);

            // Validate request data
            const validationError = validateVehicleData(vehicleData);
            if (validationError) {
                return res.status(400).json({ error: validationError });
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
                body_type,
                description,
                tags
            } = vehicleData;

            const client = await pool.connect();

            try {
                await client.query('BEGIN');

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
                if (req.files && req.files.length > 0) {
                    // Upload all images to Firebase concurrently
                    const uploadPromises = req.files.map(file => 
                        uploadToFirebase(file.buffer, file.originalname, file.mimetype)
                    );
                    const imageUrls = await Promise.all(uploadPromises);

                    // Create metadata for each image
                    const imageMetadata = req.files.map((file, index) => ({
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

                res.status(201).json({
                    message: 'Vehicle added successfully',
                    vehicle_id: vehicle_id
                });

            } catch (error) {
                await client.query('ROLLBACK');
                throw error;
            } finally {
                client.release();
            }

        } catch (error) {
            console.error('Error adding vehicle:', error);
            res.status(500).json({
                error: 'Failed to add vehicle',
                details: error.message
            });
        }
    }

    /**
     * Update vehicle details
     * @param {object} req - Express request object
     * @param {object} res - Express response object
     */
    static async updateVehicle(req, res) {
        const client = await pool.connect();
        try {
            const { id } = req.query;
            // const {
            //     make,
            //     model,
            //     year,
            //     price,
            //     mileage,
            //     exterior_color,
            //     interior_color,
            //     transmission,
            //     fuel_type,
            //     engine,
            //     vin,
            //     condition,
            //     features,
            //     is_featured,
            //     status,
            //     existing_images_to_keep, // array of image URLs to keep
            //     tags
            // } = req.body;

            const vehicleData = {
                make: req.body.make,
                model: req.body.model,
                year: parseInt(req.body.year),
                price: parseFloat(req.body.price),
                mileage: req.body.mileage ? parseInt(req.body.mileage) : null,
                vin: req.body.vin,
                exterior_color: req.body.exterior_color,
                interior_color: req.body.interior_color,
                transmission: req.body.transmission,
                fuel_type: req.body.fuel_type,
                engine: req.body.engine,
                vin: req.body.vin,
                condition: req.body.condition,
                features: req.body.features ? JSON.parse(req.body.features) : [],
                is_featured: req.body.is_featured,
                status: req.body.status,
                description: req.body.description,
                tags: req.body.tags ? JSON.parse(req.body.tags) : []
            };

            // const validationError = validateVehicleData(vehicleData);
            // if (validationError) {
            //     return res.status(400).json({ error: validationError });
            // }

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

            await client.query('BEGIN');

            // 1. Check if vehicle exists
            const vehicleCheck = await client.query(
                'SELECT vehicle_id FROM vehicles WHERE vehicle_id = $1',
                [id]
            );

            if (vehicleCheck.rows.length === 0) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Vehicle not found'
                });
            }

            // 2. Handle make and model updates if provided
            let make_id, model_id;
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

            if (model && make_id) {
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

            // 3. Update vehicle basic details
            const updateFields = [];
            const updateValues = [];
            let valueCounter = 1;

            const addUpdateField = (field, value) => {
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
                updateValues.push(id);
                await client.query(updateQuery, updateValues);
            }

            // 4. Handle features update if provided
            if (features) {
                // Remove existing feature mappings
                await client.query(
                    'DELETE FROM vehicle_feature_mapping WHERE vehicle_id = $1',
                    [id]
                );

                // Add new features
                const processedFeatures = new Set(); // Track processed features to prevent duplicates
                for (const feature of features) {
                    // Skip if we've already processed this feature
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
                        [id, feature_id]
                    );
                }
            }

            // 5. Handle image updates if provided
            if (req.files && req.files.length > 0) {
                // 1. Fetch current image URLs
                const currentImages = await client.query(
                    'SELECT image_urls FROM vehicle_images WHERE vehicle_id = $1',
                    [id]
                );
            
                if (currentImages.rows.length > 0 && currentImages.rows[0].image_urls) {
                    const oldImageUrls = currentImages.rows[0].image_urls;
            
                    // 2. Delete each image from Firebase
                    for (const url of oldImageUrls) {
                        await deleteFromFirebase(url);
                    }
            
                    // 3. Delete image records from the DB
                    await client.query(
                        'DELETE FROM vehicle_images WHERE vehicle_id = $1',
                        [id]
                    );
                }
            
                // 4. Upload new images
                const uploadPromises = req.files.map(file =>
                    uploadToFirebase(file.buffer, file.originalname, file.mimetype)
                );
                const uploadedImageUrls = await Promise.all(uploadPromises);
            
                // 5. Insert new image URLs into DB
                await client.query(
                    'INSERT INTO vehicle_images (vehicle_id, image_urls) VALUES ($1, $2)',
                    [id, uploadedImageUrls]
                );
            }
            

            // 6. Handle tags update if provided
            if (tags) {
                // Remove existing tag mappings
                await client.query(
                    'DELETE FROM vehicle_tag_mapping WHERE vehicle_id = $1',
                    [id]
                );

                // Add new tags
                for (const tag of tags) {
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
                        [id, tag_id]
                    );
                }
            }

            await client.query('COMMIT');

            res.status(200).json({
                status: 'success',
                message: 'Vehicle updated successfully',
                vehicle_id: id
            });

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Error updating vehicle:', error);
            res.status(500).json({
                status: 'error',
                message: 'Failed to update vehicle',
                details: error.message
            });
        } finally {
            client.release();
        }
    }
}

module.exports = InventoryController; 