import { Router } from 'express';
import {
  getAllTasks,
  getTaskCompletions,
  completeTask,
  createTask,
  updateTask,
  deleteTask,
} from '../controllers/clubTask.controller.js';
import { authenticate, optionalAuth } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';

const router = Router();

// Public — all active tasks (enriched with club completions)
router.get('/', optionalAuth, getAllTasks);

// Public — who completed a specific task
router.get('/:taskId/completions', getTaskCompletions);

// Authenticated user — mark task complete for their club
router.post('/:taskId/complete', authenticate, completeTask);

// Founder / admin only — CRUD
router.post('/', authenticate, authorize('founder'), createTask);
router.patch('/:taskId', authenticate, authorize('founder'), updateTask);
router.delete('/:taskId', authenticate, authorize('founder'), deleteTask);

export default router;
