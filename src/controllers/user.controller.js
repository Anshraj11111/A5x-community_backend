import { User } from '../models/User.js';
import { Post } from '../models/Post.js';
import { Comment } from '../models/Comment.js';
import { ShowcasePost } from '../models/ShowcasePost.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { getPagination, buildPaginationMeta } from '../utils/pagination.js';
import { getFileUrl, deleteFile } from '../services/upload.service.js';

export const getProfile = asyncHandler(async (req, res) => {
  const user = await User.findOne({ username: req.params.username })
    .populate('badges', 'name slug icon tier color')
    .lean();

  if (!user || user.isBanned) throw ApiError.notFound('User not found');

  // Remove sensitive fields
  const { password, preferences, ...publicProfile } = user;

  ApiResponse.success(res, { user: publicProfile });
});

export const updateProfile = asyncHandler(async (req, res) => {
  const { displayName, bio, socialLinks } = req.body;

  const user = await User.findByIdAndUpdate(
    req.user.id,
    { $set: { displayName, bio, socialLinks } },
    { new: true, runValidators: true }
  ).populate('badges', 'name slug icon tier color');

  if (!user) throw ApiError.notFound('User not found');

  ApiResponse.success(res, { user });
});

export const uploadAvatar = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('No file uploaded');

  const user = await User.findById(req.user.id).select('avatarUrl');
  if (!user) throw ApiError.notFound('User not found');

  // Delete old avatar
  if (user.avatarUrl) deleteFile(user.avatarUrl);

  const avatarUrl = getFileUrl(req.file);

  await User.findByIdAndUpdate(req.user.id, { avatarUrl });

  ApiResponse.success(res, { avatarUrl });
});

export const uploadCover = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('No file uploaded');

  const user = await User.findById(req.user.id).select('coverImageUrl');
  if (!user) throw ApiError.notFound('User not found');

  // Delete old cover
  if (user.coverImageUrl) deleteFile(user.coverImageUrl);

  const coverImageUrl = getFileUrl(req.file);

  await User.findByIdAndUpdate(req.user.id, { coverImageUrl });

  ApiResponse.success(res, { coverImageUrl });
});

export const getUserPosts = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const user = await User.findOne({ username: req.params.username }).lean();
  if (!user) throw ApiError.notFound('User not found');

  const [posts, total] = await Promise.all([
    Post.find({ author: user._id, isDeleted: false })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('author', 'username displayName avatarUrl')
      .lean(),
    Post.countDocuments({ author: user._id, isDeleted: false }),
  ]);

  ApiResponse.paginated(res, posts, buildPaginationMeta(total, page, limit));
});

export const getUserComments = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const user = await User.findOne({ username: req.params.username }).lean();
  if (!user) throw ApiError.notFound('User not found');

  const [comments, total] = await Promise.all([
    Comment.find({ author: user._id, isDeleted: false })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('post', 'title slug')
      .lean(),
    Comment.countDocuments({ author: user._id, isDeleted: false }),
  ]);

  ApiResponse.paginated(res, comments, buildPaginationMeta(total, page, limit));
});

export const getUserShowcase = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const user = await User.findOne({ username: req.params.username }).lean();
  if (!user) throw ApiError.notFound('User not found');

  const [posts, total] = await Promise.all([
    ShowcasePost.find({ author: user._id, isDeleted: false })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    ShowcasePost.countDocuments({ author: user._id, isDeleted: false }),
  ]);

  ApiResponse.paginated(res, posts, buildPaginationMeta(total, page, limit));
});

export const deleteAccount = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(req.user.id, {
    isBanned: true,
    banReason: 'Account deleted by user',
    displayName: '[Deleted]',
    bio: '',
    avatarUrl: undefined,
  });

  ApiResponse.success(res, null, 'Account deleted successfully');
});
