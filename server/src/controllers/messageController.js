import mongoose from 'mongoose';
import { Message } from '../models/Message.js';
import { Channel } from '../models/Channel.js';
import { Conversation } from '../models/Conversation.js';
import { Workspace } from '../models/Workspace.js';
import { emitMessageUpdated } from '../socket/socketServer.js';

function isWorkspaceMember(workspace, userId) {
  return workspace.members.some((m) => m.user.toString() === userId);
}

function canAccessChannel(channel, workspace, userId) {
  if (!isWorkspaceMember(workspace, userId)) return false;
  if (channel.type === 'public') return true;
  return channel.members.some((id) => id.toString() === userId);
}

const populateSender = { path: 'sender', select: 'name email avatarUrl' };

function formatMessage(m) {
  const o = m.toObject ? m.toObject() : m;
  const sender = o.sender;
  return {
    id: o._id.toString(),
    senderId: sender?._id?.toString() || o.sender?.toString(),
    sender: sender
      ? { id: sender._id.toString(), name: sender.name, email: sender.email, avatarUrl: sender.avatarUrl }
      : null,
    channelId: o.channel ? o.channel.toString() : null,
    conversationId: o.conversation ? o.conversation.toString() : null,
    content: o.content,
    createdAt: o.createdAt,
    editedAt: o.editedAt,
    deletedAt: o.deletedAt,
    threadParentId: o.threadParent ? o.threadParent.toString() : null,
    reactions: (o.reactions || []).map((r) => ({
      emoji: r.emoji,
      userIds: (r.users || []).map((id) => id.toString()),
    })),
    attachmentUrl: o.attachmentUrl || '',
    attachmentMime: o.attachmentMime || '',
  };
}

