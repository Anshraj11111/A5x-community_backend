import { Router } from 'express';
import {
  getStats, getUsers, banUser, changeUserRole,
  getReports, reviewReport, createBadge, awardBadge,
  broadcastNotification, createFounderAccount, deleteUser,
} from '../controllers/admin.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';

const router = Router();

// All admin routes require authentication
router.use(authenticate);

// Stats — moderator and above
router.get('/stats',                     authorize('moderator'), getStats);

// Users — admin only
router.get('/users',                     authorize('admin'), getUsers);
router.patch('/users/:id/ban',           authorize('admin'), banUser);
router.patch('/users/:id/role',          authorize('admin'), changeUserRole);

// Create privileged accounts (founder/co_founder/admin/moderator) — admin only
router.post('/users/create-privileged',  authorize('admin'), createFounderAccount);
router.delete('/users/:id',              authorize('admin'), deleteUser);

// Reports — moderator and above
router.get('/reports',                   authorize('moderator'), getReports);
router.patch('/reports/:id',             authorize('moderator'), reviewReport);

// Broadcast notification — admin only
router.post('/notifications/broadcast',  authorize('admin'), broadcastNotification);

// Badges — admin only
router.post('/badges',                   authorize('admin'), createBadge);
router.post('/badges/:id/award/:userId', authorize('admin'), awardBadge);

export default router;
