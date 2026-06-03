import mongoose from 'mongoose';

const { Schema } = mongoose;

const PollVoteSchema = new Schema(
  {
    poll: { type: Schema.Types.ObjectId, ref: 'Poll', required: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    options: [{ type: Schema.Types.ObjectId }],
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

PollVoteSchema.index({ poll: 1, user: 1 }, { unique: true });

export const PollVote = mongoose.model('PollVote', PollVoteSchema);
