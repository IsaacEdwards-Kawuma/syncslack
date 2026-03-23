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
import * as channelPrefs from '../db/channelPrefs.js';
import * as users from '../db/users.js';
import { sendPushToUser } from '../services/webPush.js';
import * as automations from '../db/automations.js';

const onlineByWorkspace = new Map();

async function isDndActive(userId, cache) {
  const key = String(userId);
  if (cache.has(key)) return cache.get(key);
  const u = await users.findUserById(userId);
  const active = Boolean(u?.dndUntil) && new Date(u.dndUntil) > new Date();
  cache.set(key, active);
  return active;
}

function normalizeAttachments(attachmentUrl, attachmentMime, attachments) {
  if (attachments && Array.isArray(attachments) && attachments.length) {
    return attachments
      .map((a) => ({ url: a.url || '', mime: a.mime || '', originalName: a.originalName || '' }))
      .filter((a) => a.url);
  }
  if (attachmentUrl && String(attachmentUrl).length) {
    return [{ url: attachmentUrl, mime: attachmentMime || '', originalName: '' }];
  }
  return [];
}

async function notifyMentions(io, msg, senderId, workspaceId, channelIdForMute = null) {
  const ids = extractMentionedUserIds(msg.content);
  if (!ids.length) return;
  const dndCache = new Map();
  const valid = [];
  for (const id of ids) {
    if (!isValidUuid(id)) continue;
    if (String(id) === String(senderId)) continue;
    if (!(await workspaces.isMember(workspaceId, id))) continue;
    valid.push(id);
  }
  await messages.replaceMentions(msg.id, valid);
  for (const uid of valid) {
    if (channelIdForMute && (await channelPrefs.isChannelMuted(uid, channelIdForMute))) continue;
    const n = await notifications.createNotification({
      userId: uid,
      type: 'mention',
      workspaceId,
      messageId: msg.id,
      title: 'You were mentioned',
      body: msg.content.slice(0, 200),
    });
    if (!(await isDndActive(uid, dndCache))) {
      io.to(`user:${uid}`).emit('notification', {
        type: 'mention',
        workspaceId,
        messageId: msg.id,
        notificationId: n.id,
        preview: msg.content.slice(0, 120),
        fromUserId: senderId,
      });
    }
    await sendPushToUser(uid, 'You were mentioned', msg.content.slice(0, 120), {
      type: 'mention',
      messageId: msg.id,
      workspaceId,
    });
  }
}

