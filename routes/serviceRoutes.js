const express = require('express');
const ServiceController = require('../controllers/serviceController');
const { upload } = require('../utils/firebaseStorage');

const router = express.Router();

// POST /services/create-new - Create a new service with image upload
// 'image' is the field name for the image file in the form data
router.post('/create-new', upload.single('image'), ServiceController.createService);

module.exports = router; 