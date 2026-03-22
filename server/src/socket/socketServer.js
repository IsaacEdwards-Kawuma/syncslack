import { Server } from 'socket.io';
import { isOriginAllowed } from '../config/cors.js';
import { getJwtSecret } from '../config/env.js';
import { verifyToken } from '../utils/jwt.js';
import * as messages from '../db/messages.js';
import * as conversations from '../db/conversations.js';
import { assertChannelAccess, assertConversationAccess } from './access.js';
import { formatMessageDoc } from './formatMessage.js';
import { isValidUuid } from '../utils/ids.js';

export function attachSocketIO(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (origin == null || origin === '') return callback(null, true);
        const o = String(origin).trim();
        if (!o) return callback(null, true);
        if (isOriginAllowed(o)) return callback(null, o);
        return callback(null, false);
      },
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  io.use((socket, next) => {
    const raw =
      socket.handshake.auth?.token ||
      (typeof socket.handshake.headers?.authorization === 'string'
        ? socket.handshake.headers.authorization.replace(/^Bearer\s+/i, '')
        : null);
    if (!raw) return next(new Error('Unauthorized'));
    try {
      const secret = getJwtSecret();
      const payload = verifyToken(raw, secret);
      socket.userId = payload.sub;
      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.userId;
    socket.join(`user:${userId}`);

    socket.on('join_channel', async ({ channelId }, cb) => {
      const check = await assertChannelAccess(channelId, userId);
      if (check.error) {
        if (typeof cb === 'function') cb({ ok: false, error: check.error });
        return;
      }
      socket.join(`channel:${channelId}`);
      if (typeof cb === 'function') cb({ ok: true });
    });

    socket.on('leave_channel', ({ channelId }) => {
      socket.leave(`channel:${channelId}`);
    });

    socket.on('join_conversation', async ({ conversationId }, cb) => {
      const check = await assertConversationAccess(conversationId, userId);
      if (check.error) {
        if (typeof cb === 'function') cb({ ok: false, error: check.error });
        return;
      }
      socket.join(`conversation:${conversationId}`);
      if (typeof cb === 'function') cb({ ok: true });
    });

    socket.on('leave_conversation', ({ conversationId }) => {
      socket.leave(`conversation:${conversationId}`);
    });

    socket.on(
      'send_message',
      async ({ channelId, conversationId, content, threadParentId, attachmentUrl, attachmentMime }, cb) => {
        try {
          const text = (content || '').trim();
          const hasFile = attachmentUrl && String(attachmentUrl).length > 0;
          if (!text && !hasFile) {
            if (typeof cb === 'function') cb({ ok: false, error: 'Empty message' });
            return;
          }

          if (channelId) {
            const check = await assertChannelAccess(channelId, userId);
            if (check.error) {
              if (typeof cb === 'function') cb({ ok: false, error: check.error });
              return;
            }
            let threadParent = null;
            if (threadParentId) {
              if (!isValidUuid(threadParentId)) {
                if (typeof cb === 'function') cb({ ok: false, error: 'Invalid thread parent' });
                return;
              }
              const parent = await messages.findMessageById(threadParentId);
              if (!parent || parent.channelId !== channelId) {
                if (typeof cb === 'function') cb({ ok: false, error: 'Invalid thread' });
                return;
              }
              threadParent = threadParentId;
            }
            const msg = await messages.createChannelMessage({
              senderId: userId,
              channelId,
              content: text || (hasFile ? 'Attachment' : ''),
              threadParentId: threadParent,
              attachmentUrl: attachmentUrl || '',
              attachmentMime: attachmentMime || '',
            });
            const payload = formatMessageDoc(msg);
            io.to(`channel:${channelId}`).emit('receive_message', payload);
            if (typeof cb === 'function') cb({ ok: true, message: payload });
            return;
          }

          if (conversationId) {
            const check = await assertConversationAccess(conversationId, userId);
            if (check.error) {
              if (typeof cb === 'function') cb({ ok: false, error: check.error });
              return;
            }
            const msg = await messages.createConversationMessage({
              senderId: userId,
              conversationId,
              content: text || (hasFile ? 'Attachment' : ''),
              attachmentUrl: attachmentUrl || '',
              attachmentMime: attachmentMime || '',
            });
            const conv = check.conversation;
            const payload = formatMessageDoc(msg);
            io.to(`conversation:${conversationId}`).emit('receive_message', payload);
            const other = conversations.getOtherParticipantId(conv, userId);
            io.to(`user:${other}`).emit('notification', {
              type: 'dm',
              conversationId,
              preview: text.slice(0, 120),
              fromUserId: userId,
            });
            if (typeof cb === 'function') cb({ ok: true, message: payload });
            return;
          }

          if (typeof cb === 'function') cb({ ok: false, error: 'channelId or conversationId required' });
        } catch (e) {
          console.error(e);
          if (typeof cb === 'function') cb({ ok: false, error: 'Server error' });
        }
      }
    );

    socket.on('typing', async ({ channelId, conversationId, isTyping }) => {
      const payload = { userId, isTyping: !!isTyping };
      if (channelId) {
        const check = await assertChannelAccess(channelId, userId);
        if (check.error) return;
        socket.to(`channel:${channelId}`).emit('typing', { ...payload, channelId });
      } else if (conversationId) {
        const check = await assertConversationAccess(conversationId, userId);
        if (check.error) return;
        socket.to(`conversation:${conversationId}`).emit('typing', { ...payload, conversationId });
      }
    });

    socket.on('disconnect', () => {
      socket.leave(`user:${userId}`);
    });
  });

  return io;
}

/** Called from REST after edit/delete to sync clients */
export function emitMessageUpdated(io, messageDoc) {
  const payload = formatMessageDoc(messageDoc);
  if (!payload) return;
  if (payload.channelId) {
    io.to(`channel:${payload.channelId}`).emit('message_updated', payload);
  }
  if (payload.conversationId) {
    io.to(`conversation:${payload.conversationId}`).emit('message_updated', payload);
  }
}
