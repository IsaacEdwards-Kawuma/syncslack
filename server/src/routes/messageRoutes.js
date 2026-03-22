import { Router } from 'express';
import {
  listChannelMessages,
  listConversationMessages,
  listThreadReplies,
  editMessage,
  deleteMessage,
  toggleReaction,
  listWorkspaceMembers,
} from '../controllers/messageController.js';
import { authMiddleware } from '../middleware/auth.js';

const r = Router();
r.use(authMiddleware);
r.get('/workspace/:workspaceId/members', listWorkspaceMembers);
r.get('/channel/:channelId/messages', listChannelMessages);
r.get('/channel/:channelId/thread/:messageId', listThreadReplies);
r.get('/conversation/:conversationId/thread/:messageId', listThreadReplies);
r.get('/conversation/:conversationId/messages', listConversationMessages);
r.patch('/:messageId', editMessage);
r.delete('/:messageId', deleteMessage);
r.post('/:messageId/reactions', toggleReaction);

export default r;
