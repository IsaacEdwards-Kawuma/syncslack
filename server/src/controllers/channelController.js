import mongoose from 'mongoose';
import { Channel } from '../models/Channel.js';
import { Workspace } from '../models/Workspace.js';

function isWorkspaceMember(workspace, userId) {
  return workspace.members.some((m) => m.user.toString() === userId);
}

function canAccessChannel(channel, workspace, userId) {
  if (!isWorkspaceMember(workspace, userId)) return false;
  if (channel.type === 'public') return true;
  return channel.members.some((id) => id.toString() === userId);
}

export async function listChannels(req, res) {
  try {
    const { workspaceId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(workspaceId)) {
      return res.status(400).json({ error: 'Invalid workspace id' });
    }
    const ws = await Workspace.findById(workspaceId);
    if (!ws) return res.status(404).json({ error: 'Workspace not found' });
    if (!isWorkspaceMember(ws, req.user.sub)) return res.status(403).json({ error: 'Not a member' });

    const channels = await Channel.find({ workspace: workspaceId }).sort({ name: 1 });
    const userId = req.user.sub;
    const visible = channels.filter((ch) => canAccessChannel(ch, ws, userId));
    return res.json({ channels: visible.map(formatChannel) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to list channels' });
  }
}

export async function createChannel(req, res) {
  try {
    const { workspaceId } = req.params;
    const { name, type, description } = req.body;
    if (!mongoose.Types.ObjectId.isValid(workspaceId)) {
      return res.status(400).json({ error: 'Invalid workspace id' });
    }
    if (!name?.trim()) return res.status(400).json({ error: 'name is required' });
    const ws = await Workspace.findById(workspaceId);
    if (!ws) return res.status(404).json({ error: 'Workspace not found' });
    if (!isWorkspaceMember(ws, req.user.sub)) return res.status(403).json({ error: 'Not a member' });

    const chType = type === 'private' ? 'private' : 'public';
    const normalized = name.trim().toLowerCase().replace(/^#/, '');
    const members =
      chType === 'private' ? [new mongoose.Types.ObjectId(req.user.sub)] : [];

    const channel = await Channel.create({
      name: normalized,
      workspace: workspaceId,
      type: chType,
      description: description || '',
      createdBy: req.user.sub,
      members,
    });
    return res.status(201).json({ channel: formatChannel(channel) });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'A channel with this name already exists in this workspace' });
    }
    console.error(err);
    return res.status(500).json({ error: 'Failed to create channel' });
  }
}

export async function joinChannel(req, res) {
  try {
    const { channelId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(channelId)) {
      return res.status(400).json({ error: 'Invalid channel id' });
    }
    const channel = await Channel.findById(channelId);
    if (!channel) return res.status(404).json({ error: 'Channel not found' });
    const ws = await Workspace.findById(channel.workspace);
    if (!ws || !isWorkspaceMember(ws, req.user.sub)) return res.status(403).json({ error: 'Not allowed' });
    if (channel.type === 'public') {
      return res.json({ channel: formatChannel(channel), joined: true });
    }
    const uid = new mongoose.Types.ObjectId(req.user.sub);
    if (!channel.members.some((id) => id.equals(uid))) {
      channel.members.push(uid);
      await channel.save();
    }
    return res.json({ channel: formatChannel(channel), joined: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to join channel' });
  }
}

export async function leaveChannel(req, res) {
  try {
    const { channelId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(channelId)) {
      return res.status(400).json({ error: 'Invalid channel id' });
    }
    const channel = await Channel.findById(channelId);
    if (!channel) return res.status(404).json({ error: 'Channel not found' });
    if (channel.type !== 'private') {
      return res.status(400).json({ error: 'Only private channels support leave' });
    }
    const uid = req.user.sub;
    channel.members = channel.members.filter((id) => id.toString() !== uid);
    await channel.save();
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to leave channel' });
  }
}

function formatChannel(ch) {
  const o = ch.toObject ? ch.toObject() : ch;
  return {
    id: o._id.toString(),
    name: o.name,
    workspaceId: o.workspace.toString(),
    type: o.type,
    description: o.description,
    memberIds: (o.members || []).map((id) => id.toString()),
    createdAt: o.createdAt,
  };
}
