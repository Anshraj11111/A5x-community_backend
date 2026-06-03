import { User } from '../models/User.js';
import { Post } from '../models/Post.js';
import { Comment } from '../models/Comment.js';
import { FeatureRequest } from '../models/FeatureRequest.js';
import { BugReport } from '../models/BugReport.js';
import { Report } from '../models/Report.js';
import { ProductClub } from '../models/ProductClub.js';
import { Badge } from '../models/Badge.js';
import { Notification } from '../models/Notification.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { getPagination, buildPaginationMeta } from '../utils/pagination.js';

export const getStats = asyncHandler(async (_req, res) => {
  const [
    totalUsers,
    totalPosts,
    totalComments,
    totalFeatures,
    totalBugs,
    totalClubs,
    pendingReports,
    newUsersToday,
  ] = await Promise.all([
    User.countDocuments({ isBanned: false }),
    Post.countDocuments({ isDeleted: false }),
    Comment.countDocuments({ isDeleted: false }),
    FeatureRequest.countDocuments({ isDeleted: false }),
    BugReport.countDocuments({ isDeleted: false }),
    ProductClub.countDocuments(),
    Report.countDocuments({ status: 'pending' }),
    User.countDocuments({
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    }),
  ]);

  ApiResponse.success(res, {
    totalUsers,
    totalPosts,
    totalComments,
    totalFeatures,
    totalBugs,
    totalClubs,
    pendingReports,
    newUsersToday,
  });
});

export const getUsers = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const { search, role, banned } = req.query;

  const filter = {};
  if (role) filter.role = role;
  if (banned === 'true') filter.isBanned = true;
  if (banned === 'false') filter.isBanned = false;
  if (search) {
    filter.$or = [
      { username: { $regex: search, $options: 'i' } },
      { displayName: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
    ];
  }

  const [users, total] = await Promise.all([
    User.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('-firebaseUid')
      .lean(),
    User.countDocuments(filter),
  ]);

  ApiResponse.paginated(res, users, buildPaginationMeta(total, page, limit));
});

export const banUser = asyncHandler(async (req, res) => {
  const { ban, reason } = req.body;
  const user = await User.findByIdAndUpdate(
    req.params.id,
    { isBanned: ban, banReason: ban ? reason : undefined },
    { new: true }
  ).select('username isBanned banReason');

  if (!user) throw ApiError.notFound('User not found');

  ApiResponse.success(res, { user }, ban ? 'User banned' : 'User unbanned');
});

export const changeUserRole = asyncHandler(async (req, res) => {
  const { role } = req.body;

  if (!['user', 'moderator', 'admin'].includes(role)) {
    throw ApiError.badRequest('Invalid role');
  }

  const user = await User.findByIdAndUpdate(
    req.params.id,
    { role },
    { new: true }
  ).select('username role');

  if (!user) throw ApiError.notFound('User not found');

  ApiResponse.success(res, { user }, 'Role updated');
});

export const getReports = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const { status } = req.query;

  const filter = {};
  if (status) filter.status = status;

  const [reports, total] = await Promise.all([
    Report.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('reporter', 'username displayName avatarUrl')
      .populate('reviewedBy', 'username displayName')
      .lean(),
    Report.countDocuments(filter),
  ]);

  ApiResponse.paginated(res, reports, buildPaginationMeta(total, page, limit));
});

export const reviewReport = asyncHandler(async (req, res) => {
  const { status, reviewNote } = req.body;

  const report = await Report.findByIdAndUpdate(
    req.params.id,
    { status, reviewNote, reviewedBy: req.user.id },
    { new: true }
  );

  if (!report) throw ApiError.notFound('Report not found');

  ApiResponse.success(res, { report });
});

export const createBadge = asyncHandler(async (req, res) => {
  const badge = await Badge.create(req.body);
  ApiResponse.created(res, { badge });
});

export const awardBadge = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const badge = await Badge.findById(req.params.id);
  if (!badge) throw ApiError.notFound('Badge not found');

  await User.findByIdAndUpdate(userId, {
    $addToSet: { badges: badge._id },
    $inc: { reputation: 10 },
  });

  ApiResponse.success(res, null, 'Badge awarded');
});

export const broadcastNotification = asyncHandler(async (req, res) => {
  const { title, message, type = 'system' } = req.body;

  if (!title || !message) throw ApiError.badRequest('title and message are required');

  // Fetch all non-banned user IDs in batches to avoid memory issues
  const userIds = await User.find({ isBanned: false }).select('_id').lean();

  const BATCH = 500;
  let sent = 0;

  for (let i = 0; i < userIds.length; i += BATCH) {
    const batch = userIds.slice(i, i + BATCH);
    const docs = batch.map(u => ({
      recipient:  u._id,
      sender:     null,
      type:       'system',
      entityId:   req.user.id,   // admin's id as placeholder ref
      entityType: 'system',
      message:    `${title}: ${message}`,
      isRead:     false,
    }));
    await Notification.insertMany(docs, { ordered: false });
    sent += docs.length;
  }

  ApiResponse.success(res, { sent }, `Notification broadcast to ${sent} users`);
});
