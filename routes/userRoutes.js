// routes/userRoutes.js
const express = require('express');
const UserController = require('../controllers/userController');

const router = express.Router();

// POST route for user registration
// Endpoint: /users/register
router.post('/register', UserController.registerUser);

module.exports = router;
