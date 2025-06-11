require('dotenv').config();
const express = require('express');
const formidable = require('express-formidable');
const cors = require('cors');
 
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
 
// Apply formidable only where needed (remove global use)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
 
// Mount routes
app.use('/users', formidable(), userRoutes);
app.use('/inventory', inventoryRoutes);
app.use('/vehicles', vehicleRoutes);
 
// Health checks
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});
 
app.get('/', (req, res) => {
  res.json({ message: 'SamCars API is running!' });
});
 
// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});
 
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
 