require('dotenv').config();
const express = require('express');
const formidable = require('express-formidable');
const userRoutes = require('./routes/userRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse form-data
app.use(formidable());

// Mount user routes
app.use('/users', userRoutes);

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