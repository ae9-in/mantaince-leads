import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { query } from '../config/db.js';
import { signAccessToken, signRefreshToken, hashToken, verifyRefreshToken } from '../utils/token.js';
import { logAudit } from '../services/audit.js';
import nodemailer from 'nodemailer';
import { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM, CLIENT_URL, NODE_ENV } from '../config/env.js';

// Mail transporter config
const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined
});

/**
 * Helper to set HttpOnly refresh token cookie
 */
const setRefreshCookie = (res, token) => {
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure: NODE_ENV === 'production',
    sameSite: NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });
};

/**
 * Clear refresh cookie
 */
const clearRefreshCookie = (res) => {
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: NODE_ENV === 'production',
    sameSite: NODE_ENV === 'production' ? 'none' : 'lax'
  });
};

/**
 * POST /login
 */
export const login = async (req, res) => {
  const { email, password } = req.body;
  try {
    const userRes = await query(`
      SELECT u.*, r.name as role_name, r.permissions 
      FROM users u 
      JOIN roles r ON u.role_id = r.id 
      WHERE u.email = $1
    `, [email.toLowerCase()]);

    const user = userRes.rows[0];

    if (!user || !user.is_active) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    // Update last_login_at
    const lastLoginAt = new Date();
    await query('UPDATE users SET last_login_at = $1 WHERE id = $2', [lastLoginAt, user.id]);

    // Sign tokens
    const accessToken = signAccessToken(user, user.role_name, user.permissions);
    const refreshToken = signRefreshToken(user.id);

    // Save session refresh hash
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await query(`
      INSERT INTO sessions (id, user_id, token_hash, expires_at, ip, user_agent)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      crypto.randomUUID(),
      user.id,
      hashToken(refreshToken),
      expiresAt,
      req.ip || '',
      req.headers['user-agent'] || ''
    ]);

    setRefreshCookie(res, refreshToken);

    await logAudit(req, {
      action: 'user.login',
      targetCollection: 'users',
      targetId: user.id,
      after: { last_login_at: lastLoginAt }
    });

    return res.status(200).json({
      success: true,
      data: {
        accessToken,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role_name,
          verticalAccess: user.vertical_access
        }
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * POST /refresh
 * Implements token rotation
 */
export const refresh = async (req, res) => {
  const token = req.cookies.refreshToken;
  if (!token) {
    return res.status(401).json({ success: false, error: 'Refresh token missing' });
  }

  try {
    const decoded = verifyRefreshToken(token);
    const tokenHash = hashToken(token);

    // Find and delete the session matching the hash (one-time use)
    const sessionRes = await query('DELETE FROM sessions WHERE token_hash = $1 RETURNING *', [tokenHash]);
    const session = sessionRes.rows[0];

    if (!session) {
      clearRefreshCookie(res);
      return res.status(401).json({ success: false, error: 'Session invalid or already rotated' });
    }

    if (new Date(session.expires_at) < new Date()) {
      clearRefreshCookie(res);
      return res.status(401).json({ success: false, error: 'Session expired' });
    }

    const userRes = await query(`
      SELECT u.*, r.name as role_name, r.permissions 
      FROM users u 
      JOIN roles r ON u.role_id = r.id 
      WHERE u.id = $1
    `, [decoded.sub]);
    const user = userRes.rows[0];

    if (!user || !user.is_active) {
      return res.status(401).json({ success: false, error: 'User account disabled' });
    }

    // Rotate tokens
    const accessToken = signAccessToken(user, user.role_name, user.permissions);
    const newRefreshToken = signRefreshToken(user.id);

    // Create a new session entry
    await query(`
      INSERT INTO sessions (id, user_id, token_hash, expires_at, ip, user_agent)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      crypto.randomUUID(),
      user.id,
      hashToken(newRefreshToken),
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      req.ip || '',
      req.headers['user-agent'] || ''
    ]);

    setRefreshCookie(res, newRefreshToken);

    return res.status(200).json({
      success: true,
      data: {
        accessToken,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role_name,
          verticalAccess: user.vertical_access
        }
      }
    });
  } catch (error) {
    clearRefreshCookie(res);
    return res.status(401).json({ success: false, error: 'Refresh signature invalid' });
  }
};

