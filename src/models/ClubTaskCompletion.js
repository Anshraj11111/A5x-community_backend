import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * ClubTaskCompletion — tracks which club completed which task.
 * One entry per club per task.
 */
const ClubTaskCompletionSchema = new Schema(
  {
    task: { type: Schema.Types.ObjectId, ref: 'ClubTask', required: true },
    club: { type: Schema.Types.ObjectId, ref: 'ProductClub', required: true },
    completedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true }, // club member who submitted
    note: { type: String, maxlength: 500 }, // optional proof/note
    completedAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

// One completion per club per task
ClubTaskCompletionSchema.index({ task: 1, club: 1 }, { unique: true });
ClubTaskCompletionSchema.index({ club: 1 });

export const ClubTaskCompletion = mongoose.model('ClubTaskCompletion', ClubTaskCompletionSchema);
