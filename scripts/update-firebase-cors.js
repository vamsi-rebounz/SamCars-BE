require('dotenv').config();
const { storage_admin } = require('../config/firebase');

async function updateCors() {
  try {
    await storage_admin.setCorsConfiguration([
      {
        origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175'],
        method: ['GET', 'HEAD', 'DELETE'],
        maxAgeSeconds: 3600,
        responseHeader: ['Content-Type']
      }
    ]);
    console.log('CORS configuration updated successfully');
  } catch (error) {
    console.error('Error updating CORS configuration:', error);
  }
}

updateCors(); 