/**
 * POST /logout
 */
export const logout = async (req, res) => {
  const token = req.cookies.refreshToken;
  try {
    if (token) {
      const tokenHash = hashToken(token);
      await query('DELETE FROM sessions WHERE token_hash = $1', [tokenHash]);
    }
    clearRefreshCookie(res);
    return res.status(200).json({ success: true, data: { message: 'Logged out successfully' } });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * GET /me
 */
export const me = async (req, res) => {
  try {
    const userRes = await query(`
      SELECT u.*, r.name as role_name, r.permissions 
      FROM users u 
      JOIN roles r ON u.role_id = r.id 
      WHERE u.id = $1
    `, [req.user.sub]);
    const user = userRes.rows[0];

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    return res.status(200).json({
      success: true,
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role_name,
        permissions: user.permissions,
        verticalAccess: user.vertical_access
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * POST /forgot-password
 */
export const forgotPassword = async (req, res) => {
  const { email } = req.body;
  try {
    const userRes = await query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
    const user = userRes.rows[0];

    if (!user) {
      // Don't leak exists/does-not-exist info in production
      return res.status(200).json({ success: true, data: { message: 'Reset email queued' } });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour

    await query('UPDATE users SET invite_token = $1, invite_token_expiry = $2 WHERE id = $3', [
      resetToken,
      resetTokenExpiry,
      user.id
    ]);

    // Send reset password email
    const resetUrl = `${CLIENT_URL}/reset-password/${resetToken}`;
    const mailOptions = {
      from: SMTP_FROM,
      to: user.email,
      subject: 'LeadsBase — Password Reset Request',
      text: `Hello ${user.name},\n\nYou requested a password reset. Please click on the link below or paste it in your browser to proceed:\n\n${resetUrl}\n\nThis link will expire in 1 hour.`,
      html: `<p>Hello <strong>${user.name}</strong>,</p><p>You requested a password reset. Please click the link below to set a new password:</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>This link will expire in 1 hour.</p>`
    };

    // Nodemailer call
    try {
      await transporter.sendMail(mailOptions);
    } catch (mailError) {
      console.warn('⚠️ Mail transport failed, logging link in console:', resetUrl);
    }

    return res.status(200).json({ success: true, data: { message: 'Reset email queued' } });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * POST /reset-password
 */
export const resetPassword = async (req, res) => {
  const { token, newPassword } = req.body;
  try {
    const userRes = await query(`
      SELECT * FROM users 
      WHERE invite_token = $1 AND invite_token_expiry > NOW()
    `, [token]);
    const user = userRes.rows[0];

    if (!user) {
      return res.status(400).json({ success: false, error: 'Password reset token is invalid or has expired' });
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 12);
    await query(`
      UPDATE users 
      SET password_hash = $1, invite_token = NULL, invite_token_expiry = NULL, updated_at = NOW()
      WHERE id = $2
    `, [newPasswordHash, user.id]);

    await logAudit(null, {
      action: 'user.password_reset',
      targetCollection: 'users',
      targetId: user.id
    });

    return res.status(200).json({ success: true, data: { message: 'Password has been reset successfully' } });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * POST /change-password
 */
export const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  try {
    const userRes = await query('SELECT * FROM users WHERE id = $1', [req.user.sub]);
    const user = userRes.rows[0];

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ success: false, error: 'Current password is incorrect' });
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 12);
    await query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [newPasswordHash, user.id]);

    await logAudit(req, {
      action: 'user.change_password',
      targetCollection: 'users',
      targetId: user.id
    });

    return res.status(200).json({ success: true, data: { message: 'Password changed successfully' } });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};
