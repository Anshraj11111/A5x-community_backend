import { ChampionshipSeason } from '../models/ChampionshipSeason.js';
import { ClubChampionshipScore } from '../models/ClubChampionshipScore.js';
import { ClubMember } from '../models/ClubMember.js';
import { Badge } from '../models/Badge.js';
import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { createNotification } from './notification.service.js';
import { getIO } from '../socket/index.js';

// Per-season debounce map for recomputeRanks
const rankDebounceMap = new Map();

/**
 * Debounced rank recomputation.
 * Collapses rapid calls within 500 ms into a single bulkWrite.
 *
 * @param {string} seasonId
 */
export function recomputeRanks(seasonId) {
  const key = seasonId.toString();

  if (rankDebounceMap.has(key)) {
    clearTimeout(rankDebounceMap.get(key));
  }

  const timer = setTimeout(async () => {
    rankDebounceMap.delete(key);
    try {
      const scores = await ClubChampionshipScore.find({ season: seasonId })
        .sort({ totalScore: -1, lastScoredAt: 1 })
        .lean();

      if (scores.length === 0) return;

      const bulk = scores.map((doc, i) => ({
        updateOne: {
          filter: { _id: doc._id },
          update: { $set: { rank: i + 1 } },
        },
      }));

      await ClubChampionshipScore.bulkWrite(bulk, { ordered: false });
    } catch (err) {
      console.error('recomputeRanks error:', err);
    }
  }, 500);

  rankDebounceMap.set(key, timer);
}

/**
 * Award points for a single user action.
 * Called fire-and-forget from existing controllers.
 *
 * @param {Object} opts
 * @param {string} opts.userId   - User who performed the action
 * @param {string} opts.clubId   - Club the action belongs to (may be null if post has no club)
 * @param {string} opts.action   - One of: 'post' | 'comment' | 'upvoteReceived' |
 *                                 'showcasePost' | 'featureRequest' | 'bugReport' | 'pollCreated'
 * @param {Object} [opts.meta]   - Optional contextual data (postId, etc.) for future audit log
 */
export async function awardPoints({ userId, clubId, action, meta }) {
  // Guard 1: no club context — nothing to award
  if (clubId == null) return;

  // Guard 2: require an active season
  const activeSeason = await ChampionshipSeason.findOne({ status: 'active' }).lean();
  if (!activeSeason) return;

  // Guard 3: the action must have a positive point value in this season's rules
  const points = activeSeason.scoringRules?.[action];
  if (!points) return; // covers 0, undefined, null, NaN

  // Snapshot previous score to detect rank changes (task 2.12)
  const prevScore = await ClubChampionshipScore.findOne({
    season: activeSeason._id,
    club: clubId,
  }).lean();

  // Atomically upsert the score document
  const newScore = await ClubChampionshipScore.findOneAndUpdate(
    { season: activeSeason._id, club: clubId },
    {
      $inc: {
        totalScore: points,
        [`breakdown.${action}`]: points,
      },
      $set: { lastScoredAt: new Date() },
    },
    { upsert: true, new: true }
  );

  // Debounced rank recomputation (task 2.2)
  recomputeRanks(activeSeason._id);

  // Socket.io leaderboard_update emission (task 2.12)
  const rankChanged = prevScore?.rank !== newScore.rank;
  const isMilestone = newScore.totalScore % 50 === 0;

  if (rankChanged || isMilestone) {
    const io = getIO();
    if (io) {
      io.to('championship').emit('leaderboard_update', {
        seasonId: activeSeason._id,
        clubId,
        totalScore: newScore.totalScore,
        rank: newScore.rank,
      });
    }
  }
}

/**
 * Activate a season by ID.
 * Throws if the season is missing or if another season is already active.
 *
 * @param {string} seasonId
 */
export async function activateSeason(seasonId) {
  const season = await ChampionshipSeason.findById(seasonId);
  if (!season) throw ApiError.notFound('Season not found');

  const existing = await ChampionshipSeason.findOne({ status: 'active', _id: { $ne: seasonId } });
  if (existing) {
    throw ApiError.conflict('A season is already active', 'SEASON_ALREADY_ACTIVE');
  }

  season.status = 'active';
  await season.save();

  const io = getIO();
  if (io) {
    io.to('championship').emit('season_started', {
      seasonId: season._id,
      name: season.name,
    });
  }

  return season;
}

/**
 * End a season by ID.
 * Idempotent — returns early if season is already ended.
 * Finalises top-3 snapshot, awards badges, and sends notifications.
 *
 * @param {string} seasonId
 */
export async function endSeason(seasonId) {
  const season = await ChampionshipSeason.findById(seasonId);
  if (!season) throw ApiError.notFound('Season not found');

  // Idempotency guard (Requirement 4.10)
  if (season.status === 'ended') return season;

  season.status = 'ended';
  season.finalizedAt = new Date();

  // Top-3 clubs
  const topScores = await ClubChampionshipScore.find({ season: seasonId })
    .sort({ totalScore: -1, lastScoredAt: 1 })
    .limit(3)
    .lean();

  season.topClubs = topScores.map((s) => ({
    rank: s.rank,
    club: s.club,
    score: s.totalScore,
  }));

  await season.save();

  // Badge slugs mapped to rank position (1-indexed)
  const rankBadgeSlugMap = {
    1: season.rewards?.first || 'season-champion',
    2: season.rewards?.second || 'season-runner-up',
    3: season.rewards?.third || 'season-third-place',
  };

  for (const scoreDoc of topScores) {
    const badgeSlug = rankBadgeSlugMap[scoreDoc.rank];
    if (!badgeSlug) continue;

    const badge = await Badge.findOne({ slug: badgeSlug }).lean();
    if (!badge) {
      console.warn(`Championship badge not found for slug: ${badgeSlug} — skipping`);
      continue;
    }

    // Get all club members
    const members = await ClubMember.find({ club: scoreDoc.club }).lean();
    const memberIds = members.map((m) => m.user);

    if (memberIds.length === 0) continue;

    // Award badge to all members (addToSet = idempotent)
    await User.updateMany(
      { _id: { $in: memberIds } },
      { $addToSet: { badges: badge._id } }
    );

    // Notify each member
    for (const memberId of memberIds) {
      await createNotification({
        recipient: memberId,
        sender: null,
        type: 'championship_badge',
        entityId: season._id,
        entityType: 'season',
        message: `Your club finished rank ${scoreDoc.rank} in the "${season.name}" Championship Season! You've earned the ${badge.name} badge.`,
      });
    }
  }

  // Emit socket event
  const io = getIO();
  if (io) {
    io.to('championship').emit('season_ended', {
      seasonId: season._id,
      name: season.name,
      topClubs: season.topClubs,
    });
  }

  return season;
}
