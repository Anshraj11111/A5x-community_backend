import mongoose from 'mongoose';

const { Schema } = mongoose;

const ClubJoinRequestSchema = new Schema(
  {
    club: { type: Schema.Types.ObjectId, ref: 'ProductClub', required: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected'],
      default: 'pending',
    },
    message: { type: String, maxlength: 300 }, // optional note from user
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
  },
  { timestamps: true }
);

// One pending/active request per user per club
ClubJoinRequestSchema.index({ club: 1, user: 1 }, { unique: true });
ClubJoinRequestSchema.index({ club: 1, status: 1 });

export const ClubJoinRequest = mongoose.model('ClubJoinRequest', ClubJoinRequestSchema);
