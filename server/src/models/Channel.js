import mongoose from 'mongoose';

const channelSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    type: { type: String, enum: ['public', 'private'], default: 'public' },
    description: { type: String, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    /** Private channels: explicit members. Public: anyone in workspace can read. */
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
);

channelSchema.index({ workspace: 1, name: 1 }, { unique: true });

export const Channel = mongoose.model('Channel', channelSchema);
