import { Router } from 'express';
import {
  getCurrentSeason,
  getAllSeasons,
  getSeasonById,
  getLeaderboard,
  getClubSeasonScore,
} from '../controllers/championship.controller.js';

const router = Router();

// All routes are public — no authenticate middleware

// GET /api/v1/championship/season/current
router.get('/season/current', getCurrentSeason);

// GET /api/v1/championship/seasons
router.get('/seasons', getAllSeasons);

// GET /api/v1/championship/seasons/:seasonId
router.get('/seasons/:seasonId', getSeasonById);

// GET /api/v1/championship/season/:seasonId/leaderboard
router.get('/season/:seasonId/leaderboard', getLeaderboard);

// GET /api/v1/championship/season/:seasonId/clubs/:clubSlug
router.get('/season/:seasonId/clubs/:clubSlug', getClubSeasonScore);

export default router;
