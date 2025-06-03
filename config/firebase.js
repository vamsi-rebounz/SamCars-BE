const { initializeApp } = require('firebase/app');
const { getStorage } = require('firebase/storage');
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

// Firebase config for client SDK
const firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID,
    measurementId: process.env.FIREBASE_MEASUREMENT_ID,
};

// Initialize Firebase Client SDK (for uploading if needed)
const clientApp = initializeApp(firebaseConfig);
const storage = getStorage(clientApp);

// Initialize Firebase Admin SDK (only once)
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    });
}

const storage_admin = admin.storage().bucket();

module.exports = {
    storage,         // Firebase client storage (optional)
    storage_admin    // Admin storage (use this for deletes)
};
