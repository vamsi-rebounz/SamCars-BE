const express = require('express');
const router = express.Router();
const AuctionController = require('../controllers/auctionController');
const formidable = require('express-formidable');

// Apply formidable only to this route
router.post('/vehicles/add-new', formidable(), AuctionController.addAuctionVehicle);

module.exports = router;
