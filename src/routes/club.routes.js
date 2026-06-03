import { Router } from 'express';
import {
  getClubs, getClub, createClub, updateClub, uploadClubCover,
  joinClub, leaveClub, getClubMembers, getClubPosts,
} from '../controllers/club.controller.js';
import { authenticate, optionalAuth } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';
import { createClubSchema, updateClubSchema } from '../validators/club.validator.js';
import { uploadImage } from '../middleware/upload.js';

const router = Router();

router.get('/', optionalAuth, getClubs);
router.post('/', authenticate, validate(createClubSchema), createClub);
router.get('/:slug', optionalAuth, getClub);
router.patch('/:slug', authenticate, validate(updateClubSchema), updateClub);
router.patch('/:slug/cover', authenticate, uploadImage.single('cover'), uploadClubCover);
router.post('/:slug/join', authenticate, joinClub);
router.post('/:slug/leave', authenticate, leaveClub);
router.get('/:slug/members', getClubMembers);
router.get('/:slug/posts', optionalAuth, getClubPosts);

export default router;
