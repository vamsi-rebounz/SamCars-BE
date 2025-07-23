const { validateVehicleData } = require('../validators/vehicleValidator');
const { buildWhereClauseForInventory } = require('../helpers/inventoryHelper');
const InventoryModel = require('../models/inventoryModel');

class InventoryController {
    /**
     * Add a new vehicle to the inventory
     * @param {object} req - Express request object
     * @param {object} res - Express response object
     */
    static async addVehicle(req, res) {
        try {
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
                fuel_type: req.body.fuel_type,
                description: req.body.description,
                status: req.body.status,
                condition : req.body.condition,
                tags: req.body.tags ? (typeof req.body.tags === 'string' ? JSON.parse(req.body.tags) : req.body.tags) : [],
                features: req.body.features ? (typeof req.body.features === 'string' ? JSON.parse(req.body.features) : req.body.features) : [],
                carfax_link: req.body.carfax_link,
                location: req.body.location,
                stock_number: req.body.stock_number
            };

            console.log('Received vehicle data:', vehicleData);
            console.log('Received files:', req.files);

            // Validate request data
            const validationError = validateVehicleData(vehicleData);
            if (validationError) {
                return res.status(400).json({ error: validationError });
            }

            const vehicle_id = await InventoryModel.addVehicle(vehicleData, req.files);

            res.status(201).json({
                message: 'Vehicle added successfully',
                vehicle_id: vehicle_id,
                received_files: req.files // Debug: return received files
            });

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
        try {
            const { id } = req.query;
            
            console.log('Update vehicle request body:', req.body);
            console.log('Update vehicle files:', req.files);
            
            let vehicleData = {};
            try {
                // Only include fields that are actually provided in the request
                if (req.body.make) vehicleData.make = req.body.make;
                if (req.body.model) vehicleData.model = req.body.model;
                if (req.body.year) vehicleData.year = parseInt(req.body.year);
                if (req.body.price) vehicleData.price = parseFloat(req.body.price);
                if (req.body.mileage) vehicleData.mileage = parseInt(req.body.mileage);
                if (req.body.vin) vehicleData.vin = req.body.vin;
                if (req.body.exterior_color) vehicleData.exterior_color = req.body.exterior_color;
                if (req.body.interior_color) vehicleData.interior_color = req.body.interior_color;
                if (req.body.transmission) vehicleData.transmission = req.body.transmission;
                if (req.body.fuel_type) vehicleData.fuel_type = req.body.fuel_type;
                if (req.body.engine) vehicleData.engine = req.body.engine;
                if (req.body.condition) vehicleData.condition = req.body.condition;
                if (req.body.is_featured !== undefined) vehicleData.is_featured = req.body.is_featured === 'true';
                if (req.body.status) vehicleData.status = req.body.status;
                if (req.body.description) vehicleData.description = req.body.description;
                if (req.body.carfax_link) vehicleData.carfax_link = req.body.carfax_link;
                if (req.body.location) vehicleData.location = req.body.location;
                if (req.body.body_type) vehicleData.body_type = req.body.body_type;
                if (req.body.stock_number) vehicleData.stock_number = req.body.stock_number;

                // Handle features and tags
                if (req.body.features) {
                    vehicleData.features = typeof req.body.features === 'string' ? 
                        JSON.parse(req.body.features) : req.body.features;
                }
                if (req.body.tags) {
                    vehicleData.tags = typeof req.body.tags === 'string' ? 
                        JSON.parse(req.body.tags) : req.body.tags;
                }
            } catch (error) {
                console.error('Error constructing vehicleData:', error);
                console.error('Request body that caused error:', req.body);
                return res.status(400).json({
                    status: 'error',
                    message: 'Invalid data format',
                    details: error.message
                });
            }

            // Parse images to delete
            let imagesToDelete = [];
            if (req.body.images_to_delete) {
                try {
                    imagesToDelete = typeof req.body.images_to_delete === 'string' ? 
                        JSON.parse(req.body.images_to_delete) : req.body.images_to_delete;
                } catch (error) {
                    console.error('Error parsing images_to_delete:', error);
                    return res.status(400).json({
                        status: 'error',
                        message: 'Invalid images_to_delete format',
                        details: error.message
                    });
                }
            }

            // Parse existing images
            let existingImages = [];
            if (req.body.existing_images) {
                try {
                    existingImages = typeof req.body.existing_images === 'string' ? 
                        JSON.parse(req.body.existing_images) : req.body.existing_images;
                } catch (error) {
                    console.error('Error parsing existing_images:', error);
                    return res.status(400).json({
                        status: 'error',
                        message: 'Invalid existing_images format',
                        details: error.message
                    });
                }
            }

            // Validate vehicle data
            const validationError = validateVehicleData(vehicleData, true); // true for partial update
            if (validationError) {
                return res.status(400).json({ error: validationError });
            }

            console.log('Calling InventoryModel.updateVehicle...');
            await InventoryModel.updateVehicle(
                parseInt(id), 
                vehicleData, 
                req.files || [], 
                null, // Let model handle client
                imagesToDelete,
                existingImages
            );
            console.log('InventoryModel.updateVehicle completed successfully');

            res.status(200).json({
                status: 'success',
                message: 'Vehicle updated successfully',
                vehicle_id: id,
                received_files: req.files
            });

        } catch (error) {
            console.error('Error updating vehicle:', error);
            let statusCode = 500;
            let message = 'Failed to update vehicle';
            if (error.message === 'Vehicle not found') {
                statusCode = 404;
                message = error.message;
            }
            res.status(statusCode).json({
                status: 'error',
                message: message,
                details: error.message
            });
        }
    }

