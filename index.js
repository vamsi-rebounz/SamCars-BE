require('dotenv').config();
const express = require('express');
const cors = require('cors');
 
// Import routes
const userRoutes = require('./routes/userRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const vehicleRoutes = require('./routes/vehicleRoutes');
const auctionRoutes = require('./routes/auctionRoutes');
const authRoutes = require('./routes/authRoutes');
const vehicleSalesRoutes = require('./routes/vehicleSalesRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const businessSettingsRoutes = require('./routes/businessSettingsRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');

const app = express();
const PORT = process.env.PORT || 3000;
 
// CORS should come before routes
app.use(cors({
  origin: [
    "https://www.saamcars.com",
  ],
  credentials: true
}));

// Special route for Stripe webhook that needs raw body
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));
 
// Global middleware for parsing JSON and URL-encoded bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
 
// Mount routes
app.use('/api/auth', authRoutes); // Mount auth routes first
app.use('/api/users', userRoutes);
app.use('/api/inventory', inventoryRoutes); // Use multer middleware in routes
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/auction-tracker', auctionRoutes);
app.use('/api/sales', vehicleSalesRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/business-settings', businessSettingsRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Health checks
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});
 
app.get('/', (req, res) => {
  res.json({ message: 'SamCars API is running!' });
});
 
// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  // Handle specific error types
  if (err.name === 'ValidationError') {
    return res.status(400).json({ 
      status: 'error',
      message: err.message 
    });
  }
  
  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({ 
      status: 'error',
      message: 'Invalid token or not authenticated' 
    });
  }
  
  // Default error
  res.status(500).json({ 
    status: 'error',
    message: 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { error: err.message })
  });
});
 
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
 