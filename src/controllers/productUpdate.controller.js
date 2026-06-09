import { ProductUpdate } from '../models/ProductUpdate.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { getPagination, buildPaginationMeta } from '../utils/pagination.js';

const AUTHOR_SELECT = 'username displayName avatarUrl';

export const getUpdates = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);

  const filter = {};
  // Admins and moderators can see all (including drafts), others only see published
  const isAdmin = req.user?.role === 'admin' || req.user?.role === 'moderator';
  if (!isAdmin) {
    filter.isPublished = true;
  }

  const [updates, total] = await Promise.all([
    ProductUpdate.find(filter)
      .sort({ publishedAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('author', AUTHOR_SELECT)
      .lean(),
    ProductUpdate.countDocuments(filter),
  ]);

  ApiResponse.paginated(res, updates, buildPaginationMeta(total, page, limit));
});

export const getUpdate = asyncHandler(async (req, res) => {
  const update = await ProductUpdate.findById(req.params.id)
    .populate('author', AUTHOR_SELECT)
    .lean();

  if (!update) throw ApiError.notFound('Product update not found');
  if (!update.isPublished && !['admin', 'moderator'].includes(req.user?.role)) {
    throw ApiError.forbidden('This update has not been published yet');
  }

  ApiResponse.success(res, { update });
});

export const createUpdate = asyncHandler(async (req, res) => {
  const { title, content, version, type, tags } = req.body;

  // Cloudinary returns `path` as the secure_url
  const images = req.files?.map(f => f.path) ?? [];

  const update = await ProductUpdate.create({
    author: req.user.id,
    title,
    content,
    version,
    type,
    tags,
    images,
  });

  const populated = await update.populate('author', AUTHOR_SELECT);
  ApiResponse.created(res, { update: populated });
});

export const updateUpdate = asyncHandler(async (req, res) => {
  const update = await ProductUpdate.findById(req.params.id);
  if (!update) throw ApiError.notFound('Product update not found');

  const { title, content, version, type, tags, isPublished } = req.body;

  if (title !== undefined)       update.title = title;
  if (content !== undefined)     update.content = content;
  if (version !== undefined)     update.version = version;
  if (type !== undefined)        update.type = type;
  if (tags !== undefined)        update.tags = tags;
  if (isPublished !== undefined) {
    update.isPublished = isPublished;
    if (isPublished && !update.publishedAt) update.publishedAt = new Date();
  }

  // Append new Cloudinary images if uploaded
  if (req.files?.length) {
    const newImages = req.files.map(f => f.path);
    update.images = [...(update.images ?? []), ...newImages];
  }

  await update.save();
  ApiResponse.success(res, { update });
});

export const deleteUpdate = asyncHandler(async (req, res) => {
  const update = await ProductUpdate.findByIdAndDelete(req.params.id);
  if (!update) throw ApiError.notFound('Product update not found');
  ApiResponse.success(res, null, 'Product update deleted');
});

// ── React (upvote) on a product update ───────────────────────────────────────
export const reactUpdate = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const update = await ProductUpdate.findById(req.params.id);
  if (!update) throw ApiError.notFound('Product update not found');

  const reactions = update.reactions || [];
  const idx = reactions.findIndex(id => id.toString() === userId);
  if (idx > -1) {
    reactions.splice(idx, 1);
  } else {
    reactions.push(userId);
  }
  update.reactions = reactions;
  await update.save();

  ApiResponse.success(res, { reactions: update.reactions, count: update.reactions.length });
});

// ── Comments on a product update ─────────────────────────────────────────────
// We store update comments as a simple embedded sub-document array to keep things lightweight
import mongoose from 'mongoose';

const UpdateCommentSchema = new mongoose.Schema({
  updateId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductUpdate', required: true },
  author:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content:  { type: String, required: true, maxlength: 2000 },
}, { timestamps: true });

export const UpdateComment = mongoose.models.UpdateComment
  || mongoose.model('UpdateComment', UpdateCommentSchema);

export const getUpdateComments = asyncHandler(async (req, res) => {
  const comments = await UpdateComment.find({ updateId: req.params.id })
    .sort({ createdAt: 1 })
    .populate('author', 'username displayName avatarUrl role isVerified')
    .lean();

  ApiResponse.success(res, { data: comments });
});

export const addUpdateComment = asyncHandler(async (req, res) => {
  const { content } = req.body;
  if (!content?.trim()) throw ApiError.badRequest('Content is required');

  const update = await ProductUpdate.findById(req.params.id);
  if (!update) throw ApiError.notFound('Product update not found');

  const comment = await UpdateComment.create({
    updateId: req.params.id,
    author: req.user.id,
    content: content.trim(),
  });

  update.commentCount = (update.commentCount || 0) + 1;
  await update.save();

  const populated = await comment.populate('author', 'username displayName avatarUrl role isVerified');
  ApiResponse.created(res, populated);
});