    /**
     * Get inventory with filters
     * @param {*} req - Express request object
     * @param {*} res - Express response object
     */
    static async getInventory(req, res) {
        try {
            const {
                category = 'all',
                limit = '10',
                page = '1',
                search = '',
                sort_by = 'date_added',
                sort_order = 'desc',
                status = 'all'
            } = req.query;

            const inventoryData = await InventoryModel.getInventory({
                category,
                limit,
                page,
                search,
                sortBy: sort_by,
                sortOrder: sort_order,
                status
            }, buildWhereClauseForInventory); // Pass the helper function

            res.status(200).json({
                status: 'success',
                data: inventoryData
            });

        } catch (error) {
            console.error('Error fetching inventory:', error);
            let statusCode = 500;
            let message = 'Internal server error.';
            if (error.message.includes('Invalid sort_by field')) {
                statusCode = 400;
                message = error.message;
            }
            res.status(statusCode).json({ status: 'error', message: message });
        }
    }

    /**
     * Deletes a vehicle and its associated data.
     * @param {object} req - Express request object.
     * @param {object} res - Express response object.
     */
    static async deleteVehicle(req, res) {
        const vehicle_id = parseInt(req.params.id, 10);
        console.log("Vehicle id :", vehicle_id);
        // Input validation
        if (isNaN(vehicle_id)) {
            return res.status(400).json({ error: 'Invalid vehicle ID provided. Must be a number.' });
        }

        try {
            const deletedVehicle = await InventoryModel.deleteVehicle(vehicle_id);

            if (!deletedVehicle) {
                return res.status(404).json({ message: 'Vehicle not found.' });
            }

            res.status(200).json({
                status: "success",
                message: "Vehicle and all associated data deleted successfully.",
                data: {
                  deleted_vehicle_id: deletedVehicle.vehicle_id, // Use appropriate ID field
                  deleted_at: new Date().toISOString() // Current timestamp in ISO format
                }
            });
        } catch (error) {
            console.error('Error in VehicleController.deleteVehicleById:', error);
            res.status(500).json({ error: 'An internal server error occurred while deleting the vehicle.', details: error.message });
        }
    }
}

module.exports = InventoryController;