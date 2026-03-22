import { Router } from 'express';
import { subscribePush } from '../controllers/pushController.js';
import { authMiddleware } from '../middleware/auth.js';

const r = Router();
r.use(authMiddleware);
r.post('/subscribe', subscribePush);

export default r;
