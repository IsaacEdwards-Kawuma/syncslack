import { Server } from 'socket.io';
import mongoose from 'mongoose';
import { getCorsOrigins } from '../config/cors.js';
import { getJwtSecret } from '../config/env.js';
import { verifyToken } from '../utils/jwt.js';
import { Message } from '../models/Message.js';
import { Conversation } from '../models/Conversation.js';
import { assertChannelAccess, assertConversationAccess } from './access.js';
import { formatMessageDoc } from './formatMessage.js';

const populateSender = { path: 'sender', select: 'name email avatarUrl' };

export function attachSocketIO(httpServer) {
  const allowedOrigins = getCorsOrigins();
  const io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
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
          const senderOid = new mongoose.Types.ObjectId(userId);

          if (channelId) {
            const check = await assertChannelAccess(channelId, userId);
            if (check.error) {
              if (typeof cb === 'function') cb({ ok: false, error: check.error });
              return;
            }
            let threadParent = null;
            if (threadParentId) {
              if (!mongoose.Types.ObjectId.isValid(threadParentId)) {
                if (typeof cb === 'function') cb({ ok: false, error: 'Invalid thread parent' });
                return;
              }
              const parent = await Message.findById(threadParentId);
              if (!parent || parent.channel?.toString() !== channelId) {
                if (typeof cb === 'function') cb({ ok: false, error: 'Invalid thread' });
                return;
              }
              threadParent = parent._id;
            }
            const msg = await Message.create({
              sender: senderOid,
              channel: channelId,
              content: text || (hasFile ? 'Attachment' : ''),
              threadParent,
              attachmentUrl: attachmentUrl || '',
              attachmentMime: attachmentMime || '',
            });
            const populated = await Message.findById(msg._id).populate(populateSender);
            const payload = formatMessageDoc(populated);
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
            const msg = await Message.create({
              sender: senderOid,
              conversation: conversationId,
              content: text || (hasFile ? 'Attachment' : ''),
              attachmentUrl: attachmentUrl || '',
              attachmentMime: attachmentMime || '',
            });
            await Conversation.findByIdAndUpdate(conversationId, { $set: { updatedAt: new Date() } });
            const populated = await Message.findById(msg._id).populate(populateSender);
            const payload = formatMessageDoc(populated);
            io.to(`conversation:${conversationId}`).emit('receive_message', payload);
            const conv = check.conversation;
            const other =
              conv.participantLow.toString() === userId ? conv.participantHigh : conv.participantLow;
            io.to(`user:${other.toString()}`).emit('notification', {
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
  if (payload.channelId) {
    io.to(`channel:${payload.channelId}`).emit('message_updated', payload);
  }
  if (payload.conversationId) {
    io.to(`conversation:${payload.conversationId}`).emit('message_updated', payload);
  }
}
