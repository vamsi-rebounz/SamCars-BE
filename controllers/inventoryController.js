const { validateVehicleData } = require('../validators/vehicleValidator');
const { buildWhereClauseForInventory } = require('../helpers/inventoryHelper');
const InventoryModel = require('../models/inventoryModel');
const { VEHICLE_STATUSES } = require('../constants/enums');

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
                stock_number: req.body.stock_number,
                is_bought_in_auction: req.body.is_bought_in_auction === 'true' || req.body.is_bought_in_auction === true,
                seller_name: req.body.seller_name,
                seller_email: req.body.seller_email,
                seller_phone: req.body.seller_phone,
                bought_price: req.body.bought_price ? parseFloat(req.body.bought_price) : null,
                repair_costs: req.body.repair_costs ? parseFloat(req.body.repair_costs) : null,
                sold_price: req.body.sold_price ? parseFloat(req.body.sold_price) : null
            };

            console.log('Received vehicle data:', vehicleData);
            console.log('Received files:', req.files);

            // Stricter validation for required fields
            const requiredFields = [
                'make', 'model', 'year', 'price', 'mileage', 'vin',
                'transmission', 'body_type', 'fuel_type', 'condition', 'description', 'status'
            ];
            for (const field of requiredFields) {
                if (
                    vehicleData[field] === undefined || vehicleData[field] === null || vehicleData[field] === '' ||
                    (typeof vehicleData[field] === 'number' && isNaN(vehicleData[field]))
                ) {
                    return res.status(400).json({ error: `Missing or invalid required field: ${field}` });
                }
            }
            // VIN strict validation
            const vinRegex = /^[A-HJ-NPR-Z0-9]{17}$/i;
            if (!vinRegex.test(vehicleData.vin)) {
                return res.status(400).json({ error: 'VIN must be exactly 17 characters, alphanumeric, and not contain I, O, or Q.' });
            }
            // Year validation
            const currentYear = new Date().getFullYear();
            if (vehicleData.year < 1900 || vehicleData.year > currentYear + 1) {
                return res.status(400).json({ error: `Year must be between 1900 and ${currentYear + 1}` });
            }
            // Price and mileage validation
            if (vehicleData.price <= 0) {
                return res.status(400).json({ error: 'Price must be greater than 0' });
            }
            if (vehicleData.mileage < 0) {
                return res.status(400).json({ error: 'Mileage must be 0 or greater' });
            }

            // Validate request data
            const validationError = validateVehicleData(vehicleData);
            if (validationError) {
                return res.status(400).json({ error: validationError });
            }

            const vehicle_id = await InventoryModel.addVehicle(vehicleData, req.files);

            // If vehicle was bought in auction, add it to auction_vehicles table
            if (vehicleData.is_bought_in_auction && vehicleData.bought_price) {
                try {
                    const pool = require('../config/db');
                    const auctionVehicleQuery = `
                        INSERT INTO auction_vehicles (
                            vehicle_id, purchase_date, purchase_price, additional_costs,
                            list_price, status, created_at, updated_at
                        ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
                    `;
                    
                    const auctionValues = [
                        vehicle_id,
                        new Date().toISOString().split('T')[0], // Today's date
                        vehicleData.bought_price,
                        vehicleData.repair_costs || 0,
                        vehicleData.price,
                        vehicleData.status || 'available'
                    ];
                    
                    await pool.query(auctionVehicleQuery, auctionValues);
                    console.log(`Added vehicle ${vehicle_id} to auction_vehicles table`);
                } catch (auctionError) {
                    console.error('Error adding vehicle to auction_vehicles table:', auctionError);
                    // Don't fail the vehicle creation if auction table update fails
                }
            }

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
                if (req.body.is_bought_in_auction !== undefined) vehicleData.is_bought_in_auction = req.body.is_bought_in_auction === 'true' || req.body.is_bought_in_auction === true;
                if (req.body.seller_name) vehicleData.seller_name = req.body.seller_name;
                if (req.body.seller_email) vehicleData.seller_email = req.body.seller_email;
                if (req.body.seller_phone) vehicleData.seller_phone = req.body.seller_phone;
                if (req.body.bought_price) vehicleData.bought_price = parseFloat(req.body.bought_price);
                if (req.body.repair_costs) vehicleData.repair_costs = parseFloat(req.body.repair_costs);
                if (req.body.sold_price) vehicleData.sold_price = parseFloat(req.body.sold_price);
                
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

            // Handle auction_vehicles table updates
            if (vehicleData.is_bought_in_auction !== undefined) {
                try {
                    const pool = require('../config/db');
                    
                    if (vehicleData.is_bought_in_auction && vehicleData.bought_price) {
                        // Vehicle is marked as bought in auction
                        const checkQuery = 'SELECT auction_id FROM auction_vehicles WHERE vehicle_id = $1';
                        const checkResult = await pool.query(checkQuery, [id]);
                        
                        if (checkResult.rows.length === 0) {
                            // Vehicle not in auction_vehicles table, add it
                            const auctionVehicleQuery = `
                                INSERT INTO auction_vehicles (
                                    vehicle_id, purchase_date, purchase_price, additional_costs,
                                    list_price, status, created_at, updated_at
                                ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
                            `;
                            
                            const auctionValues = [
                                id,
                                new Date().toISOString().split('T')[0], // Today's date
                                vehicleData.bought_price,
                                vehicleData.repair_costs || 0,
                                vehicleData.price,
                                vehicleData.status || 'available'
                            ];
                            
                            await pool.query(auctionVehicleQuery, auctionValues);
                            console.log(`Added vehicle ${id} to auction_vehicles table during update`);
                        } else {
                            // Vehicle already exists, update it
                            const updateAuctionQuery = `
                                UPDATE auction_vehicles 
                                SET purchase_price = $1, additional_costs = $2, list_price = $3, 
                                    status = $4, updated_at = NOW()
                                WHERE vehicle_id = $5
                            `;
                            
                            const updateValues = [
                                vehicleData.bought_price,
                                vehicleData.repair_costs || 0,
                                vehicleData.price,
                                vehicleData.status || 'available',
                                id
                            ];
                            
                            await pool.query(updateAuctionQuery, updateValues);
                            console.log(`Updated vehicle ${id} in auction_vehicles table`);
                        }
                    } else if (!vehicleData.is_bought_in_auction) {
                        // Vehicle is marked as NOT bought in auction, remove from auction_vehicles table
                        const deleteQuery = 'DELETE FROM auction_vehicles WHERE vehicle_id = $1';
                        const deleteResult = await pool.query(deleteQuery, [id]);
                        
                        if (deleteResult.rowCount > 0) {
                            console.log(`Removed vehicle ${id} from auction_vehicles table`);
                        }
                    }
                } catch (auctionError) {
                    console.error('Error updating auction_vehicles table:', auctionError);
                    // Don't fail the vehicle update if auction table update fails
                }
            }

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
                body_type = 'all',
                fuel_type = 'all',
                limit = '10',
                page = '1',
                search = '',
                sort_by = 'date_added',
                sort_order = 'desc',
                status = 'all',
                purchase_type = 'all',
                min_price,
                max_price,
                min_purchase_cost,
                max_purchase_cost,
                min_additional_costs,
                max_additional_costs,
                min_sold_price,
                max_sold_price,
                min_profit,
                max_profit
            } = req.query;

            // Only allow status values that match the DB enum
            const allowedStatuses = Object.values(VEHICLE_STATUSES);
            let statusFilter = status;
            if (status !== 'all' && !allowedStatuses.includes(status)) {
                return res.status(400).json({ status: 'error', message: `Invalid status filter. Allowed: ${allowedStatuses.join(', ')}` });
            }

            // Check if user is admin for financial filters and sorting
            const isAdmin = req.user && req.user.role === 'admin';
            
            // Define financial fields that require admin access
            const financialFields = ['bought_price', 'repair_costs', 'sold_price', 'profit'];
            const financialFilters = ['min_purchase_cost', 'max_purchase_cost', 'min_additional_costs', 'max_additional_costs', 'min_sold_price', 'max_sold_price', 'min_profit', 'max_profit'];
            
            // Check if non-admin user is trying to sort by financial fields
            if (financialFields.includes(sort_by) && !isAdmin) {
                return res.status(403).json({ 
                    status: 'error', 
                    message: 'Financial field sorting is only available for admin users' 
                });
            }
            
            // Check if non-admin user is trying to use financial filters
            const hasFinancialFilters = financialFilters.some(filter => req.query[filter] !== undefined);
            if (hasFinancialFilters && !isAdmin) {
                return res.status(403).json({ 
                    status: 'error', 
                    message: 'Financial filters are only available for admin users' 
                });
            }
            
            // Check if user is admin for purchase_type filter
            if (purchase_type !== 'all' && !isAdmin) {
                return res.status(403).json({ 
                    status: 'error', 
                    message: 'Purchase type filter is only available for admin users' 
                });
            }

            // Handle purchase type filtering
            let auctionFilter = null;
            if (purchase_type === 'auction') {
                auctionFilter = true;
            } else if (purchase_type === 'individual') {
                auctionFilter = false;
            }

            const inventoryData = await InventoryModel.getInventory({
                body_type,
                fuel_type,
                limit,
                page,
                search,
                sortBy: sort_by,
                sortOrder: sort_order,
                status: statusFilter,
                auction: auctionFilter,
                includePurchaseDetails: isAdmin,
                isAdmin: isAdmin, // Pass admin status to model
                min_price,
                max_price,
                min_purchase_cost,
                max_purchase_cost,
                min_additional_costs,
                max_additional_costs,
                min_sold_price,
                max_sold_price,
                min_profit,
                max_profit
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
     * Get dropdown options for makes, models, and years
     * @param {object} req - Express request object
     * @param {object} res - Express response object
     */
    static async getDropdownOptions(req, res) {
        try {
            const options = await InventoryModel.getDropdownOptions();
            
            res.status(200).json({
                status: 'success',
                data: options
            });
        } catch (error) {
            console.error('Error fetching dropdown options:', error);
            res.status(500).json({
                status: 'error',
                message: 'Failed to fetch dropdown options'
            });
        }
    }

    /**
     * Get vehicle categories with counts
     * @param {object} req - Express request object
     * @param {object} res - Express response object
     */
    static async getCategories(req, res) {
        try {
            const categories = await InventoryModel.getCategories();
            
            res.status(200).json({
                status: 'success',
                data: categories
            });
        } catch (error) {
            console.error('Error fetching categories:', error);
            res.status(500).json({
                status: 'error',
                message: 'Failed to fetch categories'
            });
        }
    }

    /**
     * Get vehicle statuses with counts
     * @param {object} req - Express request object
     * @param {object} res - Express response object
     */
    static async getVehicleStatuses(req, res) {
        try {
            const statuses = await InventoryModel.getVehicleStatuses();
            
            res.status(200).json({
                status: 'success',
                data: statuses
            });
        } catch (error) {
            console.error('Error fetching vehicle statuses:', error);
            res.status(500).json({
                status: 'error',
                message: 'Failed to fetch vehicle statuses'
            });
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