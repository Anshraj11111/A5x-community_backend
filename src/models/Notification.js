import mongoose from 'mongoose';

const { Schema } = mongoose;

const NotificationSchema = new Schema(
  {
    recipient: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    sender: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    type: {
      type: String,
      required: true,
      enum: [
        'post_upvote', 'post_comment', 'comment_reply', 'comment_upvote',
        'feature_vote', 'feature_status_change', 'bug_status_change',
        'badge_awarded', 'club_invite', 'club_join', 'mention',
        'product_update', 'system',
      ],
    },
    entityId: { type: Schema.Types.ObjectId, required: true },
    entityType: { type: String, required: true },
    message: { type: String, required: true, maxlength: 500 },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

NotificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });
NotificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 }); // 90 days TTL

export const Notification = mongoose.model('Notification', NotificationSchema);
