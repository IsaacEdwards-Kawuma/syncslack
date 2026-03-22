import { Router } from 'express';
import { listConversations, getOrCreateConversation } from '../controllers/conversationController.js';
import { authMiddleware } from '../middleware/auth.js';

const r = Router();
r.use(authMiddleware);
r.get('/workspace/:workspaceId/conversations', listConversations);
r.post('/workspace/:workspaceId/conversations', getOrCreateConversation);

export default r;
