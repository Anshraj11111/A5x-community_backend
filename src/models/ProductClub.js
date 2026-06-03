import mongoose from 'mongoose';

const { Schema } = mongoose;

const ProductClubSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 50 },
    slug: { type: String, required: true, unique: true, lowercase: true },
    description: { type: String, required: true, minlength: 10, maxlength: 1000 },
    coverImage: { type: String },
    icon: { type: String },
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    memberCount: { type: Number, default: 1, min: 0 },
    postCount: { type: Number, default: 0, min: 0 },
    isPrivate: { type: Boolean, default: false },
    tags: [{ type: String, lowercase: true, trim: true }],
    rules: [{ type: String, maxlength: 200 }],
  },
  { timestamps: true }
);

// unique: true on slug already creates the index
ProductClubSchema.index({ memberCount: -1 });

export const ProductClub = mongoose.model('ProductClub', ProductClubSchema);
