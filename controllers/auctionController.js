const InventoryModel = require('../models/inventoryModel');
const AuctionVehicle = require('../models/auctionModel');
const { upload, handleMulterError } = require('../middleware/multerMiddleware');
const pool = require('../config/db');
const { validateVehicleData } = require('../validators/vehicleValidator');
const { VEHICLE_STATUSES } = require('../constants/enums');
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

    static async getAuctionVehicles(req, res) {
        try {
            // Parse query parameters with default values
            const limit = parseInt(req.query.limit) || 10;
            const page = parseInt(req.query.page) || 1;
            const search = req.query.search ? String(req.query.search).trim() : null;
            const sortBy = req.query.sort_by ? String(req.query.sort_by).trim() : 'purchaseDate';
            const sortOrder = req.query.sort_order ? String(req.query.sort_order).trim().toUpperCase() : 'DESC';
            const status = req.query.status ? String(req.query.status).trim() : null;
    
            const offset = (page - 1) * limit;
    
            // Basic validation for parameters
            if (limit <= 0 || page <= 0) {
                return res.status(400).json({ status: "error", message: "Limit and page must be positive integers." });
            }
            if (sortOrder !== 'ASC' && sortOrder !== 'DESC') {
                return res.status(400).json({ status: "error", message: "sort_order must be 'asc' or 'desc'." });
            }
            if (status && !VEHICLE_STATUSES.includes(status)) {
                 return res.status(400).json({
                    status: "error",
                    message: `Invalid status: ${status}. Allowed: ${VEHICLE_STATUSES.join(', ')}`
                });
            }
    
    
            const { vehicles, totalItems } = await AuctionVehicle.fetchAuctionVehicles({
                limit,
                offset,
                search,
                sortBy,
                sortOrder,
                status
            });
    
            const totalPages = Math.ceil(totalItems / limit);
            const hasNext = page < totalPages;
            const hasPrev = page > 1;
    
            // Format the response according to the specified structure
            const formattedVehicles = vehicles.map(vehicle => ({
                id: vehicle.id.toString(),
                make: vehicle.make,
                model: vehicle.model,
                year: vehicle.year.toString(),
                vin: vehicle.vin,
                purchaseDate: vehicle.purchaseDate.toISOString().split('T')[0], // Format date as YYYY-MM-DD
                // Convert string numbers to float before calling toFixed, handle nulls
                purchasePrice: vehicle.purchasePrice ? parseFloat(vehicle.purchasePrice).toFixed(2) : null,
                totalInvestment: vehicle.totalInvestment ? parseFloat(vehicle.totalInvestment).toFixed(2) : null,
                listPrice: vehicle.listPrice ? parseFloat(vehicle.listPrice).toFixed(2) : null,
                soldPrice: vehicle.soldPrice ? parseFloat(vehicle.soldPrice).toFixed(2) : null,
                status: vehicle.status,
                profit: vehicle.profit ? parseFloat(vehicle.profit).toFixed(2) : null,
                createdAt: vehicle.createdAt.toISOString(),
                updatedAt: vehicle.updatedAt.toISOString(),
                imageUrls: vehicle.imageUrls || []
            }));
    
            res.status(200).json({
                status: "success",
                data: {
                    vehicles: formattedVehicles,
                    pagination: {
                        currentPage: page.toString(),
                        totalPages: totalPages.toString(),
                        totalItems: totalItems.toString(),
                        hasNext: hasNext.toString(),
                        hasPrev: hasPrev.toString()
                    }
                }
            });
    
        } catch (error) {
            console.error('Error in getAuctionVehicles controller:', error);
            res.status(500).json({ status: "error", message: error.message || "Failed to fetch auction vehicles." });
        }
    };

    /**
     * Fetches summary statistics for the auction dashboard.
     * Query params:
     * - `date_from` (optional): Start date (YYYY-MM-DD). Defaults to '1900-01-01' if not provided.
     * - `date_to` (optional): End date (YYYY-MM-DD). Defaults to current date if not provided.
     * - `status` (optional): Filter by vehicle status (e.g., 'sold', 'auction').
     */
    static async getAuctionDashboardSummary(req, res) {
        try {
            let { date_from, date_to, status } = req.query; // Use 'let' to allow reassignment

            // --- Set default dates if not provided ---
            // Default `date_from` to a very early date if not provided
            date_from = date_from ? String(date_from).trim() : '1900-01-01';

            // Default `date_to` to the current date if not provided
            const today = new Date();
            const year = today.getFullYear();
            const month = String(today.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
            const day = String(today.getDate()).padStart(2, '0');
            const defaultDateTo = `${year}-${month}-${day}`;
            date_to = date_to ? String(date_to).trim() : defaultDateTo;
            // --- End of default date setting ---

            // Basic date format validation (YYYY-MM-DD)
            const isValidDate = (dateString) => /^\d{4}-\d{2}-\d{2}$/.test(dateString) && !isNaN(new Date(dateString));
            if (!isValidDate(date_from) || !isValidDate(date_to)) {
                return res.status(400).json({
                    status: "error",
                    message: "Invalid date format. Dates must be in YYYY-MM-DD format."
                });
            }

            // Ensure `date_from` is not after `date_to`
            if (new Date(date_from) > new Date(date_to)) {
                return res.status(400).json({
                    status: "error",
                    message: "date_from cannot be after date_to."
                });
            }

            // Validate status if provided against your enum
            if (status && !VEHICLE_STATUSES.includes(status)) {
                 return res.status(400).json({
                    status: "error",
                    message: `Invalid status: ${status}. Allowed statuses are: ${VEHICLE_STATUSES.join(', ')}`
                });
            }

            // Fetch summary statistics from the model
            const summary = await AuctionVehicle.getAuctionSummaryStatistics({
                dateFrom: date_from,
                dateTo: date_to,
                status: status || null // Pass null if status is not provided
            });

            // Format the response according to the specified structure
            res.status(200).json({
                status: "success",
                data: {
                    summary: {
                        totalInvestment: {
                            amount: summary.totalInvestment.toFixed(2), // Format to 2 decimal places
                            currency: "USD" // Assuming USD as default currency
                        },
                        totalProfit: {
                            amount: summary.totalProfit.toFixed(2), // Format to 2 decimal places
                            currency: "USD"
                        },
                        vehiclesPurchased: summary.vehiclesPurchased,
                        vehiclesSold: summary.vehiclesSold
                    }
                }
            });

        } catch (error) {
            console.error('Error in getAuctionDashboardSummary controller:', error);
            res.status(500).json({
                status: "error",
                message: error.message || "Failed to fetch auction dashboard summary."
            });
        }
    }
}

module.exports =  AuctionController;