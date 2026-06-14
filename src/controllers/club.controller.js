import { ProductClub } from '../models/ProductClub.js';
import { ClubMember } from '../models/ClubMember.js';
import { ClubJoinRequest } from '../models/ClubJoinRequest.js';
import { Post } from '../models/Post.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { getPagination, buildPaginationMeta } from '../utils/pagination.js';
import { slugify } from '../utils/slugify.js';
import { getFileUrl, deleteFile } from '../services/upload.service.js';
import { createNotification } from '../services/notification.service.js';

const OWNER_SELECT = 'username displayName avatarUrl';

// ─── Public / shared ──────────────────────────────────────────────────────────

export const getClubs = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const { search } = req.query;

  const filter = {};
  if (search) filter.$text = { $search: search };

  const [clubs, total] = await Promise.all([
    ProductClub.find(filter)
      .sort({ memberCount: -1 })
      .skip(skip)
      .limit(limit)
      .populate('owner', OWNER_SELECT)
      .lean(),
    ProductClub.countDocuments(filter),
  ]);

  let memberClubIds = new Set();
  let pendingClubIds = new Set();

  if (req.user) {
    const [memberships, requests] = await Promise.all([
      ClubMember.find({ user: req.user.id }).lean(),
      ClubJoinRequest.find({ user: req.user.id, status: 'pending' }).lean(),
    ]);
    memberClubIds = new Set(memberships.map((m) => m.club.toString()));
    pendingClubIds = new Set(requests.map((r) => r.club.toString()));
  }

  const enriched = clubs.map((c) => ({
    ...c,
    isMember: memberClubIds.has(c._id.toString()),
    hasPendingRequest: pendingClubIds.has(c._id.toString()),
  }));

  ApiResponse.paginated(res, enriched, buildPaginationMeta(total, page, limit));
});

export const getClub = asyncHandler(async (req, res) => {
  const club = await ProductClub.findOne({ slug: req.params.slug })
    .populate('owner', OWNER_SELECT)
    .lean();

  if (!club) throw ApiError.notFound('Club not found');

  let isMember = false;
  let memberRole;
  let hasPendingRequest = false;

  if (req.user) {
    const [membership, request] = await Promise.all([
      ClubMember.findOne({ club: club._id, user: req.user.id }).lean(),
      ClubJoinRequest.findOne({ club: club._id, user: req.user.id, status: 'pending' }).lean(),
    ]);
    isMember = !!membership;
    memberRole = membership?.role;
    hasPendingRequest = !!request;
  }

  ApiResponse.success(res, { club: { ...club, isMember, memberRole, hasPendingRequest } });
});

// ─── Club creation — founder / admin only ────────────────────────────────────

export const createClub = asyncHandler(async (req, res) => {
  const { name, description, isPrivate, tags, rules } = req.body;

  const slug = slugify(name);
  const existing = await ProductClub.findOne({ slug });
  if (existing) throw ApiError.conflict('A club with that name already exists');

  const club = await ProductClub.create({
    name,
    slug,
    description,
    isPrivate: isPrivate ?? false,
    tags: tags ?? [],
    rules: rules ?? [],
    owner: req.user.id,
  });

  await ClubMember.create({ club: club._id, user: req.user.id, role: 'owner' });

  const populated = await club.populate('owner', OWNER_SELECT);
  ApiResponse.created(res, { club: populated });
});

export const updateClub = asyncHandler(async (req, res) => {
  const club = await ProductClub.findOne({ slug: req.params.slug });
  if (!club) throw ApiError.notFound('Club not found');

  const membership = await ClubMember.findOne({ club: club._id, user: req.user.id });
  if (!membership || !['owner', 'moderator'].includes(membership.role)) {
    throw ApiError.forbidden('Only club owners and moderators can update the club');
  }

  const { name, description, isPrivate, tags, rules } = req.body;
  if (name) club.name = name;
  if (description) club.description = description;
  if (isPrivate !== undefined) club.isPrivate = isPrivate;
  if (tags) club.tags = tags;
  if (rules) club.rules = rules;

  await club.save();
  ApiResponse.success(res, { club });
});

