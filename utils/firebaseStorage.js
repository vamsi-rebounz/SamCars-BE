const { storage } = require('../config/firebase');
const { ref, uploadBytes, getDownloadURL } = require('firebase/storage');
const multer = require('multer');

// Configure multer for memory storage
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        // Accept images only
        if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/)) {
            return cb(new Error('Only image files are allowed!'), false);
        }
        cb(null, true);
    }
});

/**
 * Uploads a base64 image to Firebase Storage
 * @param {string} base64String - The base64 string of the image
 * @param {string} fileName - Name of the file
 * @param {string} folder - Folder path in Firebase Storage
 * @returns {Promise<string>} Download URL of the uploaded file
 */
async function uploadBase64ToFirebase(base64String, fileName, folder = 'services') {
    try {
        // Remove data:image/...;base64, prefix if present
        const base64WithoutPrefix = base64String.replace(/^data:image\/\w+;base64,/, '');
        
        // Convert base64 to buffer
        const fileBuffer = Buffer.from(base64WithoutPrefix, 'base64');
        
        // Create unique filename to avoid collisions
        const timestamp = Date.now();
        const uniqueFilename = `${timestamp}-${fileName}`;
        const fullPath = `${folder}/${uniqueFilename}`;
        
        // Create storage reference
        const storageRef = ref(storage, fullPath);
        
        // Create file metadata
        const metadata = {
            contentType: 'image/jpeg', // You might want to make this dynamic based on the image type
        };
        
        // Upload file and metadata
        const snapshot = await uploadBytes(storageRef, fileBuffer, metadata);
        console.log('Uploaded a file to Firebase Storage!', snapshot.metadata);
        
        // Get download URL
        const downloadURL = await getDownloadURL(snapshot.ref);
        console.log('File available at', downloadURL);
        
        return downloadURL;
    } catch (error) {
        console.error('Error uploading to Firebase:', error);
        throw new Error('Failed to upload file to Firebase Storage');
    }
}

/**
 * Uploads a file to Firebase Storage
 * @param {Buffer} fileBuffer - The file buffer to upload
 * @param {string} originalName - Original name of the file
 * @param {string} folder - Folder path in Firebase Storage
 * @returns {Promise<string>} Download URL of the uploaded file
 */
async function uploadToFirebase(fileBuffer, originalName, folder = 'services') {
    try {
        console.log('Starting file upload to Firebase Storage...');
        console.log('Original filename:', originalName);
        console.log('Target folder:', folder);

        // Create unique filename to avoid collisions
        const timestamp = Date.now();
        const uniqueFilename = `${timestamp}-${originalName.replace(/[^a-zA-Z0-9.]/g, '_')}`;
        const fullPath = `${folder}/${uniqueFilename}`;
        
        console.log('Generated path:', fullPath);

        // Create storage reference
        const storageRef = ref(storage, fullPath);
        
        // Determine content type based on file extension
        const extension = originalName.split('.').pop().toLowerCase();
        const contentType = {
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'gif': 'image/gif'
        }[extension] || 'image/jpeg';

        // Create file metadata
        const metadata = {
            contentType,
            customMetadata: {
                originalName: originalName
            }
        };
        
        console.log('Uploading with content type:', contentType);

        // Upload file and metadata
        const snapshot = await uploadBytes(storageRef, fileBuffer, metadata);
        console.log('File uploaded successfully:', snapshot.metadata);
        
        // Get download URL
        const downloadURL = await getDownloadURL(snapshot.ref);
        console.log('Download URL generated:', downloadURL);
        
        return downloadURL;
    } catch (error) {
        console.error('Detailed upload error:', {
            code: error.code,
            message: error.message,
            serverResponse: error.customData?.serverResponse,
            status: error.status_
        });
        
        let errorMessage = 'Failed to upload file to Firebase Storage';
        if (error.code === 'storage/unauthorized') {
            errorMessage = 'Firebase Storage: Unauthorized access. Please check your Firebase configuration.';
        } else if (error.code === 'storage/unknown') {
            errorMessage = 'Firebase Storage: Connection error. Please check your internet connection and Firebase configuration.';
        }
        
        throw new Error(errorMessage);
    }
}

module.exports = {
    upload,
    uploadToFirebase,
    uploadBase64ToFirebase
}; 