import slugify from '../utils/slugify.js';
import { Workspace } from '../models/Workspace.js';
import { Channel } from '../models/Channel.js';
import mongoose from 'mongoose';

function isMember(workspace, userId) {
  return workspace.members.some((m) => m.user.toString() === userId);
}

export async function createWorkspace(req, res) {
  try {
    const { name, description } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'name is required' });
    const userId = req.user.sub;
    let base = slugify(name);
    let slug = base;
    let n = 0;
    while (await Workspace.findOne({ slug })) {
      n += 1;
      slug = `${base}-${n}`;
    }
    const ws = await Workspace.create({
      name: name.trim(),
      slug,
      description: description || '',
      owner: userId,
      members: [{ user: userId, role: 'owner' }],
    });
    await Channel.create({
      name: 'general',
      workspace: ws._id,
      type: 'public',
      createdBy: userId,
      members: [],
    });
    const populated = await Workspace.findById(ws._id).populate('owner', 'name email avatarUrl');
    return res.status(201).json({ workspace: formatWorkspace(populated) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to create workspace' });
  }
}

export async function listMyWorkspaces(req, res) {
  try {
    const userId = req.user.sub;
    const list = await Workspace.find({ 'members.user': userId })
      .sort({ updatedAt: -1 })
      .populate('owner', 'name email avatarUrl');
    return res.json({ workspaces: list.map(formatWorkspace) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to list workspaces' });
  }
}

export async function getWorkspace(req, res) {
  try {
    const { workspaceId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(workspaceId)) {
      return res.status(400).json({ error: 'Invalid workspace id' });
    }
    const ws = await Workspace.findById(workspaceId).populate('owner', 'name email avatarUrl');
    if (!ws) return res.status(404).json({ error: 'Workspace not found' });
    if (!isMember(ws, req.user.sub)) return res.status(403).json({ error: 'Not a member' });
    return res.json({ workspace: formatWorkspace(ws) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to load workspace' });
  }
}

export async function joinWorkspace(req, res) {
  try {
    const { slug } = req.body;
    if (!slug?.trim()) return res.status(400).json({ error: 'slug is required' });
    const ws = await Workspace.findOne({ slug: slug.trim().toLowerCase() });
    if (!ws) return res.status(404).json({ error: 'Workspace not found' });
    const userId = req.user.sub;
    if (isMember(ws, userId)) {
      return res.json({ workspace: formatWorkspace(ws), alreadyMember: true });
    }
    ws.members.push({ user: userId, role: 'member' });
    await ws.save();
    const populated = await Workspace.findById(ws._id).populate('owner', 'name email avatarUrl');
    return res.json({ workspace: formatWorkspace(populated) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to join workspace' });
  }
}

function formatWorkspace(doc) {
  const o = doc.toObject ? doc.toObject() : doc;
  return {
    id: o._id.toString(),
    name: o.name,
    slug: o.slug,
    description: o.description,
    owner: o.owner
      ? { id: o.owner._id?.toString() || o.owner.toString(), name: o.owner.name, email: o.owner.email, avatarUrl: o.owner.avatarUrl }
      : null,
    members: (o.members || []).map((m) => ({
      userId: m.user.toString(),
      role: m.role,
    })),
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}
