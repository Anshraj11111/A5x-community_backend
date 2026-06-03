import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const authenticate = asyncHandler(async (req, _res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw ApiError.unauthorized('No token provided');
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);

    const user = await User.findById(decoded.id).select('_id role isBanned').lean();

    if (!user) {
      throw ApiError.unauthorized('User no longer exists');
    }

    if (user.isBanned) {
      throw ApiError.forbidden('Your account has been suspended');
    }

    req.user = {
      id: user._id.toString(),
      role: user.role,
    };

    next();
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw ApiError.unauthorized('Invalid or expired token');
  }
});

export const optionalAuth = asyncHandler(async (req, _res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('_id role isBanned').lean();

    if (user && !user.isBanned) {
      req.user = {
        id: user._id.toString(),
        role: user.role,
      };
    }
  } catch {
    // Silently ignore invalid tokens for optional auth
  }

  next();
});
