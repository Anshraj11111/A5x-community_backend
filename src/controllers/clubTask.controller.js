import { ClubTask } from '../models/ClubTask.js';
import { ClubTaskCompletion } from '../models/ClubTaskCompletion.js';
import { ClubMember } from '../models/ClubMember.js';
import { awardPoints } from '../services/championship.service.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { getPagination, buildPaginationMeta } from '../utils/pagination.js';

// ─── Public ──────────────────────────────────────────────────────────────────

/**
 * GET /club-tasks
 * All active tasks — visible to everyone (including non-logged-in users).
 * Enriched with 'completedByMyClub' if user is authenticated.
 */
export const getAllTasks = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);

  const [tasks, total] = await Promise.all([
    ClubTask.find({ isActive: true })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('season', 'name status')
      .lean(),
    ClubTask.countDocuments({ isActive: true }),
  ]);

  // Enrich with completion count per task + user's club completion
  const taskIds = tasks.map(t => t._id);
  const completions = await ClubTaskCompletion.find({ task: { $in: taskIds } })
    .populate('club', 'name slug icon')
    .lean();

  // Group completions by taskId
  const completionMap = new Map();
  for (const c of completions) {
    const tid = c.task.toString();
    if (!completionMap.has(tid)) completionMap.set(tid, []);
    completionMap.get(tid).push(c);
  }

  // User's club memberships
  let userClubIds = new Set();
  if (req.user) {
    const memberships = await ClubMember.find({ user: req.user.id }).lean();
    userClubIds = new Set(memberships.map(m => m.club.toString()));
  }

  const enriched = tasks.map(task => {
    const taskCompletions = completionMap.get(task._id.toString()) ?? [];
    const myClubCompleted = taskCompletions.some(c =>
      userClubIds.has(c.club._id?.toString() ?? c.club.toString())
    );
    return {
      ...task,
      completedByClubs: taskCompletions.map(c => ({
        club: c.club,
        completedAt: c.completedAt,
      })),
      completedCount: taskCompletions.length,
      myClubCompleted,
    };
  });

  ApiResponse.paginated(res, enriched, buildPaginationMeta(total, page, limit));
});

/**
 * GET /club-tasks/:taskId/completions
 * All clubs that completed a task — for leaderboard display.
 */
export const getTaskCompletions = asyncHandler(async (req, res) => {
  const task = await ClubTask.findById(req.params.taskId).lean();
  if (!task) throw ApiError.notFound('Task not found');

  const completions = await ClubTaskCompletion.find({ task: task._id })
    .sort({ completedAt: 1 })
    .populate('club', 'name slug icon memberCount')
    .populate('completedBy', 'username displayName avatarUrl')
    .lean();

  ApiResponse.success(res, { task, completions });
});

// ─── Member actions ───────────────────────────────────────────────────────────

/**
 * POST /club-tasks/:taskId/complete
 * A club member marks a task as completed for their club.
 * Body: { clubSlug, note? }
 */
export const completeTask = asyncHandler(async (req, res) => {
  const task = await ClubTask.findById(req.params.taskId).lean();
  if (!task) throw ApiError.notFound('Task not found');
  if (!task.isActive) throw ApiError.badRequest('This task is no longer active');

  const { clubSlug, note } = req.body;
  if (!clubSlug) throw ApiError.badRequest('clubSlug is required');

  // Import ProductClub inline to avoid circular deps
  const { ProductClub } = await import('../models/ProductClub.js');
  const club = await ProductClub.findOne({ slug: clubSlug }).lean();
  if (!club) throw ApiError.notFound('Club not found');

  // Must be a member of the club
  const membership = await ClubMember.findOne({ club: club._id, user: req.user.id });
  if (!membership) throw ApiError.forbidden('You must be a member of this club to complete tasks for it');

  // Already completed by this club?
  const existing = await ClubTaskCompletion.findOne({ task: task._id, club: club._id });
  if (existing) throw ApiError.conflict('Your club already completed this task');

  await ClubTaskCompletion.create({
    task: task._id,
    club: club._id,
    completedBy: req.user.id,
    note: note?.trim() || undefined,
  });

  // Award championship points if task is linked to a season
  if (task.season) {
    awardPoints({
      userId: req.user.id,
      clubId: club._id.toString(),
      action: 'post', // use 'post' action as proxy — points = task.points via direct DB update
    }).catch(console.error);

    // Directly increment score for the actual task points amount
    const { ClubChampionshipScore } = await import('../models/ClubChampionshipScore.js');
    await ClubChampionshipScore.findOneAndUpdate(
      { season: task.season, club: club._id },
      {
        $inc: { totalScore: task.points, 'breakdown.post': task.points },
        $set: { lastScoredAt: new Date() },
      },
      { upsert: true, new: true }
    );

    // Trigger rank recompute
    const { recomputeRanks } = await import('../services/championship.service.js');
    recomputeRanks(task.season.toString());
  }

  ApiResponse.success(res, null, `Task completed! +${task.points} pts for ${club.name}`);
});

// ─── Founder / Admin ──────────────────────────────────────────────────────────

/**
 * POST /club-tasks
 * Founder creates a task.
 */
export const createTask = asyncHandler(async (req, res) => {
  const { title, description, points, seasonId, dueDate } = req.body;

  const task = await ClubTask.create({
    title: title.trim(),
    description: description.trim(),
    points: points ?? 50,
    season: seasonId || undefined,
    dueDate: dueDate || undefined,
    createdBy: req.user.id,
    isActive: true,
  });

  const populated = await task.populate('season', 'name status');
  ApiResponse.created(res, { task: populated });
});

/**
 * PATCH /club-tasks/:taskId
 * Founder updates a task.
 */
export const updateTask = asyncHandler(async (req, res) => {
  const task = await ClubTask.findById(req.params.taskId);
  if (!task) throw ApiError.notFound('Task not found');

  const { title, description, points, isActive, dueDate } = req.body;
  if (title !== undefined) task.title = title.trim();
  if (description !== undefined) task.description = description.trim();
  if (points !== undefined) task.points = points;
  if (isActive !== undefined) task.isActive = isActive;
  if (dueDate !== undefined) task.dueDate = dueDate || undefined;

  await task.save();
  ApiResponse.success(res, { task });
});

/**
 * DELETE /club-tasks/:taskId
 * Founder deletes a task.
 */
export const deleteTask = asyncHandler(async (req, res) => {
  const task = await ClubTask.findById(req.params.taskId);
  if (!task) throw ApiError.notFound('Task not found');

  await ClubTaskCompletion.deleteMany({ task: task._id });
  await task.deleteOne();

  ApiResponse.success(res, null, 'Task deleted');
});
