const { ref, uploadBytes, getDownloadURL } = require('firebase/storage');
const { storage } = require('../config/firebase');

/**
 * Uploads multiple files to Firebase Storage and returns an array of download URLs
 * @param {Array<Express.Multer.File>} files - Array of files to upload
 * @returns {Promise<string[]>} Array of download URLs
 */
async function uploadToFirebase(files) {
    try {
        console.log('Starting file upload to Firebase:', files.length, 'files');
        
        // Process each file
        const uploadPromises = files.map(async (file) => {
            try {
                // Create a unique file name to avoid collisions
                const uniqueFileName = `${Date.now()}-${file.originalname}`;
                const storageRef = ref(storage, `vehicle-images/${uniqueFileName}`);

                // Create file metadata including the content type
                const metadata = {
                    contentType: file.mimetype,
                };

                // Upload the file and metadata
                const snapshot = await uploadBytes(storageRef, file.buffer, metadata);
                
                // Get the download URL
                const downloadURL = await getDownloadURL(snapshot.ref);
                console.log('Successfully uploaded file:', uniqueFileName);
                
                return downloadURL;
            } catch (error) {
                console.error('Error uploading individual file:', error);
                throw new Error(`Failed to upload file ${file.originalname}: ${error.message}`);
            }
        });

        // Wait for all uploads to complete
        const urls = await Promise.all(uploadPromises);
        console.log('All files uploaded successfully');
        return urls;
    } catch (error) {
        console.error('Error in uploadToFirebase:', error);
        throw new Error('Failed to upload images to Firebase: ' + error.message);
    }
}

module.exports = { uploadToFirebase }; 