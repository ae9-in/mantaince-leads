import express from 'express';
import { getUsers, createUser, updateUser, toggleUserStatus } from '../controllers/users.js';
import { authenticate, attachRole, checkPermission } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);
router.use(attachRole);

router.get('/', checkPermission('users:read'), getUsers);
router.post('/', checkPermission('users:invite'), createUser);
router.put('/:id', checkPermission('users:invite'), updateUser);
router.put('/:id/status', checkPermission('users:invite'), toggleUserStatus);

export default router;
