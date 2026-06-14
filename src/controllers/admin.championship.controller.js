import { ChampionshipSeason } from '../models/ChampionshipSeason.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { slugify } from '../utils/slugify.js';
import { activateSeason, endSeason } from '../services/championship.service.js';

/**
 * GET /admin/championship/seasons
 * Returns all seasons sorted by startDate descending.
 */
export const listAllSeasons = asyncHandler(async (_req, res) => {
  const seasons = await ChampionshipSeason.find()
    .sort({ startDate: -1 })
    .lean();

  return ApiResponse.success(res, { seasons });
});

/**
 * POST /admin/championship/seasons
 * Creates a new championship season with status 'upcoming'.
 * Body is validated upstream by validate(createSeasonSchema).
 */
export const createSeason = asyncHandler(async (req, res) => {
  const { name, description, startDate, endDate, scoringRules, rewards } = req.body;

  // Generate a unique slug from the season name
  let baseSlug = slugify(name);
  let slug = baseSlug;
  let suffix = 2;

  while (await ChampionshipSeason.exists({ slug })) {
    slug = `${baseSlug}-${suffix}`;
    suffix++;
  }

  const season = await ChampionshipSeason.create({
    name,
    slug,
    description,
    startDate,
    endDate,
    scoringRules,
    rewards,
    createdBy: req.user.id,
    status: 'upcoming',
  });

  return ApiResponse.created(res, { season });
});

/**
 * PATCH /admin/championship/seasons/:id
 * Updates an upcoming season. Throws 403 if already active or ended.
 * Body is validated upstream by validate(updateSeasonSchema).
 */
export const updateSeason = asyncHandler(async (req, res) => {
  const season = await ChampionshipSeason.findById(req.params.id);
  if (!season) throw ApiError.notFound('Season not found');

  if (season.status !== 'upcoming') {
    throw ApiError.forbidden('Only upcoming seasons can be edited');
  }

  const allowed = ['name', 'description', 'startDate', 'endDate', 'scoringRules', 'rewards'];
  for (const field of allowed) {
    if (req.body[field] !== undefined) {
      season[field] = req.body[field];
    }
  }

  await season.save();
  return ApiResponse.success(res, { season });
});

/**
 * DELETE /admin/championship/seasons/:id
 * Deletes an upcoming season. Throws 403 if active or ended.
 */
export const deleteSeason = asyncHandler(async (req, res) => {
  const season = await ChampionshipSeason.findById(req.params.id);
  if (!season) throw ApiError.notFound('Season not found');

  if (season.status !== 'upcoming') {
    throw ApiError.forbidden('Only upcoming seasons can be deleted');
  }

  await season.deleteOne();
  return ApiResponse.success(res, null, 'Season deleted');
});

/**
 * POST /admin/championship/seasons/:id/activate
 * Manually activates a season.
 */
export const activateSeasonManually = asyncHandler(async (req, res) => {
  const season = await activateSeason(req.params.id);
  return ApiResponse.success(res, { season });
});

/**
 * POST /admin/championship/seasons/:id/end
 * Manually ends a season.
 */
export const endSeasonManually = asyncHandler(async (req, res) => {
  const season = await endSeason(req.params.id);
  return ApiResponse.success(res, { season });
});