export async function listChannelMessages(req, res) {
  try {
    const { channelId } = req.params;
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
    const before = req.query.before;
    if (!mongoose.Types.ObjectId.isValid(channelId)) {
      return res.status(400).json({ error: 'Invalid channel id' });
    }
    const channel = await Channel.findById(channelId);
    if (!channel) return res.status(404).json({ error: 'Channel not found' });
    const ws = await Workspace.findById(channel.workspace);
    if (!canAccessChannel(channel, ws, req.user.sub)) return res.status(403).json({ error: 'Not allowed' });

    const query = { channel: channelId, conversation: null, threadParent: null, deletedAt: null };
    if (before && mongoose.Types.ObjectId.isValid(before)) {
      query._id = { $lt: new mongoose.Types.ObjectId(before) };
    }
    const messages = await Message.find(query)
      .sort({ _id: -1 })
      .limit(limit)
      .populate(populateSender);
    return res.json({ messages: messages.reverse().map(formatMessage) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to load messages' });
  }
}

export async function listThreadReplies(req, res) {
  try {
    const { messageId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(messageId)) {
      return res.status(400).json({ error: 'Invalid message id' });
    }
    const parent = await Message.findById(messageId);
    if (!parent || !parent.channel) return res.status(404).json({ error: 'Message not found' });
    const channel = await Channel.findById(parent.channel);
    const ws = await Workspace.findById(channel.workspace);
    if (!canAccessChannel(channel, ws, req.user.sub)) return res.status(403).json({ error: 'Not allowed' });

    const replies = await Message.find({
      channel: parent.channel,
      threadParent: parent._id,
      deletedAt: null,
    })
      .sort({ createdAt: 1 })
      .populate(populateSender);
    return res.json({ replies: replies.map(formatMessage) });
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
    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      return res.status(400).json({ error: 'Invalid conversation id' });
    }
    const conv = await Conversation.findById(conversationId);
    if (!conv) return res.status(404).json({ error: 'Conversation not found' });
    const uid = req.user.sub;
    if (conv.participantLow.toString() !== uid && conv.participantHigh.toString() !== uid) {
      return res.status(403).json({ error: 'Not a participant' });
    }
    const query = { conversation: conversationId, channel: null, deletedAt: null };
    if (before && mongoose.Types.ObjectId.isValid(before)) {
      query._id = { $lt: new mongoose.Types.ObjectId(before) };
    }
    const messages = await Message.find(query)
      .sort({ _id: -1 })
      .limit(limit)
      .populate(populateSender);
    return res.json({ messages: messages.reverse().map(formatMessage) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to load messages' });
  }
}

export async function editMessage(req, res) {
  try {
    const { messageId } = req.params;
    const { content } = req.body;
    if (!mongoose.Types.ObjectId.isValid(messageId)) {
      return res.status(400).json({ error: 'Invalid message id' });
    }
    if (!content?.trim()) return res.status(400).json({ error: 'content is required' });
    const msg = await Message.findById(messageId);
    if (!msg || msg.deletedAt) return res.status(404).json({ error: 'Message not found' });
    if (msg.sender.toString() !== req.user.sub) return res.status(403).json({ error: 'Not your message' });
    msg.content = content.trim();
    msg.editedAt = new Date();
    await msg.save();
    const populated = await Message.findById(msg._id).populate(populateSender);
    const io = req.app.get('io');
    if (io) emitMessageUpdated(io, populated);
    return res.json({ message: formatMessage(populated) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to edit message' });
  }
}

export async function deleteMessage(req, res) {
  try {
    const { messageId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(messageId)) {
      return res.status(400).json({ error: 'Invalid message id' });
    }
    const msg = await Message.findById(messageId);
    if (!msg) return res.status(404).json({ error: 'Message not found' });
    if (msg.sender.toString() !== req.user.sub) return res.status(403).json({ error: 'Not your message' });
    msg.deletedAt = new Date();
    msg.content = '[deleted]';
    await msg.save();
    const populated = await Message.findById(msg._id).populate(populateSender);
    const io = req.app.get('io');
    if (io) emitMessageUpdated(io, populated);
    return res.json({ message: formatMessage(populated) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to delete message' });
  }
}

export async function toggleReaction(req, res) {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body;
    if (!mongoose.Types.ObjectId.isValid(messageId)) {
      return res.status(400).json({ error: 'Invalid message id' });
    }
    if (!emoji?.trim()) return res.status(400).json({ error: 'emoji is required' });
    const msg = await Message.findById(messageId);
    if (!msg || msg.deletedAt) return res.status(404).json({ error: 'Message not found' });

    const uid = new mongoose.Types.ObjectId(req.user.sub);
    let bucket = msg.reactions.find((r) => r.emoji === emoji);
    if (!bucket) {
      bucket = { emoji, users: [] };
      msg.reactions.push(bucket);
    }
    const idx = bucket.users.findIndex((id) => id.equals(uid));
    if (idx >= 0) bucket.users.splice(idx, 1);
    else bucket.users.push(uid);
    if (bucket.users.length === 0) {
      msg.reactions = msg.reactions.filter((r) => r.emoji !== emoji);
    }
    await msg.save();
    const populated = await Message.findById(msg._id).populate(populateSender);
    const io = req.app.get('io');
    if (io) emitMessageUpdated(io, populated);
    return res.json({ message: formatMessage(populated) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to update reaction' });
  }
}

export async function listWorkspaceMembers(req, res) {
  try {
    const { workspaceId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(workspaceId)) {
      return res.status(400).json({ error: 'Invalid workspace id' });
    }
    const ws = await Workspace.findById(workspaceId).populate('members.user', 'name email avatarUrl');
    if (!ws) return res.status(404).json({ error: 'Workspace not found' });
    if (!isWorkspaceMember(ws, req.user.sub)) return res.status(403).json({ error: 'Not a member' });
    const users = ws.members.map((m) => {
      const u = m.user;
      return u
        ? { id: u._id.toString(), name: u.name, email: u.email, avatarUrl: u.avatarUrl }
        : null;
    }).filter(Boolean);
    return res.json({ members: users });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to list members' });
  }
}
