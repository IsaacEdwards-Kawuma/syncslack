import slugify from '../utils/slugify.js';
import * as workspaces from '../db/workspaces.js';
import { isValidUuid } from '../utils/ids.js';

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
