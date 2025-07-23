const jwt = require('jsonwebtoken');
const userModel = require('../models/userModel');
require('dotenv').config();

async function authenticateToken(req, res, next) {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

        if (!token) {
            return res.status(401).json({ 
                status: 'error',
                message: 'Authentication required.' 
            });
        }

        // Verify the token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Check if user still exists and is active
        const user = await userModel.findById(decoded.userId);
        if (!user) {
            return res.status(401).json({ 
                status: 'error',
                message: 'User no longer exists.' 
            });
        }

        if (!user.is_active) {
            return res.status(401).json({ 
                status: 'error',
                message: 'Account is deactivated.' 
            });
        }

        // Check token version (for forced logout)
        if (user.token_version !== decoded.tokenVersion) {
            return res.status(401).json({ 
                status: 'error',
                message: 'Token is invalid. Please login again.' 
            });
        }

        // Attach user to request
        req.user = {
            userId: user.user_id,
            email: user.email,
            role: user.role,
            tokenVersion: user.token_version
        };
        
        next();
    } catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
            return res.status(401).json({ 
                status: 'error',
                message: 'Token has expired.',
                code: 'TOKEN_EXPIRED'
            });
        }
        if (error instanceof jwt.JsonWebTokenError) {
            return res.status(401).json({ 
                status: 'error',
                message: 'Invalid token.',
                code: 'INVALID_TOKEN'
            });
        }
        return res.status(500).json({ 
            status: 'error',
            message: 'Internal server error.' 
        });
    }
}

function isAdmin(req, res, next) {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ 
            status: 'error',
            message: 'Admin access required.' 
        });
    }
    next();
}

// Middleware to check if user is either admin or the resource owner
function isAdminOrSelf(userIdField) {
    return (req, res, next) => {
        const resourceUserId = req.params[userIdField] || req.body[userIdField];
        
        if (!req.user) {
            return res.status(401).json({ 
                status: 'error',
                message: 'Authentication required.' 
            });
        }

        if (req.user.role === 'admin' || req.user.userId === resourceUserId) {
            next();
        } else {
            return res.status(403).json({ 
                status: 'error',
                message: 'Access denied.' 
            });
        }
    };
}

module.exports = { authenticateToken, isAdmin, isAdminOrSelf };