export const deleteClub = asyncHandler(async (req, res) => {
  const club = await ProductClub.findOne({ slug: req.params.slug });
  if (!club) throw ApiError.notFound('Club not found');

  // Only founder/admin OR club owner can delete
  const isFounderOrAdmin = ['founder', 'co_founder', 'admin'].includes(req.user.role);
  if (!isFounderOrAdmin) {
    const membership = await ClubMember.findOne({ club: club._id, user: req.user.id });
    if (!membership || membership.role !== 'owner') {
      throw ApiError.forbidden('Only founders/admins or club owners can delete a club');
    }
  }

  // Clean up related data
  await ClubMember.deleteMany({ club: club._id });
  await ClubJoinRequest.deleteMany({ club: club._id });
  if (club.coverImage) deleteFile(club.coverImage);
  await club.deleteOne();

  ApiResponse.success(res, null, 'Club deleted successfully');
});

export const uploadClubCover = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('No file uploaded');

  const club = await ProductClub.findOne({ slug: req.params.slug });
  if (!club) throw ApiError.notFound('Club not found');

  const isFounderOrAdmin = ['founder', 'co_founder', 'admin'].includes(req.user.role);
  if (!isFounderOrAdmin) {
    const membership = await ClubMember.findOne({ club: club._id, user: req.user.id });
    if (!membership || membership.role !== 'owner') {
      throw ApiError.forbidden('Only club owners can update the cover image');
    }
  }

  if (club.coverImage) deleteFile(club.coverImage);
  club.coverImage = getFileUrl(req.file);
  await club.save();

  ApiResponse.success(res, { coverImage: club.coverImage });
});

export const uploadClubIcon = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('No file uploaded');

  const club = await ProductClub.findOne({ slug: req.params.slug });
  if (!club) throw ApiError.notFound('Club not found');

  const isFounderOrAdmin = ['founder', 'co_founder', 'admin'].includes(req.user.role);
  if (!isFounderOrAdmin) {
    const membership = await ClubMember.findOne({ club: club._id, user: req.user.id });
    if (!membership || membership.role !== 'owner') {
      throw ApiError.forbidden('Only club owners can update the club icon');
    }
  }

  if (club.icon) deleteFile(club.icon);
  club.icon = getFileUrl(req.file);
  await club.save();

  ApiResponse.success(res, { icon: club.icon });
});

// ─── Join Request flow ────────────────────────────────────────────────────────

/**
 * POST /clubs/:slug/request-join
 * - Public clubs  → direct join (no approval needed)
 * - Private clubs → creates a pending request, notifies owner
 */
export const requestJoinClub = asyncHandler(async (req, res) => {
  const club = await ProductClub.findOne({ slug: req.params.slug });
  if (!club) throw ApiError.notFound('Club not found');

  // Already a member?
  const existing = await ClubMember.findOne({ club: club._id, user: req.user.id });
  if (existing) throw ApiError.conflict('You are already a member of this club');

  // ── Public club → direct join ─────────────────────────────────────────────
  if (!club.isPrivate) {
    await ClubMember.create({ club: club._id, user: req.user.id, role: 'member' });
    await ProductClub.findByIdAndUpdate(club._id, { $inc: { memberCount: 1 } });
    return ApiResponse.success(res, null, 'Joined club successfully');
  }

  // ── Private club → join request ───────────────────────────────────────────
  const existingReq = await ClubJoinRequest.findOne({
    club: club._id,
    user: req.user.id,
    status: 'pending',
  });
  if (existingReq) throw ApiError.conflict('You already have a pending join request for this club');

  const { message } = req.body;
  await ClubJoinRequest.create({
    club: club._id,
    user: req.user.id,
    message: message || undefined,
    status: 'pending',
  });

  // Notify the club owner AND all club moderators
  await createNotification({
    recipient: club.owner,
    sender: req.user.id,
    type: 'club_join_request',
    entityId: club._id,
    entityType: 'club',
    message: `Someone requested to join your private club "${club.name}"`,
  });

  // Also notify club moderators
  const moderators = await ClubMember.find({ club: club._id, role: 'moderator' }).lean();
  for (const mod of moderators) {
    await createNotification({
      recipient: mod.user,
      sender: req.user.id,
      type: 'club_join_request',
      entityId: club._id,
      entityType: 'club',
      message: `Someone requested to join "${club.name}" — you can approve as club moderator`,
    });
  }

  return ApiResponse.success(res, null, 'Join request sent successfully');
});

