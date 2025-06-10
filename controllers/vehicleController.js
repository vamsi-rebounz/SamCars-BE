const VehicleModel = require('../models/vehicleModel'); // Import the new model

class VehicleController {
    /**
     * Get vehicle details by ID
     * @param {object} req - Express request object
     * @param {object} res - Express response object
     */
    static async getVehicleById(req, res) {
        try {
            const { id } = req.query;

            // Input validation (optional, but good practice for public APIs)
            if (!id || isNaN(parseInt(id))) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Invalid vehicle ID provided.'
                });
            }

            // Delegate data fetching to the VehicleModel
            const vehicleData = await VehicleModel.getVehicleById(parseInt(id));

            if (!vehicleData) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Vehicle not found.'
                });
            }

            res.status(200).json({
                status: 'success',
                data: vehicleData
            });

        } catch (error) {
            console.error('Error fetching vehicle in controller:', error); // Log the error for debugging
            res.status(500).json({
                status: 'error',
                message: 'Failed to retrieve vehicle details due to a server error.',
                details: error.message // Include error message for more context in development
            });
        }
    }
}

module.exports = VehicleController;