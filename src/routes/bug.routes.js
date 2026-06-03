import { Router } from 'express';
import { getBugs, getBug, createBug, updateBugStatus, deleteBug } from '../controllers/bug.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';

const router = Router();

router.get('/', authenticate, getBugs);
router.post('/', authenticate, createBug);
router.get('/:id', authenticate, getBug);
router.patch('/:id/status', authenticate, authorize('admin'), updateBugStatus);
router.delete('/:id', authenticate, deleteBug);

export default router;
