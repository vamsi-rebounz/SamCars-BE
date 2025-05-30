// models/vehicleModel.js
const db = require('../config/db');

const findByVIN = async (vin) => {
  const result = await db.query(`SELECT * FROM vehicles WHERE vin = $1`, [vin]);
  return result.rows[0];
};

const createVehicle = async (vehicle) => {
  try {
    // Step 1: Get or insert make
    let make_id;
    const makeRes = await db.query(
      `SELECT make_id FROM vehicle_makes WHERE name = $1`,
      [vehicle.make]
    );

    if (makeRes.rows.length > 0) {
      make_id = makeRes.rows[0].make_id;
    } else {
      const newMake = await db.query(
        `INSERT INTO vehicle_makes (name, created_at) VALUES ($1, NOW()) RETURNING make_id`,
        [vehicle.make]
      );
      make_id = newMake.rows[0].make_id;
    }

    // Step 2: Get or insert model for that make
    let model_id;
    const modelRes = await db.query(
      `SELECT model_id FROM vehicle_models WHERE name = $1 AND make_id = $2`,
      [vehicle.model, make_id]
    );

    if (modelRes.rows.length > 0) {
      model_id = modelRes.rows[0].model_id;
    } else {
      const newModel = await db.query(
        `INSERT INTO vehicle_models (name, make_id, created_at) VALUES ($1, $2, NOW()) RETURNING model_id`,
        [vehicle.model, make_id]
      );
      model_id = newModel.rows[0].model_id;
    }

    // Step 3: Insert vehicle
    const vehicleInsert = await db.query(
      `INSERT INTO vehicles (
        vin, make_id, model_id, year, price, mileage,
        status, description, location, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9,  NOW(), NOW()
      ) RETURNING *`,
      [
        vehicle.vin,
        make_id,
        model_id,
        parseInt(vehicle.year),
        parseInt(vehicle.price),
        parseInt(vehicle.mileage),
        vehicle.status,
        vehicle.description,
        vehicle.location,
      ]
    );

    return vehicleInsert.rows[0];
  } catch (error) {
    console.error('Error inserting vehicle:', error);
    throw new Error('Could not insert vehicle into database.');
  }
};

module.exports = {
  createVehicle,
  findByVIN
};
