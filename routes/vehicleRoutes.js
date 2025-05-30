// routes/vehicleRoutes.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const VehicleController = require('../controllers/vehicleController');

const router = express.Router();

// Set up multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) =>
    cb(null, Date.now() + path.extname(file.originalname))
});

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg' || ext === '.png') {
    cb(null, true);
  } else {
    cb(new Error('Only JPG and PNG images are allowed'), false);
  }
};

const upload = multer({ storage, fileFilter });

// POST route to add a vehicle with optional image upload
router.post('/add-vehicle', upload.single('image'), VehicleController.addVehicle);

module.exports = router;
