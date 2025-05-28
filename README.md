# SamCars Backend API

A robust backend API service for SamCars, built with Node.js, Express, and PostgreSQL.


## Prerequisites

Before you begin, ensure you have the following installed:
- Node.js (v14 or higher)
- PostgreSQL (v14 or higher)
- npm (Node Package Manager)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/vamsi-rebounz/SamCars-BE.git
cd SamCars-BE
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory with the following variables:
```env
DB_USER=postgres
DB_HOST=localhost
DB_DATABASE=samcars
DB_PASSWORD=your_db_passoword
DB_PORT=5432
PORT=3000
```

4. Start the server:
```bash
npm start
```

## Example API Endpoint

### User Management

#### Register User
- **POST** `/users/register`
- **Body:**
```json
{
    "first_name": "John",
    "last_name": "Doe",
    "email": "john@example.com",
    "password": "securepassword",
    "role": "customer"
}
```

## Project Structure

```
samcars-be/
├── app.js              # Application entry point
├── config/             # Configuration files
├── controllers/        # Request handlers
├── models/            # Database models
├── routes/            # API routes
└── migrations/        # Database migrations
```

## Dependencies

- express: ^5.1.0 - Web framework
- pg: ^8.16.0 - PostgreSQL client
- bcrypt: ^6.0.0 - Password hashing
- dotenv: ^16.5.0 - Environment variable management

## Development

To run the server in development mode:
```bash
node app.js
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request