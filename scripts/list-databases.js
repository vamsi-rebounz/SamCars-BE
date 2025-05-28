const pool = require('../config/db');

async function listDatabases() {
    try {
        // Get current database
        const currentDB = await pool.query('SELECT current_database()');
        console.log('\nCurrently connected to database:', currentDB.rows[0].current_database);

        // List all databases
        const result = await pool.query(`
            SELECT 
                datname as database_name,
                pg_size_pretty(pg_database_size(datname)) as size,
                usename as owner
            FROM pg_database d
            JOIN pg_user u ON d.datdba = u.usesysid
            WHERE datistemplate = false
            ORDER BY datname;
        `);
        
        console.log('\nAll Databases:');
        console.log('-------------');
        result.rows.forEach(row => {
            console.log(`Database: ${row.database_name}`);
            console.log(`Owner: ${row.owner}`);
            console.log(`Size: ${row.size}`);
            console.log('-------------');
        });
        
    } catch (error) {
        console.error('Error listing databases:', error);
    } finally {
        await pool.end();
    }
}

listDatabases(); 