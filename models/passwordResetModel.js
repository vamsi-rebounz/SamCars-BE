const pool = require('../config/db');
const bcrypt = require('bcrypt');

const PasswordResetModel = {
    async createToken(userId, token, expiresAt) {
        await pool.query(
          'INSERT INTO PASSWORD_RESET_TOKENS (user_id, token, expires_at) VALUES ($1, $2, $3)',
          [userId, token, expiresAt]
        );
      },
      
      async findByToken(token) {
        const result = await pool.query(
          'SELECT * FROM PASSWORD_RESET_TOKENS WHERE token = $1',
          [token]
        );
        return result.rows[0];
      },
      
      async deleteToken(token) {
        await pool.query('DELETE FROM PASSWORD_RESET_TOKENS WHERE token = $1', [token]);
      }
}

module.exports = PasswordResetModel;