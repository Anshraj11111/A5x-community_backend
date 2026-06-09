import mongoose from 'mongoose';

const { Schema } = mongoose;

const ProductUpdateSchema = new Schema(
  {
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    content: { type: String, required: true, maxlength: 20000 },
    version: { type: String, required: true, trim: true, maxlength: 20 },
    type: { type: String, enum: ['feature', 'bugfix', 'improvement', 'breaking'], required: true },
    tags: [{ type: String, lowercase: true, trim: true }],
    images: [{ type: String }],
    reactions: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    commentCount: { type: Number, default: 0, min: 0 },
    isPublished: { type: Boolean, default: false },
    publishedAt: { type: Date },
  },
  { timestamps: true }
);

ProductUpdateSchema.index({ isPublished: 1, publishedAt: -1 });

export const ProductUpdate = mongoose.model('ProductUpdate', ProductUpdateSchema);
