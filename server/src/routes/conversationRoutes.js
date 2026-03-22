import { Router } from 'express';
import {
  listConversations,
  getOrCreateConversation,
  createGroupConversationHandler,
  addGroupMembersHandler,
} from '../controllers/conversationController.js';
import { authMiddleware } from '../middleware/auth.js';

const r = Router();
r.use(authMiddleware);
r.get('/workspace/:workspaceId/conversations', listConversations);
r.post('/workspace/:workspaceId/conversations', getOrCreateConversation);
r.post('/workspace/:workspaceId/conversations/group', createGroupConversationHandler);
r.post('/conversation/:conversationId/members', addGroupMembersHandler);

export default r;
