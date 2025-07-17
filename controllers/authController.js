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
    if (password.length < minLength) errors.push(`Password must be at least ${minLength} characters long`);
    if (!hasUpperCase) errors.push('Password must contain at least one uppercase letter');
    if (!hasLowerCase) errors.push('Password must contain at least one lowercase letter');
    if (!hasNumbers) errors.push('Password must contain at least one number');
    if (!hasSpecialChar) errors.push('Password must contain at least one special character');

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
        const { email, password, firstName, lastName, phone } = req.body;

        // Validate email
        if (!email || !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid email format'
            });
        }

        // Check if user exists
        const existingUser = await userModel.findByEmail(email);
        if (existingUser) {
            return res.status(400).json({
                status: 'error',
                message: 'Email already registered'
            });
        }

        // Validate password
        const passwordErrors = validatePassword(password);
        if (passwordErrors.length > 0) {
            return res.status(400).json({
                status: 'error',
                message: 'Password validation failed',
                errors: passwordErrors
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 12);

        // Create user
        const user = await userModel.create({
            email,
            password: hashedPassword,
            first_name: firstName,
            last_name: lastName,
            phone,
            role: 'customer',
            is_active: true,
            token_version: 0
        });

        // Generate tokens
        const { accessToken, refreshToken } = generateTokens(user);

        res.status(201).json({
            status: 'success',
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
            message: 'Failed to register user'
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
                message: 'Invalid credentials'
            });
        }

        // Check if account is active
        if (!user.is_active) {
            return res.status(401).json({
                status: 'error',
                message: 'Account is deactivated'
            });
        }

        // Verify password
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({
                status: 'error',
                message: 'Invalid credentials'
            });
        }

        // Generate tokens
        const { accessToken, refreshToken } = generateTokens(user);

        res.json({
            status: 'success',
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
            message: 'Failed to login'
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
                message: 'Refresh token required'
            });
        }

        // Verify refresh token
        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
        
        // Get user
        const user = await userModel.findById(decoded.userId);
        if (!user || !user.is_active || user.token_version !== decoded.tokenVersion) {
            return res.status(401).json({
                status: 'error',
                message: 'Invalid refresh token'
            });
        }

        // Generate new tokens
        const tokens = generateTokens(user);

        res.json({
            status: 'success',
            data: tokens
        });
    } catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
            return res.status(401).json({
                status: 'error',
                message: 'Refresh token expired'
            });
        }
        console.error('Token refresh error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to refresh token'
        });
    }
};

// Logout (invalidate refresh token)
exports.logout = async (req, res) => {
    try {
        // Increment token version to invalidate all existing tokens
        await userModel.incrementTokenVersion(req.user.userId);
        
        res.json({
            status: 'success',
            message: 'Successfully logged out'
        });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to logout'
        });
    }
};

// Keep existing password reset functionality
exports.requestPasswordReset = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await userModel.findByEmail(email);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

    await passwordResetModel.createToken(user.user_id, token, expiresAt);

    const resetLink = `${process.env.FRONTEND_RESET_PASSWORD_URL}/reset-password?token=${token}`;

    await transporter.sendMail({
      from: `"Saam Cars Support" <${process.env.EMAIL_USER}>` || '"Saam Cars Support" <no-reply@saamcars..com>',
      to: email,
      subject: 'Password Reset Request - Saam Cars',
      headers: {
        'X-Priority': '1', // 1 = High Priority (used by Gmail)
        // 'X-MSMail-Priority': 'High', // For microsoft mail clients
        'Importance': 'high' // Gmail may flag these as important
      },
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #0078D4; padding: 20px; color: white;">
            <h1 style="margin: 0;">Saam Cars</h1>
          </div>
          <div style="padding: 20px;">
            <h2 style="color: #0078D4;">Password Reset</h2>
            <p>Hello User,</p>
            <p>We received a request to reset your password. Click the button below to proceed:</p>
            <div style="margin: 25px 0; text-align: center;">
              <a href="${process.env.FRONTEND_RESET_PASSWORD_URL || 'http://localhost:5173/reset-password'}?token=${token}" 
                 style="background-color: #0078D4; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">
                Reset Password
              </a>
            </div>
            <p style="color: #666; font-size: 0.9em;">
              <strong>Note:</strong> This link will expire in 15 min. If you didn't request this, please ignore this email.
            </p>
          </div>
          <div style="background-color: #f3f2f1; padding: 20px; text-align: center; font-size: 0.8em; color: #666;">
            <p>© ${new Date().getFullYear()} Saam Cars. All rights reserved.</p>
          </div>
        </div>
      `
    });

    res.json({ message: 'Reset email sent' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.resetPassword = async (req, res) => {
  const { token, newPassword } = req.body;

  try {
    const tokenData = await passwordResetModel.findByToken(token);
    if (!tokenData) return res.status(400).json({ message: 'Invalid or expired token' });

    if (new Date() > new Date(tokenData.expires_at)) {
      return res.status(400).json({ message: 'Token expired' });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await userModel.updatePassword(tokenData.user_id, hashed);
    await passwordResetModel.deleteToken(token);

    res.json({ message: 'Password reset successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};