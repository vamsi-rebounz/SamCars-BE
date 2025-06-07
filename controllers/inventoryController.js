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

                // Fetch the complete vehicle data to return
                const vehicleQuery = `
                    SELECT 
                        v.vehicle_id as id,
                        vm.name as make,
                        vmod.name as model,
                        v.year,
                        v.price,
                        v.mileage,
                        v.vin,
                        v.exterior_color,
                        v.interior_color,
                        v.transmission,
                        v.body_type,
                        v.description,
                        vi.image_urls as images,
                        array_agg(vt.name) as tags
                    FROM vehicles v
                    JOIN vehicle_makes vm ON v.make_id = vm.make_id
                    JOIN vehicle_models vmod ON v.model_id = vmod.model_id
                    LEFT JOIN vehicle_images vi ON v.vehicle_id = vi.vehicle_id
                    LEFT JOIN vehicle_tag_mapping vtm ON v.vehicle_id = vtm.vehicle_id
                    LEFT JOIN vehicle_tags vt ON vtm.tag_id = vt.tag_id
                    WHERE v.vehicle_id = $1
                    GROUP BY 
                        v.vehicle_id, 
                        vm.name, 
                        vmod.name,
                        v.year,
                        v.price,
                        v.mileage,
                        v.vin,
                        v.exterior_color,
                        v.interior_color,
                        v.transmission,
                        v.body_type,
                        v.description,
                        vi.image_urls`;

                const vehicleData = await client.query(vehicleQuery, [vehicle_id]);

                res.status(201).json({
                    success: true,
                    message: 'Vehicle added successfully',
                    vehicle: vehicleData.rows[0]
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
                success: false,
                message: 'Failed to add vehicle',
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
            const vehicleId = req.query.id;
            if (!vehicleId) {
                return res.status(400).json({
                    success: false,
                    message: 'Vehicle ID is required'
                });
            }

            // Start transaction
            await client.query('BEGIN');

            // Check if vehicle exists
            const vehicleExists = await client.query(
                'SELECT vehicle_id FROM vehicles WHERE vehicle_id = $1',
                [vehicleId]
            );

            if (vehicleExists.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Vehicle not found'
                });
            }

            // Build update query dynamically based on provided fields
            const updates = [];
            const values = [vehicleId];
            let paramCount = 2;

            const addUpdateField = (field, value) => {
                if (value !== undefined && value !== null) {
                    updates.push(`${field} = $${paramCount}`);
                    values.push(value);
                    paramCount++;
                }
            };

            // Handle basic fields
            addUpdateField('year', req.body.year ? parseInt(req.body.year) : null);
            addUpdateField('price', req.body.price ? parseFloat(req.body.price) : null);
            addUpdateField('mileage', req.body.mileage ? parseInt(req.body.mileage) : null);
            addUpdateField('vin', req.body.vin);
            addUpdateField('exterior_color', req.body.exterior_color);
            addUpdateField('interior_color', req.body.interior_color);
            addUpdateField('transmission', req.body.transmission);
            addUpdateField('body_type', req.body.body_type);
            addUpdateField('description', req.body.description);

            // Update vehicle base data if there are any changes
            if (updates.length > 0) {
                const updateQuery = `
                    UPDATE vehicles 
                    SET ${updates.join(', ')}
                    WHERE vehicle_id = $1
                `;
                await client.query(updateQuery, values);
            }

            // Handle make and model updates if provided
            if (req.body.make) {
                // Get or create make
                let makeResult = await client.query(
                    'SELECT make_id FROM vehicle_makes WHERE name = $1',
                    [req.body.make]
                );

                let make_id;
                if (makeResult.rows.length === 0) {
                    const newMake = await client.query(
                        'INSERT INTO vehicle_makes (name) VALUES ($1) RETURNING make_id',
                        [req.body.make]
                    );
                    make_id = newMake.rows[0].make_id;
                } else {
                    make_id = makeResult.rows[0].make_id;
                }

                // Update vehicle's make_id
                await client.query(
                    'UPDATE vehicles SET make_id = $1 WHERE vehicle_id = $2',
                    [make_id, vehicleId]
                );

                // If model is also provided, update it
                if (req.body.model) {
                    let modelResult = await client.query(
                        'SELECT model_id FROM vehicle_models WHERE make_id = $1 AND name = $2',
                        [make_id, req.body.model]
                    );

                    let model_id;
                    if (modelResult.rows.length === 0) {
                        const newModel = await client.query(
                            'INSERT INTO vehicle_models (make_id, name) VALUES ($1, $2) RETURNING model_id',
                            [make_id, req.body.model]
                        );
                        model_id = newModel.rows[0].model_id;
                    } else {
                        model_id = modelResult.rows[0].model_id;
                    }

                    await client.query(
                        'UPDATE vehicles SET model_id = $1 WHERE vehicle_id = $2',
                        [model_id, vehicleId]
                    );
                }
            } else if (req.body.model) {
                // If only model is provided, get current make_id
                const currentMake = await client.query(
                    'SELECT make_id FROM vehicles WHERE vehicle_id = $1',
                    [vehicleId]
                );

                let modelResult = await client.query(
                    'SELECT model_id FROM vehicle_models WHERE make_id = $1 AND name = $2',
                    [currentMake.rows[0].make_id, req.body.model]
                );

                let model_id;
                if (modelResult.rows.length === 0) {
                    const newModel = await client.query(
                        'INSERT INTO vehicle_models (make_id, name) VALUES ($1, $2) RETURNING model_id',
                        [currentMake.rows[0].make_id, req.body.model]
                    );
                    model_id = newModel.rows[0].model_id;
                } else {
                    model_id = modelResult.rows[0].model_id;
                }

                await client.query(
                    'UPDATE vehicles SET model_id = $1 WHERE vehicle_id = $2',
                    [model_id, vehicleId]
                );
            }

            // Handle tags if provided
            if (req.body.tags) {
                const tags = typeof req.body.tags === 'string' ? JSON.parse(req.body.tags) : req.body.tags;
                
                // Remove existing tags
                await client.query(
                    'DELETE FROM vehicle_tag_mapping WHERE vehicle_id = $1',
                    [vehicleId]
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
                        [vehicleId, tag_id]
                    );
                }
            }

            // Handle image uploads if provided
            if (req.files && req.files.length > 0) {
                // Get existing images
                const existingImages = await client.query(
                    'SELECT image_urls FROM vehicle_images WHERE vehicle_id = $1',
                    [vehicleId]
                );

                // Delete existing images from storage if they exist
                if (existingImages.rows.length > 0 && existingImages.rows[0].image_urls) {
                    const storage = getStorage();
                    const deletePromises = existingImages.rows[0].image_urls.map(url => 
                        deleteFromFirebase(url)
                    );
                    await Promise.all(deletePromises);
                }

                // Upload new images
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

                // Update or insert new images
                if (existingImages.rows.length > 0) {
                    await client.query(
                        `UPDATE vehicle_images 
                        SET image_urls = $1, image_metadata = $2 
                        WHERE vehicle_id = $3`,
                        [imageUrls, JSON.stringify(imageMetadata), vehicleId]
                    );
                } else {
                    await client.query(
                        `INSERT INTO vehicle_images (
                            vehicle_id, 
                            image_urls, 
                            image_metadata, 
                            primary_image_index
                        ) VALUES ($1, $2, $3, $4)`,
                        [vehicleId, imageUrls, JSON.stringify(imageMetadata), 0]
                    );
                }
            }

            // Fetch updated vehicle data
            const vehicleQuery = `
                SELECT 
                    v.vehicle_id as id,
                    vm.name as make,
                    vmod.name as model,
                    v.year,
                    v.price,
                    v.mileage,
                    v.vin,
                    v.exterior_color,
                    v.interior_color,
                    v.transmission,
                    v.body_type,
                    v.description,
                    vi.image_urls as images,
                    array_agg(vt.name) as tags
                FROM vehicles v
                JOIN vehicle_makes vm ON v.make_id = vm.make_id
                JOIN vehicle_models vmod ON v.model_id = vmod.model_id
                LEFT JOIN vehicle_images vi ON v.vehicle_id = vi.vehicle_id
                LEFT JOIN vehicle_tag_mapping vtm ON v.vehicle_id = vtm.vehicle_id
                LEFT JOIN vehicle_tags vt ON vtm.tag_id = vt.tag_id
                WHERE v.vehicle_id = $1
                GROUP BY 
                    v.vehicle_id, 
                    vm.name, 
                    vmod.name,
                    v.year,
                    v.price,
                    v.mileage,
                    v.vin,
                    v.exterior_color,
                    v.interior_color,
                    v.transmission,
                    v.body_type,
                    v.description,
                    vi.image_urls`;

            const vehicleData = await client.query(vehicleQuery, [vehicleId]);

            await client.query('COMMIT');

            res.json({
                success: true,
                message: 'Vehicle updated successfully',
                vehicle: vehicleData.rows[0]
            });

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Error updating vehicle:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to update vehicle',
                details: error.message
            });
        } finally {
            client.release();
        }
    }
}

module.exports = InventoryController; 