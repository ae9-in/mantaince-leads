import express from 'express';
import { login, refresh, logout, me, forgotPassword, resetPassword, changePassword, register } from '../controllers/auth.js';
import authenticate from '../middleware/authenticate.js';

const router = express.Router();

router.post('/login', login);
router.post('/register', register);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.get('/me', authenticate, me);

router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/change-password', authenticate, changePassword);

export default router;
