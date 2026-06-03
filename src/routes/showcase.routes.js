import { Router } from 'express';
import {
  getShowcasePosts, getShowcasePost, createShowcasePost,
  updateShowcasePost, deleteShowcasePost, upvoteShowcase, featureShowcase,
} from '../controllers/showcase.controller.js';
import { authenticate, optionalAuth } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';

const router = Router();

router.get('/', optionalAuth, getShowcasePosts);
router.post('/', authenticate, createShowcasePost);
router.get('/:id', optionalAuth, getShowcasePost);
router.patch('/:id', authenticate, updateShowcasePost);
router.delete('/:id', authenticate, deleteShowcasePost);
router.post('/:id/upvote', authenticate, upvoteShowcase);
router.post('/:id/feature', authenticate, authorize('admin'), featureShowcase);

export default router;
