import jwt from 'jsonwebtoken';
import { verifyAccessToken } from '../utils/token.js';

/**
 * Authentication Middleware
 * Validates the JWT Access Token in the Authorization header.
 */
export const authenticate = (req, res, next) => {
  let token = null;
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.query.token) {
    // Support token in query string for SSE (EventSource)
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Access token missing or invalid format'
    });
  }

  try {
    const decoded = verifyAccessToken(token);
    req.user = decoded; // Attach payload: { sub, role, permissions, verticalAccess }
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({
        success: false,
        error: 'Access token expired',
        code: 'TOKEN_EXPIRED'
      });
    }
    return res.status(401).json({
      success: false,
      error: 'Invalid access token'
    });
  }
};

export default authenticate;
