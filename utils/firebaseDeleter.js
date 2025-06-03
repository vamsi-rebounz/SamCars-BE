// utils/firebaseDeleter.js
const admin = require('firebase-admin');
const { getStorage } = require('firebase-admin/storage');
const firebase_base_url = process.env.FIREBASE_STORAGE_BASE_URL;
/**
 * Deletes a file from Firebase Storage using its public URL.
 * @param {string} fileUrl - Full public URL of the file
 */
async function deleteFromFirebase(fileUrl) {
    try {
        const bucket = getStorage().bucket();
        const bucketName = bucket.name;

        // URL prefix we expect
        const prefix = `${firebase_base_url}/${bucketName}/o/`;

        if (!fileUrl.startsWith(prefix)) {
            throw new Error(`File URL does not start with expected prefix: ${prefix}`);
        }

        // Remove prefix and query params from URL to get the encoded file path
        let filePathWithParams = fileUrl.substring(prefix.length);

        // Remove URL query params after '?'
        const questionMarkIndex = filePathWithParams.indexOf('?');
        if (questionMarkIndex !== -1) {
            filePathWithParams = filePathWithParams.substring(0, questionMarkIndex);
        }

        // URL decode the file path (to get actual path with slashes etc.)
        const filePath = decodeURIComponent(filePathWithParams);

        await bucket.file(filePath).delete();
        console.log(`Deleted from Firebase: ${filePath}`);
    } catch (err) {
        console.error(`Failed to delete from Firebase: ${fileUrl}`, err.message);
    }
}

module.exports = { deleteFromFirebase };
