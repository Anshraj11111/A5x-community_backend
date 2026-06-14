import { FeatureRequest } from '../models/FeatureRequest.js';
import { FeatureVote } from '../models/FeatureVote.js';
import { User } from '../models/User.js';
import { ClubMember } from '../models/ClubMember.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { getPagination, buildPaginationMeta } from '../utils/pagination.js';
import { createNotification } from '../services/notification.service.js';
import { awardPoints } from '../services/championship.service.js';

const AUTHOR_SELECT = 'username displayName avatarUrl';

export const getFeatures = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const { status, sort, search } = req.query;

  const filter = { isDeleted: false };
  if (status) filter.status = status;
  if (search) filter.$text = { $search: search };

  const sortMap = {
    votes: { voteCount: -1 },
    latest: { createdAt: -1 },
    oldest: { createdAt: 1 },
  };
  const sortOrder = sortMap[sort || 'votes'] || sortMap.votes;

  const [features, total] = await Promise.all([
    FeatureRequest.find(filter)
      .sort(sortOrder)
      .skip(skip)
      .limit(limit)
      .populate('author', AUTHOR_SELECT)
      .lean(),
    FeatureRequest.countDocuments(filter),
  ]);

  let votedIds = new Set();
  if (req.user) {
    const votes = await FeatureVote.find({
      featureRequest: { $in: features.map((f) => f._id) },
      user: req.user.id,
    }).lean();
    votedIds = new Set(votes.map((v) => v.featureRequest.toString()));
  }

  const enriched = features.map((f) => ({
    ...f,
    hasVoted: votedIds.has(f._id.toString()),
  }));

  ApiResponse.paginated(res, enriched, buildPaginationMeta(total, page, limit));
});

export const getFeature = asyncHandler(async (req, res) => {
  const feature = await FeatureRequest.findOne({ _id: req.params.id, isDeleted: false })
    .populate('author', AUTHOR_SELECT)
    .lean();

  if (!feature) throw ApiError.notFound('Feature request not found');

  let hasVoted = false;
  if (req.user) {
    const vote = await FeatureVote.findOne({ featureRequest: feature._id, user: req.user.id });
    hasVoted = !!vote;
  }

  ApiResponse.success(res, { feature: { ...feature, hasVoted } });
});

export const createFeature = asyncHandler(async (req, res) => {
  const { title, description, tags } = req.body;

  const feature = await FeatureRequest.create({
    author: req.user.id,
    title,
    description,
    tags,
  });

  await User.findByIdAndUpdate(req.user.id, { $inc: { reputation: 3 } });

  // Championship points — resolve user's earliest club membership
  const membership = await ClubMember.findOne({ user: req.user.id })
    .sort({ joinedAt: 1, _id: 1 })
    .lean();
  if (membership) {
    awardPoints({ userId: req.user.id, clubId: membership.club.toString(), action: 'featureRequest' }).catch(console.error);
  }

  const populated = await feature.populate('author', AUTHOR_SELECT);
  ApiResponse.created(res, { feature: populated });
});

export const voteFeature = asyncHandler(async (req, res) => {
  const feature = await FeatureRequest.findOne({ _id: req.params.id, isDeleted: false });
  if (!feature) throw ApiError.notFound('Feature request not found');

  const existingVote = await FeatureVote.findOne({
    featureRequest: feature._id,
    user: req.user.id,
  });

  if (existingVote) {
    await existingVote.deleteOne();
    feature.voteCount = Math.max(0, feature.voteCount - 1);
    await feature.save();
    return ApiResponse.success(res, { voteCount: feature.voteCount, hasVoted: false });
  }

  await FeatureVote.create({ featureRequest: feature._id, user: req.user.id });
  feature.voteCount += 1;
  await feature.save();

  await createNotification({
    recipient: feature.author,
    sender: req.user.id,
    type: 'feature_vote',
    entityId: feature._id,
    entityType: 'feature',
    message: `Someone voted for your feature request "${feature.title}"`,
  });

  ApiResponse.success(res, { voteCount: feature.voteCount, hasVoted: true });
});

export const updateFeatureStatus = asyncHandler(async (req, res) => {
  const { status, adminNote, priority } = req.body;

  const feature = await FeatureRequest.findOneAndUpdate(
    { _id: req.params.id, isDeleted: false },
    { $set: { status, adminNote, priority } },
    { new: true }
  ).populate('author', AUTHOR_SELECT);

  if (!feature) throw ApiError.notFound('Feature request not found');

  await createNotification({
    recipient: feature.author._id,
    sender: null,
    type: 'feature_status_change',
    entityId: feature._id,
    entityType: 'feature',
    message: `Your feature request "${feature.title}" status changed to ${status}`,
  });

  ApiResponse.success(res, { feature });
});

export const deleteFeature = asyncHandler(async (req, res) => {
  const feature = await FeatureRequest.findOne({ _id: req.params.id, isDeleted: false });
  if (!feature) throw ApiError.notFound('Feature request not found');

  if (feature.author.toString() !== req.user.id && req.user.role === 'user') {
    throw ApiError.forbidden('You can only delete your own feature requests');
  }

  feature.isDeleted = true;
  await feature.save();

  ApiResponse.success(res, null, 'Feature request deleted');
});
