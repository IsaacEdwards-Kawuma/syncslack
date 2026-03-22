import mongoose from 'mongoose';
import { Workspace } from '../models/Workspace.js';
import { Channel } from '../models/Channel.js';
import { Conversation } from '../models/Conversation.js';

export function isWorkspaceMember(workspace, userId) {
  return workspace.members.some((m) => m.user.toString() === userId);
}

export function canAccessChannel(channel, workspace, userId) {
  if (!isWorkspaceMember(workspace, userId)) return false;
  if (channel.type === 'public') return true;
  return channel.members.some((id) => id.toString() === userId);
}

export async function assertChannelAccess(channelId, userId) {
  if (!mongoose.Types.ObjectId.isValid(channelId)) return { error: 'Invalid channel' };
  const channel = await Channel.findById(channelId);
  if (!channel) return { error: 'Channel not found' };
  const ws = await Workspace.findById(channel.workspace);
  if (!ws || !canAccessChannel(channel, ws, userId)) return { error: 'Forbidden' };
  return { channel, workspace: ws };
}

export async function assertConversationAccess(conversationId, userId) {
  if (!mongoose.Types.ObjectId.isValid(conversationId)) return { error: 'Invalid conversation' };
  const conv = await Conversation.findById(conversationId);
  if (!conv) return { error: 'Conversation not found' };
  const uid = userId.toString();
  if (conv.participantLow.toString() !== uid && conv.participantHigh.toString() !== uid) {
    return { error: 'Forbidden' };
  }
  const ws = await Workspace.findById(conv.workspace);
  if (!ws || !isWorkspaceMember(ws, userId)) return { error: 'Forbidden' };
  return { conversation: conv, workspace: ws };
}
