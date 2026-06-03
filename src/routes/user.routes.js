import { Router } from 'express';
import {
  getProfile, updateProfile, uploadAvatar, uploadCover,
  getUserPosts, getUserComments, getUserShowcase, deleteAccount,
} from '../controllers/user.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { uploadImage } from '../middleware/upload.js';

const router = Router();

router.get('/:username', getProfile);
router.patch('/me', authenticate, updateProfile);
router.patch('/me/avatar', authenticate, uploadImage.single('avatar'), uploadAvatar);
router.patch('/me/cover', authenticate, uploadImage.single('cover'), uploadCover);
router.get('/:username/posts', getUserPosts);
router.get('/:username/comments', getUserComments);
router.get('/:username/showcase', getUserShowcase);
router.delete('/me', authenticate, deleteAccount);

export default router;
