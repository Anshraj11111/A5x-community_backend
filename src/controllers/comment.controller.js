import mongoose from 'mongoose';
import { Comment } from '../models/Comment.js';
import { Post } from '../models/Post.js';
import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { createNotification } from '../services/notification.service.js';
import { checkAndAwardBadges } from '../services/badge.service.js';
import { awardPoints } from '../services/championship.service.js';

const AUTHOR_SELECT = 'username displayName avatarUrl role isVerified';

export const createComment = asyncHandler(async (req, res) => {
  const { postId, content, parentId } = req.body;

  const post = await Post.findOne({ _id: postId, isDeleted: false });
  if (!post) throw ApiError.notFound('Post not found');
  if (post.isLocked) throw ApiError.forbidden('This post is locked');

  let depth = 0;
  if (parentId) {
    const parent = await Comment.findById(parentId);
    if (!parent) throw ApiError.notFound('Parent comment not found');
    depth = Math.min(parent.depth + 1, 3);
  }

  const comment = await Comment.create({
    post: postId,
    author: req.user.id,
    parent: parentId || null,
    content,
    depth,
  });

  await Post.findByIdAndUpdate(postId, { $inc: { commentCount: 1 } });
  await User.findByIdAndUpdate(req.user.id, { $inc: { reputation: 2 } });
  await checkAndAwardBadges(req.user.id);

  // Championship points — resolve parent post's club
  const parentPost = await Post.findById(postId).select('club').lean();
  if (parentPost?.club) {
    awardPoints({ userId: req.user.id, clubId: parentPost.club.toString(), action: 'comment' }).catch(console.error);
  }

  if (post.author.toString() !== req.user.id) {
    await createNotification({
      recipient: post.author,
      sender: req.user.id,
      type: 'post_comment',
      entityId: post._id,
      entityType: 'post',
      message: `Someone commented on your post "${post.title}"`,
    });
  }

  if (parentId) {
    const parent = await Comment.findById(parentId);
    if (parent && parent.author.toString() !== req.user.id) {
      await createNotification({
        recipient: parent.author,
        sender: req.user.id,
        type: 'comment_reply',
        entityId: comment._id,
        entityType: 'comment',
        message: 'Someone replied to your comment',
      });
    }
  }

  const populated = await comment.populate('author', AUTHOR_SELECT);
  ApiResponse.created(res, { comment: populated });
});

export const updateComment = asyncHandler(async (req, res) => {
  const comment = await Comment.findOne({ _id: req.params.id, isDeleted: false });
  if (!comment) throw ApiError.notFound('Comment not found');

  if (comment.author.toString() !== req.user.id) {
    throw ApiError.forbidden('You can only edit your own comments');
  }

  comment.content = req.body.content;
  await comment.save();

  const populated = await comment.populate('author', AUTHOR_SELECT);
  ApiResponse.success(res, { comment: populated });
});

export const deleteComment = asyncHandler(async (req, res) => {
  const comment = await Comment.findOne({ _id: req.params.id, isDeleted: false });
  if (!comment) throw ApiError.notFound('Comment not found');

  if (comment.author.toString() !== req.user.id && req.user.role === 'user') {
    throw ApiError.forbidden('You can only delete your own comments');
  }

  comment.isDeleted = true;
  await comment.save();

  await Post.findByIdAndUpdate(comment.post, { $inc: { commentCount: -1 } });

  ApiResponse.success(res, null, 'Comment deleted');
});

export const upvoteComment = asyncHandler(async (req, res) => {
  const userId = new mongoose.Types.ObjectId(req.user.id);
  const comment = await Comment.findOne({ _id: req.params.id, isDeleted: false });
  if (!comment) throw ApiError.notFound('Comment not found');

  const hasUpvoted = comment.upvotes.some((id) => id.equals(userId));

  if (hasUpvoted) {
    comment.upvotes = comment.upvotes.filter((id) => !id.equals(userId));
  } else {
    comment.upvotes.push(userId);
    await createNotification({
      recipient: comment.author,
      sender: req.user.id,
      type: 'comment_upvote',
      entityId: comment._id,
      entityType: 'comment',
      message: 'Someone upvoted your comment',
    });
  }

  comment.voteScore = comment.upvotes.length;
  await comment.save();

  ApiResponse.success(res, { voteScore: comment.voteScore });
});
