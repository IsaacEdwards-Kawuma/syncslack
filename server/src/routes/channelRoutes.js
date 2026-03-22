import { Router } from 'express';
import {
  listChannels,
  createChannel,
  joinChannel,
  leaveChannel,
  getChannelNotificationPref,
  setChannelNotificationPref,
  createWebhookForChannel,
  listWebhooksForChannel,
  deleteWebhookForChannel,
} from '../controllers/channelController.js';
import { authMiddleware } from '../middleware/auth.js';

const r = Router();
r.use(authMiddleware);
r.get('/workspace/:workspaceId/channels', listChannels);
r.post('/workspace/:workspaceId/channels', createChannel);
r.get('/:channelId/notification-prefs', getChannelNotificationPref);
r.patch('/:channelId/notification-prefs', setChannelNotificationPref);
r.post('/:channelId/webhooks', createWebhookForChannel);
r.get('/:channelId/webhooks', listWebhooksForChannel);
r.delete('/:channelId/webhooks/:webhookId', deleteWebhookForChannel);
r.post('/:channelId/join', joinChannel);
r.post('/:channelId/leave', leaveChannel);

export default r;
