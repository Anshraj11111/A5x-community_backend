import { Notification } from '../models/Notification.js';
import { getIO } from '../socket/index.js';

export const createNotification = async (params) => {
  try {
    if (params.sender && params.sender.toString() === params.recipient.toString()) {
      return;
    }

    const notification = await Notification.create({
      recipient: params.recipient,
      sender: params.sender || null,
      type: params.type,
      entityId: params.entityId,
      entityType: params.entityType,
      message: params.message,
    });

    const populated = await notification.populate([
      { path: 'sender', select: 'username displayName avatarUrl' },
    ]);

    const io = getIO();
    if (io) {
      io.to(`user:${params.recipient}`).emit('notification', populated);

      const unreadCount = await Notification.countDocuments({
        recipient: params.recipient,
        isRead: false,
      });
      io.to(`user:${params.recipient}`).emit('notification_count', { unreadCount });
    }
  } catch (err) {
    console.error('Failed to create notification:', err);
  }
};
