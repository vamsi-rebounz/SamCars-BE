// models/userModel.js
const pool = require('../config/db');
const bcrypt = require('bcrypt');

const UserModel = {
    /**
     * Creates a new user in the database.
     * Hashes the password before storing it.
     * @param {object} userData - Object containing user details.
     * @param {string} userData.first_name - User's first name.
     * @param {string} userData.last_name - User's last name.
     * @param {string} userData.email - User's email (must be unique).
     * @param {string} userData.password - User's plain text password.
     * @param {string} [userData.role='customer'] - Optional: User's role (defaults to 'customer' in DB).
     * @param {boolean} [userData.email_verified=false] - Optional: Email verification status (defaults to false via DB).
     * @param {string} [userData.phone] - Optional: User's phone number.
     * @param {string} [userData.driver_license] - Optional: User's driver's license.
     * @param {string} [userData.date_of_birth] - Optional: User's date of birth (ISO 8601 date string).
     * @returns {Promise<object|null>} - The created user object (excluding password_hash) or null if creation fails.
     */
    async createUser(userData) {
        const {
            first_name,
            last_name,
            email,
            password,
            // Removed 'username' as it's not in your table schema
            // 'role' will default in DB, but can be passed if needed
            role = 'customer', // Align with your DB default if not provided
            email_verified = false,
            phone = null, // Default to null if not provided
            driver_license = null, // Default to null if not provided
            date_of_birth = null // Default to null if not provided
        } = userData;

        try {
            // Hash the password
            const saltRounds = 10; // Cost factor for hashing
            const password_hash = await bcrypt.hash(password, saltRounds);

            // Updated to use lowercase table name
            const checkQuery = 'SELECT user_id FROM users WHERE email = $1';
            const existingUser = await pool.query(checkQuery, [email]);

            if (existingUser.rows.length > 0) {
                // Throw an error that the controller can specifically catch for 'email already registered'
                const error = new Error('Email already registered.');
                error.code = '23505'; // PostgreSQL unique violation error code
                error.constraint = 'users_email_key'; // Name of the unique constraint on email
                throw error;
            }

            // Updated to use lowercase table name
            const result = await pool.query(
                `INSERT INTO users (
                    first_name,
                    last_name,
                    email,
                    password_hash,
                    role,             -- This column exists
                    email_verified,   -- This column exists
                    phone,            -- This column exists
                    driver_license,   -- This column exists
                    date_of_birth     -- This column exists
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                RETURNING user_id, first_name, last_name, email, role, email_verified, created_at, updated_at`, // Return actual column names
                [
                    first_name,
                    last_name,
                    email,
                    password_hash,
                    role,
                    email_verified,
                    phone,
                    driver_license,
                    date_of_birth
                ]
            );

            // Return the newly created user (without the hashed password)
            return result.rows[0];
        } catch (error) {
            console.error('Error creating user in model:', error);
            // Check for unique constraint violation (e.g., duplicate email)
            if (error.code === '23505') { // PostgreSQL unique violation error code
                if (error.constraint === 'users_email_key') {
                    throw new Error('Email already registered.');
                }
                // If you had other unique constraints (e.g., on phone or driver_license),
                // you would add more `if (error.constraint === 'your_constraint_name')` checks here.
                throw new Error('A unique constraint violation occurred.');
            }
            // Re-throw generic server error for controller
            throw new Error('Could not create user due to a server error.');
        }
    },

    /**
     * Fetches a user by their ID from the database.
     * @param {string|number} userId - The ID of the user to fetch.
     * @returns {Promise<object|null>} The user object (excluding password_hash) or null if not found.
     */
    async getUserById(userId) {
        try {
            const query = `
                SELECT 
                    user_id,
                    first_name,
                    last_name,
                    email,
                    role,
                    email_verified,
                    phone,
                    driver_license,
                    date_of_birth,
                    created_at,
                    updated_at,
                    last_login
                FROM users 
                WHERE user_id = $1`;
            
            const result = await pool.query(query, [userId]);
            
            if (result.rows.length === 0) {
                return null;
            }
            
            return result.rows[0];
        } catch (error) {
            console.error('Error in getUserById:', error);
            throw new Error('Could not fetch user details.');
        }
    }
};

module.exports = UserModel;