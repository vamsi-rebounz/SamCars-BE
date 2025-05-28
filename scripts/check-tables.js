const pool = require('../config/db');

async function checkTables() {
    try {
        // Get detailed connection info
        const connInfo = await pool.query(`
            SELECT current_database(), current_schema(), current_user, session_user;
        `);
        console.log('\nConnection Details:');
        console.log(connInfo.rows[0]);

        // Try to directly check auction_vehicles table
        try {
            const tableCheck = await pool.query(`
                SELECT EXISTS (
                    SELECT 1 
                    FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = 'auction_vehicles'
                );
            `);
            console.log('\nDoes auction_vehicles exist?', tableCheck.rows[0].exists);
            
            if (tableCheck.rows[0].exists) {
                // If table exists, try to count rows
                const countRows = await pool.query('SELECT COUNT(*) FROM auction_vehicles');
                console.log('Number of rows in auction_vehicles:', countRows.rows[0].count);
            }
        } catch (tableError) {
            console.log('\nError checking auction_vehicles:', tableError.message);
        }

        // List all tables in public schema
        const tables = await pool.query(`
            SELECT table_name, table_type 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            ORDER BY table_name;
        `);

        console.log('\nAll tables in public schema:');
        tables.rows.forEach(row => {
            console.log(`${row.table_name} (${row.table_type})`);
        });

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await pool.end();
    }
}

checkTables(); 