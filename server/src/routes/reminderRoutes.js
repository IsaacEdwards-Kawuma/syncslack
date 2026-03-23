import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { createReminderFromMessage } from '../controllers/reminderController.js';

const r = Router();
r.use(authMiddleware);

r.post('/:messageId/from-message', createReminderFromMessage);

export default r;

