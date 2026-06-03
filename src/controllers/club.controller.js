import { ProductClub } from '../models/ProductClub.js';
import { ClubMember } from '../models/ClubMember.js';
import { Post } from '../models/Post.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { getPagination, buildPaginationMeta } from '../utils/pagination.js';
import { slugify } from '../utils/slugify.js';
import { getFileUrl, deleteFile } from '../services/upload.service.js';

const OWNER_SELECT = 'username displayName avatarUrl';

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
  if (req.user) {
    const memberships = await ClubMember.find({ user: req.user.id }).lean();
    memberClubIds = new Set(memberships.map((m) => m.club.toString()));
  }

  const enriched = clubs.map((c) => ({
    ...c,
    isMember: memberClubIds.has(c._id.toString()),
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

  if (req.user) {
    const membership = await ClubMember.findOne({ club: club._id, user: req.user.id }).lean();
    isMember = !!membership;
    memberRole = membership?.role;
  }

  ApiResponse.success(res, { club: { ...club, isMember, memberRole } });
});

export const createClub = asyncHandler(async (req, res) => {
  const { name, description, isPrivate, tags, rules } = req.body;

  const slug = slugify(name);
  const existing = await ProductClub.findOne({ slug });
  if (existing) throw ApiError.conflict('A club with that name already exists');

  const club = await ProductClub.create({
    name,
    slug,
    description,
    isPrivate,
    tags,
    rules,
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

export const uploadClubCover = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('No file uploaded');

  const club = await ProductClub.findOne({ slug: req.params.slug });
  if (!club) throw ApiError.notFound('Club not found');

  const membership = await ClubMember.findOne({ club: club._id, user: req.user.id });
  if (!membership || membership.role !== 'owner') {
    throw ApiError.forbidden('Only club owners can update the cover image');
  }

  // Delete old cover
  if (club.coverImage) deleteFile(club.coverImage);

  club.coverImage = getFileUrl(req.file.filename);
  await club.save();

  ApiResponse.success(res, { coverImage: club.coverImage });
});

export const joinClub = asyncHandler(async (req, res) => {
  const club = await ProductClub.findOne({ slug: req.params.slug });
  if (!club) throw ApiError.notFound('Club not found');

  const existing = await ClubMember.findOne({ club: club._id, user: req.user.id });
  if (existing) throw ApiError.conflict('You are already a member of this club');

  await ClubMember.create({ club: club._id, user: req.user.id, role: 'member' });
  await ProductClub.findByIdAndUpdate(club._id, { $inc: { memberCount: 1 } });

  ApiResponse.success(res, null, 'Joined club successfully');
});

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

export const getClubMembers = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const club = await ProductClub.findOne({ slug: req.params.slug }).lean();
  if (!club) throw ApiError.notFound('Club not found');

  const [members, total] = await Promise.all([
    ClubMember.find({ club: club._id })
      .sort({ role: 1, joinedAt: 1 })
      .skip(skip)
      .limit(limit)
      .populate('user', 'username displayName avatarUrl isVerified')
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
