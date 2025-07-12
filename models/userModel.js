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

    /**
     * Update user profile information.
     * @param {string|number} userId
     * @param {object} updateData
     * @returns {Promise<object>} Updated user (excluding password)
     */
    async updateUserProfile(userId, updateData) {
        const {
            first_name,
            last_name,
            email,
            phone,
            new_password
        } = updateData;

        try {
            // Check if email is already taken by another user
            if (email) {
                const emailCheckQuery = 'SELECT user_id FROM users WHERE email = $1 AND user_id != $2';
                const existingUser = await pool.query(emailCheckQuery, [email, userId]);
                
                if (existingUser.rows.length > 0) {
                    throw new Error('Email already registered.');
                }
            }

            // Build update query dynamically
            const updateFields = [];
            const updateValues = [];
            let valueCounter = 1;

            if (first_name !== undefined) {
                updateFields.push(`first_name = $${valueCounter}`);
                updateValues.push(first_name);
                valueCounter++;
            }

            if (last_name !== undefined) {
                updateFields.push(`last_name = $${valueCounter}`);
                updateValues.push(last_name);
                valueCounter++;
            }

            if (email !== undefined) {
                updateFields.push(`email = $${valueCounter}`);
                updateValues.push(email);
                valueCounter++;
            }

            if (phone !== undefined) {
                updateFields.push(`phone = $${valueCounter}`);
                updateValues.push(phone);
                valueCounter++;
            }

            if (new_password) {
                const password_hash = await bcrypt.hash(new_password, 10);
                updateFields.push(`password_hash = $${valueCounter}`);
                updateValues.push(password_hash);
                valueCounter++;
            }

            // Always update the updated_at timestamp
            updateFields.push(`updated_at = CURRENT_TIMESTAMP`);

            if (updateFields.length === 0) {
                throw new Error('No fields to update.');
            }

            // Add user_id to the values array
            updateValues.push(userId);

            const updateQuery = `
                UPDATE users 
                SET ${updateFields.join(', ')}
                WHERE user_id = $${valueCounter}
                RETURNING user_id, first_name, last_name, email, role, phone, created_at, updated_at
            `;

            const result = await pool.query(updateQuery, updateValues);
            
            if (result.rows.length === 0) {
                throw new Error('User not found.');
            }

            return result.rows[0];
        } catch (error) {
            console.error('Error updating user profile in model:', error);
            if (error.message === 'Email already registered.') {
                throw error;
            }
            throw new Error('Could not update user profile due to a server error.');
        }
    },

    /**
     * Find a user by email.
     * @param {string} email
     * @returns {Promise<object|null>}
     */
    async findByEmail(email) {
        const { rows } = await pool.query(
            'SELECT user_id, email, first_name FROM users WHERE email = $1',
            [email]
        );
        return rows[0] || null;
    },

    /**
     * Update a user's password.
     * @param {string|number} userId
     * @param {string} hashedPassword
     * @returns {Promise<void>}
     */
    async updatePassword(userId, hashedPassword) {
        await pool.query(
          'UPDATE USERS SET password_hash = $1, updated_at = NOW() WHERE user_id = $2',
          [hashedPassword, userId]
        );
    }
}; 

module.exports = UserModel;
