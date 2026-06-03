import { Router } from 'express';
import {
  getUpdates, getUpdate, createUpdate, updateUpdate, deleteUpdate,
} from '../controllers/productUpdate.controller.js';
import { authenticate, optionalAuth } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';

const router = Router();

router.get('/',    optionalAuth, getUpdates);
router.get('/:id', optionalAuth, getUpdate);

// Admin / moderator only below
router.post('/',       authenticate, authorize('moderator'), createUpdate);
router.patch('/:id',   authenticate, authorize('moderator'), updateUpdate);
router.delete('/:id',  authenticate, authorize('moderator'), deleteUpdate);

export default router;
