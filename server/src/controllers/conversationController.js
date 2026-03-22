import * as conversations from '../db/conversations.js';
import * as workspaces from '../db/workspaces.js';
import * as users from '../db/users.js';
import * as messages from '../db/messages.js';
import { isValidUuid } from '../utils/ids.js';

function formatPeer(u) {
  return u
    ? { id: u.id, name: u.name, email: u.email, avatarUrl: u.avatar_url || '' }
    : { id: '', name: 'Unknown' };
}

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
    const out = [];
    for (const c of convs) {
      const last = await messages.lastMessagePreview(c.id);
      if (c.kind === 'group') {
        const memberIds = await conversations.listConversationMemberIds(c.id);
        const userRows = await users.findUsersByIds(memberIds);
        out.push({
          id: c.id,
          workspaceId: c.workspace_id,
          kind: 'group',
          title: c.title || 'Group',
          participants: userRows.map(formatPeer),
          lastMessage: last ? { content: last.content, createdAt: last.created_at } : null,
          updatedAt: c.updated_at,
        });
      } else {
        const otherId = conversations.getOtherParticipantId(c, req.user.sub);
        const other = otherId ? await users.findUserById(otherId) : null;
        out.push({
          id: c.id,
          workspaceId: c.workspace_id,
          kind: 'direct',
          otherUser: formatPeer(other),
          lastMessage: last ? { content: last.content, createdAt: last.created_at } : null,
          updatedAt: c.updated_at,
        });
      }
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
        kind: 'direct',
        otherUser: formatPeer(other),
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to open conversation' });
  }
}

export async function createGroupConversationHandler(req, res) {
  try {
    const { workspaceId } = req.params;
    const { memberIds, title } = req.body;
    if (!isValidUuid(workspaceId)) {
      return res.status(400).json({ error: 'Invalid workspace id' });
    }
    if (!Array.isArray(memberIds) || memberIds.length < 1) {
      return res.status(400).json({ error: 'memberIds must include at least one other user' });
    }
    const ws = await workspaces.findWorkspaceById(workspaceId);
    if (!ws) return res.status(404).json({ error: 'Workspace not found' });
    if (!(await workspaces.isMember(workspaceId, req.user.sub))) {
      return res.status(403).json({ error: 'Not a member' });
    }
    for (const uid of memberIds) {
      if (!isValidUuid(uid)) return res.status(400).json({ error: 'Invalid member id' });
      if (!(await workspaces.isMember(workspaceId, uid))) {
        return res.status(403).json({ error: 'All members must be in the workspace' });
      }
    }
    const conv = await conversations.createGroupConversation(workspaceId, req.user.sub, memberIds, title);
    const memberList = await conversations.listConversationMemberIds(conv.id);
    const userRows = await users.findUsersByIds(memberList);
    return res.status(201).json({
      conversation: {
        id: conv.id,
        workspaceId: conv.workspace_id,
        kind: 'group',
        title: conv.title || 'Group',
        participants: userRows.map(formatPeer),
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || 'Failed to create group' });
  }
}
