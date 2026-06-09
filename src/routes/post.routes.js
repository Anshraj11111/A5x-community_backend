import { Router } from 'express';
import {
  getPosts, getPost, createPost, updatePost, deletePost,
  votePost, pinPost, lockPost, getPostComments, repostPost,
} from '../controllers/post.controller.js';
import { authenticate, optionalAuth } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { createPostSchema, updatePostSchema } from '../validators/post.validator.js';

const router = Router();

router.get('/', optionalAuth, getPosts);
router.post('/', authenticate, validate(createPostSchema), createPost);
router.get('/:id', optionalAuth, getPost);
router.patch('/:id', authenticate, validate(updatePostSchema), updatePost);
router.delete('/:id', authenticate, deletePost);
router.post('/:id/upvote', authenticate, (req, _res, next) => { req.params.voteType = 'upvote'; next(); }, votePost);
router.post('/:id/downvote', authenticate, (req, _res, next) => { req.params.voteType = 'downvote'; next(); }, votePost);
router.post('/:id/repost', authenticate, repostPost);
router.post('/:id/pin', authenticate, authorize('admin'), pinPost);
router.post('/:id/lock', authenticate, authorize('moderator'), lockPost);
router.get('/:id/comments', optionalAuth, getPostComments);

export default router;
