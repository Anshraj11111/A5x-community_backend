import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { env } from '../config/env.js';

const signToken = (userId, role) => {
  return jwt.sign({ id: userId, role }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  });
};

export const register = asyncHandler(async (req, res) => {
  const { username, displayName, email, password } = req.body;

  // Check if email already exists
  const emailExists = await User.findOne({ email: email.toLowerCase() });
  if (emailExists) {
    throw ApiError.conflict('Email is already registered');
  }

  // Check username availability
  const usernameTaken = await User.findOne({ username: username.toLowerCase() });
  if (usernameTaken) {
    throw ApiError.conflict('Username is already taken');
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 12);

  const user = await User.create({
    username: username.toLowerCase(),
    displayName,
    email: email.toLowerCase(),
    password: hashedPassword,
  });

  const token = signToken(user._id.toString(), user.role);

  // Don't return password
  const userObj = user.toObject();
  delete userObj.password;

  ApiResponse.created(res, { user: userObj, token }, 'Account created successfully');
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email: email.toLowerCase() })
    .select('+password')
    .populate('badges', 'name slug icon tier color');

  if (!user) {
    throw ApiError.unauthorized('Invalid email or password');
  }

  const isPasswordCorrect = await bcrypt.compare(password, user.password);
  if (!isPasswordCorrect) {
    throw ApiError.unauthorized('Invalid email or password');
  }

  if (user.isBanned) {
    throw ApiError.forbidden(`Account suspended: ${user.banReason || 'Policy violation'}`);
  }

  const token = signToken(user._id.toString(), user.role);

  const userObj = user.toObject();
  delete userObj.password;

  ApiResponse.success(res, { user: userObj, token }, 'Login successful');
});

export const getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id)
    .populate('badges', 'name slug icon tier color')
    .lean();

  if (!user) throw ApiError.notFound('User not found');

  ApiResponse.success(res, { user });
});

/**
 * GET /auth/club-moderator-check
 * Returns whether the authenticated user is a club moderator in any club.
 * Used by the admin portal login to grant club-admin access.
 */
export const checkClubModerator = asyncHandler(async (req, res) => {
  const { ClubMember } = await import('../models/ClubMember.js');

  const modMembership = await ClubMember.findOne({
    user: req.user.id,
    role: { $in: ['moderator', 'owner'] },
  })
    .populate('club', 'name slug icon')
    .lean();

  ApiResponse.success(res, {
    isClubModerator: !!modMembership,
    club: modMembership?.club ?? null,
  });
});

export const logout = asyncHandler(async (_req, res) => {
  ApiResponse.success(res, null, 'Logged out successfully');
});

export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const user = await User.findById(req.user.id).select('+password');
  if (!user) throw ApiError.notFound('User not found');

  const isCorrect = await bcrypt.compare(currentPassword, user.password);
  if (!isCorrect) throw ApiError.unauthorized('Current password is incorrect');

  user.password = await bcrypt.hash(newPassword, 12);
  await user.save();

  ApiResponse.success(res, null, 'Password changed successfully');
});
