const VehicleModel = require('../models/vehicleModel'); // Import the new model

class VehicleController {
    /**
     * Get vehicle details by ID
     * @param {object} req - Express request object
     * @param {object} res - Express response object
     */
    static async getVehicleById(req, res) {
        try {
            const { id } = req.params;

            // Input validation
            if (!id || isNaN(parseInt(id))) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Invalid vehicle ID provided.'
                });
            }

            // Check if user is admin
            const isAdmin = req.user && req.user.role === 'admin';
            
            // Delegate data fetching to the VehicleModel
            const vehicleData = await VehicleModel.getVehicleById(parseInt(id), { includePurchaseDetails: isAdmin });

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
            console.error('Error fetching vehicle in controller:', error);
            res.status(500).json({
                status: 'error',
                message: 'Failed to retrieve vehicle details due to a server error.',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }
}

module.exports = VehicleController;