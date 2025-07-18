const businessSettingsModel = require('../models/businessSettingsModel');

exports.getBusinessSettings = async (req, res) => {
    try {
        const settings = await businessSettingsModel.get();
        res.json({
            status: 'success',
            data: settings
        });
    } catch (error) {
        console.error('Error fetching business settings:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch business settings'
        });
    }
};

exports.updateBusinessSettings = async (req, res) => {
    try {
        // Only allow admins to update settings
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                status: 'error',
                message: 'Only administrators can update business settings'
            });
        }

        const settings = await businessSettingsModel.update(req.body, req.user.user_id);
        
        res.json({
            status: 'success',
            message: 'Business settings updated successfully',
            data: settings
        });
    } catch (error) {
        console.error('Error updating business settings:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to update business settings'
        });
    }
}; 