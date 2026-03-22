import * as conversations from '../db/conversations.js';
import * as workspaces from '../db/workspaces.js';
import * as users from '../db/users.js';
import * as messages from '../db/messages.js';
import { isValidUuid } from '../utils/ids.js';

export async function listConversations(req, res) {
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

    const convs = await conversations.listConversationsForUser(workspaceId, req.user.sub);
    const otherIds = convs.map((c) => conversations.getOtherParticipantId(c, req.user.sub));
    const userRows = await users.findUsersByIds(otherIds);
    const userMap = Object.fromEntries(userRows.map((u) => [u.id, u]));

    const out = [];
    for (const c of convs) {
      const otherId = conversations.getOtherParticipantId(c, req.user.sub);
      const u = userMap[otherId];
      const last = await messages.lastMessagePreview(c.id);
      out.push({
        id: c.id,
        workspaceId: c.workspace_id,
        otherUser: u
          ? { id: u.id, name: u.name, email: u.email, avatarUrl: u.avatar_url || '' }
          : { id: otherId, name: 'Unknown' },
        lastMessage: last ? { content: last.content, createdAt: last.created_at } : null,
        updatedAt: c.updated_at,
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
    if (!isValidUuid(workspaceId) || !isValidUuid(otherUserId)) {
      return res.status(400).json({ error: 'Invalid ids' });
    }
    if (otherUserId === req.user.sub) {
      return res.status(400).json({ error: 'Cannot DM yourself' });
    }
    const ws = await workspaces.findWorkspaceById(workspaceId);
    if (!ws) return res.status(404).json({ error: 'Workspace not found' });
    if (!(await workspaces.isMember(workspaceId, req.user.sub))) {
      return res.status(403).json({ error: 'Both users must be in the workspace' });
    }
    if (!(await workspaces.isMember(workspaceId, otherUserId))) {
      return res.status(403).json({ error: 'Both users must be in the workspace' });
    }

    const conv = await conversations.createConversation(workspaceId, req.user.sub, otherUserId);
    const other = await users.findUserById(conversations.getOtherParticipantId(conv, req.user.sub));
    return res.json({
      conversation: {
        id: conv.id,
        workspaceId: conv.workspace_id,
        otherUser: other
          ? { id: other.id, name: other.name, email: other.email, avatarUrl: other.avatar_url || '' }
          : null,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to open conversation' });
  }
}
