import { Router } from 'express';
import {
  getUpdates, getUpdate, createUpdate, updateUpdate, deleteUpdate,
  reactUpdate, getUpdateComments, addUpdateComment,
} from '../controllers/productUpdate.controller.js';
import { authenticate, optionalAuth } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { uploadImage } from '../middleware/upload.js';

const router = Router();

router.get('/',    optionalAuth, getUpdates);
router.get('/:id', optionalAuth, getUpdate);

// Reactions & comments — any authenticated user
router.post('/:id/react',          authenticate, reactUpdate);
router.get('/:id/comments',        optionalAuth, getUpdateComments);
router.post('/:id/comments',       authenticate, addUpdateComment);

// Admin / moderator only below
router.post('/',       authenticate, authorize('moderator'), uploadImage.array('images', 5), createUpdate);
router.patch('/:id',   authenticate, authorize('moderator'), uploadImage.array('images', 5), updateUpdate);
router.delete('/:id',  authenticate, authorize('moderator'), deleteUpdate);

export default router;
