const jwt = require('jsonwebtoken');
require('dotenv').config();

function authenticateToken(req, res, next) {
    console.log('Auth Middleware: Checking token');
    const authHeader = req.headers['authorization'];
    console.log('Auth Header:', authHeader);
    
    const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

    if (!token) {
        console.log('Auth Middleware: No token provided');
        return res.status(401).json({ message: 'Token required.' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            console.error('Auth Middleware: Token verification failed:', err.message);
            return res.status(403).json({ message: 'Invalid or expired token.' });
        }
        console.log('Auth Middleware: Token verified successfully. User:', {
            id: user.id,
            email: user.email,
            role: user.role
        });
        req.user = user;
        next();
    });
}

function authorizeRoles(...roles) {
    return (req, res, next) => {
        console.log('Role Authorization:', {
            required: roles,
            userRole: req.user.role
        });
        if (!roles.includes(req.user.role)) {
            console.log('Role Authorization: Access denied');
            return res.status(403).json({ message: 'Access denied.' });
        }
        console.log('Role Authorization: Access granted');
        next();
    };
}

function isAdmin(req, res, next) {
    console.log('Admin Check:', {
        userRole: req.user.role,
        isAdmin: req.user.role === 'admin'
    });
    if (req.user.role !== 'admin') {
        console.log('Admin Check: Access denied');
        return res.status(403).json({ message: 'Access denied.' });
    }
    console.log('Admin Check: Access granted');
    next();
}

module.exports = { authenticateToken, authorizeRoles, isAdmin };