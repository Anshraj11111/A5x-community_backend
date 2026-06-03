import mongoose from 'mongoose';

const { Schema } = mongoose;

const FeatureRequestSchema = new Schema(
  {
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true, minlength: 5, maxlength: 200 },
    description: { type: String, required: true, minlength: 20, maxlength: 5000 },
    status: {
      type: String,
      enum: ['open', 'under_review', 'planned', 'in_development', 'released', 'rejected'],
      default: 'open',
    },
    priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    voteCount: { type: Number, default: 0, min: 0 },
    tags: [{ type: String, lowercase: true, trim: true }],
    adminNote: { type: String, maxlength: 2000 },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

FeatureRequestSchema.index({ voteCount: -1 });
FeatureRequestSchema.index({ status: 1, createdAt: -1 });
FeatureRequestSchema.index({ author: 1, createdAt: -1 });

export const FeatureRequest = mongoose.model('FeatureRequest', FeatureRequestSchema);
