// models/userModel.js
const pool = require('../config/db');
const bcrypt = require('bcrypt');

const UserModel = {
    /**
     * Creates a new user in the database with hashed password.
     * @param {object} userData
     * @returns {Promise<object>} Created user (excluding password)
     */
    async createUser(userData) {
        const {
            first_name,
            last_name,
            email,
            password,
            role = 'customer',
            email_verified = false,
            phone = null,
            driver_license = null,
            date_of_birth = null
        } = userData;

        try {
            const password_hash = await bcrypt.hash(password, 10);

            const checkQuery = 'SELECT user_id FROM users WHERE email = $1';
            const existingUser = await pool.query(checkQuery, [email]);

            if (existingUser.rows.length > 0) {
                const error = new Error('Email already registered.');
                error.code = '23505';
                error.constraint = 'users_email_key';
                throw error;
            }

            const result = await pool.query(
                `INSERT INTO users (
                    first_name, last_name, email, password_hash, role,
                    email_verified, phone, driver_license, date_of_birth
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
                RETURNING user_id, first_name, last_name, email, role, email_verified, created_at, updated_at`,
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

            return result.rows[0];
        } catch (error) {
            console.error('Error creating user in model:', error);
            if (error.code === '23505') {
                if (error.constraint === 'users_email_key') {
                    throw new Error('Email already registered.');
                }
                throw new Error('A unique constraint violation occurred.');
            }
            throw new Error('Could not create user due to a server error.');
        }
    },

    /**
     * Fetch a user by ID.
     * @param {string|number} userId
     * @returns {Promise<object|null>}
     */
    async getUserById(userId) {
        try {
            const result = await pool.query(
                `SELECT user_id, first_name, last_name, email, role,
                        email_verified, phone, driver_license, date_of_birth,
                        created_at, updated_at, last_login
                 FROM users
                 WHERE user_id = $1`,
                [userId]
            );
            return result.rows[0] || null;
        } catch (error) {
            console.error('Error in getUserById:', error);
            throw new Error('Could not fetch user details.');
        }
    },

    /**
     * Fetch a user by email (used for login and password reset).
     * @param {string} email
     * @returns {Promise<object|null>}
     */
    async getUserByEmail(email) {
        try {
            const result = await pool.query(
                `SELECT user_id, first_name, last_name, email, password_hash, role
                 FROM users
                 WHERE email = $1`,
                [email]
            );
            return result.rows[0] || null;
        } catch (error) {
            console.error('Error in getUserByEmail:', error);
            throw new Error('Could not fetch user by email.');
        }
    },

    async createUserSession(userId, token, ipAddress, userAgent) {
        try {
            // Update last_login timestamp
            await pool.query(
                'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE user_id = $1',
                [userId]
            );

            // Create new session
            const result = await pool.query(
                `INSERT INTO user_sessions (
                    user_id, token, expires_at, ip_address, user_agent
                ) VALUES ($1, $2, NOW() + INTERVAL '7 days', $3, $4)
                RETURNING session_id, expires_at`,
                [userId, token, ipAddress, userAgent]
            );

            return result.rows[0];
        } catch (error) {
            console.error('Error in createUserSession:', error);
            throw new Error('Could not create user session.');
        }
    },

    async updateUser(userId, updateData) {
        try {
            const fields = Object.keys(updateData);
            const values = Object.values(updateData);
            
            // Build the SET clause for the UPDATE query
            const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ');
            
            const query = `
                UPDATE users 
                SET ${setClause}, updated_at = CURRENT_TIMESTAMP 
                WHERE user_id = $1 
                RETURNING user_id, first_name, last_name, email, role, 
                          email_verified, phone, driver_license, date_of_birth, 
                          created_at, updated_at, last_login
            `;
            
            const result = await pool.query(query, [userId, ...values]);
            return result.rows[0];
        } catch (error) {
            console.error('Error in updateUser:', error);
            throw new Error('Could not update user details.');
        }
    }
};

module.exports = UserModel;
