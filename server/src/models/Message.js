import mongoose from 'mongoose';

const reactionSchema = new mongoose.Schema(
  {
    emoji: { type: String, required: true },
    users: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  { _id: false }
);

const messageSchema = new mongoose.Schema(
  {
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    channel: { type: mongoose.Schema.Types.ObjectId, ref: 'Channel', index: true },
    conversation: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', index: true },
    content: { type: String, required: true, trim: true, maxlength: 10000 },
    /** Thread: parent message id (only for channel messages) */
    threadParent: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', default: null, index: true },
    reactions: [reactionSchema],
    editedAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null },
    /** Optional attachment (upload path relative to /uploads) */
    attachmentUrl: { type: String, default: '' },
    attachmentMime: { type: String, default: '' },
  },
  { timestamps: true }
);

messageSchema.pre('validate', function validateTarget(next) {
  const hasChannel = !!this.channel;
  const hasConv = !!this.conversation;
  if (hasChannel === hasConv) {
    this.invalidate('channel', 'Message must have exactly one of channel or conversation');
  }
  next();
});

messageSchema.index({ channel: 1, createdAt: 1 });
messageSchema.index({ conversation: 1, createdAt: 1 });
messageSchema.index({ threadParent: 1, createdAt: 1 });

export const Message = mongoose.model('Message', messageSchema);
