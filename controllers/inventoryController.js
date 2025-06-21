const { validateVehicleData } = require('../validators/vehicleValidator');
const { buildWhereClauseForInventory } = require('../helpers/inventoryHelper');
const InventoryModel = require('../models/inventoryModel'); // Import the new model

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
                carfax_link: req.body.carfax_link
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
                vehicle_id: vehicle_id
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

            const vehicleData = {
                make: req.body.make,
                model: req.body.model,
                year: req.body.year ? parseInt(req.body.year) : undefined,
                price: req.body.price ? parseFloat(req.body.price) : undefined,
                mileage: req.body.mileage ? parseInt(req.body.mileage) : undefined,
                vin: req.body.vin,
                exterior_color: req.body.exterior_color,
                interior_color: req.body.interior_color,
                transmission: req.body.transmission,
                fuel_type: req.body.fuel_type,
                engine: req.body.engine,
                condition: req.body.condition,
                features: req.body.features ? JSON.parse(req.body.features) : undefined,
                is_featured: req.body.is_featured !== undefined ? (req.body.is_featured === 'true') : undefined, // Convert string to boolean
                status: req.body.status,
                description: req.body.description,
                tags: req.body.tags ? JSON.parse(req.body.tags) : undefined,
                features: req.body.features ? JSON.parse(req.body.features) : undefined,
                carfax_link: req.body.carfax_link
            };

            const validationError = validateVehicleData(vehicleData);
            if (validationError) {
                return res.status(400).json({ error: validationError });
            }

            await InventoryModel.updateVehicle(id, vehicleData, req.files);

            res.status(200).json({
                status: 'success',
                message: 'Vehicle updated successfully',
                vehicle_id: id
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
                status
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