import mongoose from 'mongoose';
import { Conversation } from '../models/Conversation.js';
import { Workspace } from '../models/Workspace.js';
import { User } from '../models/User.js';
import { Message } from '../models/Message.js';

function isWorkspaceMember(workspace, userId) {
  return workspace.members.some((m) => m.user.toString() === userId);
}

export async function listConversations(req, res) {
  try {
    const { workspaceId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(workspaceId)) {
      return res.status(400).json({ error: 'Invalid workspace id' });
    }
    const ws = await Workspace.findById(workspaceId);
    if (!ws) return res.status(404).json({ error: 'Workspace not found' });
    if (!isWorkspaceMember(ws, req.user.sub)) return res.status(403).json({ error: 'Not a member' });

    const userId = new mongoose.Types.ObjectId(req.user.sub);
    const convs = await Conversation.find({
      workspace: workspaceId,
      $or: [{ participantLow: userId }, { participantHigh: userId }],
    }).sort({ updatedAt: -1 });

    const otherIds = convs.map((c) => c.getOtherUserId(req.user.sub));
    const users = await User.find({ _id: { $in: otherIds } }).select('name email avatarUrl');
    const userMap = Object.fromEntries(users.map((u) => [u._id.toString(), u]));

    const out = [];
    for (const c of convs) {
      const otherId = c.getOtherUserId(req.user.sub).toString();
      const u = userMap[otherId];
      const last = await Message.findOne({ conversation: c._id, deletedAt: null })
        .sort({ createdAt: -1 })
        .select('content createdAt');
      out.push({
        id: c._id.toString(),
        workspaceId: c.workspace.toString(),
        otherUser: u
          ? { id: u._id.toString(), name: u.name, email: u.email, avatarUrl: u.avatarUrl }
          : { id: otherId, name: 'Unknown' },
        lastMessage: last ? { content: last.content, createdAt: last.createdAt } : null,
        updatedAt: c.updatedAt,
      });
    }
    return res.json({ conversations: out });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to list conversations' });
  }
}

export async function getOrCreateConversation(req, res) {
  try {
    const { workspaceId } = req.params;
    const { otherUserId } = req.body;
    if (!mongoose.Types.ObjectId.isValid(workspaceId) || !mongoose.Types.ObjectId.isValid(otherUserId)) {
      return res.status(400).json({ error: 'Invalid ids' });
    }
    if (otherUserId === req.user.sub) {
      return res.status(400).json({ error: 'Cannot DM yourself' });
    }
    const ws = await Workspace.findById(workspaceId);
    if (!ws) return res.status(404).json({ error: 'Workspace not found' });
    if (!isWorkspaceMember(ws, req.user.sub) || !isWorkspaceMember(ws, otherUserId)) {
      return res.status(403).json({ error: 'Both users must be in the workspace' });
    }

    const pair = Conversation.sortedPair(new mongoose.Types.ObjectId(req.user.sub), new mongoose.Types.ObjectId(otherUserId));
    let conv = await Conversation.findOne({ workspace: workspaceId, ...pair });
    if (!conv) {
      try {
        conv = await Conversation.create({ workspace: workspaceId, ...pair });
      } catch (e) {
        if (e.code === 11000) {
          conv = await Conversation.findOne({ workspace: workspaceId, ...pair });
        } else throw e;
      }
    }
    const other = await User.findById(conv.getOtherUserId(req.user.sub)).select('name email avatarUrl');
    return res.json({
      conversation: {
        id: conv._id.toString(),
        workspaceId: conv.workspace.toString(),
        otherUser: other
          ? { id: other._id.toString(), name: other.name, email: other.email, avatarUrl: other.avatarUrl }
          : null,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to open conversation' });
  }
}
