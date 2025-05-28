const fs = require('fs');
const path = require('path');
const pool = require('../config/db');

async function runMigrations() {
    try {
        // Read the migration file
        const migrationPath = path.join(__dirname, '../migrations/001_create_users_table.sql');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

        // Execute the migration
        await pool.query(migrationSQL);
        console.log('Migration completed successfully!');
    } catch (error) {
        console.error('Error running migration:', error);
    } finally {
        // Close the pool
        await pool.end();
    }
}

// Run migrations
runMigrations(); 