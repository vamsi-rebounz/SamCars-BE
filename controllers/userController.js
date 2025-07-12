// controllers/userController.js
const UserModel = require('../models/userModel');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
require('dotenv').config();

const UserController = {
    
    // Register a new user
    async registerUser(req, res) {
        
        // Using req.fields to handle form-data
        console.log('req.fields:', req.fields);
        const first_name = req.fields.first_name;
        const last_name = req.fields.last_name;
        const email = req.fields.email;
        const password = req.fields.password;
        const role = req.fields.role;

        if (!first_name || !last_name || !email || !password) {
            return res.status(400).json({ success: false, message: 'All fields (first_name, last_name, email, password) are required.' });
        }

        if (!/\S+@\S+\.\S+/.test(email)) {
            return res.status(400).json({ success: false, message: 'Invalid email format.' });
        }

        if (password.length < 8) {
            return res.status(400).json({ success: false, message: 'Password must be at least 8 characters long.' });
        }

        try {
            const newUser = await UserModel.createUser({ first_name, last_name, email, password, role });
            res.status(201).json({
                success: true,
                message: 'User created successfully.',
                user: {
                    id: newUser.user_id,
                    email: newUser.email,
                    first_name: newUser.first_name,
                    last_name: newUser.last_name,
                    role: newUser.role,
                    created_at: newUser.created_at
                }
            });
        } catch (error) {
            console.error('Error in registerUser controller:', error);
            if (error.message === 'Email already registered.') {
                return res.status(409).json({ success: false, error_code: 'EMAIL_ALREADY_REGISTERED', message: error.message });
            }
            res.status(500).json({ success: false, error_code: 'UNKNOWN_ERROR', message: 'An unexpected error occurred.' });
        }
    },

    // Login a user
    async loginUser(req, res) {
        console.log('Login attempt received:', { email: req.fields.email });
        const { email, password } = req.fields;
    
        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required.' });
        }
    
        try {
            console.log('Attempting to fetch user...');
            const user = await UserModel.getUserByEmail(email);
            console.log('User fetch result:', { found: !!user, userId: user?.user_id });
            
            if (!user) {
                return res.status(401).json({ message: 'Invalid email or password.' });
            }
    
            console.log('Comparing password...');
            const passwordMatch = await bcrypt.compare(password, user.password_hash);
            console.log('Password match result:', passwordMatch);
            
            if (!passwordMatch) {
                return res.status(401).json({ message: 'Invalid email or password.' });
            }
    
            const payload = {
                user_id: user.user_id,
                email: user.email,
                role: user.role
            };
    
            console.log('Generating tokens with payload:', payload);
            const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
                expiresIn: process.env.JWT_EXPIRES_IN || '15m'
            });
    
            const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
                expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
            });
    
            return res.status(200).json({
                success: true,
                message: "Login successful",
                accessToken,
                refreshToken,
                user: {
                    id: user.user_id,
                    email: user.email,
                    role: user.role,
                    first_name: user.first_name,
                    last_name: user.last_name
                }
            });
    
        } catch (error) {
            console.error("Login error details:", {
                message: error.message,
                stack: error.stack,
                name: error.name
            });
            res.status(500).json({ message: 'Internal server error' });
        }
    },

    // Fetch a user by ID
    async fetchUserById(req, res) {
        const { id } = req.query;

        if (!id) {
            return res.status(400).json({ success: false, error_code: 'MISSING_ID', message: 'User ID is required' });
        }

        try {
            const user = await UserModel.getUserById(id);
            if (!user) {
                return res.status(404).json({ success: false, error_code: 'USER_NOT_FOUND', message: 'User not found' });
            }
            res.json({ success: true, user });
        } catch (error) {
            console.error('Error in fetchUserById controller:', error);
            res.status(500).json({ success: false, error_code: 'SERVER_ERROR', message: 'Could not fetch user details' });
        }
    },

    // Update user profile
    async updateUserProfile(req, res) {
        try {
            const userId = req.user.user_id; // From JWT token
            const {
                first_name,
                last_name,
                email,
                phone,
                current_password,
                new_password
            } = req.fields;

            // Validate required fields
            if (!first_name || !last_name || !email) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'First name, last name, and email are required.' 
                });
            }

            // Validate email format
            if (!/\S+@\S+\.\S+/.test(email)) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Invalid email format.' 
                });
            }

            // If changing password, validate current password
            if (new_password) {
                if (!current_password) {
                    return res.status(400).json({ 
                        success: false, 
                        message: 'Current password is required to change password.' 
                    });
                }

                if (new_password.length < 8) {
                    return res.status(400).json({ 
                        success: false, 
                        message: 'New password must be at least 8 characters long.' 
                    });
                }

                // Verify current password
                const currentUser = await UserModel.getUserByEmail(email);
                if (!currentUser) {
                    return res.status(404).json({ 
                        success: false, 
                        message: 'User not found.' 
                    });
                }

                const passwordMatch = await bcrypt.compare(current_password, currentUser.password_hash);
                if (!passwordMatch) {
                    return res.status(401).json({ 
                        success: false, 
                        message: 'Current password is incorrect.' 
                    });
                }
            }

            // Update user profile
            const updatedUser = await UserModel.updateUserProfile(userId, {
                first_name,
                last_name,
                email,
                phone,
                new_password
            });

            res.json({
                success: true,
                message: 'Profile updated successfully.',
                user: {
                    id: updatedUser.user_id,
                    email: updatedUser.email,
                    first_name: updatedUser.first_name,
                    last_name: updatedUser.last_name,
                    role: updatedUser.role,
                    phone: updatedUser.phone,
                    updated_at: updatedUser.updated_at
                }
            });

        } catch (error) {
            console.error('Error in updateUserProfile controller:', error);
            if (error.message === 'Email already registered.') {
                return res.status(409).json({ 
                    success: false, 
                    error_code: 'EMAIL_ALREADY_REGISTERED', 
                    message: error.message 
                });
            }
            res.status(500).json({ 
                success: false, 
                error_code: 'SERVER_ERROR', 
                message: 'Failed to update profile.' 
            });
        }
    },
};

module.exports = UserController;
