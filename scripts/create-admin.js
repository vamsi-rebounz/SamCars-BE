const readline = require('readline');
const bcrypt = require('bcryptjs');
const db = require('../config/db');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function ask(question) {
  return new Promise(resolve => rl.question(question, answer => resolve(answer)));
}

async function createAdmin() {
  try {
    const email = (await ask('Email (default: admin@samcars123.com): ')) || 'admin@samcars123.com';
    const password = (await ask('Password (default: admin123): ')) || 'admin123';
    const first_name = (await ask('First name (default: Admin123): ')) || 'Admin123';
    const last_name = (await ask('Last name (default: SamCars123): ')) || 'SamCars123';
    const phone = (await ask('Phone (default: 09123456789): ')) || '09123456789';
    const role = 'admin';
    const is_active = true;
    const token_version = 0;

    const password_hash = await bcrypt.hash(password, 10);

    const query = `
      INSERT INTO users (email, password, first_name, last_name, phone, role, is_active, token_version, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
      RETURNING user_id, email, first_name, last_name, phone, role, is_active, created_at;
    `;
    const values = [email, password_hash, first_name, last_name, phone, role, is_active, token_version];

    const result = await db.query(query, values);
    console.log('\nAdmin user created successfully:');
    console.table(result.rows);
  } catch (err) {
    console.error('Error creating admin user:', err);
  } finally {
    rl.close();
    process.exit();
  }
}

createAdmin(); 