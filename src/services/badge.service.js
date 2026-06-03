import { User } from '../models/User.js';
import { Badge } from '../models/Badge.js';
import { Post } from '../models/Post.js';
import { Comment } from '../models/Comment.js';
import { createNotification } from './notification.service.js';

const BADGE_SLUGS = {
  FIRST_POST: 'first-post',
  TEN_POSTS: 'ten-posts',
  FIFTY_POSTS: 'fifty-posts',
  FIRST_UPVOTE: 'first-upvote',
  HUNDRED_UPVOTES: 'hundred-upvotes',
  FIRST_COMMENT: 'first-comment',
  HELPFUL_COMMENTER: 'helpful-commenter',
};

export const checkAndAwardBadges = async (userId) => {
  try {
    const user = await User.findById(userId).select('badges reputation').lean();
    if (!user) return;

    const userBadgeSlugs = new Set();
    const badges = await Badge.find({ _id: { $in: user.badges } }).select('slug').lean();
    badges.forEach((b) => userBadgeSlugs.add(b.slug));

    const postCount = await Post.countDocuments({ author: userId, isDeleted: false });
    const commentCount = await Comment.countDocuments({ author: userId, isDeleted: false });

    const toAward = [];

    if (postCount >= 1 && !userBadgeSlugs.has(BADGE_SLUGS.FIRST_POST)) {
      toAward.push(BADGE_SLUGS.FIRST_POST);
    }
    if (postCount >= 10 && !userBadgeSlugs.has(BADGE_SLUGS.TEN_POSTS)) {
      toAward.push(BADGE_SLUGS.TEN_POSTS);
    }
    if (postCount >= 50 && !userBadgeSlugs.has(BADGE_SLUGS.FIFTY_POSTS)) {
      toAward.push(BADGE_SLUGS.FIFTY_POSTS);
    }
    if (commentCount >= 1 && !userBadgeSlugs.has(BADGE_SLUGS.FIRST_COMMENT)) {
      toAward.push(BADGE_SLUGS.FIRST_COMMENT);
    }
    if (commentCount >= 50 && !userBadgeSlugs.has(BADGE_SLUGS.HELPFUL_COMMENTER)) {
      toAward.push(BADGE_SLUGS.HELPFUL_COMMENTER);
    }

    for (const slug of toAward) {
      const badge = await Badge.findOne({ slug }).lean();
      if (!badge) continue;

      await User.findByIdAndUpdate(userId, {
        $addToSet: { badges: badge._id },
        $inc: { reputation: 10 },
      });

      await createNotification({
        recipient: userId,
        sender: null,
        type: 'badge_awarded',
        entityId: badge._id,
        entityType: 'badge',
        message: `You earned the "${badge.name}" badge!`,
      });
    }
  } catch (err) {
    console.error('Badge check failed:', err);
  }
};
