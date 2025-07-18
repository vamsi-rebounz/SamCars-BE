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
        try {
            const userId = req.params.userId || req.user.userId;

            const user = await UserModel.findById(userId);
            if (!user) {
                return res.status(404).json({ 
                    status: 'error',
                    message: 'User not found' 
                });
            }

            // Remove sensitive information
            const { password, ...userInfo } = user;

            res.json({ 
                status: 'success',
                data: userInfo 
            });
        } catch (error) {
            console.error('Error in fetchUserById:', error);
            res.status(500).json({ 
                status: 'error',
                message: 'Failed to fetch user details' 
            });
        }
    },

    // Update user profile
    async updateUserProfile(req, res) {
        try {
            const userId = req.user.userId;
            const { firstName, lastName, phone } = req.body;

            const updatedUser = await UserModel.updateProfile(userId, {
                firstName,
                lastName,
                phone
            });

            if (!updatedUser) {
                return res.status(404).json({ 
                    status: 'error',
                    message: 'User not found' 
                });
            }

            // Transform the response to match frontend expectations
            const userResponse = {
                userId: updatedUser.user_id,
                email: updatedUser.email,
                firstName: updatedUser.first_name,
                lastName: updatedUser.last_name,
                phone: updatedUser.phone,
                role: updatedUser.role
            };

            res.json({ 
                status: 'success',
                data: {
                    user: userResponse
                },
                message: 'Profile updated successfully' 
            });
        } catch (error) {
            console.error('Error in updateUserProfile:', error);
            res.status(500).json({ 
                status: 'error',
                message: 'Failed to update profile' 
            });
        }
    },

    // List all users (admin only)
    async listUsers(req, res) {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            const role = req.query.role;

            const result = await UserModel.listAll(page, limit, role);

            res.json({
                status: 'success',
                data: {
                    users: result.users.map(user => {
                        const { password, ...userInfo } = user;
                        return userInfo;
                    }),
                    pagination: {
                        total: result.total,
                        page: result.page,
                        totalPages: result.totalPages
                    }
                }
            });
        } catch (error) {
            console.error('Error in listUsers:', error);
            res.status(500).json({ 
                status: 'error',
                message: 'Failed to fetch users list' 
            });
        }
    },

    // Update user status (admin only)
    async updateUserStatus(req, res) {
        try {
            const { userId } = req.params;
            const { isActive } = req.body;

            if (typeof isActive !== 'boolean') {
                return res.status(400).json({ 
                    status: 'error',
                    message: 'isActive must be a boolean value' 
                });
            }

            const updatedUser = await UserModel.setActiveStatus(userId, isActive);
            
            if (!updatedUser) {
                return res.status(404).json({ 
                    status: 'error',
                    message: 'User not found' 
                });
            }

            // Remove sensitive information
            const { password, ...userInfo } = updatedUser;

            res.json({ 
                status: 'success',
                data: userInfo,
                message: `User ${isActive ? 'activated' : 'deactivated'} successfully` 
            });
        } catch (error) {
            console.error('Error in updateUserStatus:', error);
            res.status(500).json({ 
                status: 'error',
                message: 'Failed to update user status' 
            });
        }
    }
};

module.exports = UserController;
