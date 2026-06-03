import mongoose from 'mongoose';

const { Schema } = mongoose;

const ClubMemberSchema = new Schema(
  {
    club: { type: Schema.Types.ObjectId, ref: 'ProductClub', required: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['member', 'moderator', 'owner'], default: 'member' },
    joinedAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

ClubMemberSchema.index({ club: 1, user: 1 }, { unique: true });
ClubMemberSchema.index({ user: 1 });

export const ClubMember = mongoose.model('ClubMember', ClubMemberSchema);
