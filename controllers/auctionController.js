const InventoryModel = require('../models/inventoryModel');
const AuctionModel = require('../models/auctionModel');
const { upload, handleMulterError } = require('../middleware/multerMiddleware');
const pool = require('../config/db');
const { validateVehicleData } = require('../validators/vehicleValidator');
const { VEHICLE_STATUSES } = require('../constants/enums');
class AuctionController {
    /**
     * Creates a new auction purchase
     * @param {object} req - Express request object
     * @param {object} res - Express response object
     * @returns 
     */
    static async addAuctionPurchase(req, res) {
      const client = await pool.connect(); // Get a client from the pool
      try {
          await client.query('BEGIN'); // Start a transaction

          // Extract vehicle details from req.body
          const vehicleData = {
            make: req.body.make,
            model: req.body.model,
            year: parseInt(req.body.year),
            // price: parseFloat(req.body.price),
            price: parseFloat(req.body.list_price),
            mileage: req.body.mileage ? parseInt(req.body.mileage) : null,
            vin: req.body.vin,
            exterior_color: req.body.exterior_color,
            interior_color: req.body.interior_color,
            transmission: req.body.transmission,
            body_type: req.body.body_type,
            fuel_type: req.body.fuel_type,
            description: req.body.description,
            status: 'reserved', // Set status to 'reserved' before validation
            condition: req.body.condition,
            tags: req.body.tags ? (typeof req.body.tags === 'string' ? JSON.parse(req.body.tags) : req.body.tags) : [],
            features: req.body.features ? (typeof req.body.features === 'string' ? JSON.parse(req.body.features) : req.body.features) : [],
            carfax_link: req.body.carfax_link,
            location: req.body.location,
            stock_number: req.body.stock_number
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
              notes: req.body.notes,
              status: 'reserved' // Set status for auction_vehicles table
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
          const auction_id = await AuctionModel.addAuctionPurchase(vehicle_id, auctionData);

          // 3. Update the vehicle status to 'reserved'
          await AuctionModel.updateVehicleStatus(vehicle_id, 'reserved', client);

          await client.query('COMMIT'); // Commit the entire transaction
          res.status(201).json({
              success: true,
              message: 'Vehicle auction purchase added successfully!',
              vehicle_id,
              auction_id
          });

      } catch (error) {
          await client.query('ROLLBACK'); // Rollback if any part fails
          console.error('Error adding auction purchase:', error, '\nRequest body:', req.body, '\nFiles:', req.files);
          
          let statusCode = 500;
          let errorMessage = 'Failed to add auction purchase';
          
          if (error.message.includes('duplicate key')) {
              statusCode = 409;
              errorMessage = 'Vehicle already exists in auction';
          } else if (error.message.includes('invalid status')) {
              statusCode = 400;
              errorMessage = 'Invalid vehicle status';
          }
          
          res.status(statusCode).json({ 
              success: false, 
              message: errorMessage, 
              error: error.message 
          });
      } finally {
          client.release(); // Always release the client
      }
    };

    /**
     * Updates auction purchase and associated vehicle details.
     * @param {Object} req - Express request object
     * @param {Object} res - Express request object
     */
    static async updateAuctionPurchase(req, res) {
        let client;
        try {
            client = await pool.connect();
            const { auction_id } = req.query;
            if (isNaN(auction_id)) {
                return res.status(400).json({
                    status: "error",
                    message: "Invalid auction ID"
                });
            }

            // Check if auction exists and get vehicle_id
            const existingAuction = await client.query(
                'SELECT * FROM auction_vehicles WHERE auction_id = $1',
                [auction_id]
            );
            
            if (existingAuction.rows.length === 0) {
                return res.status(404).json({
                    status: "error",
                    message: "Auction purchase not found"
                });
            }

            const vehicleId = existingAuction.rows[0].vehicle_id;
            await client.query('BEGIN');

            // 1. Prepare vehicle data from request
            const vehicleData = {
                make: req.body.make,
                model: req.body.model,
                year: parseInt(req.body.year),
                price: parseFloat(req.body.list_price), // Use list_price as the vehicle price
                mileage: req.body.mileage ? parseInt(req.body.mileage) : null,
                vin: req.body.vin,
                exterior_color: req.body.exterior_color,
                interior_color: req.body.interior_color,
                transmission: req.body.transmission,
                body_type: req.body.body_type,
                fuel_type: req.body.fuel_type,
                description: req.body.description,
                status: req.body.status,
                condition: req.body.condition,
                tags: req.body.tags ? (typeof req.body.tags === 'string' ? JSON.parse(req.body.tags) : req.body.tags) : [],
                features: req.body.features ? (typeof req.body.features === 'string' ? JSON.parse(req.body.features) : req.body.features) : [],
                carfax_link: req.body.carfax_link,
                location: req.body.location,
                stock_number: req.body.stock_number
            };

            // 2. Validate vehicle data
            const validationError = validateVehicleData(vehicleData);
            if (validationError) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: validationError });
            }

