import mongoose from 'mongoose';

/**
 * Direct message thread: two users in a workspace.
 * participantLow / participantHigh are sorted ObjectIds for a stable unique key.
 */
const conversationSchema = new mongoose.Schema(
  {
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    participantLow: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    participantHigh: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

conversationSchema.index({ workspace: 1, participantLow: 1, participantHigh: 1 }, { unique: true });

conversationSchema.virtual('participants').get(function getParticipants() {
  return [this.participantLow, this.participantHigh];
});

conversationSchema.methods.getOtherUserId = function getOtherUserId(myUserId) {
  const id = myUserId.toString();
  if (this.participantLow.toString() === id) return this.participantHigh;
  return this.participantLow;
};

/** Sort two user ids into [low, high] for storage */
conversationSchema.statics.sortedPair = function sortedPair(a, b) {
  const sa = a.toString();
  const sb = b.toString();
  return sa < sb ? { participantLow: a, participantHigh: b } : { participantLow: b, participantHigh: a };
};

export const Conversation = mongoose.model('Conversation', conversationSchema);
