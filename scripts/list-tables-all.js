const { Pool } = require('pg');
require('dotenv').config();

async function listTablesInDatabase(dbName) {
    const pool = new Pool({
        user: process.env.DB_USER,
        host: process.env.DB_HOST,
        database: dbName,
        password: process.env.DB_PASSWORD,
        port: process.env.DB_PORT,
    });

    try {
        console.log(`\nChecking tables in database: ${dbName}`);
        console.log('----------------------------------------');

        const result = await pool.query(`
            SELECT 
                table_schema,
                table_name,
                table_type
            FROM information_schema.tables 
            WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
            ORDER BY table_schema, table_name;
        `);
        
        if (result.rows.length === 0) {
            console.log('No tables found');
        } else {
            result.rows.forEach(row => {
                console.log(`Schema: ${row.table_schema}, Table: ${row.table_name}, Type: ${row.table_type}`);
            });
        }
        
    } catch (error) {
        console.error(`Error listing tables in ${dbName}:`, error.message);
    } finally {
        await pool.end();
    }
}

// Check both databases
async function checkAllDatabases() {
    await listTablesInDatabase('postgres');
    await listTablesInDatabase('samcars');
}

checkAllDatabases(); 