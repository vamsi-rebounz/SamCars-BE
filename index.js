require('dotenv').config();
const express = require('express');
const formidable = require('express-formidable');
const cors = require('cors');
const pool = require('./config/db');
const path = require('path');
const fs = require('fs');
 
// Import routes
const userRoutes = require('./routes/userRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const vehicleRoutes = require('./routes/vehicleRoutes');
 
const app = express();
const PORT = process.env.PORT || 3000;
 
// CORS should come before routes
app.use(cors({
  origin: [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175"
  ],
  credentials: true
}));

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
 
// Test endpoint
app.get('/test', (req, res) => {
  res.json({ message: 'Backend server is running and accessible' });
});

// Mount routes
// Use formidable only for user routes that need file upload
app.use('/users', formidable(), userRoutes);
// Use express.json for other routes
app.use('/inventory', express.json(), inventoryRoutes);
app.use('/vehicles', express.json(), vehicleRoutes);
 
// Health checks
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});
 
app.get('/', (req, res) => {
  res.json({ message: 'SamCars API is running!' });
});
 
// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});
 
// Test database connection before starting server
pool.connect((err, client, release) => {
  if (err) {
    console.error('Error connecting to the database:', err.stack);
    process.exit(1);
  }
  release();
  console.log('Successfully connected to PostgreSQL database');
  
  // Start server after successful database connection
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
});
 