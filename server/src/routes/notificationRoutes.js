import { Router } from 'express';
import { listNotifications, markNotificationRead, markAllNotificationsRead } from '../controllers/notificationController.js';
import { authMiddleware } from '../middleware/auth.js';

const r = Router();
r.use(authMiddleware);
r.get('/', listNotifications);
r.patch('/read-all', markAllNotificationsRead);
r.patch('/:id/read', markNotificationRead);

export default r;