            // Parse images to delete
            const imagesToDelete = req.body.images_to_delete 
                ? JSON.parse(req.body.images_to_delete) 
                : [];

            // Parse existing images to keep
            const existingImages = req.body.existing_images 
                ? JSON.parse(req.body.existing_images)
                : [];

            // 3. Update vehicle using existing implementation
            await InventoryModel.updateVehicle(
                vehicleId, 
                vehicleData,
                req.files || [], // Pass files array directly
                client, // Pass the transaction client
                imagesToDelete, // Pass imagesToDelete array
                existingImages // Pass existingImages array
            );

            // 4. Prepare auction update data
            const auctionUpdate = {
                purchase_date: req.body.purchase_date,
                purchase_price: req.body.purchase_price ? parseFloat(req.body.purchase_price) : undefined,
                additional_costs: req.body.additional_costs ? parseFloat(req.body.additional_costs) : undefined,
                list_price: req.body.list_price ? parseFloat(req.body.list_price) : undefined,
                sold_price: req.body.sold_price ? parseFloat(req.body.sold_price) : undefined,
                status: req.body.status, // Sync with vehicle status
                notes: req.body.notes
            };

            // 5. Update auction details
            const updateFields = [];
            const updateValues = [];
            let valueCounter = 1;

            for (const [key, value] of Object.entries(auctionUpdate)) {
                if (value !== undefined) {
                    updateFields.push(`${key} = $${valueCounter}`);
                    updateValues.push(value);
                    valueCounter++;
                }
            }

            if (updateFields.length > 0) {
                const updateQuery = `
                    UPDATE auction_vehicles
                    SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
                    WHERE auction_id = $${valueCounter}
                    RETURNING *
                `;
                updateValues.push(auction_id);
                await client.query(updateQuery, updateValues);
            }

            await client.query('COMMIT');

            // 6. Fetch updated data including images
            const query = `
                SELECT
                    av.*,
                    v.*,
                    vi.image_urls AS images,
                    vi.primary_image_index,
                    ARRAY_REMOVE(ARRAY_AGG(DISTINCT vt.name), NULL) AS tags,
                    ARRAY_REMOVE(ARRAY_AGG(DISTINCT vf.name), NULL) AS features
                FROM auction_vehicles av
                JOIN vehicles v ON av.vehicle_id = v.vehicle_id
                LEFT JOIN vehicle_images vi ON v.vehicle_id = vi.vehicle_id
                LEFT JOIN vehicle_tag_mapping vtm ON v.vehicle_id = vtm.vehicle_id
                LEFT JOIN vehicle_tags vt ON vtm.tag_id = vt.tag_id
                LEFT JOIN vehicle_feature_mapping vfm ON v.vehicle_id = vfm.vehicle_id
                LEFT JOIN vehicle_features vf ON vfm.feature_id = vf.feature_id
                WHERE av.auction_id = $1
                GROUP BY av.auction_id, v.vehicle_id, vi.image_urls, vi.primary_image_index;
            `;

            const result = await client.query(query, [auction_id]);

