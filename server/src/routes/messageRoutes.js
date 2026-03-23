import { Router } from 'express';
import {
  listChannelMessages,
  listChannelMessagesAround,
  listConversationMessages,
  listConversationMessagesAround,
  listThreadReplies,
  editMessage,
  deleteMessage,
  toggleReaction,
  listWorkspaceMembers,
  listSavedMessages,
  markReadHandler,
  listChannelPins,
  pinMessageHandler,
  unpinMessageHandler,
  saveMessageHandler,
  unsaveMessageHandler,
  resolveThreadHandler,
  unresolveThreadHandler,
  // around handlers
} from '../controllers/messageController.js';
import { authMiddleware } from '../middleware/auth.js';

const r = Router();
r.use(authMiddleware);
r.post('/mark-read', markReadHandler);
r.get('/saved', listSavedMessages);
r.get('/workspace/:workspaceId/members', listWorkspaceMembers);
r.get('/channel/:channelId/pins', listChannelPins);
r.get('/channel/:channelId/messages', listChannelMessages);
r.get('/channel/:channelId/messages/around/:messageId', listChannelMessagesAround);
r.get('/channel/:channelId/thread/:messageId', listThreadReplies);
r.get('/conversation/:conversationId/thread/:messageId', listThreadReplies);
r.get('/conversation/:conversationId/messages', listConversationMessages);
r.get('/conversation/:conversationId/messages/around/:messageId', listConversationMessagesAround);
r.post('/:messageId/resolve-thread', resolveThreadHandler);
r.delete('/:messageId/resolve-thread', unresolveThreadHandler);
r.post('/:messageId/pin', pinMessageHandler);
r.delete('/:messageId/pin', unpinMessageHandler);
r.post('/:messageId/save', saveMessageHandler);
r.delete('/:messageId/save', unsaveMessageHandler);
r.patch('/:messageId', editMessage);
r.delete('/:messageId', deleteMessage);
r.post('/:messageId/reactions', toggleReaction);

export default r;
