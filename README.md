# SamCars Backend API

SamCars is a comprehensive car dealership management system built with Node.js and Express. This backend API provides functionality for:
- Vehicle inventory management
- Sales transaction processing
- Payment handling
- Customer relationship management
- Dealer operations management

## Key Features
- 🚗 Inventory Management
  - Track vehicle details, specifications, and availability
  - Manage vehicle photos and documentation
  - Monitor inventory levels and valuation

- 💰 Sales & Payments
  - Process vehicle sales transactions
  - Handle multiple payment methods
  - Generate invoices and receipts
  - Track sales history

- 👥 Customer Management
  - Store customer information
  - Track customer interactions and preferences
  - Manage test drive appointments
  - Handle customer inquiries

- 📊 Dealer Operations
  - Staff management
  - Sales performance tracking
  - Financial reporting
  - Service scheduling

## Project Structure

```
SamCars-BE/
├── index.js          # Main application file (Express setup & server)
├── routes/
│   └── userRoutes.js # User-related routes
├── controllers/      # Route controllers
├── .env              # Environment variables (not in repo)
└── package.json      # Project dependencies and scripts
```

### File Structure Explanation

The project uses a simple and straightforward structure with `index.js` as the main file that handles:
- Server setup and configuration
- Express application setup
- Middleware configuration
- Route definitions
- Error handling
- Server startup

This single-file approach keeps the codebase simple and easy to navigate while still maintaining a clean separation of routes and controllers in their respective directories.

## Prerequisites

- Node.js (Latest LTS version recommended)
- PostgreSQL
- npm (comes with Node.js)

## Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/vamsi-rebounz/SamCars-BE.git
   cd SamCars-BE
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the root directory with the following content:
   ```
   PORT=3000
   NODE_ENV=development
   
   # Database configuration
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=samcars
   DB_USER=postgres
   DB_PASSWORD=your_password
   ```

## Running the Application

Development mode (with auto-reload):
```bash
npm run dev
```

Production mode:
```bash
npm start
```

The server will start on port 3000 (or the port specified in your .env file).

## API Endpoints

### Health Check
- `GET /health` - Check server status
- `GET /` - Basic API information

### User Routes
- `POST /users/register` - Register a new user

## Dependencies

- express: ^5.1.0 - Web framework
- dotenv: ^16.5.0 - Environment variable management
- pg: ^8.16.0 - PostgreSQL client
- bcrypt: ^6.0.0 - Password hashing
- nodemon: ^3.0.3 (dev dependency) - Auto-reload during development

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request
