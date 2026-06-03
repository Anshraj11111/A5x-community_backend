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

  const update = await ProductUpdate.create({
    author: req.user.id,
    title,
    content,
    version,
    type,
    tags,
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

  await update.save();
  ApiResponse.success(res, { update });
});

export const deleteUpdate = asyncHandler(async (req, res) => {
  const update = await ProductUpdate.findByIdAndDelete(req.params.id);
  if (!update) throw ApiError.notFound('Product update not found');
  ApiResponse.success(res, null, 'Product update deleted');
});
