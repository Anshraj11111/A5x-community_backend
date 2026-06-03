import { BugReport } from '../models/BugReport.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { getPagination, buildPaginationMeta } from '../utils/pagination.js';
import { createNotification } from '../services/notification.service.js';

const REPORTER_SELECT = 'username displayName avatarUrl';

export const getBugs = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const { status, severity, sort } = req.query;

  const filter = { isDeleted: false };
  if (status) filter.status = status;
  if (severity) filter.severity = severity;

  const sortMap = {
    latest: { createdAt: -1 },
    severity: { severity: -1, createdAt: -1 },
  };
  const sortOrder = sortMap[sort || 'latest'] || sortMap.latest;

  const [bugs, total] = await Promise.all([
    BugReport.find(filter)
      .sort(sortOrder)
      .skip(skip)
      .limit(limit)
      .populate('reporter', REPORTER_SELECT)
      .lean(),
    BugReport.countDocuments(filter),
  ]);

  ApiResponse.paginated(res, bugs, buildPaginationMeta(total, page, limit));
});

export const getBug = asyncHandler(async (req, res) => {
  const bug = await BugReport.findOne({ _id: req.params.id, isDeleted: false })
    .populate('reporter', REPORTER_SELECT)
    .lean();

  if (!bug) throw ApiError.notFound('Bug report not found');

  ApiResponse.success(res, { bug });
});

export const createBug = asyncHandler(async (req, res) => {
  const { title, description, steps, severity, attachments } = req.body;

  const bug = await BugReport.create({
    reporter: req.user.id,
    title,
    description,
    steps,
    severity,
    attachments: attachments || [],
  });

  const populated = await bug.populate('reporter', REPORTER_SELECT);
  ApiResponse.created(res, { bug: populated });
});

export const updateBugStatus = asyncHandler(async (req, res) => {
  const { status, adminNote } = req.body;

  const bug = await BugReport.findOneAndUpdate(
    { _id: req.params.id, isDeleted: false },
    { $set: { status, adminNote } },
    { new: true }
  ).populate('reporter', REPORTER_SELECT);

  if (!bug) throw ApiError.notFound('Bug report not found');

  await createNotification({
    recipient: bug.reporter._id,
    sender: null,
    type: 'bug_status_change',
    entityId: bug._id,
    entityType: 'bug',
    message: `Your bug report "${bug.title}" status changed to ${status}`,
  });

  ApiResponse.success(res, { bug });
});

export const deleteBug = asyncHandler(async (req, res) => {
  const bug = await BugReport.findOne({ _id: req.params.id, isDeleted: false });
  if (!bug) throw ApiError.notFound('Bug report not found');

  if (bug.reporter.toString() !== req.user.id && req.user.role === 'user') {
    throw ApiError.forbidden('You can only delete your own bug reports');
  }

  bug.isDeleted = true;
  await bug.save();

  ApiResponse.success(res, null, 'Bug report deleted');
});
