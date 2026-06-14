import { ChampionshipSeason } from '../models/ChampionshipSeason.js';
import { ClubChampionshipScore } from '../models/ClubChampionshipScore.js';
import { ProductClub } from '../models/ProductClub.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { getPagination, buildPaginationMeta } from '../utils/pagination.js';

/**
 * GET /championship/season/current
 * Returns the active season. Falls back to the most-recently-ended season.
 * Returns data: null when neither exists.
 */
export const getCurrentSeason = asyncHandler(async (_req, res) => {
  let season = await ChampionshipSeason.findOne({ status: 'active' }).lean();

  if (!season) {
    season = await ChampionshipSeason.findOne({ status: 'ended' })
      .sort({ finalizedAt: -1 })
      .lean();
  }

  if (!season) {
    return ApiResponse.success(res, null, 'No active season');
  }

  return ApiResponse.success(res, { season });
});

/**
 * GET /championship/seasons
 * Returns all seasons sorted by startDate descending.
 */
export const getAllSeasons = asyncHandler(async (_req, res) => {
  const seasons = await ChampionshipSeason.find()
    .sort({ startDate: -1 })
    .lean();

  return ApiResponse.success(res, { seasons });
});

/**
 * GET /championship/seasons/:seasonId
 * Returns a single season by ID.
 */
export const getSeasonById = asyncHandler(async (req, res) => {
  const season = await ChampionshipSeason.findById(req.params.seasonId).lean();
  if (!season) throw ApiError.notFound('Season not found');

  return ApiResponse.success(res, { season });
});

/**
 * GET /championship/season/:seasonId/leaderboard
 * Paginated leaderboard for a season, sorted by totalScore desc (ties broken by lastScoredAt asc).
 * Populates club fields: name, slug, icon, memberCount.
 */
export const getLeaderboard = asyncHandler(async (req, res) => {
  const { seasonId } = req.params;
  const rawLimit = parseInt(req.query.limit, 10) || 20;
  const limit = Math.min(rawLimit, 100);
  const { page, skip } = getPagination({ page: req.query.page, limit });

  const season = await ChampionshipSeason.findById(seasonId).lean();
  if (!season) throw ApiError.notFound('Season not found');

  const [scores, total] = await Promise.all([
    ClubChampionshipScore.find({ season: seasonId })
      .sort({ totalScore: -1, lastScoredAt: 1 })
      .skip(skip)
      .limit(limit)
      .populate('club', 'name slug icon memberCount')
      .lean(),
    ClubChampionshipScore.countDocuments({ season: seasonId }),
  ]);

  return ApiResponse.paginated(res, scores, buildPaginationMeta(total, page, limit));
});

/**
 * GET /championship/season/:seasonId/clubs/:clubSlug
 * Returns the score document for a specific club in a season.
 * Returns score 0 and no rank if no score doc exists.
 */
export const getClubSeasonScore = asyncHandler(async (req, res) => {
  const { seasonId, clubSlug } = req.params;

  const season = await ChampionshipSeason.findById(seasonId).lean();
  if (!season) throw ApiError.notFound('Season not found');

  const club = await ProductClub.findOne({ slug: clubSlug }).lean();
  if (!club) throw ApiError.notFound('Club not found');

  const scoreDoc = await ClubChampionshipScore.findOne({
    season: seasonId,
    club: club._id,
  }).lean();

  if (!scoreDoc) {
    return ApiResponse.success(res, {
      club: { _id: club._id, name: club.name, slug: club.slug, icon: club.icon },
      season: { _id: season._id, name: season.name, status: season.status },
      totalScore: 0,
      breakdown: {},
      rank: null,
    });
  }

  return ApiResponse.success(res, { score: scoreDoc });
});
