import mongoose from 'mongoose';

const { Schema } = mongoose;

const CommentSchema = new Schema(
  {
    post: { type: Schema.Types.ObjectId, ref: 'Post', required: true },
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    parent: { type: Schema.Types.ObjectId, ref: 'Comment', default: null },
    content: { type: String, required: true, minlength: 1, maxlength: 10000 },
    upvotes: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    voteScore: { type: Number, default: 0 },
    isDeleted: { type: Boolean, default: false },
    depth: { type: Number, default: 0, min: 0, max: 3 },
  },
  { timestamps: true }
);

CommentSchema.index({ post: 1, parent: 1, createdAt: 1 });
CommentSchema.index({ author: 1, createdAt: -1 });

export const Comment = mongoose.model('Comment', CommentSchema);
