import mongoose from 'mongoose';

const { Schema } = mongoose;

const UserSchema = new Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      minlength: 3,
      maxlength: 30,
      match: /^[a-z0-9_-]+$/,
    },
    displayName: { type: String, required: true, trim: true, maxlength: 50 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false },
    avatarUrl: { type: String },
    coverImageUrl: { type: String },
    bio: { type: String, maxlength: 300 },
    role: { type: String, enum: ['user', 'moderator', 'admin', 'founder', 'co_founder'], default: 'user' },
    badges: [{ type: Schema.Types.ObjectId, ref: 'Badge' }],
    reputation: { type: Number, default: 0, min: 0 },
    isVerified: { type: Boolean, default: false },
    isBanned: { type: Boolean, default: false },
    banReason: { type: String },
    socialLinks: {
      twitter: { type: String },
      github: { type: String },
      website: { type: String },
    },
    preferences: {
      emailNotifications: { type: Boolean, default: true },
      pushNotifications: { type: Boolean, default: true },
    },
  },
  { timestamps: true }
);

// unique: true already creates indexes for username and email
UserSchema.index({ reputation: -1 });

export const User = mongoose.model('User', UserSchema);
