const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const transporter = require('../config/mail');
const userModel = require('../models/userModel');
const passwordResetModel = require('../models/passwordResetModel');
require('dotenv').config();

// Password validation
const validatePassword = (password) => {
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    const errors = [];
    if (password.length < minLength) errors.push(`Your password must be at least ${minLength} characters long`);
    if (!hasUpperCase) errors.push('Your password must include at least one uppercase letter');
    if (!hasLowerCase) errors.push('Your password must include at least one lowercase letter');
    if (!hasNumbers) errors.push('Your password must include at least one number');
    if (!hasSpecialChar) errors.push('Your password must include at least one special character');

    return errors;
};

// Generate tokens
const generateTokens = (user) => {
    const accessToken = jwt.sign(
        { 
            userId: user.user_id,
            email: user.email,
            role: user.role,
            tokenVersion: user.token_version
        },
        process.env.JWT_SECRET,
        { expiresIn: '15m' }
    );

    const refreshToken = jwt.sign(
        { 
            userId: user.user_id,
            tokenVersion: user.token_version
        },
        process.env.JWT_REFRESH_SECRET,
        { expiresIn: '7d' }
    );

    return { accessToken, refreshToken };
};

// Registration
exports.register = async (req, res) => {
    try {
        console.log('Registration request body:', req.body);
        const { email, password, firstName, lastName, phone, role } = req.body;

        // Validate email
        if (!email || !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
            return res.status(400).json({
                status: 'error',
                message: 'Please enter a valid email address'
            });
        }

        // Check if user exists
        const existingUser = await userModel.findByEmail(email);
        if (existingUser) {
            return res.status(400).json({
                status: 'error',
                message: 'This email address is already registered. Please use a different email or try logging in.'
            });
        }

        // Validate password
        const passwordErrors = validatePassword(password);
        if (passwordErrors.length > 0) {
            return res.status(400).json({
                status: 'error',
                message: 'Please ensure your password meets our security requirements:',
                errors: passwordErrors
            });
        }

        // Validate role
        const validRoles = ['customer', 'admin', 'sales', 'technician', 'manager'];
        if (role && !validRoles.includes(role)) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid user role specified. Please contact support if this issue persists.'
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 12);

        // Create user
        const userData = {
            email,
            password: hashedPassword,
            first_name: firstName,
            last_name: lastName,
            phone,
            role: role || 'customer',
            is_active: true,
            token_version: 0
        };
        console.log('Creating user with data:', userData);
        const user = await userModel.create(userData);

        // Generate tokens
        const { accessToken, refreshToken } = generateTokens(user);

        res.status(201).json({
            status: 'success',
            message: 'Your account has been created successfully. Welcome to SaamCars!',
            data: {
                user: {
                    userId: user.user_id,
                    email: user.email,
                    firstName: user.first_name,
                    lastName: user.last_name,
                    role: user.role
                },
                accessToken,
                refreshToken
            }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({
            status: 'error',
            message: 'We encountered an issue while creating your account. Please try again later.',
            details: error.message
        });
    }
};

// Login
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Find user
        const user = await userModel.findByEmail(email);
        if (!user) {
            return res.status(401).json({
                status: 'error',
                message: 'The email or password you entered is incorrect. Please try again.'
            });
        }

        // Check if account is active
        if (!user.is_active) {
            return res.status(401).json({
                status: 'error',
                message: 'Your account is currently deactivated. Please contact support for assistance.'
            });
        }

        // Verify password
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({
                status: 'error',
                message: 'The email or password you entered is incorrect. Please try again.'
            });
        }

        // Generate tokens
        const { accessToken, refreshToken } = generateTokens(user);

        res.json({
            status: 'success',
            message: 'Welcome back to SaamCars!',
            data: {
                user: {
                    userId: user.user_id,
                    email: user.email,
                    firstName: user.first_name,
                    lastName: user.last_name,
                    role: user.role
                },
                accessToken,
                refreshToken
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            status: 'error',
            message: 'We encountered an issue while signing you in. Please try again later.'
        });
    }
};

// Refresh Token
exports.refreshToken = async (req, res) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) {
            return res.status(400).json({
                status: 'error',
                message: 'Your session has expired. Please sign in again.'
            });
        }

        // Verify refresh token
        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
        
        // Get user
        const user = await userModel.findById(decoded.userId);
        if (!user || !user.is_active || user.token_version !== decoded.tokenVersion) {
            return res.status(401).json({
                status: 'error',
                message: 'Your session has expired. Please sign in again to continue.'
            });
        }

        // Generate new tokens
        const tokens = generateTokens(user);

        res.json({
            status: 'success',
            message: 'Session refreshed successfully.',
            data: tokens
        });
    } catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
            return res.status(401).json({
                status: 'error',
                message: 'Your session has expired. Please sign in again to continue.'
            });
        }
        console.error('Token refresh error:', error);
        res.status(500).json({
            status: 'error',
            message: 'We encountered an issue refreshing your session. Please sign in again.'
        });
    }
};

