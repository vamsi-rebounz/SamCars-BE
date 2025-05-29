// routes/userRoutes.js
const express = require('express');
const UserController = require('../controllers/userController');

const router = express.Router();

// POST route for user registration/signup
// Endpoint: /users/register
router.post('/register', UserController.registerUser);

//GET route for fetch user by id
// Endpoint: /users/fetch-by-id
router.get('/fetch-by-id', UserController.fetchUserById);

module.exports = router;
