// routes/userRoutes.js
const express = require('express');
const UserController = require('../controllers/userController');

const router = express.Router();

// GET all users
router.get('/', (req, res) => {
    res.json({ message: 'Get all users endpoint' });
});

// POST create new user
router.post('/', (req, res) => {
    res.json({ message: 'Create new user endpoint', data: req.body });
});

// POST route for user registration
// Endpoint: /users/register
router.post('/register', UserController.registerUser);

module.exports = router;
