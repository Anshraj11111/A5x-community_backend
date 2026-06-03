import mongoose from 'mongoose';

const { Schema } = mongoose;

const ShowcasePostSchema = new Schema(
  {
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true, minlength: 5, maxlength: 200 },
    description: { type: String, required: true, minlength: 20, maxlength: 5000 },
    images: [{ type: String }],
    tags: [{ type: String, lowercase: true, trim: true }],
    links: {
      live: { type: String },
      github: { type: String },
      demo: { type: String },
    },
    upvotes: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    voteScore: { type: Number, default: 0 },
    commentCount: { type: Number, default: 0, min: 0 },
    isFeatured: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

ShowcasePostSchema.index({ voteScore: -1 });
ShowcasePostSchema.index({ isFeatured: 1, createdAt: -1 });
ShowcasePostSchema.index({ author: 1, createdAt: -1 });

export const ShowcasePost = mongoose.model('ShowcasePost', ShowcasePostSchema);
