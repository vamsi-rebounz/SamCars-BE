// controllers/userController.js
const UserModel = require('../models/userModel');

const UserController = {
    /**
     * Handles the creation of a new user.
     * @param {object} req - Express request object.
     * @param {object} res - Express response object.
     */
    async registerUser(req, res) {
        const { first_name, last_name, email, password } = req.body;

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

        // Password strength validation (example)
        if (password.length < 8) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 8 characters long.'
            });
        }

        try {
            const newUser = await UserModel.createUser({ first_name, last_name, email, password });

            res.status(201).json({
                success: true,
                message: 'User created successfully.',
                user: {
                    id: newUser.id,
                    username: newUser.username, // Assuming username might be derived or added later
                    email: newUser.email,
                    role: 'user', // Default role for new registrations
                    created_at: newUser.created_at
                }
            });
        } catch (error) {
            console.error('Error in registerUser controller:', error.message);
            if (error.message === 'Email already registered.') {
                return res.status(409).json({ // Conflict status for duplicate resource
                    success: false,
                    error_code: 'EMAIL_ALREADY_REGISTERED',
                    message: error.message
                });
            }
            res.status(500).json({
                success: false,
                error_code: 'SERVER_ERROR',
                message: 'Something went wrong during user registration.'
            });
        }
    }
    // You can add more controller methods here (e.g., loginUser, getUserById)
};

module.exports = UserController;
