import { ApiError } from '../utils/ApiError.js';

const roleHierarchy = {
  user: 1,
  moderator: 2,
  admin: 3,
};

export const authorize = (...roles) => {
  return (req, _res, next) => {
    if (!req.user) {
      throw ApiError.unauthorized();
    }

    const userLevel = roleHierarchy[req.user.role];
    const requiredLevel = Math.min(...roles.map((r) => roleHierarchy[r]));

    if (userLevel < requiredLevel) {
      throw ApiError.forbidden('Insufficient permissions');
    }

    next();
  };
};

export const requireAdmin = authorize('admin');
export const requireModerator = authorize('moderator');
