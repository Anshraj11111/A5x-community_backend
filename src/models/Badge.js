import mongoose from 'mongoose';

const { Schema } = mongoose;

const BadgeSchema = new Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true },
    description: { type: String, required: true },
    icon: { type: String, required: true },
    color: { type: String, required: true, default: '#00FF88' },
    tier: { type: String, enum: ['bronze', 'silver', 'gold', 'platinum'], required: true },
    criteria: { type: String, required: true },
    isAutomatic: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const Badge = mongoose.model('Badge', BadgeSchema);
