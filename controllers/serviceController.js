const ServiceModel = require('../models/serviceModel');
const { uploadToFirebase, uploadBase64ToFirebase } = require('../utils/firebaseStorage');

const ServiceController = {
    /**
     * Handles the creation of a new service with image upload.
     * @param {object} req - Express request object
     * @param {object} res - Express response object
     */
    async createService(req, res) {
        try {
            const {
                name,
                description,
                category,
                price,
                duration_minutes,
                warranty_months,
            } = req.body;

            // Debug logging
            console.log('Received category:', category);
            console.log('Category type:', typeof category);
            console.log('Request body:', req.body);

            // Validate required fields
            if (!name || !description || !category || !price || !duration_minutes) {
                return res.status(400).json({
                    success: false,
                    error_code: 'MISSING_REQUIRED_FIELDS',
                    message: 'Name, description, category, price, and duration_minutes are required.'
                });
            }

            // Validate price and duration
            if (price <= 0) {
                return res.status(400).json({
                    success: false,
                    error_code: 'INVALID_PRICE',
                    message: 'Price must be greater than 0.'
                });
            }

            if (duration_minutes <= 0) {
                return res.status(400).json({
                    success: false,
                    error_code: 'INVALID_DURATION',
                    message: 'Duration must be greater than 0 minutes.'
                });
            }

            // Trim the category to remove any whitespace
            const trimmedCategory = category ? category.trim().toLowerCase() : '';

            // Validate category
            const validCategories = ['maintenance', 'repair', 'inspection', 'detailing', 'tire_service'];
            console.log('Trimmed category:', trimmedCategory);
            console.log('Is category valid:', validCategories.includes(trimmedCategory));

            if (!validCategories.includes(trimmedCategory)) {
                return res.status(400).json({
                    success: false,
                    error_code: 'INVALID_CATEGORY',
                    message: `Category must be one of: ${validCategories.join(', ')}`
                });
            }

            // Handle image upload
            let image_url = null;
            if (req.file) {
                try {
                    image_url = await uploadToFirebase(
                        req.file.buffer,
                        req.file.originalname,
                        'service-images'
                    );
                    console.log('Image uploaded successfully:', image_url);
                } catch (uploadError) {
                    console.error('Error uploading image:', uploadError);
                    return res.status(500).json({
                        success: false,
                        error_code: 'IMAGE_UPLOAD_FAILED',
                        message: 'Failed to upload service image.'
                    });
                }
            }

            const newService = await ServiceModel.createService({
                name,
                description,
                category: trimmedCategory,
                price: parseFloat(price),
                duration_minutes: parseInt(duration_minutes),
                image_url,
                warranty_months: warranty_months ? parseInt(warranty_months) : 0
            });

            res.status(201).json({
                success: true,
                message: 'Service created successfully.',
                service: newService
            });
        } catch (error) {
            console.error('Error in createService controller:', error);
            res.status(500).json({
                success: false,
                error_code: 'SERVER_ERROR',
                message: error.message || 'Could not create service.'
            });
        }
    }
};

module.exports = ServiceController; 