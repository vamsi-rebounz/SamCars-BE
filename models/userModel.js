// models/userModel.js
const db = require('../config/db');

class UserModel {
    static async create({ email, password, first_name, last_name, phone, role, is_active, token_version }) {
        const query = `
            INSERT INTO users (
                email, password, first_name, last_name, 
                phone, role, is_active, token_version,
                created_at, updated_at
            ) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
            RETURNING *
        `;
        const values = [email, password, first_name, last_name, phone, role, is_active, token_version];
        const result = await db.query(query, values);
        return result.rows[0];
    }

    static async findByEmail(email) {
        const query = 'SELECT * FROM users WHERE email = $1';
        const result = await db.query(query, [email]);
            return result.rows[0];
    }

    static async findById(userId) {
        const query = 'SELECT * FROM users WHERE user_id = $1';
        const result = await db.query(query, [userId]);
        return result.rows[0];
    }

    static async updatePassword(userId, newPassword) {
        const query = `
            UPDATE users 
            SET password = $1, updated_at = NOW() 
            WHERE user_id = $2 
            RETURNING *
        `;
        const result = await db.query(query, [newPassword, userId]);
        return result.rows[0];
    }

    static async incrementTokenVersion(userId) {
        const query = `
            UPDATE users 
            SET token_version = token_version + 1, 
                updated_at = NOW() 
            WHERE user_id = $1 
            RETURNING *
        `;
        const result = await db.query(query, [userId]);
        return result.rows[0];
    }

    static async updateProfile(userId, { firstName, lastName, phone, driverLicense, dateOfBirth }) {
        const query = `
            UPDATE users 
            SET first_name = COALESCE($1, first_name),
                last_name = COALESCE($2, last_name),
                phone = COALESCE($3, phone),
                driver_license = COALESCE($4, driver_license),
                date_of_birth = COALESCE($5, date_of_birth),
                updated_at = NOW()
            WHERE user_id = $6 
            RETURNING *
        `;
        const result = await db.query(query, [firstName, lastName, phone, driverLicense, dateOfBirth, userId]);
        return result.rows[0];
    }

    static async setActiveStatus(userId, isActive) {
        const query = `
            UPDATE users 
            SET is_active = $1, 
                updated_at = NOW() 
            WHERE user_id = $2 
            RETURNING *
        `;
        const result = await db.query(query, [isActive, userId]);
        return result.rows[0];
    }

    static async delete(userId) {
        // Soft delete - just deactivate the user
        return this.setActiveStatus(userId, false);
    }

    static async listAll(page = 1, limit = 10, role = null) {
        const offset = (page - 1) * limit;
        let query = `
            SELECT user_id, email, first_name, last_name, 
                   phone, role, is_active, created_at 
            FROM users
            WHERE 1=1
        `;
        const values = [];

        if (role) {
            query += ' AND role = $1';
            values.push(role);
        }

        query += `
            ORDER BY created_at DESC
            LIMIT $${values.length + 1} OFFSET $${values.length + 2}
        `;
        values.push(limit, offset);

        const result = await db.query(query, values);
        
        // Get total count for pagination
        const countQuery = 'SELECT COUNT(*) FROM users' + (role ? ' WHERE role = $1' : '');
        const countResult = await db.query(countQuery, role ? [role] : []);
        
        return {
            users: result.rows,
            total: parseInt(countResult.rows[0].count),
            page,
            totalPages: Math.ceil(parseInt(countResult.rows[0].count) / limit)
        };
    }

    static async saveVerificationToken(userId, token) {
        const query = `
            UPDATE users 
            SET verification_token = $1,
                verification_token_created_at = NOW()
            WHERE user_id = $2 
            RETURNING *
        `;
        const result = await db.query(query, [token, userId]);
        return result.rows[0];
    }

    static async findByVerificationToken(token) {
        const query = 'SELECT * FROM users WHERE verification_token = $1';
        const result = await db.query(query, [token]);
        return result.rows[0];
    }

    static async verifyEmail(userId) {
        const query = `
            UPDATE users 
            SET email_verified = true,
                verification_token = NULL,
                verification_token_created_at = NULL,
                updated_at = NOW()
            WHERE user_id = $1 
            RETURNING *
        `;
        const result = await db.query(query, [userId]);
        return result.rows[0];
    }
}

module.exports = UserModel;
