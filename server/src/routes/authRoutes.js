import { Router } from 'express';
import {
  register,
  login,
  me,
  updateTheme,
  updateStatus,
  forgotPassword,
  resetPassword,
  changePassword,
  verifyEmail,
} from '../controllers/authController.js';
import { authMiddleware } from '../middleware/auth.js';

const r = Router();
r.post('/register', register);
r.post('/login', login);
r.get('/verify-email', verifyEmail);
r.post('/verify-email', verifyEmail);
r.post('/forgot-password', forgotPassword);
r.post('/reset-password', resetPassword);
r.post('/change-password', authMiddleware, changePassword);
r.get('/me', authMiddleware, me);
r.patch('/me/theme', authMiddleware, updateTheme);
r.patch('/me/status', authMiddleware, updateStatus);

export default r;
