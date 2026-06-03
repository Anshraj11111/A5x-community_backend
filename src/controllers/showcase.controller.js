import mongoose from 'mongoose';
import { ShowcasePost } from '../models/ShowcasePost.js';
import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { getPagination, buildPaginationMeta } from '../utils/pagination.js';

const AUTHOR_SELECT = 'username displayName avatarUrl isVerified';

export const getShowcasePosts = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const { sort, tag, featured } = req.query;

  const filter = { isDeleted: false };
  if (tag) filter.tags = tag;
  if (featured === 'true') filter.isFeatured = true;

  const sortMap = {
    latest: { createdAt: -1 },
    top: { voteScore: -1 },
    featured: { isFeatured: -1, voteScore: -1 },
  };
  const sortOrder = sortMap[sort || 'latest'] || sortMap.latest;

  const [posts, total] = await Promise.all([
    ShowcasePost.find(filter)
      .sort(sortOrder)
      .skip(skip)
      .limit(limit)
      .populate('author', AUTHOR_SELECT)
      .lean(),
    ShowcasePost.countDocuments(filter),
  ]);

  ApiResponse.paginated(res, posts, buildPaginationMeta(total, page, limit));
});

export const getShowcasePost = asyncHandler(async (req, res) => {
  const post = await ShowcasePost.findOne({ _id: req.params.id, isDeleted: false })
    .populate('author', AUTHOR_SELECT)
    .lean();

  if (!post) throw ApiError.notFound('Showcase post not found');

  ApiResponse.success(res, { post });
});

export const createShowcasePost = asyncHandler(async (req, res) => {
  const { title, description, images, tags, links } = req.body;

  const post = await ShowcasePost.create({
    author: req.user.id,
    title,
    description,
    images: images || [],
    tags: tags || [],
    links,
  });

  await User.findByIdAndUpdate(req.user.id, { $inc: { reputation: 5 } });

  const populated = await post.populate('author', AUTHOR_SELECT);
  ApiResponse.created(res, { post: populated });
});

export const updateShowcasePost = asyncHandler(async (req, res) => {
  const post = await ShowcasePost.findOne({ _id: req.params.id, isDeleted: false });
  if (!post) throw ApiError.notFound('Showcase post not found');

  if (post.author.toString() !== req.user.id) {
    throw ApiError.forbidden('You can only edit your own showcase posts');
  }

  const { title, description, images, tags, links } = req.body;
  if (title) post.title = title;
  if (description) post.description = description;
  if (images) post.images = images;
  if (tags) post.tags = tags;
  if (links) post.links = links;

  await post.save();
  const populated = await post.populate('author', AUTHOR_SELECT);
  ApiResponse.success(res, { post: populated });
});

export const deleteShowcasePost = asyncHandler(async (req, res) => {
  const post = await ShowcasePost.findOne({ _id: req.params.id, isDeleted: false });
  if (!post) throw ApiError.notFound('Showcase post not found');

  if (post.author.toString() !== req.user.id && req.user.role === 'user') {
    throw ApiError.forbidden('You can only delete your own showcase posts');
  }

  post.isDeleted = true;
  await post.save();

  ApiResponse.success(res, null, 'Showcase post deleted');
});

export const upvoteShowcase = asyncHandler(async (req, res) => {
  const userId = new mongoose.Types.ObjectId(req.user.id);
  const post = await ShowcasePost.findOne({ _id: req.params.id, isDeleted: false });
  if (!post) throw ApiError.notFound('Showcase post not found');

  const hasUpvoted = post.upvotes.some((id) => id.equals(userId));

  if (hasUpvoted) {
    post.upvotes = post.upvotes.filter((id) => !id.equals(userId));
  } else {
    post.upvotes.push(userId);
  }

  post.voteScore = post.upvotes.length;
  await post.save();

  ApiResponse.success(res, { voteScore: post.voteScore, hasUpvoted: !hasUpvoted });
});

export const featureShowcase = asyncHandler(async (req, res) => {
  const post = await ShowcasePost.findOneAndUpdate(
    { _id: req.params.id, isDeleted: false },
    [{ $set: { isFeatured: { $not: '$isFeatured' } } }],
    { new: true }
  );
  if (!post) throw ApiError.notFound('Showcase post not found');
  ApiResponse.success(res, { isFeatured: post.isFeatured });
});
