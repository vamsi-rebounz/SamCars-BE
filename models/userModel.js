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
     * @param {string} [userData.username] - Optional: User's chosen username (unique).
     * @param {string} [userData.role='user'] - Optional: User's role (defaults to 'user').
     * @param {boolean} [userData.email_verified=false] - Optional: Email verification status (defaults to false via DB).
     * @param {string} [userData.date_of_birth] - Optional: User's date of birth (ISO 8601 date string).
     * @returns {Promise<object|null>} - The created user object (excluding password_hash) or null if creation fails.
     */
    async createUser(userData) {
        const {
            first_name,
            last_name,
            email,
            password,
            username = null, // Default to null if not provided, as per schema's optionality
            role = 'user', // Default to 'user' role if not provided in input
            email_verified = false, // Explicitly set or default, database also has a default
            date_of_birth = null // Default to null if not provided
        } = userData;

        try {
            // Hash the password
            const saltRounds = 10; // Cost factor for hashing
            const password_hash = await bcrypt.hash(password, saltRounds);

            // Insert the new user into the 'users' table, including all new fields
            const result = await pool.query(
                `INSERT INTO users (
                    first_name,
                    last_name,
                    email,
                    password_hash,
                    username,
                    role,
                    email_verified,
                    date_of_birth
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING id, first_name, last_name, email, username, role, email_verified, date_of_birth, created_at`, // Return all relevant user data
                [
                    first_name,
                    last_name,
                    email,
                    password_hash,
                    username,
                    role,
                    email_verified,
                    date_of_birth
                ]
            );

            // Return the newly created user (without the hashed password)
            return result.rows[0];
        } catch (error) {
            console.error('Error creating user in model:', error);
            // Check for unique constraint violation (e.g., duplicate email or username)
            if (error.code === '23505') { // PostgreSQL unique violation error code
                if (error.constraint === 'users_email_key') {
                    throw new Error('Email already registered.');
                }
                if (error.constraint === 'users_username_key') {
                    throw new Error('Username already taken.');
                }
                // Generic unique constraint error if constraint name is not matched
                throw new Error('A unique constraint violation occurred (e.g., duplicate email or username).');
            }
            throw new Error('Could not create user due to a server error.');
        }
    }
    // You can add more user-related database functions here (e.g., findUserByEmail, updateUser, deleteUser)
};

module.exports = UserModel;
