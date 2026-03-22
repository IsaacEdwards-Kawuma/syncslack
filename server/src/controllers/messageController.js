import * as messages from '../db/messages.js';
import * as channels from '../db/channels.js';
import * as conversations from '../db/conversations.js';
import * as workspaces from '../db/workspaces.js';
import { emitMessageUpdated } from '../socket/socketServer.js';
import { isValidUuid } from '../utils/ids.js';

async function canAccessChannel(ch, userId) {
  if (!(await workspaces.isMember(ch.workspace_id, userId))) return false;
  if (ch.type === 'public') return true;
  const mids = await channels.listChannelMemberIds(ch.id);
  return mids.includes(userId);
}

export async function listChannelMessages(req, res) {
  try {
    const { channelId } = req.params;
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
    const before = req.query.before;
    if (!isValidUuid(channelId)) {
      return res.status(400).json({ error: 'Invalid channel id' });
    }
    const channel = await channels.findChannelById(channelId);
    if (!channel) return res.status(404).json({ error: 'Channel not found' });
    const ws = await workspaces.findWorkspaceById(channel.workspace_id);
    if (!(await canAccessChannel(channel, req.user.sub))) return res.status(403).json({ error: 'Not allowed' });

    const list = await messages.listChannelRootMessages(channelId, before || null, limit);
    return res.json({ messages: list });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to load messages' });
  }
}

export async function listThreadReplies(req, res) {
  try {
    const { messageId } = req.params;
    if (!isValidUuid(messageId)) {
      return res.status(400).json({ error: 'Invalid message id' });
    }
    const parent = await messages.findMessageById(messageId);
    if (!parent) return res.status(404).json({ error: 'Message not found' });
    if (parent.channelId) {
      const channel = await channels.findChannelById(parent.channelId);
      if (!(await canAccessChannel(channel, req.user.sub))) return res.status(403).json({ error: 'Not allowed' });
    } else if (parent.conversationId) {
      if (!(await conversations.isConversationMember(parent.conversationId, req.user.sub))) {
        return res.status(403).json({ error: 'Not allowed' });
      }
    } else {
      return res.status(404).json({ error: 'Message not found' });
    }

    const replies = await messages.listThreadReplies(messageId);
    return res.json({ replies });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to load thread' });
  }
}

export async function listConversationMessages(req, res) {
  try {
    const { conversationId } = req.params;
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
    const before = req.query.before;
    if (!isValidUuid(conversationId)) {
      return res.status(400).json({ error: 'Invalid conversation id' });
    }
    const conv = await conversations.findConversationById(conversationId);
    if (!conv) return res.status(404).json({ error: 'Conversation not found' });
    const uid = req.user.sub;
    if (!(await conversations.isConversationMember(conversationId, uid))) {
      return res.status(403).json({ error: 'Not a participant' });
    }
    const list = await messages.listConversationMessages(conversationId, before || null, limit);
    return res.json({ messages: list });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to load messages' });
  }
}

export async function editMessage(req, res) {
  try {
    const { messageId } = req.params;
    const { content } = req.body;
    if (!isValidUuid(messageId)) {
      return res.status(400).json({ error: 'Invalid message id' });
    }
    if (!content?.trim()) return res.status(400).json({ error: 'content is required' });
    const msg = await messages.findMessageById(messageId);
    if (!msg || msg.deletedAt) return res.status(404).json({ error: 'Message not found' });
    if (msg.senderId !== req.user.sub) return res.status(403).json({ error: 'Not your message' });
    const populated = await messages.updateMessageContent(messageId, content.trim());
    const io = req.app.get('io');
    if (io) emitMessageUpdated(io, populated);
    return res.json({ message: populated });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to edit message' });
  }
}

export async function deleteMessage(req, res) {
  try {
    const { messageId } = req.params;
    if (!isValidUuid(messageId)) {
      return res.status(400).json({ error: 'Invalid message id' });
    }
    const msg = await messages.findMessageById(messageId);
    if (!msg) return res.status(404).json({ error: 'Message not found' });
    if (msg.senderId !== req.user.sub) return res.status(403).json({ error: 'Not your message' });
    const populated = await messages.softDeleteMessage(messageId);
    const io = req.app.get('io');
    if (io) emitMessageUpdated(io, populated);
    return res.json({ message: populated });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to delete message' });
  }
}

export async function toggleReaction(req, res) {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body;
    if (!isValidUuid(messageId)) {
      return res.status(400).json({ error: 'Invalid message id' });
    }
    if (!emoji?.trim()) return res.status(400).json({ error: 'emoji is required' });
    const msg = await messages.findMessageById(messageId);
    if (!msg || msg.deletedAt) return res.status(404).json({ error: 'Message not found' });

    const populated = await messages.toggleReactionOnMessage(messageId, req.user.sub, emoji);
    const io = req.app.get('io');
    if (io) emitMessageUpdated(io, populated);
    return res.json({ message: populated });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to update reaction' });
  }
}

export async function listWorkspaceMembers(req, res) {
  try {
    const { workspaceId } = req.params;
    if (!isValidUuid(workspaceId)) {
      return res.status(400).json({ error: 'Invalid workspace id' });
    }
    const ws = await workspaces.findWorkspaceById(workspaceId);
    if (!ws) return res.status(404).json({ error: 'Workspace not found' });
    if (!(await workspaces.isMember(workspaceId, req.user.sub))) {
      return res.status(403).json({ error: 'Not a member' });
    }
    const members = await workspaces.listMembers(workspaceId);
    const users = members.map((m) => ({
      id: m.user_id,
      name: m.name,
      email: m.email,
      avatarUrl: m.avatar_url || '',
      role: m.role,
    }));
    return res.json({ members: users });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to list members' });
  }
}
