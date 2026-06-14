import { Router } from 'express';
import {
  getClubs,
  getClub,
  createClub,
  updateClub,
  deleteClub,
  uploadClubCover,
  uploadClubIcon,
  requestJoinClub,
  leaveClub,
  getClubMembers,
  getClubPosts,
  getJoinRequests,
  handleJoinRequest,
  getAllPendingRequests,
  updateMemberRole,
} from '../controllers/club.controller.js';
import { authenticate, optionalAuth } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { createClubSchema, updateClubSchema } from '../validators/club.validator.js';
import { uploadImage } from '../middleware/upload.js';

const router = Router();

// ── IMPORTANT: Static/literal routes MUST come before /:slug wildcard routes ──

// ── List all clubs ───────────────────────────────────────────────────────────
router.get('/', optionalAuth, getClubs);

// ── Founder/moderator view — pending requests (founder=all clubs, moderator=their clubs) ──
router.get('/join-requests/all', authenticate, getAllPendingRequests);
// ── Create club — founder/admin only ─────────────────────────────────────────
router.post(
  '/',
  authenticate,
  authorize('founder'),
  validate(createClubSchema),
  createClub
);

// ── Single club — by slug (wildcard, must come after all static routes) ───────
router.get('/:slug', optionalAuth, getClub);
router.get('/:slug/members', optionalAuth, getClubMembers);
router.get('/:slug/posts', optionalAuth, getClubPosts);
router.get('/:slug/join-requests', authenticate, getJoinRequests);

router.patch('/:slug', authenticate, validate(updateClubSchema), updateClub);
router.patch('/:slug/cover', authenticate, uploadImage.single('cover'), uploadClubCover);
router.patch('/:slug/icon',  authenticate, uploadImage.single('icon'),  uploadClubIcon);
router.patch('/:slug/join-requests/:requestId', authenticate, handleJoinRequest);

router.post('/:slug/request-join', authenticate, requestJoinClub);
router.post('/:slug/leave', authenticate, leaveClub);

// Founder promotes/demotes a club member
router.patch('/:slug/members/:userId/role', authenticate, authorize('founder'), updateMemberRole);

router.delete('/:slug', authenticate, deleteClub);

export default router;
