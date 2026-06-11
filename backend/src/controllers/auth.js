import jwt from 'jsonwebtoken';
import User from '../models/user.js';
import Role from '../models/role.js';
import Session from '../models/session.js';
import { logAudit } from '../utils/audit.js';

const ACCESS_TOKEN_SECRET = process.env.JWT_SECRET || 'jwt_access_secret_fallback_12345';
const REFRESH_TOKEN_SECRET = process.env.JWT_REFRESH_SECRET || 'jwt_refresh_secret_fallback_12345';

// Helpers to generate tokens
const generateAccessToken = (user, roleName) => {
  return jwt.sign(
    {
      userId: user._id,
      roleId: user.roleId,
      roleName: roleName,
      verticalAccess: user.verticalAccess
    },
    ACCESS_TOKEN_SECRET,
    { expiresIn: '15m' }
  );
};

const generateRefreshToken = (user, roleName) => {
  return jwt.sign(
    {
      userId: user._id,
      roleId: user.roleId,
      roleName: roleName,
      verticalAccess: user.verticalAccess
    },
    REFRESH_TOKEN_SECRET,
    { expiresIn: '7d' }
  );
};

// Login user
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await User.findOne({ email }).populate('roleId');
    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'Invalid credentials or inactive account' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const roleName = user.roleId.name;
    const accessToken = generateAccessToken(user, roleName);
    const refreshToken = generateRefreshToken(user, roleName);

    // Save refresh token session in database
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now

    await Session.create({
      userId: user._id,
      token: refreshToken,
      expiresAt
    });

    // Set refresh token in HttpOnly cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    // Set access token in cookie too as a fallback for standard layout requests
    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000 // 15 mins
    });

    await logAudit(user._id, 'user.login', 'users', user._id, null, req);

    res.status(200).json({
      accessToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: roleName,
        verticalAccess: user.verticalAccess
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Refresh access token
export const refresh = async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) {
      return res.status(401).json({ message: 'Refresh token missing' });
    }

    // Check if session exists in DB
    const session = await Session.findOne({ token: refreshToken });
    if (!session) {
      return res.status(401).json({ message: 'Session expired or invalid' });
    }

    // Verify token
    jwt.verify(refreshToken, REFRESH_TOKEN_SECRET, async (err, decoded) => {
      if (err) {
        await Session.deleteOne({ token: refreshToken });
        return res.status(401).json({ message: 'Session invalid' });
      }

      const user = await User.findById(decoded.userId).populate('roleId');
      if (!user || !user.isActive) {
        await Session.deleteOne({ token: refreshToken });
        return res.status(401).json({ message: 'User not found or inactive' });
      }

      const roleName = user.roleId.name;
      const accessToken = generateAccessToken(user, roleName);

      // Renew access token cookie
      res.cookie('accessToken', accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 15 * 60 * 1000
      });

      res.status(200).json({
        accessToken,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: roleName,
          verticalAccess: user.verticalAccess
        }
      });
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Logout user
export const logout = async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    if (refreshToken) {
      // Remove session from DB
      await Session.deleteOne({ token: refreshToken });
    }

    // Clear cookies
    res.clearCookie('refreshToken');
    res.clearCookie('accessToken');

    if (req.user) {
      await logAudit(req.user.userId, 'user.logout', 'users', req.user.userId, null, req);
    }

    res.status(200).json({ message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get current user profile details
export const getMe = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    const user = await User.findById(req.user.userId).populate('roleId', 'name permissions');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.roleId.name,
      permissions: user.roleId.permissions,
      verticalAccess: user.verticalAccess,
      isActive: user.isActive
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
