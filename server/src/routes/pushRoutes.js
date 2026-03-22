import { Router } from 'express';
import { getVapidPublic, subscribePush } from '../controllers/pushController.js';
import { authMiddleware } from '../middleware/auth.js';

const r = Router();
r.get('/vapid-public', getVapidPublic);
r.use(authMiddleware);
r.post('/subscribe', subscribePush);

export default r;
