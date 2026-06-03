import { ZodError } from 'zod';
import { ApiError } from '../utils/ApiError.js';

export const validate = (schema) => {
  return (req, _res, next) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const messages = err.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
        throw ApiError.badRequest(`Validation failed: ${messages}`, 'VALIDATION_ERROR');
      }
      next(err);
    }
  };
};

export const validateQuery = (schema) => {
  return (req, _res, next) => {
    try {
      req.query = schema.parse(req.query);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const messages = err.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
        throw ApiError.badRequest(`Invalid query params: ${messages}`, 'VALIDATION_ERROR');
      }
      next(err);
    }
  };
};
