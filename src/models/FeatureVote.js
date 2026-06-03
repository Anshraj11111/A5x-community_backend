import mongoose from 'mongoose';

const { Schema } = mongoose;

const FeatureVoteSchema = new Schema(
  {
    featureRequest: { type: Schema.Types.ObjectId, ref: 'FeatureRequest', required: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

FeatureVoteSchema.index({ featureRequest: 1, user: 1 }, { unique: true });

export const FeatureVote = mongoose.model('FeatureVote', FeatureVoteSchema);
