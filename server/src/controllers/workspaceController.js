import slugify from '../utils/slugify.js';
import * as workspaces from '../db/workspaces.js';
import * as invites from '../db/invites.js';
import * as audit from '../db/audit.js';
import {
  searchWorkspaceMessages,
  searchWorkspaceChannels,
  searchWorkspacePeople,
} from '../db/search.js';
import { publicAppBaseUrl } from '../utils/mail.js';
import { isValidUuid } from '../utils/ids.js';

async function canManageWorkspace(workspaceId, userId) {
  const role = await workspaces.getMemberRole(workspaceId, userId);
  return role === 'owner' || role === 'admin';
}

export async function createWorkspace(req, res) {
  try {
    const { name, description } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'name is required' });
    const userId = req.user.sub;
    let base = slugify(name);
    let slug = base;
    let n = 0;
    while (await workspaces.workspaceExistsBySlug(slug)) {
      n += 1;
      slug = `${base}-${n}`;
    }
    const created = await workspaces.createWorkspaceWithGeneral({
      name,
      description,
      slug,
      ownerId: userId,
    });
    const full = await workspaces.findWorkspaceById(created.id);
    const members = await workspaces.listMembers(created.id);
    return res.status(201).json({ workspace: workspaces.formatWorkspace(full, members) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to create workspace' });
  }
}

export async function listMyWorkspaces(req, res) {
  try {
    const userId = req.user.sub;
    const list = await workspaces.listWorkspacesForUser(userId);
    const out = [];
    for (const row of list) {
      const members = await workspaces.listMembers(row.id);
      out.push(workspaces.formatWorkspace(row, members));
    }
    return res.json({ workspaces: out });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to list workspaces' });
  }
}

