import { ChampionshipSeason } from '../models/ChampionshipSeason.js';
import { activateSeason, endSeason } from '../services/championship.service.js';

const TICK_INTERVAL_MS = 60 * 1000; // 60 seconds

async function tick() {
  const now = new Date();

  // Activate seasons whose startDate has passed but are still 'upcoming'
  try {
    const toActivate = await ChampionshipSeason.find({
      status: 'upcoming',
      startDate: { $lte: now },
    }).lean();

    for (const season of toActivate) {
      try {
        await activateSeason(season._id);
        console.log(`[SeasonLifecycle] Activated season: ${season.name} (${season._id})`);
      } catch (err) {
        console.error(`[SeasonLifecycle] Failed to activate season ${season._id}:`, err.message);
      }
    }
  } catch (err) {
    console.error('[SeasonLifecycle] Error querying upcoming seasons:', err);
  }

  // End seasons whose endDate has passed but are still 'active'
  try {
    const toEnd = await ChampionshipSeason.find({
      status: 'active',
      endDate: { $lte: now },
    }).lean();

    for (const season of toEnd) {
      try {
        await endSeason(season._id);
        console.log(`[SeasonLifecycle] Ended season: ${season.name} (${season._id})`);
      } catch (err) {
        console.error(`[SeasonLifecycle] Failed to end season ${season._id}:`, err.message);
      }
    }
  } catch (err) {
    console.error('[SeasonLifecycle] Error querying active seasons:', err);
  }
}

/**
 * Starts the season lifecycle background job.
 * Runs immediately on startup, then every 60 seconds.
 */
export function startSeasonLifecycleJob() {
  console.log('[SeasonLifecycle] Starting season lifecycle job (60s interval)');

  // Run immediately on startup
  tick().catch(console.error);

  // Then run on every interval tick
  setInterval(() => {
    tick().catch(console.error);
  }, TICK_INTERVAL_MS);
}