            res.status(200).json({
                status: "success",
                message: "Auction purchase and vehicle updated successfully",
                data: result.rows[0]
            });

        } catch (error) {
            if (client) {
                await client.query('ROLLBACK');
            }
            console.error('Error updating auction purchase:', error);
            res.status(500).json({
                status: "error",
                message: error.message || "Failed to update auction purchase"
            });
        } finally {
            if (client) {
                client.release();
            }
        }
    }

    /**
     * Deletes an auction purchase and its associated vehicle
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    static async deleteAuctionPurchase(req, res) {
        try {
            const auctionId = parseInt(req.params.id, 10);
            
            // Validate auction ID
            if (isNaN(auctionId) || auctionId <= 0) {
                return res.status(400).json({
                    status: "error",
                    message: "Invalid auction ID",
                    details: "Please provide a valid positive numeric auction ID"
                });
            }

            // Get auction details including vehicle_id
            const auction = await AuctionModel.getAuctionDetails(auctionId);
            if (!auction) {
                return res.status(404).json({
                    status: "error",
                    message: "Auction purchase not found"
                });
            }

            // Delete auction and vehicle in transaction
            const result = await AuctionModel.deleteAuctionWithVehicle(auctionId, auction.vehicle_id);

            if (result.success) {
                return res.status(200).json({
                    status: "success",
                    message: "Auction purchase and vehicle deleted successfully",
                    data: {
                        auction_id: auctionId,
                        vehicle_id: auction.vehicle_id,
                        deleted_at: new Date().toISOString(),
                        images_deleted: result.imagesDeleted
                    }
                });
            }

            return res.status(500).json({
                status: "error",
                message: "Failed to complete deletion"
            });

        } catch (error) {
            console.error('Error in deleteAuctionPurchase:', error);
            res.status(500).json({
                status: "error",
                message: "Failed to delete auction purchase",
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }


    /**
     * Fetches a list of vehicles that are currently in an auction.
     * @param {reque} req - Express request object
     * @param {res} res - Express response object
     * @returns 
     */
    static async getAuctionVehicles(req, res) {
        try {
            const limit = parseInt(req.query.limit) || 10;
            const page = parseInt(req.query.page) || 1;
            const search = req.query.search ? String(req.query.search).trim() : null;
            const sort_by = req.query.sort_by ? String(req.query.sort_by).trim() : 'purchase_date';
            const sort_order = req.query.sort_order ? String(req.query.sort_order).trim().toUpperCase() : 'DESC';
            const status = req.query.status ? String(req.query.status).trim() : null;
    
            const offset = (page - 1) * limit;
    
            if (limit <= 0 || page <= 0) {
                return res.status(400).json({ status: "error", message: "Limit and page must be positive integers." });
            }
    
            if (sort_order !== 'ASC' && sort_order !== 'DESC') {
                return res.status(400).json({ status: "error", message: "sort_order must be 'asc' or 'desc'." });
            }
    
            if (status && !Object.values(VEHICLE_STATUSES).includes(status)) {
                return res.status(400).json({
                    status: "error",
                    message: `Invalid status: ${status}. Allowed: ${Object.values(VEHICLE_STATUSES).join(', ')}`
                });
            }
    
            const { vehicles, totalItems } = await AuctionModel.fetchAuctionVehicles({
                limit,
                offset,
                search,
                sortBy: sort_by,
                sortOrder: sort_order,
                status
            });
    
            const totalPages = Math.ceil(totalItems / limit);
            const hasNext = page < totalPages;
            const hasPrev = page > 1;
    
            const formattedVehicles = vehicles.map(vehicle => ({
                auction_id: vehicle.auctionId.toString(),
                vehicle_id: vehicle.vehicleId.toString(),
                make: vehicle.make,
                model: vehicle.model,
                year: vehicle.year.toString(),
                vin: vehicle.vin,
                purchase_date: vehicle.purchaseDate.toISOString().split('T')[0],
                purchase_price: vehicle.purchasePrice ? parseFloat(vehicle.purchasePrice).toFixed(2) : null,
                additional_costs: vehicle.additionalCosts ? parseFloat(vehicle.additionalCosts).toFixed(2) : null,
                total_investment: vehicle.totalInvestment ? parseFloat(vehicle.totalInvestment).toFixed(2) : null,
                list_price: vehicle.listPrice ? parseFloat(vehicle.listPrice).toFixed(2) : null,
                sold_price: vehicle.soldPrice ? parseFloat(vehicle.soldPrice).toFixed(2) : null,
                status: vehicle.status,
                profit: vehicle.profit ? parseFloat(vehicle.profit).toFixed(2) : null,
                created_at: vehicle.createdAt.toISOString(),
                updated_at: vehicle.updatedAt.toISOString(),
                images: vehicle.imageUrls || [],
                image_url: vehicle.imageUrls?.[vehicle.primaryImageIndex || 0] || null,
                carfax_link: vehicle.carfaxLink || `https://www.carfax.com/vehicle/${vehicle.vin}`,
                tags: vehicle.tags || [],
                features: vehicle.features || [],
                price: vehicle.listPrice ? parseFloat(vehicle.listPrice).toFixed(2) : null,
                mileage: vehicle.mileage,
                exterior_color: vehicle.exterior_color,
                interior_color: vehicle.interior_color,
                transmission: vehicle.transmission,
                fuel_type: vehicle.fuel_type,
                body_type: vehicle.body_type,
                engine: vehicle.engine,
                condition: vehicle.condition,
                stock_number: vehicle.stock_number,
                location: vehicle.location,
                description: vehicle.description
            }));
    
            res.status(200).json({
                status: "success",
                data: {
                    vehicles: formattedVehicles,
                    pagination: {
                        current_page: page.toString(),
                        total_pages: totalPages.toString(),
                        total_items: totalItems.toString(),
                        has_next: hasNext.toString(),
                        has_previous: hasPrev.toString()
                    }
                }
            });
    
        } catch (error) {
            console.error('Error in getAuctionVehicles controller:', error);
            res.status(500).json({ status: "error", message: error.message || "Failed to fetch auction vehicles." });
        }
    }
    

    /**
     * Fetches auction dashboard summary statistics.
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @returns 
     */
    static async getAuctionDashboardSummary(req, res) {
        try {
            // Get date range from query params or use defaults
            const { start_date, end_date } = req.query;

            // Validate date format
            if (start_date && end_date) {
                if (!AuctionController.isValidDate(start_date) || !AuctionController.isValidDate(end_date)) {
                    return res.status(400).json({
                        status: 'error',
                        message: 'Invalid date format. Use YYYY-MM-DD'
                    });
                }
            }

            // Use default date range if not provided
            const dateFrom = start_date || new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0];
            const dateTo = end_date || new Date().toISOString().split('T')[0];

            // Get dashboard statistics from the model
            const dashboardStats = await AuctionModel.getDashboardStatistics({
                date_from: dateFrom,
                date_to: dateTo
            });

            // Get recent transactions
            const recentQuery = `
                SELECT
                    av.auction_id,
                    av.purchase_date,
                    av.purchase_price,
                    av.additional_costs,
                    av.sold_price,
                    av.list_price,
                    vm.name as make,
                    vmo.name as model,
                    v.year,
                    v.status,
                    v.vin,
                    vi.image_urls[1] as primary_image,
                    COALESCE(av.sold_price - (av.purchase_price + COALESCE(av.additional_costs, 0)), 0) as profit
                FROM auction_vehicles av
                JOIN vehicles v ON av.vehicle_id = v.vehicle_id
                JOIN vehicle_makes vm ON v.make_id = vm.make_id
                JOIN vehicle_models vmo ON v.model_id = vmo.model_id
                LEFT JOIN vehicle_images vi ON v.vehicle_id = vi.vehicle_id
                ORDER BY av.purchase_date DESC
                LIMIT 10
            `;

            // Get profit by month
            const profitByMonthQuery = `
                SELECT
                    DATE_TRUNC('month', av.purchase_date) as month,
                    COUNT(*) as vehicles_purchased,
                    COUNT(CASE WHEN v.status = 'sold' THEN 1 END) as vehicles_sold,
                    COALESCE(SUM(av.purchase_price), 0) as total_purchase_amount,
                    COALESCE(SUM(av.additional_costs), 0) as total_additional_costs,
                    COALESCE(SUM(av.sold_price), 0) as total_sales_amount,
                    COALESCE(SUM(av.sold_price - (av.purchase_price + COALESCE(av.additional_costs, 0))), 0) as profit
                FROM auction_vehicles av
                JOIN vehicles v ON av.vehicle_id = v.vehicle_id
                WHERE av.purchase_date BETWEEN $1 AND $2
                GROUP BY DATE_TRUNC('month', av.purchase_date)
                ORDER BY month DESC
                LIMIT 12
            `;

            // Execute recent transactions and profit by month queries
            const [recentResult, profitByMonthResult] = await Promise.all([
                pool.query(recentQuery),
                pool.query(profitByMonthQuery, [dateFrom, dateTo])
            ]);

            res.json({
                status: 'success',
                data: {
                    summary: dashboardStats.summary,
                    age_analysis: dashboardStats.age_analysis,
                    recent_transactions: recentResult.rows,
                    profit_by_month: profitByMonthResult.rows
                }
            });

        } catch (error) {
            console.error('Error fetching auction dashboard summary:', error);
            res.status(500).json({
                status: 'error',
                message: 'Failed to fetch auction dashboard summary',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    // Helper function to validate date format
    static isValidDate(dateString) {
        return /^\d{4}-\d{2}-\d{2}$/.test(dateString) && !isNaN(new Date(dateString));
    }

    /**
     * Fetches detailed auction info by ID
     * @param {object} req - Express request object
     * @param {object} res - Express response object
     */
    static async getAuctionById(req, res) {
        try {
            const auctionId = parseInt(req.params.id, 10);
            
            // Validate auction ID
            if (isNaN(auctionId) || auctionId <= 0) {
                return res.status(400).json({
                    status: "error",
                    message: "Invalid auction ID",
                    details: "Please provide a valid positive numeric auction ID"
                });
            }

            // Get auction details including vehicle data
            const query = `
                SELECT
                    av.auction_id,
                    av.vehicle_id,
                    vm.name AS make,
                    vmo.name AS model,
                    v.year,
                    v.vin,
                    v.price,
                    v.mileage,
                    v.exterior_color,
                    v.interior_color,
                    v.transmission,
                    v.fuel_type,
                    v.body_type,
                    v.engine,
                    v.condition,
                    v.status AS vehicle_status,
                    v.description,
                    v.stock_number,
                    v.location,
                    v.carfax_link,
                    av.purchase_date,
                    av.purchase_price,
                    av.additional_costs,
                    av.list_price,
                    av.sold_price,
                    av.status,
                    av.notes,
                    av.created_at,
                    av.updated_at,
                    vi.image_urls AS images,
                    vi.primary_image_index,
                    ARRAY_REMOVE(ARRAY_AGG(DISTINCT vt.name), NULL) AS tags,
                    ARRAY_REMOVE(ARRAY_AGG(DISTINCT vf.name), NULL) AS features
                FROM
                    AUCTION_VEHICLES av
                JOIN VEHICLES v ON av.vehicle_id = v.vehicle_id
                JOIN VEHICLE_MAKES vm ON v.make_id = vm.make_id
                JOIN VEHICLE_MODELS vmo ON v.model_id = vmo.model_id
                LEFT JOIN VEHICLE_IMAGES vi ON v.vehicle_id = vi.vehicle_id
                LEFT JOIN VEHICLE_TAG_MAPPING vtm ON v.vehicle_id = vtm.vehicle_id
                LEFT JOIN VEHICLE_TAGS vt ON vtm.tag_id = vt.tag_id
                LEFT JOIN VEHICLE_FEATURE_MAPPING vfm ON v.vehicle_id = vfm.vehicle_id
                LEFT JOIN VEHICLE_FEATURES vf ON vfm.feature_id = vf.feature_id
                WHERE av.auction_id = $1
                GROUP BY
                    av.auction_id, av.vehicle_id, vm.name, vmo.name,
                    v.year, v.vin, v.price, v.mileage, v.exterior_color,
                    v.interior_color, v.transmission, v.fuel_type,
                    v.body_type, v.engine, v.condition, v.status,
                    v.description, v.stock_number, v.location,
                    v.carfax_link, av.purchase_date, av.purchase_price,
                    av.additional_costs, av.list_price, av.sold_price,
                    av.status, av.notes, av.created_at, av.updated_at,
                    vi.image_urls, vi.primary_image_index;
            `;

            const result = await pool.query(query, [auctionId]);

            if (result.rows.length === 0) {
                return res.status(404).json({
                    status: "error",
                    message: "Auction not found"
                });
            }

            const auctionData = result.rows[0];
            
            // Calculate total investment and profit
            const totalInvestment = parseFloat(auctionData.purchase_price) + parseFloat(auctionData.additional_costs || 0);
            const profit = auctionData.sold_price 
                ? parseFloat(auctionData.sold_price) - totalInvestment 
                : null;

            res.status(200).json({
                status: "success",
                data: {
                    ...auctionData,
                    total_investment: totalInvestment,
                    profit: profit,
                    images: auctionData.images || [],
                    tags: auctionData.tags || [],
                    features: auctionData.features || []
                }
            });

        } catch (error) {
            console.error('Error in getAuctionById:', error);
            res.status(500).json({
                status: "error",
                message: "Failed to fetch auction details",
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }
}

module.exports =  AuctionController;