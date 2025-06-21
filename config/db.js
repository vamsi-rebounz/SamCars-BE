const { Pool } = require('pg');
require('dotenv').config(); // Load environment variables from .env file

/**
 * Creates a new PostgreSQL connection pool
 */
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

// Test the database connection
pool.connect((err, client, release) => {
    if (err) {
        return console.error('Error acquiring client', err.stack);
    }
    console.log('Successfully connected to PostgreSQL database!');
    release(); // Release the client back to the pool
});

module.exports = pool;
