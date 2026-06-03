import { Router } from 'express';
import {
  getFeatures, getFeature, createFeature, voteFeature,
  updateFeatureStatus, deleteFeature,
} from '../controllers/feature.controller.js';
import { authenticate, optionalAuth } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { createFeatureSchema, updateFeatureStatusSchema } from '../validators/feature.validator.js';

const router = Router();

router.get('/', optionalAuth, getFeatures);
router.post('/', authenticate, validate(createFeatureSchema), createFeature);
router.get('/:id', optionalAuth, getFeature);
router.post('/:id/vote', authenticate, voteFeature);
router.patch('/:id/status', authenticate, authorize('admin'), validate(updateFeatureStatusSchema), updateFeatureStatus);
router.delete('/:id', authenticate, deleteFeature);

export default router;
