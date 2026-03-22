import { Server } from 'socket.io';
import { isOriginAllowed } from '../config/cors.js';
import { getJwtSecret } from '../config/env.js';
import { verifyToken } from '../utils/jwt.js';
import * as messages from '../db/messages.js';
import * as conversations from '../db/conversations.js';
import * as channels from '../db/channels.js';
import * as workspaces from '../db/workspaces.js';
import * as notifications from '../db/notifications.js';
import { assertChannelAccess, assertConversationAccess } from './access.js';
import { formatMessageDoc } from './formatMessage.js';
import { isValidUuid } from '../utils/ids.js';
import { extractMentionedUserIds } from '../utils/mentions.js';

const onlineByWorkspace = new Map();

function normalizeAttachments(attachmentUrl, attachmentMime, attachments) {
  if (attachments && Array.isArray(attachments) && attachments.length) {
    return attachments.map((a) => ({ url: a.url || '', mime: a.mime || '' })).filter((a) => a.url);
  }
  if (attachmentUrl && String(attachmentUrl).length) {
    return [{ url: attachmentUrl, mime: attachmentMime || '' }];
  }
  return [];
}

async function notifyMentions(io, msg, senderId, workspaceId) {
  const ids = extractMentionedUserIds(msg.content);
  if (!ids.length) return;
  const valid = [];
  for (const id of ids) {
    if (!isValidUuid(id)) continue;
    if (String(id) === String(senderId)) continue;
    if (!(await workspaces.isMember(workspaceId, id))) continue;
    valid.push(id);
  }
  await messages.replaceMentions(msg.id, valid);
  for (const uid of valid) {
    const n = await notifications.createNotification({
      userId: uid,
      type: 'mention',
      workspaceId,
      messageId: msg.id,
      title: 'You were mentioned',
      body: msg.content.slice(0, 200),
    });
    io.to(`user:${uid}`).emit('notification', {
      type: 'mention',
      workspaceId,
      messageId: msg.id,
      notificationId: n.id,
      preview: msg.content.slice(0, 120),
      fromUserId: senderId,
    });
  }
}

async function emitDmNotifications(io, conv, conversationId, userId, text) {
  if (conv.kind === 'group') {
    const memberIds = await conversations.listConversationMemberIds(conversationId);
    for (const other of memberIds) {
      if (String(other) !== String(userId)) {
        io.to(`user:${other}`).emit('notification', {
          type: 'dm',
          conversationId,
          preview: text.slice(0, 120),
          fromUserId: userId,
        });
      }
    }
  } else {
    const other = conversations.getOtherParticipantId(conv, userId);
    if (other) {
      io.to(`user:${other}`).emit('notification', {
        type: 'dm',
        conversationId,
        preview: text.slice(0, 120),
        fromUserId: userId,
      });
    }
  }
}

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
    socket.presenceWorkspaces = new Set();

    socket.on('join_presence', async ({ workspaceId }, cb) => {
      try {
        if (!isValidUuid(workspaceId)) {
          if (typeof cb === 'function') cb({ ok: false });
          return;
        }
        if (!(await workspaces.isMember(workspaceId, userId))) {
          if (typeof cb === 'function') cb({ ok: false });
          return;
        }
        socket.join(`presence:${workspaceId}`);
        socket.presenceWorkspaces.add(workspaceId);
        if (!onlineByWorkspace.has(workspaceId)) onlineByWorkspace.set(workspaceId, new Set());
        onlineByWorkspace.get(workspaceId).add(userId);
        const userIds = [...onlineByWorkspace.get(workspaceId)];
        io.to(`presence:${workspaceId}`).emit('presence', { workspaceId, userIds });
        if (typeof cb === 'function') cb({ ok: true, userIds });
      } catch (e) {
        console.error(e);
        if (typeof cb === 'function') cb({ ok: false });
      }
    });

    socket.on('leave_presence', ({ workspaceId }) => {
      if (!workspaceId) return;
      socket.leave(`presence:${workspaceId}`);
      socket.presenceWorkspaces?.delete(workspaceId);
      const set = onlineByWorkspace.get(workspaceId);
      if (set) {
        set.delete(userId);
        io.to(`presence:${workspaceId}`).emit('presence', {
          workspaceId,
          userIds: [...set],
        });
      }
    });

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
      async (
        { channelId, conversationId, content, threadParentId, attachmentUrl, attachmentMime, attachments },
        cb
      ) => {
        try {
          const text = (content || '').trim();
          const attList = normalizeAttachments(attachmentUrl, attachmentMime, attachments);
          const hasFile = attList.length > 0;
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
              attachments: attList,
            });
            const ch = await channels.findChannelById(channelId);
            if (ch) await notifyMentions(io, msg, userId, ch.workspace_id);
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
              attachments: attList,
            });
            const conv = check.conversation;
            const payload = formatMessageDoc(msg);
            await notifyMentions(io, msg, userId, conv.workspace_id);
            io.to(`conversation:${conversationId}`).emit('receive_message', payload);
            await emitDmNotifications(io, conv, conversationId, userId, text);
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
      for (const wid of socket.presenceWorkspaces || []) {
        const set = onlineByWorkspace.get(wid);
        if (set) {
          set.delete(userId);
          io.to(`presence:${wid}`).emit('presence', { workspaceId: wid, userIds: [...set] });
        }
      }
      socket.leave(`user:${userId}`);
    });
  });

  return io;
}

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
