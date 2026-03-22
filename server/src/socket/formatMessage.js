export function formatMessageDoc(m) {
  const o = m.toObject ? m.toObject() : m;
  const sender = o.sender;
  return {
    id: o._id.toString(),
    senderId: sender?._id?.toString() || o.sender?.toString(),
    sender: sender
      ? { id: sender._id.toString(), name: sender.name, email: sender.email, avatarUrl: sender.avatarUrl }
      : null,
    channelId: o.channel ? o.channel.toString() : null,
    conversationId: o.conversation ? o.conversation.toString() : null,
    content: o.content,
    createdAt: o.createdAt,
    editedAt: o.editedAt,
    deletedAt: o.deletedAt,
    threadParentId: o.threadParent ? o.threadParent.toString() : null,
    reactions: (o.reactions || []).map((r) => ({
      emoji: r.emoji,
      userIds: (r.users || []).map((id) => id.toString()),
    })),
    attachmentUrl: o.attachmentUrl || '',
    attachmentMime: o.attachmentMime || '',
  };
}
