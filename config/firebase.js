// Import the functions you need from the SDKs you need
const { initializeApp } = require('firebase/app');
const { getStorage } = require('firebase/storage');

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyA98WeYnS0nLdM9mgkufrQoVtr-2NBm1bY",
    authDomain: "samcars-11f0f.firebaseapp.com",
    projectId: "samcars-11f0f",
    storageBucket: "samcars-11f0f.firebasestorage.app",
    messagingSenderId: "74320712003",
    appId: "1:74320712003:web:7afa06b72a59dcfdafdff6",
    measurementId: "G-L8HE50JVL4"
  };

// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);

// Initialize Cloud Storage and get a reference to the service
// This is what we'll use for file uploads
const storage = getStorage(firebaseApp);

// Export only what we need for file storage
module.exports = { storage, firebaseApp }; 