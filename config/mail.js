const nodemailer = require('nodemailer');
require('dotenv').config();
console.log('EMAIL_USER:', process.env.EMAIL_USER);
console.log('EMAIL_PASS:', process.env.EMAIL_PASS ? process.env.EMAIL_PASS : '(not set)');

const transporter = nodemailer.createTransport({
  host: 'smtp.hostinger.com',
  port: 465, // or 587 if you want to use TLS
  secure: true, // true for 465, false for 587
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  }
});

module.exports = transporter;
