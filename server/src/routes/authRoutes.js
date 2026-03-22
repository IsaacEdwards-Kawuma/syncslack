import { Router } from 'express';
import { register, login, me, updateTheme } from '../controllers/authController.js';
import { authMiddleware } from '../middleware/auth.js';

const r = Router();
r.post('/register', register);
r.post('/login', login);
r.get('/me', authMiddleware, me);
r.patch('/me/theme', authMiddleware, updateTheme);

export default r;
