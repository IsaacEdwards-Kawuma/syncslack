import { isValidUuid } from '../utils/ids.js';
import * as workspaces from '../db/workspaces.js';
import * as channels from '../db/channels.js';
import * as conversations from '../db/conversations.js';

export async function assertChannelAccess(channelId, userId) {
  if (!isValidUuid(channelId)) return { error: 'Invalid channel' };
  const channel = await channels.findChannelById(channelId);
  if (!channel) return { error: 'Channel not found' };
  if (!(await workspaces.isMember(channel.workspace_id, userId))) return { error: 'Forbidden' };
  if (channel.type === 'public') return { channel };
  const mids = await channels.listChannelMemberIds(channelId);
  if (!mids.includes(userId)) return { error: 'Forbidden' };
  return { channel };
}

export async function assertConversationAccess(conversationId, userId) {
  if (!isValidUuid(conversationId)) return { error: 'Invalid conversation' };
  const conv = await conversations.findConversationById(conversationId);
  if (!conv) return { error: 'Conversation not found' };
  const uid = userId.toString();
  if (String(conv.participant_low) !== uid && String(conv.participant_high) !== uid) {
    return { error: 'Forbidden' };
  }
  const ws = await workspaces.findWorkspaceById(conv.workspace_id);
  if (!ws || !(await workspaces.isMember(conv.workspace_id, userId))) return { error: 'Forbidden' };
  return { conversation: conv };
}
