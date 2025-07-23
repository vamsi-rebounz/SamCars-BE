const { ref, uploadBytes, getDownloadURL } = require('firebase/storage');
const { storage } = require('../config/firebase');

/**
 * Uploads a file to Firebase Storage and returns the download URL
 * @param {Buffer} fileBuffer - The file buffer to upload
 * @param {string} fileName - The name of the file
 * @param {string} mimeType - The MIME type of the file
 * @returns {Promise<string>} The download URL of the uploaded file
 */
async function uploadToFirebase(fileBuffer, fileName, mimeType) {
    try {
        // Create a unique file name to avoid collisions
        const uniqueFileName = `${Date.now()}-${fileName}`;
        const storageRef = ref(storage, `vehicle-images/${uniqueFileName}`);

        // Create file metadata including the content type
        const metadata = {
            contentType: mimeType,
        };

        // Upload the file and metadata
        const snapshot = await uploadBytes(storageRef, fileBuffer, metadata);
        
        // Get the download URL
        const downloadURL = await getDownloadURL(snapshot.ref);
        
        return downloadURL;
    } catch (error) {
        console.error('Error uploading to Firebase:', error);
        throw new Error('Failed to upload image to Firebase');
    }
}

module.exports = { uploadToFirebase }; 