require('dotenv').config();
const pool = require('../config/db');

async function checkConnection() {
    try {
        console.log('\nEnvironment Variables:');
        console.log('---------------------');
        console.log('DB_USER:', process.env.DB_USER);
        console.log('DB_HOST:', process.env.DB_HOST);
        console.log('DB_DATABASE:', process.env.DB_DATABASE);
        console.log('DB_PORT:', process.env.DB_PORT);
        console.log('DB_PASSWORD:', '[HIDDEN]');

        // Get connection info
        const connInfo = await pool.query(`
            SELECT 
                current_database() as database,
                current_schema() as schema,
                current_user as user,
                session_user as session_user,
                version() as version
        `);
        
        console.log('\nActual Connection Details:');
        console.log('------------------------');
        console.log(connInfo.rows[0]);

        // List all schemas
        const schemas = await pool.query(`
            SELECT schema_name 
            FROM information_schema.schemata 
            WHERE schema_name NOT IN ('pg_catalog', 'information_schema')
            ORDER BY schema_name;
        `);

        console.log('\nAvailable Schemas:');
        console.log('------------------');
        schemas.rows.forEach(row => {
            console.log(row.schema_name);
        });
        
    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await pool.end();
    }
}

checkConnection(); 