export async function getWorkspace(req, res) {
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
    return res.json({ workspace: workspaces.formatWorkspace(ws, members) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to load workspace' });
  }
}

export async function joinWorkspace(req, res) {
  try {
    const { slug } = req.body;
    if (!slug?.trim()) return res.status(400).json({ error: 'slug is required' });
    const ws = await workspaces.findWorkspaceBySlug(slug);
    if (!ws) return res.status(404).json({ error: 'Workspace not found' });
    const userId = req.user.sub;
    if (await workspaces.isMember(ws.id, userId)) {
      const members = await workspaces.listMembers(ws.id);
      return res.json({ workspace: workspaces.formatWorkspace(ws, members), alreadyMember: true });
    }
    await workspaces.addMember(ws.id, userId, 'member');
    const full = await workspaces.findWorkspaceById(ws.id);
    const members = await workspaces.listMembers(ws.id);
    return res.json({ workspace: workspaces.formatWorkspace(full, members) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to join workspace' });
  }
}

export async function joinByInvite(req, res) {
  try {
    const { token } = req.body;
    if (!token?.trim()) return res.status(400).json({ error: 'token is required' });
    const inv = await invites.findValidInviteByToken(token.trim());
    if (!inv) return res.status(404).json({ error: 'Invalid or expired invite' });
    const userId = req.user.sub;
    const ws = await workspaces.findWorkspaceById(inv.workspace_id);
    if (!ws) return res.status(404).json({ error: 'Workspace not found' });
    if (await workspaces.isMember(ws.id, userId)) {
      const members = await workspaces.listMembers(ws.id);
      return res.json({ workspace: workspaces.formatWorkspace(ws, members), alreadyMember: true });
    }
    await workspaces.addMember(ws.id, userId, inv.role);
    await audit.logAction({
      workspaceId: ws.id,
      actorId: userId,
      action: 'member_joined_invite',
      meta: { inviteId: inv.id },
    });
    const full = await workspaces.findWorkspaceById(ws.id);
    const members = await workspaces.listMembers(ws.id);
    return res.json({ workspace: workspaces.formatWorkspace(full, members) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to join workspace' });
  }
}

export async function createWorkspaceInvite(req, res) {
  try {
    const { workspaceId } = req.params;
    const { role } = req.body;
    if (!isValidUuid(workspaceId)) return res.status(400).json({ error: 'Invalid workspace id' });
    const r = role === 'admin' ? 'admin' : 'member';
    if (!(await canManageWorkspace(workspaceId, req.user.sub))) {
      return res.status(403).json({ error: 'Admin or owner required' });
    }
    const row = await invites.createInvite({
      workspaceId,
      invitedBy: req.user.sub,
      role: r,
      ttlDays: 14,
    });
    const base = publicAppBaseUrl();
    return res.status(201).json({
      token: row.token,
      expiresAt: row.expires_at,
      inviteUrl: `${base}/?invite=${encodeURIComponent(row.token)}`,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to create invite' });
  }
}

export async function searchWorkspace(req, res) {
  try {
    const { workspaceId } = req.params;
    const q = req.query.q;
    const type = (req.query.type || 'messages').toLowerCase();
    if (!isValidUuid(workspaceId)) return res.status(400).json({ error: 'Invalid workspace id' });
    if (!q || String(q).trim().length < 1) {
      return res.json({ results: [], type });
    }
    if (!(await workspaces.isMember(workspaceId, req.user.sub))) {
      return res.status(403).json({ error: 'Not a member' });
    }
    const trimmed = String(q).trim();
    if (type === 'channels') {
      const results = await searchWorkspaceChannels(workspaceId, req.user.sub, trimmed, 30);
      return res.json({ results, type: 'channels' });
    }
    if (type === 'people' || type === 'members') {
      const results = await searchWorkspacePeople(workspaceId, trimmed, 30);
      return res.json({ results, type: 'people' });
    }
    if (trimmed.length < 2) {
      return res.json({ results: [], type: 'messages' });
    }
    const results = await searchWorkspaceMessages(workspaceId, req.user.sub, trimmed, 40);
    return res.json({ results, type: 'messages' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Search failed' });
  }
}

export async function leaveWorkspace(req, res) {
  try {
    const { workspaceId } = req.params;
    if (!isValidUuid(workspaceId)) return res.status(400).json({ error: 'Invalid workspace id' });
    const userId = req.user.sub;
    const role = await workspaces.getMemberRole(workspaceId, userId);
    if (!role) return res.status(404).json({ error: 'Not a member' });
    if (role === 'owner') {
      return res.status(400).json({ error: 'Transfer ownership before leaving' });
    }
    await workspaces.removeMember(workspaceId, userId);
    await audit.logAction({
      workspaceId,
      actorId: userId,
      action: 'member_left',
      meta: {},
    });
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to leave' });
  }
}

export async function transferWorkspaceOwnership(req, res) {
  try {
    const { workspaceId } = req.params;
    const { newOwnerUserId } = req.body;
    if (!isValidUuid(workspaceId) || !isValidUuid(newOwnerUserId)) {
      return res.status(400).json({ error: 'Invalid id' });
    }
    const ok = await workspaces.transferOwnership(workspaceId, req.user.sub, newOwnerUserId);
    if (!ok) return res.status(400).json({ error: 'Transfer failed' });
    await audit.logAction({
      workspaceId,
      actorId: req.user.sub,
      action: 'ownership_transferred',
      meta: { newOwnerUserId },
    });
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Transfer failed' });
  }
}

export async function updateWorkspaceMember(req, res) {
  try {
    const { workspaceId, memberUserId } = req.params;
    const { role } = req.body;
    if (!isValidUuid(workspaceId) || !isValidUuid(memberUserId)) {
      return res.status(400).json({ error: 'Invalid id' });
    }
    if (!['admin', 'member'].includes(role)) {
      return res.status(400).json({ error: 'role must be admin or member' });
    }
    if (!(await canManageWorkspace(workspaceId, req.user.sub))) {
      return res.status(403).json({ error: 'Admin or owner required' });
    }
    const targetRole = await workspaces.getMemberRole(workspaceId, memberUserId);
    if (!targetRole) return res.status(404).json({ error: 'Member not found' });
    if (targetRole === 'owner') return res.status(400).json({ error: 'Cannot change owner role' });
    const actorRole = await workspaces.getMemberRole(workspaceId, req.user.sub);
    if (actorRole === 'admin' && targetRole === 'admin') {
      return res.status(403).json({ error: 'Only owner can change admins' });
    }
    await workspaces.updateMemberRole(workspaceId, memberUserId, role);
    await audit.logAction({
      workspaceId,
      actorId: req.user.sub,
      action: 'member_role_updated',
      meta: { memberUserId, role },
    });
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Update failed' });
  }
}

export async function removeWorkspaceMember(req, res) {
  try {
    const { workspaceId, memberUserId } = req.params;
    if (!isValidUuid(workspaceId) || !isValidUuid(memberUserId)) {
      return res.status(400).json({ error: 'Invalid id' });
    }
    if (memberUserId === req.user.sub) {
      return res.status(400).json({ error: 'Use leave workspace instead' });
    }
    if (!(await canManageWorkspace(workspaceId, req.user.sub))) {
      return res.status(403).json({ error: 'Admin or owner required' });
    }
    const targetRole = await workspaces.getMemberRole(workspaceId, memberUserId);
    if (!targetRole) return res.status(404).json({ error: 'Member not found' });
    if (targetRole === 'owner') return res.status(400).json({ error: 'Cannot remove owner' });
    const actorRole = await workspaces.getMemberRole(workspaceId, req.user.sub);
    if (actorRole === 'admin' && targetRole === 'admin') {
      return res.status(403).json({ error: 'Only owner can remove an admin' });
    }
    await workspaces.removeMember(workspaceId, memberUserId);
    await audit.logAction({
      workspaceId,
      actorId: req.user.sub,
      action: 'member_removed',
      meta: { memberUserId },
    });
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Remove failed' });
  }
}

export async function listWorkspaceAudit(req, res) {
  try {
    const { workspaceId } = req.params;
    if (!isValidUuid(workspaceId)) return res.status(400).json({ error: 'Invalid workspace id' });
    if (!(await canManageWorkspace(workspaceId, req.user.sub))) {
      return res.status(403).json({ error: 'Admin or owner required' });
    }
    const rows = await audit.listForWorkspace(workspaceId, 200);
    return res.json({ audit: rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to load audit log' });
  }
}
