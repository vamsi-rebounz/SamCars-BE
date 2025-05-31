// Import the functions you need from the SDKs you need
const { initializeApp } = require('firebase/app');
const { getStorage } = require('firebase/storage');

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyA98WeYnS0nLdM9mgkufrQoVtr-2NBm1bY",
    authDomain: "samcars-11f0f.firebaseapp.com",
    projectId: "samcars-11f0f",
    storageBucket: "samcars-11f0f.appspot.com",
    messagingSenderId: "74320712003",
    appId: "1:74320712003:web:4249dce1a1bcdd78afdff6",
    measurementId: "G-PYFZH8DET5"
};

// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);

// Initialize Cloud Storage and get a reference to the service
// This is what we'll use for file uploads
const storage = getStorage(firebaseApp);

// Export only what we need for file storage
module.exports = { storage, firebaseApp }; 