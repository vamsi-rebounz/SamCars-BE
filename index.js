require('dotenv').config();

// Importing dependencies
const express = require('express');
const formidable = require('express-formidable');
const cors = require('cors');

// Importing routes
const userRoutes = require('./routes/userRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const vehicleRoutes = require('./routes/vehicleRoutes');

// Initializing express app and port
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON request bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Mount user routes
app.use('/users', formidable(), userRoutes);
app.use('/inventory', inventoryRoutes);
app.use('/vehicles', vehicleRoutes);

// CORS middleware
app.use(cors({
  origin: [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175"
  ],
  credentials: true
}));

// Middleware to parse form-data
app.use(formidable());

// Health check route
app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'Server is running' });
});

// Basic route for testing server status
app.get('/', (req, res) => {
    res.json({ message: 'SamCars API is running!' });
});

// Default error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
