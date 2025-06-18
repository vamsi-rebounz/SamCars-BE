const express = require('express');
const multer = require('multer');
const inventoryModel = require('../models/inventoryModel');
const { buildWhereClauseForInventory } = require('../helpers/inventoryHelper');
const InventoryModel = require('../models/inventoryModel');
const db = require('../config/db');

class InventoryController {
    /**
     * Add a new vehicle to the inventory
     * @param {object} req - Express request object
     * @param {object} res - Express response object
     */
    static async addVehicle(req, res) {
        try {
            console.log('Received add vehicle request:', {
                body: req.body,
                files: req.files
            });

            // Check for duplicate VIN
            const existingVehicle = await db.query(
                'SELECT * FROM vehicles WHERE vin = $1',
                [req.body.vin]
            );

            if (existingVehicle.rows.length > 0) {
                console.log('Duplicate VIN detected:', req.body.vin);
                return res.status(400).json({
                    status: 'error',
                    message: 'A vehicle with this VIN already exists.',
                    error: 'duplicate_vin'
                });
            }

            // Process vehicle data
            const vehicleData = {
                ...req.body,
                price: parseFloat(req.body.price) || 0,
                mileage: parseInt(req.body.mileage) || 0,
                year: parseInt(req.body.year) || new Date().getFullYear(),
                is_featured: req.body.is_featured === 'true',
                images: req.files ? req.files.map(file => file) : []
            };

            console.log('Processed vehicle data for add vehicle:', vehicleData);

            const result = await InventoryModel.addVehicle(vehicleData, req.files);
            
            if (result.success) {
                res.status(201).json({
                    status: 'success',
                    message: 'Vehicle added successfully',
                    vehicle: result.vehicle
                });
            } else {
                console.error('Error adding vehicle to model:', result.error);
                res.status(500).json({
                    status: 'error',
                    message: 'Failed to add vehicle.',
                    error: result.error
                });
            }
        } catch (error) {
            console.error('Error in addVehicle controller:', error);
            res.status(500).json({
                status: 'error',
                message: 'Failed to add vehicle.',
                error: error.message,
                details: error.stack
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
            const vehicleId = req.params.id;
            console.log('Received update vehicle request:', {
                id: vehicleId,
                body: req.body,
                files: req.files
            });

            // Process vehicle data
            const vehicleData = {
                ...req.body,
                price: parseFloat(req.body.price) || 0,
                mileage: parseInt(req.body.mileage) || 0,
                year: parseInt(req.body.year) || new Date().getFullYear(),
                is_featured: req.body.is_featured === 'true',
                // Ensure fuel_type is a single string, even if parsed as an array
                fuel_type: Array.isArray(req.body.fuel_type) ? req.body.fuel_type[0] : req.body.fuel_type,
                // Ensure condition is a single string, even if parsed as an array
                condition: Array.isArray(req.body.condition) ? req.body.condition[0] : req.body.condition,
                // Ensure tags are an array of strings
                tags: Array.isArray(req.body.tags) ? req.body.tags : (req.body.tags ? [req.body.tags] : []),
                images: req.files ? req.files.map(file => file) : []
            };

            // If there are existing images in the request, add them to the images array
            if (req.body.existingImages) {
                const existingImages = Array.isArray(req.body.existingImages) 
                    ? req.body.existingImages 
                    : [req.body.existingImages];
                vehicleData.images = [...existingImages, ...vehicleData.images];
            }

            console.log('Processed update vehicle data:', vehicleData);
            console.log('Specific fields in controller: ', {
                exterior_color: vehicleData.exterior_color,
                interior_color: vehicleData.interior_color,
                fuel_type: vehicleData.fuel_type,
                engine: vehicleData.engine,
                body_type: vehicleData.body_type,
                condition: vehicleData.condition,
                stock_number: vehicleData.stock_number,
                location: vehicleData.location,
                is_featured: vehicleData.is_featured
            });

            const result = await InventoryModel.updateVehicle(vehicleId, vehicleData, req.files);
            
            if (result.success) {
                res.status(200).json({
                    status: 'success',
                    message: 'Vehicle updated successfully',
                    vehicle: result.vehicle
                });
            } else {
                console.error('Error updating vehicle in model:', result.error);
                res.status(500).json({
                    status: 'error',
                    message: 'Failed to update vehicle.',
                    error: result.error
                });
            }
        } catch (error) {
            console.error('Error in updateVehicle controller:', error);
            res.status(500).json({
                status: 'error',
                message: 'Failed to update vehicle.',
                error: error.message,
                details: error.stack
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