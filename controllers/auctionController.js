const InventoryModel = require('../models/inventoryModel');
const AuctionVehicle = require('../models/auctionModel');
const { upload, handleMulterError } = require('../middleware/multerMiddleware');
const pool = require('../config/db');
const { validateVehicleData } = require('../validators/vehicleValidator');

class AuctionController {
    
  static async addAuctionPurchase(req, res) {
      const client = await pool.connect(); // Get a client from the pool
      try {
          await client.query('BEGIN'); // Start a transaction

          // Extract vehicle details from req.body
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
            status: req.body.status,
            tags: req.body.tags ? (typeof req.body.tags === 'string' ? JSON.parse(req.body.tags) : req.body.tags) : []
          };

          const validationError = validateVehicleData(vehicleData);
          if (validationError) {
              return res.status(400).json({ error: validationError });
          }
          // Extract auction-specific details from req.body
          const auctionData = {
              purchase_date:  new Date(req.body.purchase_date),
              purchase_price: parseFloat(req.body.purchase_price),
              additional_costs: parseFloat(req.body.additional_costs || 0),
              list_price: req.body.list_price ? parseFloat(req.body.list_price) : null,
              sold_price: req.body.sold_price ? parseFloat(req.body.sold_price) : null,
              notes: req.body.notes
          };

          // 1. Add the vehicle (including images and tags)
          // The addVehicle function itself handles its own transaction for its internal operations,
          // but we'll manage the overall transaction for both vehicle and auction creation here.
          const vehicle_id = await InventoryModel.addVehicle(vehicleData, req.files);
          if (!vehicle_id) {
              throw new Error('Failed to create vehicle.');
          }

          // 2. Add the auction purchase details using the newly created vehicle_id
          auctionData.vehicle_id = vehicle_id;
          const auction_id = await AuctionVehicle.addAuctionPurchase(vehicle_id, auctionData);

          // 3. Update the vehicle status to 'auction'
          await AuctionVehicle.updateVehicleStatus(vehicle_id, 'auction', client);

          await client.query('COMMIT'); // Commit the entire transaction
          res.status(201).json({
              success: true,
              message: 'Vehicle auction purchase added successfully!',
              vehicle_id,
              auction_id
          });

      } catch (error) {
          await client.query('ROLLBACK'); // Rollback if any part fails
          console.error('Error adding auction purchase:', error);
          res.status(500).json({ success: false, message: 'Failed to add auction purchase', error: error.message });
      } finally {
          client.release(); // Always release the client
      }
    };
}

module.exports =  AuctionController;