const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkVehicleStatus() {
  try {
    console.log('🔍 Checking vehicle statuses...\n');
    
    // Get all vehicles with their status
    const query = `
      SELECT 
        vehicle_id,
        stock_number,
        make,
        model,
        year,
        status,
        price,
        updated_at
      FROM vehicles 
      ORDER BY updated_at DESC
      LIMIT 10
    `;
    
    const result = await pool.query(query);
    
    console.log('📊 Recent vehicles and their status:');
    console.log('─'.repeat(80));
    
    result.rows.forEach(vehicle => {
      const statusIcon = vehicle.status === 'available' ? '🟢' : 
                        vehicle.status === 'sold' ? '🔴' : 
                        vehicle.status === 'reserved' ? '🟡' : '⚪';
      
      console.log(`${statusIcon} ID: ${vehicle.vehicle_id} | Stock: ${vehicle.stock_number} | ${vehicle.year} ${vehicle.make} ${vehicle.model} | Status: ${vehicle.status} | Price: $${vehicle.price?.toLocaleString() || 'N/A'} | Updated: ${vehicle.updated_at}`);
    });
    
    // Check recent payments
    console.log('\n💰 Recent payments:');
    console.log('─'.repeat(80));
    
    const paymentQuery = `
      SELECT 
        payment_id,
        user_id,
        vehicle_id,
        amount,
        type,
        status,
        created_at
      FROM payments 
      ORDER BY created_at DESC
      LIMIT 5
    `;
    
    const paymentResult = await pool.query(paymentQuery);
    
    paymentResult.rows.forEach(payment => {
      console.log(`💳 Payment ID: ${payment.payment_id} | Vehicle: ${payment.vehicle_id} | Amount: $${payment.amount} | Type: ${payment.type} | Status: ${payment.status} | Date: ${payment.created_at}`);
    });
    
  } catch (error) {
    console.error('❌ Error checking vehicle status:', error);
  } finally {
    await pool.end();
  }
}

checkVehicleStatus(); 