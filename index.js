require('dotenv').config();

// Import dependencies
const express = require('express');
const cors = require('cors');
const formidable = require('express-formidable');

// Initialize express app
const app = express();
const PORT = process.env.PORT || 3000;

// Import routes
const userRoutes = require('./routes/userRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const vehicleRoutes = require('./routes/vehicleRoutes');
const auctionRoutes = require('./routes/auctionRoutes');

// Middleware
app.use(cors({
  origin: [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175"
  ],
  credentials: true
}));

// Parse JSON and URL-encoded data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Mount routes
app.use('/users', formidable(), userRoutes); // expects form-data for users
app.use('/inventory', inventoryRoutes);      // expects JSON
app.use('/vehicles', vehicleRoutes);         // expects JSON
app.use('/auction-tracker', formidable(), auctionRoutes); // expects form-data

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// Default route
app.get('/', (req, res) => {
  res.json({ message: 'SamCars API is running!' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});