/**
 * GET /clubs/:slug/join-requests
 * Founder / admin sees all pending requests for a club they own.
 */
export const getJoinRequests = asyncHandler(async (req, res) => {
  const club = await ProductClub.findOne({ slug: req.params.slug }).lean();
  if (!club) throw ApiError.notFound('Club not found');

  // Must be founder/admin OR club owner/moderator
  const isFounderOrAdmin = ['founder', 'co_founder', 'admin'].includes(req.user.role);
  if (!isFounderOrAdmin) {
    const membership = await ClubMember.findOne({ club: club._id, user: req.user.id });
    if (!membership || !['owner', 'moderator'].includes(membership.role)) {
      throw ApiError.forbidden('Only club owners/moderators or founders can view join requests');
    }
  }

  const { status = 'pending' } = req.query;
  const { page, limit, skip } = getPagination(req.query);

  const [requests, total] = await Promise.all([
    ClubJoinRequest.find({ club: club._id, status })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('user', 'username displayName avatarUrl isVerified')
      .lean(),
    ClubJoinRequest.countDocuments({ club: club._id, status }),
  ]);

  ApiResponse.paginated(res, requests, buildPaginationMeta(total, page, limit));
});

/**
 * PATCH /clubs/:slug/join-requests/:requestId
 * Founder / admin accepts or rejects a join request.
 * Body: { action: 'accept' | 'reject' }
 */
export const handleJoinRequest = asyncHandler(async (req, res) => {
  const club = await ProductClub.findOne({ slug: req.params.slug });
  if (!club) throw ApiError.notFound('Club not found');

  // Must be founder/admin OR club owner/moderator
  const isFounderOrAdmin = ['founder', 'co_founder', 'admin'].includes(req.user.role);
  if (!isFounderOrAdmin) {
    const membership = await ClubMember.findOne({ club: club._id, user: req.user.id });
    if (!membership || !['owner', 'moderator'].includes(membership.role)) {
      throw ApiError.forbidden('Only club owners/moderators or founders can handle join requests');
    }
  }

  const request = await ClubJoinRequest.findOne({
    _id: req.params.requestId,
    club: club._id,
    status: 'pending',
  });
  if (!request) throw ApiError.notFound('Join request not found or already processed');

  const { action } = req.body;
  if (!['accept', 'reject'].includes(action)) {
    throw ApiError.badRequest('action must be "accept" or "reject"');
  }

  request.status = action === 'accept' ? 'accepted' : 'rejected';
  request.reviewedBy = req.user.id;
  request.reviewedAt = new Date();
  await request.save();

  if (action === 'accept') {
    // Add as member (guard against race condition)
    const alreadyMember = await ClubMember.findOne({ club: club._id, user: request.user });
    if (!alreadyMember) {
      await ClubMember.create({ club: club._id, user: request.user, role: 'member' });
      await ProductClub.findByIdAndUpdate(club._id, { $inc: { memberCount: 1 } });
    }

    await createNotification({
      recipient: request.user,
      sender: req.user.id,
      type: 'club_request_accepted',
      entityId: club._id,
      entityType: 'club',
      message: `Your request to join "${club.name}" was accepted! Welcome to the club.`,
    });
  } else {
    await createNotification({
      recipient: request.user,
      sender: req.user.id,
      type: 'club_request_rejected',
      entityId: club._id,
      entityType: 'club',
      message: `Your request to join "${club.name}" was not approved.`,
    });
  }

  ApiResponse.success(
    res,
    null,
    action === 'accept' ? 'Request accepted — user added to club' : 'Request rejected'
  );
});

/**
 * GET /clubs/join-requests/all
 * Founder/admin → all pending requests across ALL clubs.
 * Club moderator → only their clubs' pending requests.
 */
