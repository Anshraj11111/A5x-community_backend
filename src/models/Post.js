import mongoose from 'mongoose';

const { Schema } = mongoose;

const PostSchema = new Schema(
  {
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true, minlength: 5, maxlength: 200 },
    slug: { type: String, required: true, unique: true, lowercase: true },
    content: { type: String, required: true, minlength: 10, maxlength: 50000 },
    type: { type: String, enum: ['discussion', 'question', 'announcement'], default: 'discussion' },
    tags: [{ type: String, lowercase: true, trim: true }],
    images: [{ type: String }],
    club: { type: Schema.Types.ObjectId, ref: 'ProductClub' },
    upvotes: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    downvotes: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    voteScore: { type: Number, default: 0 },
    reposts: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    repostCount: { type: Number, default: 0, min: 0 },
    commentCount: { type: Number, default: 0, min: 0 },
    viewCount: { type: Number, default: 0, min: 0 },
    isPinned: { type: Boolean, default: false },
    isLocked: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
    poll: { type: Schema.Types.ObjectId, ref: 'Poll' },
  },
  { timestamps: true }
);

// unique: true on slug already creates the index
PostSchema.index({ author: 1, createdAt: -1 });
PostSchema.index({ tags: 1 });
PostSchema.index({ voteScore: -1 });
PostSchema.index({ createdAt: -1 });
PostSchema.index({ club: 1, createdAt: -1 });
PostSchema.index({ isDeleted: 1, isPinned: -1, createdAt: -1 });

export const Post = mongoose.model('Post', PostSchema);
