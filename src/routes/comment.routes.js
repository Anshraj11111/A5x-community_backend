import { Router } from 'express';
import { createComment, updateComment, deleteComment, upvoteComment } from '../controllers/comment.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';
import { createCommentSchema, updateCommentSchema } from '../validators/comment.validator.js';

const router = Router();

router.post('/', authenticate, validate(createCommentSchema), createComment);
router.patch('/:id', authenticate, validate(updateCommentSchema), updateComment);
router.delete('/:id', authenticate, deleteComment);
router.post('/:id/upvote', authenticate, upvoteComment);

export default router;
