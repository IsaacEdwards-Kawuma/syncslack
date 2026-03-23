import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { createTaskFromMessage, listPriorityTasks, updateTaskStatus } from '../controllers/taskController.js';

const r = Router();
r.use(authMiddleware);

r.post('/:messageId/from-message', createTaskFromMessage);
r.get('/workspaces/:workspaceId/priority', listPriorityTasks);
r.patch('/:taskId', updateTaskStatus);

export default r;

