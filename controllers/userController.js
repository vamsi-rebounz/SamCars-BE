// controllers/userController.js
const UserModel = require('../models/userModel');

const UserController = {
    /**
     * Handles the creation of a new user.
     * @param {object} req - Express request object.
     * @param {object} res - Express response object.
     */
    async registerUser(req, res) {
        const { first_name, last_name, email, password, role } = req.body;

        // Basic input validation
        if (!first_name || !last_name || !email || !password) {
            return res.status(400).json({
                success: false,
                message: 'All fields (first_name, last_name, email, password) are required.'
            });
        }

        // Basic email format validation (more robust validation might be needed)
        if (!/\S+@\S+\.\S+/.test(email)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid email format.'
            });
        }

        // Password strength validation
        if (password.length < 8) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 8 characters long.'
            });
        }

        try {
            // UserModel.createUser now handles password hashing and database insertion.
            // Pass the plain password to the model.
            const newUser = await UserModel.createUser({
                first_name,
                last_name,
                email,
                password, // Pass plain password, model will hash it
                role // Add role parameter
            });

            // The newUser object returned from the model will contain actual database columns
            res.status(201).json({
                success: true,
                message: 'User created successfully.',
                user: {
                    id: newUser.user_id, // Use 'user_id' as per your database schema
                    // Removed 'username' as it's not a column in your 'users' table
                    email: newUser.email,
                    first_name: newUser.first_name,
                    last_name: newUser.last_name,
                    role: newUser.role, // Use the role returned from the DB (defaults to 'customer')
                    created_at: newUser.created_at
                }
            });
        } catch (error) {
            console.error('Error in registerUser controller:', error); // Log the full error for better debugging
            if (error.message === 'Email already registered.') {
                return res.status(409).json({ // Conflict status for duplicate resource
                    success: false,
                    error_code: 'EMAIL_ALREADY_REGISTERED',
                    message: error.message
                });
            }
            // Catch the generic server error message from the model
            if (error.message.includes('Could not create user')) {
                return res.status(500).json({
                    success: false,
                    error_code: 'SERVER_ERROR',
                    message: error.message // Use the specific error message from the model
                });
            }
            // Fallback for any other unexpected errors
            res.status(500).json({
                success: false,
                error_code: 'UNKNOWN_ERROR',
                message: 'An unexpected server error occurred during user registration.'
            });
        }
    },
    
    /**
     * Handler for fetching a user by their ID.
     * @param {*} req - Express request object
     * @param {*} res - Express response object
     */
    async fetchUserById(req, res) {
        const { id } = req.query;

        if (!id) {
            return res.status(400).json({
                success: false,
                error_code: 'MISSING_ID',
                message: 'User ID is required'
            });
        }

        try {
            const user = await UserModel.getUserById(id);
            
            if (!user) {
                return res.status(404).json({
                    success: false,
                    error_code: 'USER_NOT_FOUND',
                    message: 'User not found'
                });
            }

            res.json({
                success: true,
                user
            });
        } catch (error) {
            console.error('Error in fetchUserById controller:', error);
            res.status(500).json({
                success: false,
                error_code: 'SERVER_ERROR',
                message: 'Could not fetch user details'
            });
        }
    }
};

module.exports = UserController;