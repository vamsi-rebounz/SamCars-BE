// utils/firebaseDeleter.js
const admin = require('firebase-admin');
const { getStorage } = require('firebase-admin/storage');
const firebase_base_url = process.env.FIREBASE_STORAGE_BASE_URL;
/**
 * Deletes a file from Firebase Storage using its public URL.
 * @param {string} fileUrl - Full public URL of the file
 */
async function deleteFromFirebase(fileUrls) {
    try {
        const bucket = getStorage().bucket();
        const bucketName = bucket.name;
        const prefix = `${firebase_base_url}/${bucketName}/o/`;

        // Convert single URL to array for uniform processing
        const urls = Array.isArray(fileUrls) ? fileUrls : [fileUrls];

        const deletePromises = urls.map(async (fileUrl) => {
            try {
                if (!fileUrl.startsWith(prefix)) {
                    console.warn(`Skipping invalid URL (prefix mismatch): ${fileUrl}`);
                    return { success: false, url: fileUrl, error: "Invalid prefix" };
                }

                let filePathWithParams = fileUrl.substring(prefix.length);
                const questionMarkIndex = filePathWithParams.indexOf('?');
                const cleanPath = questionMarkIndex !== -1 
                    ? filePathWithParams.substring(0, questionMarkIndex) 
                    : filePathWithParams;

                const filePath = decodeURIComponent(cleanPath);
                await bucket.file(filePath).delete();
                console.log(`Deleted: ${filePath}`);
                return { success: true, url: fileUrl };
            } catch (err) {
                console.error(`Failed to delete ${fileUrl}`, err.message);
                return { success: false, url: fileUrl, error: err.message };
            }
        });

        const results = await Promise.all(deletePromises);
        const failedDeletes = results.filter(r => !r.success);

        if (failedDeletes.length > 0) {
            console.warn(`${failedDeletes.length} files failed to delete`);
            return { 
                success: false, 
                results, 
                error: `Failed to delete ${failedDeletes.length} file(s)` 
            };
        }

        return { success: true, results };
    } catch (err) {
        console.error("Critical error in batch delete:", err.message);
        return { 
            success: false, 
            error: err.message 
        };
    }
}

module.exports = { deleteFromFirebase };