async function emitDmNotifications(io, conv, conversationId, userId, text) {
  if (conv.kind === 'group') {
    const memberIds = await conversations.listConversationMemberIds(conversationId);
    const dndCache = new Map();
    for (const other of memberIds) {
      if (String(other) !== String(userId)) {
        if (!(await isDndActive(other, dndCache))) {
          io.to(`user:${other}`).emit('notification', {
            type: 'dm',
            conversationId,
            preview: text.slice(0, 120),
            fromUserId: userId,
          });
        }
        await sendPushToUser(other, 'New message', text.slice(0, 120), {
          type: 'dm',
          conversationId,
        });
      }
    }
  } else {
    const other = conversations.getOtherParticipantId(conv, userId);
    if (other) {
      const dndCache = new Map();
      if (!(await isDndActive(other, dndCache))) {
        io.to(`user:${other}`).emit('notification', {
          type: 'dm',
          conversationId,
          preview: text.slice(0, 120),
          fromUserId: userId,
        });
      }
      await sendPushToUser(other, 'Direct message', text.slice(0, 120), {
        type: 'dm',
        conversationId,
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
        {
          channelId,
          conversationId,
          content,
          threadParentId,
          attachmentUrl,
          attachmentMime,
          attachments,
          alsoToChannel,
        },
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
            const atc = Boolean(alsoToChannel && threadParent);
            const msg = await messages.createChannelMessage({
              senderId: userId,
              channelId,
              content: text || (hasFile ? 'Attachment' : ''),
              threadParentId: threadParent,
              attachments: attList,
              alsoToChannel: atc,
            });
            const ch = await channels.findChannelById(channelId);
            if (ch) {
              await notifyMentions(io, msg, userId, ch.workspace_id, channelId);
              const automationNotifs = await automations
                .runMessageAutomations({ workspaceId: ch.workspace_id, messageId: msg.id, actorUserId: userId })
                .catch(() => []);

              if (automationNotifs?.length) {
                const dndCache = new Map();
                for (const a of automationNotifs) {
                  if (!a?.notifyUserId) continue;
                  const dndActive = await isDndActive(a.notifyUserId, dndCache);

                  const preview = String(a.preview || '').slice(0, 120);
                  const title = 'New automated task';
                  const body = preview || a?.task?.title || 'Task created from a message';

                  if (!dndActive) {
                    io.to(`user:${a.notifyUserId}`).emit('notification', {
                      type: 'task',
                      workspaceId: a.workspaceId,
                      messageId: a.messageId,
                      notificationId: a.notificationId,
                      preview,
                      fromUserId: a.fromUserId,
                    });
                  }
                  await sendPushToUser(a.notifyUserId, title, body, {
                    type: 'task',
                    messageId: a.messageId,
                    workspaceId: a.workspaceId,
                  });
                }
              }
            }
            const payload = formatMessageDoc(msg);
            io.to(`channel:${channelId}`).emit('receive_message', payload);
            if (atc) {
              const rootMirror = await messages.createChannelMessage({
                senderId: userId,
                channelId,
                content: text || (hasFile ? 'Attachment' : ''),
                threadParentId: null,
                attachments: attList,
                alsoToChannel: false,
              });
              io.to(`channel:${channelId}`).emit('receive_message', formatMessageDoc(rootMirror));
            }
            if (typeof cb === 'function') cb({ ok: true, message: payload });
            return;
          }

          if (conversationId) {
            const check = await assertConversationAccess(conversationId, userId);
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
              if (!parent || parent.conversationId !== conversationId) {
                if (typeof cb === 'function') cb({ ok: false, error: 'Invalid thread' });
                return;
              }
              threadParent = threadParentId;
            }
            const msg = await messages.createConversationMessage({
              senderId: userId,
              conversationId,
              content: text || (hasFile ? 'Attachment' : ''),
              threadParentId: threadParent,
              attachments: attList,
            });
            const conv = check.conversation;
            const payload = formatMessageDoc(msg);
            await notifyMentions(io, msg, userId, conv.workspace_id, null);
            const automationNotifs = await automations
              .runMessageAutomations({ workspaceId: conv.workspace_id, messageId: msg.id, actorUserId: userId })
              .catch(() => []);

            if (automationNotifs?.length) {
              const dndCache = new Map();
              for (const a of automationNotifs) {
                if (!a?.notifyUserId) continue;
                const dndActive = await isDndActive(a.notifyUserId, dndCache);

                const preview = String(a.preview || '').slice(0, 120);
                const title = 'New automated task';
                const body = preview || a?.task?.title || 'Task created from a message';

                if (!dndActive) {
                  io.to(`user:${a.notifyUserId}`).emit('notification', {
                    type: 'task',
                    workspaceId: a.workspaceId,
                    messageId: a.messageId,
                    notificationId: a.notificationId,
                    preview,
                    fromUserId: a.fromUserId,
                  });
                }
                await sendPushToUser(a.notifyUserId, title, body, {
                  type: 'task',
                  messageId: a.messageId,
                  workspaceId: a.workspaceId,
                });
              }
            }
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
      let userName = 'Someone';
      try {
        const u = await users.findUserById(userId);
        if (u?.name) userName = u.name;
      } catch {
        /* ignore */
      }
      const payload = { userId, userName, isTyping: !!isTyping };
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
