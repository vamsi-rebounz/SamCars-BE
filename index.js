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

const isProduction = process.env.NODE_ENV === 'production';

let allowedOrigins = [];
if (isProduction) {
  allowedOrigins = [
    "https://www.saamcars.com",
    "https://saam-cars-7k2w7fhhq-saam-cars-llc.vercel.app", // add your vercel frontend URL here
  ];
} else {
  allowedOrigins = [
    "http://localhost:5173",
  ];
}

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like curl or Postman)
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('CORS policy: This origin is not allowed'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Content-Range', 'X-Total-Count'],
};

app.use(cors(corsOptions));

// Special route for Stripe webhook that needs raw body
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));

// Global middleware for parsing JSON and URL-encoded bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/inventory', inventoryRoutes);
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

  res.status(500).json({
    status: 'error',
    message: 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { error: err.message })
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
