const multer = require('multer');
const path = require('path');

// Configure multer for memory storage
const storage = multer.memoryStorage();

// Strict file validation configuration
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // Strict 5MB limit per file
        files: 10,                 // Maximum 10 files
        fields: 20                 // Maximum 20 non-file fields
    },
    fileFilter: (req, file, cb) => {
        try {
            // Get file extension
            const ext = path.extname(file.originalname).toLowerCase();
            const allowedExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
            
            // Check extension
            if (!allowedExts.includes(ext)) {
                console.error(`Rejected file [${file.originalname}]: Invalid extension`);
                return cb(new Error('Only JPG, JPEG, PNG, GIF, or WEBP files allowed'), false);
            }
            
            // Check MIME type
            const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
            if (!allowedMimes.includes(file.mimetype)) {
                console.error(`Rejected file [${file.originalname}]: Invalid MIME type [${file.mimetype}]`);
                return cb(new Error('Only image files are allowed'), false);
            }
            
            // Verify extension matches MIME type
            const extToMime = {
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.png': 'image/png',
                '.gif': 'image/gif',
                '.webp': 'image/webp'
            };
            
            if (extToMime[ext] !== file.mimetype) {
                console.error(`Rejected file [${file.originalname}]: MIME mismatch (${ext} expects ${extToMime[ext]} but got ${file.mimetype})`);
                return cb(new Error('File extension does not match content type'), false);
            }
            
            // Additional check for actual file size (double verification)
            if (file.size > 5 * 1024 * 1024) {
                console.error(`Rejected file [${file.originalname}]: Size ${(file.size / (1024 * 1024)).toFixed(2)}MB exceeds 5MB limit`);
                return cb(new Error('Each file must be less than 5MB'), false);
            }
            
            console.log(`Accepted file [${file.originalname}]`);
            cb(null, true);
        } catch (err) {
            console.error('File validation error:', err);
            cb(err);
        }
    }
});

// Enhanced error handling middleware
const handleMulterError = (err, req, res, next) => {
    if (err) {
        console.error('Upload error:', err);
        
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(413).json({
                success: false,
                error: 'FILE_TOO_LARGE',
                message: 'Each file must be less than 5MB',
                maxSize: '5MB'
            });
        }
        
        if (err.code === 'LIMIT_FILE_COUNT') {
            return res.status(413).json({
                success: false,
                error: 'TOO_MANY_FILES',
                message: 'Maximum 10 files allowed per upload',
                maxFiles: 10
            });
        }
        
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
            return res.status(400).json({
                success: false,
                error: 'INVALID_FIELD_NAME',
                message: 'Unexpected file field in upload'
            });
        }
        
        // Handle our custom validation errors
        return res.status(400).json({
            success: false,
            error: 'INVALID_FILE',
            message: err.message || 'File upload failed'
        });
    }
    next();
};

module.exports = {
    upload,
    handleMulterError,
};