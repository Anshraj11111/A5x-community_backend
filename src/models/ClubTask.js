import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * ClubTask — a challenge/task created by the founder.
 * All clubs compete to complete it. Points awarded to the club that completes it.
 */
const ClubTaskSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, required: true, maxlength: 1000 },
    points: { type: Number, default: 50, min: 1 },
    // If linked to a championship season — points go toward that season's leaderboard
    season: { type: Schema.Types.ObjectId, ref: 'ChampionshipSeason' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    dueDate: { type: Date },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

ClubTaskSchema.index({ isActive: 1, createdAt: -1 });

export const ClubTask = mongoose.model('ClubTask', ClubTaskSchema);