// Logout
exports.logout = async (req, res) => {
    try {
        // Increment token version to invalidate all existing tokens
        await userModel.incrementTokenVersion(req.user.userId);
        
        res.json({
            status: 'success',
            message: 'You have been successfully signed out. Thank you for using SaamCars!'
        });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({
            status: 'error',
            message: 'We encountered an issue while signing you out. Please try again.'
        });
    }
};

// Request Password Reset
exports.requestPasswordReset = async (req, res) => {
    const { email } = req.body;

    try {
        // Find user
        const user = await userModel.findByEmail(email);
        
        // For security, don't reveal if email exists
        if (!user) {
            return res.json({
                status: 'success',
                message: 'If an account exists with this email, you will receive password reset instructions shortly.'
            });
        }

        // Generate reset token
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 1); // Token expires in 1 hour

        // Save reset token
        await passwordResetModel.createToken(user.user_id, token, expiresAt);

        // Send reset email
        const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
        await transporter.sendMail({
            to: email,
            subject: 'Reset Your SaamCars Password',
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Reset Your SaamCars Password</title>
                    <style>
                        body {
                            font-family: Arial, sans-serif;
                            line-height: 1.6;
                            color: #333333;
                            margin: 0;
                            padding: 0;
                        }
                        .container {
                            max-width: 600px;
                            margin: 0 auto;
                            padding: 20px;
                        }
                        .header {
                            background-color: #1a56db;
                            color: white;
                            padding: 20px;
                            text-align: center;
                        }
                        .content {
                            background-color: #ffffff;
                            padding: 30px;
                            border-radius: 5px;
                            box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
                        }
                        .button {
                            display: inline-block;
                            background-color: #1a56db;
                            color: white;
                            padding: 12px 24px;
                            text-decoration: none;
                            border-radius: 5px;
                            margin: 20px 0;
                        }
                        .footer {
                            text-align: center;
                            margin-top: 20px;
                            padding: 20px;
                            font-size: 12px;
                            color: #666666;
                        }
                        .divider {
                            border-top: 1px solid #e5e7eb;
                            margin: 20px 0;
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>SaamCars Password Reset</h1>
                        </div>
                        <div class="content">
                            <h2>Hello ${user.first_name},</h2>
                            <p>We received a request to reset the password for your SaamCars account. Your security is important to us, and we're here to help you regain access to your account.</p>
                            
                            <p><strong>Please click the button below to reset your password:</strong></p>
                            <p style="text-align: center;">
                                <a href="${resetLink}" class="button" style="display: inline-block; background-color: #1a56db; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 20px 0; font-family: Arial, sans-serif; font-size: 16px; font-weight: bold; text-align: center;">Reset My Password</a>
                            </p>
                            
                            <div class="divider"></div>
                            
                            <p><strong>Important Security Notes:</strong></p>
                            <ul>
                                <li>This link will expire in 1 hour for your security</li>
                                <li>If you didn't request this password reset, please ignore this email</li>
                                <li>For additional security, consider changing your password regularly</li>
                            </ul>
                            
                            <p>If you're having trouble clicking the button, you can copy and paste this link into your browser:</p>
                            <p style="word-break: break-all; font-size: 12px; color: #666666;">${resetLink}</p>
                        </div>
                        <div class="footer">
                            <p>This is an automated message, please do not reply to this email.</p>
                            <p>&copy; ${new Date().getFullYear()} SaamCars. All rights reserved.</p>
                            <p>Premium Cars, Exceptional Service</p>
                        </div>
                    </div>
                </body>
                </html>
            `
        });

        res.json({
            status: 'success',
            message: 'If an account exists with this email, you will receive password reset instructions shortly.'
        });
    } catch (error) {
        console.error('Password reset request error:', error);
        res.status(500).json({
            status: 'error',
            message: 'We encountered an issue processing your request. Please try again later.'
        });
    }
};

// Reset Password
exports.resetPassword = async (req, res) => {
    const { token, newPassword } = req.body;

    try {
        // Validate password
        const passwordErrors = validatePassword(newPassword);
        if (passwordErrors.length > 0) {
            return res.status(400).json({
                status: 'error',
                message: 'Please ensure your new password meets our security requirements:',
                errors: passwordErrors
            });
        }

        // Find valid reset token
        const resetToken = await passwordResetModel.findByToken(token);
        if (!resetToken || new Date() > new Date(resetToken.expires_at)) {
            return res.status(400).json({
                status: 'error',
                message: 'This password reset link has expired or is invalid. Please request a new one.'
            });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 12);

        // Update password
        await userModel.updatePassword(resetToken.user_id, hashedPassword);

        // Invalidate token
        await passwordResetModel.deleteToken(token);

        res.json({
            status: 'success',
            message: 'Your password has been successfully reset. You can now sign in with your new password.'
        });
    } catch (error) {
        console.error('Password reset error:', error);
        res.status(500).json({
            status: 'error',
            message: 'We encountered an issue resetting your password. Please try again later.'
        });
    }
};