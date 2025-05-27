// app.js
const express = require('express');
const userRoutes = require('./routes/userRoutes');
require('dotenv').config(); // Load environment variables

const app = express();
const PORT = process.env.PORT || 3000; // Use port from .env or default to 3000

// Middleware to parse JSON request bodies
app.use(express.json());

// Mount user routes
app.use('/users', userRoutes);

// Basic route for testing server status
app.get('/', (req, res) => {
    res.status(200).json({ message: 'SamCars API is running!' });
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
