import { Router } from 'express';
import { listChannels, createChannel, joinChannel, leaveChannel } from '../controllers/channelController.js';
import { authMiddleware } from '../middleware/auth.js';

const r = Router();
r.use(authMiddleware);
r.get('/workspace/:workspaceId/channels', listChannels);
r.post('/workspace/:workspaceId/channels', createChannel);
r.post('/:channelId/join', joinChannel);
r.post('/:channelId/leave', leaveChannel);

export default r;
