const pool = require('../config/db');

async function listTables() {
    try {
        // Get connection info
        const connInfo = await pool.query(`
            SELECT 
                current_database() as database,
                current_schema() as schema,
                current_user as user,
                session_user as session_user
        `);
        
        console.log('\nConnection Details:');
        console.log('------------------');
        console.log(connInfo.rows[0]);
        
        // Get all tables from all schemas
        const result = await pool.query(`
            SELECT 
                table_schema,
                table_name,
                table_type
            FROM information_schema.tables 
            WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
            ORDER BY table_schema, table_name;
        `);
        
        console.log('\nAll Tables in Database:');
        console.log('----------------------');
        if (result.rows.length === 0) {
            console.log('No tables found in any schema');
        } else {
            result.rows.forEach(row => {
                console.log(`Schema: ${row.table_schema}, Table: ${row.table_name}, Type: ${row.table_type}`);
            });
        }
        
    } catch (error) {
        console.error('Error listing tables:', error);
        console.error('Error details:', error.message);
    } finally {
        await pool.end();
    }
}

listTables(); 