export const getAllPendingRequests = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);

  const isFounderOrAdmin = ['founder', 'co_founder', 'admin'].includes(req.user.role);

  let filter = { status: 'pending' };

  if (!isFounderOrAdmin) {
    // Club moderator: only see requests for clubs they moderate
    const modMemberships = await ClubMember.find({
      user: req.user.id,
      role: { $in: ['moderator', 'owner'] },
    }).lean();

    if (modMemberships.length === 0) {
      return ApiResponse.paginated(res, [], { total: 0, page: 1, limit, totalPages: 0, hasNext: false, hasPrev: false });
    }
    const clubIds = modMemberships.map(m => m.club);
    filter = { status: 'pending', club: { $in: clubIds } };
  }

  const [requests, total] = await Promise.all([
    ClubJoinRequest.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('user', 'username displayName avatarUrl isVerified')
      .populate('club', 'name slug icon')
      .lean(),
    ClubJoinRequest.countDocuments(filter),
  ]);

  ApiResponse.paginated(res, requests, buildPaginationMeta(total, page, limit));
});

// ─── Leave ────────────────────────────────────────────────────────────────────

export const leaveClub = asyncHandler(async (req, res) => {
  const club = await ProductClub.findOne({ slug: req.params.slug });
  if (!club) throw ApiError.notFound('Club not found');

  const membership = await ClubMember.findOne({ club: club._id, user: req.user.id });
  if (!membership) throw ApiError.notFound('You are not a member of this club');

  if (membership.role === 'owner') {
    throw ApiError.badRequest('Club owners cannot leave. Transfer ownership first.');
  }

  await membership.deleteOne();
  await ProductClub.findByIdAndUpdate(club._id, { $inc: { memberCount: -1 } });

  ApiResponse.success(res, null, 'Left club successfully');
});

// ─── Members / Posts ──────────────────────────────────────────────────────────

export const getClubMembers = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const club = await ProductClub.findOne({ slug: req.params.slug }).lean();
  if (!club) throw ApiError.notFound('Club not found');

  // Include email for all — members use it to contact each other
  const [members, total] = await Promise.all([
    ClubMember.find({ club: club._id })
      .sort({ role: 1, joinedAt: 1 })
      .skip(skip)
      .limit(limit)
      .populate('user', 'username displayName avatarUrl isVerified email')
      .lean(),
    ClubMember.countDocuments({ club: club._id }),
  ]);

  ApiResponse.paginated(res, members, buildPaginationMeta(total, page, limit));
});

export const getClubPosts = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const club = await ProductClub.findOne({ slug: req.params.slug }).lean();
  if (!club) throw ApiError.notFound('Club not found');

  const [posts, total] = await Promise.all([
    Post.find({ club: club._id, isDeleted: false })
      .sort({ isPinned: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('author', 'username displayName avatarUrl isVerified')
      .lean(),
    Post.countDocuments({ club: club._id, isDeleted: false }),
  ]);

  ApiResponse.paginated(res, posts, buildPaginationMeta(total, page, limit));
});

/**
 * PATCH /clubs/:slug/members/:userId/role
 * Founder promotes a club member to moderator (or demotes back to member).
 * Body: { role: 'moderator' | 'member' }
 */
export const updateMemberRole = asyncHandler(async (req, res) => {
  const club = await ProductClub.findOne({ slug: req.params.slug }).lean();
  if (!club) throw ApiError.notFound('Club not found');

  // Only founder/admin can promote
  const isFounderOrAdmin = ['founder', 'co_founder', 'admin'].includes(req.user.role);
  if (!isFounderOrAdmin) throw ApiError.forbidden('Only founders can promote club members');

  const { role } = req.body;
  if (!['moderator', 'member'].includes(role)) {
    throw ApiError.badRequest('role must be "moderator" or "member"');
  }

  const membership = await ClubMember.findOne({ club: club._id, user: req.params.userId });
  if (!membership) throw ApiError.notFound('User is not a member of this club');
  if (membership.role === 'owner') throw ApiError.badRequest('Cannot change the owner\'s role');

  membership.role = role;
  await membership.save();

  await membership.populate('user', 'username displayName avatarUrl');

  ApiResponse.success(res, { membership }, `Member ${role === 'moderator' ? 'promoted to moderator' : 'demoted to member'}`);
});
