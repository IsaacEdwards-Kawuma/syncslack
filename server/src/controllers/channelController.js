import * as channels from '../db/channels.js';
import * as workspaces from '../db/workspaces.js';
import { isValidUuid } from '../utils/ids.js';

async function canAccessChannel(ch, userId) {
  if (!(await workspaces.isMember(ch.workspace_id, userId))) return false;
  if (ch.type === 'public') return true;
  return (ch.member_ids || []).includes(userId);
}

export async function listChannels(req, res) {
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

    const chList = await channels.loadChannelsWithMembers(workspaceId);
    const userId = req.user.sub;
    const visible = [];
    for (const ch of chList) {
      if (await canAccessChannel(ch, userId)) visible.push(channels.formatChannel(ch));
    }
    return res.json({ channels: visible });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to list channels' });
  }
}

export async function createChannel(req, res) {
  try {
    const { workspaceId } = req.params;
    const { name, type, description } = req.body;
    if (!isValidUuid(workspaceId)) {
      return res.status(400).json({ error: 'Invalid workspace id' });
    }
    if (!name?.trim()) return res.status(400).json({ error: 'name is required' });
    const ws = await workspaces.findWorkspaceById(workspaceId);
    if (!ws) return res.status(404).json({ error: 'Workspace not found' });
    if (!(await workspaces.isMember(workspaceId, req.user.sub))) {
      return res.status(403).json({ error: 'Not a member' });
    }

    const chType = type === 'private' ? 'private' : 'public';
    const normalized = name.trim().toLowerCase().replace(/^#/, '');
    const memberIds = chType === 'private' ? [req.user.sub] : [];

    const channel = await channels.createChannel({
      workspaceId,
      name: normalized,
      type: chType,
      description: description || '',
      createdBy: req.user.sub,
      memberIds,
    });
    const mids = await channels.listChannelMemberIds(channel.id);
    return res.status(201).json({ channel: channels.formatChannel({ ...channel, member_ids: mids }) });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'A channel with this name already exists in this workspace' });
    }
    console.error(err);
    return res.status(500).json({ error: 'Failed to create channel' });
  }
}

export async function joinChannel(req, res) {
  try {
    const { channelId } = req.params;
    if (!isValidUuid(channelId)) {
      return res.status(400).json({ error: 'Invalid channel id' });
    }
    const channel = await channels.findChannelById(channelId);
    if (!channel) return res.status(404).json({ error: 'Channel not found' });
    if (!(await workspaces.isMember(channel.workspace_id, req.user.sub))) {
      return res.status(403).json({ error: 'Not allowed' });
    }
    if (channel.type === 'public') {
      const mids = await channels.listChannelMemberIds(channel.id);
      return res.json({ channel: channels.formatChannel({ ...channel, member_ids: mids }), joined: true });
    }
    await channels.addChannelMember(channelId, req.user.sub);
    const mids = await channels.listChannelMemberIds(channel.id);
    return res.json({ channel: channels.formatChannel({ ...channel, member_ids: mids }), joined: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to join channel' });
  }
}

export async function leaveChannel(req, res) {
  try {
    const { channelId } = req.params;
    if (!isValidUuid(channelId)) {
      return res.status(400).json({ error: 'Invalid channel id' });
    }
    const channel = await channels.findChannelById(channelId);
    if (!channel) return res.status(404).json({ error: 'Channel not found' });
    if (channel.type !== 'private') {
      return res.status(400).json({ error: 'Only private channels support leave' });
    }
    await channels.removeChannelMember(channelId, req.user.sub);
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to leave channel' });
  }
}
