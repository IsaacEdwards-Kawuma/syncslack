/** Normalizes message payloads from the DB layer for Socket.IO (same shape as REST). */
export function formatMessageDoc(m) {
  if (!m || !m.id) return null;
  return {
    id: m.id,
    senderId: m.senderId,
    sender: m.sender,
    channelId: m.channelId ?? null,
    conversationId: m.conversationId ?? null,
    content: m.content,
    createdAt: m.createdAt,
    editedAt: m.editedAt,
    deletedAt: m.deletedAt,
    threadParentId: m.threadParentId ?? null,
    alsoToChannel: Boolean(m.alsoToChannel),
    reactions: m.reactions || [],
    attachmentUrl: m.attachmentUrl || '',
    attachmentMime: m.attachmentMime || '',
    attachments: m.attachments || [],
  };
}
