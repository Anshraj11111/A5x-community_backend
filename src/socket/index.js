import { Server as SocketServer } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { Notification } from '../models/Notification.js';

let io = null;

export const initSocket = (httpServer) => {
  io = new SocketServer(httpServer, {
    cors: {
      origin: env.CLIENT_URL,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // Auth middleware for socket connections
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;

    if (!token) {
      return next(new Error('Authentication required'));
    }

    try {
      const decoded = jwt.verify(token, env.JWT_SECRET);
      socket.userId = decoded.id;
      socket.userRole = decoded.role;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.userId;

    socket.join(`user:${userId}`);
    console.log(`🔌 Socket connected: ${userId}`);

    Notification.countDocuments({ recipient: userId, isRead: false })
      .then((count) => {
        socket.emit('notification_count', { unreadCount: count });
      })
      .catch(console.error);

    socket.on('mark_read', async ({ notificationId }) => {
      try {
        await Notification.findOneAndUpdate(
          { _id: notificationId, recipient: userId },
          { isRead: true }
        );
        const count = await Notification.countDocuments({ recipient: userId, isRead: false });
        socket.emit('notification_count', { unreadCount: count });
      } catch (err) {
        console.error('mark_read error:', err);
      }
    });

    socket.on('mark_all_read', async () => {
      try {
        await Notification.updateMany({ recipient: userId, isRead: false }, { isRead: true });
        socket.emit('notification_count', { unreadCount: 0 });
      } catch (err) {
        console.error('mark_all_read error:', err);
      }
    });

    socket.on('join_club', ({ clubId }) => {
      socket.join(`club:${clubId}`);
    });

    socket.on('leave_club', ({ clubId }) => {
      socket.leave(`club:${clubId}`);
    });

    socket.on('disconnect', () => {
      console.log(`🔌 Socket disconnected: ${userId}`);
    });
  });

  return io;
};

export const getIO = () => io;
