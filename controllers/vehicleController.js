// controllers/vehicleController.js
const VehicleModel = require('../models/vehicleModel');
const path = require('path');

const VehicleController = {
  async addVehicle(req, res) {
    try {
      const {
        make,
        model,
        year,
        vin,
        price,
        mileage,
        status,
        tags,
        description,
        features,
        location
      } = req.body;

      const imageFile = req.file;

      // Basic required field validation
      if (!make || !model || !year || !vin || !price || !mileage || !status) {
        return res.status(400).json({
          success: false,
          message: 'Required fields: make, model, year, vin, price, mileage, status'
        });
      }

      if (isNaN(year) || isNaN(price) || isNaN(mileage)) {
        return res.status(400).json({
          success: false,
          message: 'Year, price, and mileage must be valid numbers.'
        });
      }

      const validStatuses = ['available', 'sold', 'reserved'];
      if (!validStatuses.includes(status.toLowerCase())) {
        return res.status(400).json({
          success: false,
          message: `Invalid status. Allowed: ${validStatuses.join(', ')}`
        });
      }

      // Check for duplicate VIN
      const existing = await VehicleModel.findByVIN(vin);
      if (existing) {
        return res.status(409).json({
          success: false,
          message: 'A vehicle with this VIN already exists.'
        });
      }

      // Tags cleanup
      const parsedTags = typeof tags === 'string'
        ? tags.split(',').map(t => t.trim())
        : [];

      const vehicleData = {
        make,
        model,
        year,
        vin,
        price,
        mileage,
        status,
        tags: parsedTags,
        description,
        features,
        location
      };

      const newVehicle = await VehicleModel.createVehicle(vehicleData);

      if (!newVehicle) {
        return res.status(500).json({
          success: false,
          message: 'Vehicle could not be added to the database.'
        });
      }

      const imageUrl = imageFile
        ? `${req.protocol}://${req.get('host')}/uploads/${imageFile.filename}`
        : null;

      res.status(200).json({
        status: 'success',
        message: 'Vehicle added successfully.',
        data: {
          ...newVehicle,
          image_url: imageUrl
        }
      });
    } catch (error) {
      console.error('Error in addVehicle controller:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to add vehicle.',
        error: error.message
      });
    }
  }
};

module.exports = VehicleController;