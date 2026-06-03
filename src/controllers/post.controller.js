import mongoose from 'mongoose';
import { Post } from '../models/Post.js';
import { Comment } from '../models/Comment.js';
import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { getPagination, buildPaginationMeta } from '../utils/pagination.js';
import { uniqueSlug } from '../utils/slugify.js';
import { createNotification } from '../services/notification.service.js';
import { checkAndAwardBadges } from '../services/badge.service.js';

const AUTHOR_SELECT = 'username displayName avatarUrl role isVerified';

export const getPosts = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const { type, sort, tag, club, search } = req.query;

  const filter = { isDeleted: false };
  if (type) filter.type = type;
  if (tag) filter.tags = tag;
  if (club) filter.club = club;
  if (search) filter.$text = { $search: search };

  const sortMap = {
    latest: { isPinned: -1, createdAt: -1 },
    top: { isPinned: -1, voteScore: -1 },
    trending: { isPinned: -1, commentCount: -1, voteScore: -1 },
  };
  const sortOrder = sortMap[sort || 'latest'] || sortMap.latest;

  const [posts, total] = await Promise.all([
    Post.find(filter)
      .sort(sortOrder)
      .skip(skip)
      .limit(limit)
      .populate('author', AUTHOR_SELECT)
      .lean(),
    Post.countDocuments(filter),
  ]);

  ApiResponse.paginated(res, posts, buildPaginationMeta(total, page, limit));
});

export const getPost = asyncHandler(async (req, res) => {
  const post = await Post.findOneAndUpdate(
    { _id: req.params.id, isDeleted: false },
    { $inc: { viewCount: 1 } },
    { new: true }
  )
    .populate('author', AUTHOR_SELECT)
    .lean();

  if (!post) throw ApiError.notFound('Post not found');

  ApiResponse.success(res, { post });
});

export const createPost = asyncHandler(async (req, res) => {
  const { title, content, type, tags, images, clubId } = req.body;

  const post = await Post.create({
    author: req.user.id,
    title,
    content,
    type,
    tags,
    images,
    club: clubId || undefined,
    slug: uniqueSlug(title),
  });

  await User.findByIdAndUpdate(req.user.id, { $inc: { reputation: 5 } });
  await checkAndAwardBadges(req.user.id);

  const populated = await post.populate('author', AUTHOR_SELECT);
  ApiResponse.created(res, { post: populated });
});

export const updatePost = asyncHandler(async (req, res) => {
  const post = await Post.findOne({ _id: req.params.id, isDeleted: false });
  if (!post) throw ApiError.notFound('Post not found');

  if (post.author.toString() !== req.user.id && req.user.role === 'user') {
    throw ApiError.forbidden('You can only edit your own posts');
  }

  if (post.isLocked && req.user.role === 'user') {
    throw ApiError.forbidden('This post is locked');
  }

  const { title, content, tags, images } = req.body;
  if (title) post.title = title;
  if (content) post.content = content;
  if (tags) post.tags = tags;
  if (images) post.images = images;

  await post.save();
  const populated = await post.populate('author', AUTHOR_SELECT);
  ApiResponse.success(res, { post: populated });
});

export const deletePost = asyncHandler(async (req, res) => {
  const post = await Post.findOne({ _id: req.params.id, isDeleted: false });
  if (!post) throw ApiError.notFound('Post not found');

  if (post.author.toString() !== req.user.id && req.user.role === 'user') {
    throw ApiError.forbidden('You can only delete your own posts');
  }

  post.isDeleted = true;
  await post.save();

  ApiResponse.success(res, null, 'Post deleted');
});

export const votePost = asyncHandler(async (req, res) => {
  const { voteType } = req.params;
  const userId = new mongoose.Types.ObjectId(req.user.id);

  const post = await Post.findOne({ _id: req.params.id, isDeleted: false });
  if (!post) throw ApiError.notFound('Post not found');

  const hasUpvoted = post.upvotes.some((id) => id.equals(userId));
  const hasDownvoted = post.downvotes.some((id) => id.equals(userId));

  if (voteType === 'upvote') {
    if (hasUpvoted) {
      post.upvotes = post.upvotes.filter((id) => !id.equals(userId));
    } else {
      post.upvotes.push(userId);
      post.downvotes = post.downvotes.filter((id) => !id.equals(userId));

      await createNotification({
        recipient: post.author,
        sender: req.user.id,
        type: 'post_upvote',
        entityId: post._id,
        entityType: 'post',
        message: `Someone upvoted your post "${post.title}"`,
      });
    }
  } else {
    if (hasDownvoted) {
      post.downvotes = post.downvotes.filter((id) => !id.equals(userId));
    } else {
      post.downvotes.push(userId);
      post.upvotes = post.upvotes.filter((id) => !id.equals(userId));
    }
  }

  post.voteScore = post.upvotes.length - post.downvotes.length;
  await post.save();

  ApiResponse.success(res, { voteScore: post.voteScore, upvotes: post.upvotes.length });
});

export const pinPost = asyncHandler(async (req, res) => {
  const post = await Post.findOneAndUpdate(
    { _id: req.params.id, isDeleted: false },
    [{ $set: { isPinned: { $not: '$isPinned' } } }],
    { new: true }
  );
  if (!post) throw ApiError.notFound('Post not found');
  ApiResponse.success(res, { isPinned: post.isPinned });
});

export const lockPost = asyncHandler(async (req, res) => {
  const post = await Post.findOneAndUpdate(
    { _id: req.params.id, isDeleted: false },
    [{ $set: { isLocked: { $not: '$isLocked' } } }],
    { new: true }
  );
  if (!post) throw ApiError.notFound('Post not found');
  ApiResponse.success(res, { isLocked: post.isLocked });
});

export const getPostComments = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);

  const [comments, total] = await Promise.all([
    Comment.find({ post: req.params.id, parent: null, isDeleted: false })
      .sort({ voteScore: -1, createdAt: 1 })
      .skip(skip)
      .limit(limit)
      .populate('author', AUTHOR_SELECT)
      .lean(),
    Comment.countDocuments({ post: req.params.id, parent: null, isDeleted: false }),
  ]);

  const commentIds = comments.map((c) => c._id);
  const replies = await Comment.find({
    post: req.params.id,
    parent: { $in: commentIds },
    isDeleted: false,
  })
    .sort({ createdAt: 1 })
    .populate('author', AUTHOR_SELECT)
    .lean();

  const replyMap = new Map();
  replies.forEach((r) => {
    const key = r.parent.toString();
    if (!replyMap.has(key)) replyMap.set(key, []);
    replyMap.get(key).push(r);
  });

  const threaded = comments.map((c) => ({
    ...c,
    replies: replyMap.get(c._id.toString()) || [],
  }));

  ApiResponse.paginated(res, threaded, buildPaginationMeta(total, page, limit));
});
