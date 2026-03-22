import * as channels from '../db/channels.js';
import * as workspaces from '../db/workspaces.js';
import * as channelPrefs from '../db/channelPrefs.js';
import * as webhooks from '../db/webhooks.js';
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

export async function getChannelNotificationPref(req, res) {
  try {
    const { channelId } = req.params;
    if (!isValidUuid(channelId)) return res.status(400).json({ error: 'Invalid channel id' });
    const channel = await channels.findChannelById(channelId);
    if (!channel) return res.status(404).json({ error: 'Channel not found' });
    if (!(await canAccessChannel(channel, req.user.sub))) return res.status(403).json({ error: 'Not allowed' });
    const level = await channelPrefs.getLevel(req.user.sub, channelId);
    return res.json({ level });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to load preference' });
  }
}

export async function setChannelNotificationPref(req, res) {
  try {
    const { channelId } = req.params;
    const { level } = req.body;
    if (!isValidUuid(channelId)) return res.status(400).json({ error: 'Invalid channel id' });
    if (!['all', 'mentions', 'mute'].includes(level)) {
      return res.status(400).json({ error: 'level must be all, mentions, or mute' });
    }
    const channel = await channels.findChannelById(channelId);
    if (!channel) return res.status(404).json({ error: 'Channel not found' });
    if (!(await canAccessChannel(channel, req.user.sub))) return res.status(403).json({ error: 'Not allowed' });
    const next = await channelPrefs.setLevel(req.user.sub, channelId, level);
    return res.json({ level: next });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to save preference' });
  }
}

export async function createWebhookForChannel(req, res) {
  try {
    const { channelId } = req.params;
    const { name } = req.body;
    if (!isValidUuid(channelId)) return res.status(400).json({ error: 'Invalid channel id' });
    const channel = await channels.findChannelById(channelId);
    if (!channel) return res.status(404).json({ error: 'Channel not found' });
    if (!(await canAccessChannel(channel, req.user.sub))) return res.status(403).json({ error: 'Not allowed' });
    const hook = await webhooks.create({
      workspaceId: channel.workspace_id,
      channelId,
      name,
      createdBy: req.user.sub,
    });
    return res.status(201).json({
      ok: true,
      id: hook.id,
      token: hook.secret_token,
      url: `/api/webhooks/incoming/${hook.secret_token}`,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to create webhook' });
  }
}

export async function listWebhooksForChannel(req, res) {
  try {
    const { channelId } = req.params;
    if (!isValidUuid(channelId)) return res.status(400).json({ error: 'Invalid channel id' });
    const channel = await channels.findChannelById(channelId);
    if (!channel) return res.status(404).json({ error: 'Channel not found' });
    if (!(await canAccessChannel(channel, req.user.sub))) return res.status(403).json({ error: 'Not allowed' });
    const rows = await webhooks.listForChannel(channelId);
    return res.json({ webhooks: rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to list webhooks' });
  }
}

export async function deleteWebhookForChannel(req, res) {
  try {
    const { channelId, webhookId } = req.params;
    if (!isValidUuid(channelId) || !isValidUuid(webhookId)) return res.status(400).json({ error: 'Invalid id' });
    const channel = await channels.findChannelById(channelId);
    if (!channel) return res.status(404).json({ error: 'Channel not found' });
    if (!(await canAccessChannel(channel, req.user.sub))) return res.status(403).json({ error: 'Not allowed' });
    const ok = await webhooks.deleteWebhook(webhookId, req.user.sub);
    if (!ok) return res.status(404).json({ error: 'Webhook not found' });
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to delete webhook' });
  }
}
