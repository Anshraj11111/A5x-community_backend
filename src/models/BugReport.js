import mongoose from 'mongoose';

const { Schema } = mongoose;

const BugReportSchema = new Schema(
  {
    reporter: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true, minlength: 5, maxlength: 200 },
    description: { type: String, required: true, minlength: 20, maxlength: 5000 },
    steps: { type: String, maxlength: 3000 },
    severity: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
    status: {
      type: String,
      enum: ['reported', 'confirmed', 'investigating', 'fixed', 'released'],
      default: 'reported',
    },
    attachments: [{ type: String }],
    adminNote: { type: String, maxlength: 2000 },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

BugReportSchema.index({ status: 1, severity: -1, createdAt: -1 });
BugReportSchema.index({ reporter: 1, createdAt: -1 });

export const BugReport = mongoose.model('BugReport', BugReportSchema);
