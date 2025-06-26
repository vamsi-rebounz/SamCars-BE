const crypto = require('crypto');
const bcrypt = require('bcrypt');
const transporter = require('../config/mail');
const userModel = require('../models/userModel');
const passwordResetModel = require('../models/passwordResetModel');
require('dotenv').config();

exports.requestPasswordReset = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await userModel.findByEmail(email);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

    await passwordResetModel.createToken(user.user_id, token, expiresAt);

    const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

    await transporter.sendMail({
      from: `"Saam Cars Support" <${process.env.EMAIL_USER}>` || '"Saam Cars Support" <no-reply@saamcars..com>',
      to: email,
      subject: 'Password Reset Request - Saam Cars',
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
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000/reset-password'}?token=${token}" 
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
