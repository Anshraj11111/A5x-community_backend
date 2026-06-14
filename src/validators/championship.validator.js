import { z } from 'zod';

const scoringRulesSchema = z.object({
  post: z.number().int().min(0).default(10),
  comment: z.number().int().min(0).default(3),
  upvoteReceived: z.number().int().min(0).default(2),
  showcasePost: z.number().int().min(0).default(20),
  featureRequest: z.number().int().min(0).default(8),
  bugReport: z.number().int().min(0).default(5),
  pollCreated: z.number().int().min(0).default(4),
});

const rewardsSchema = z.object({
  first: z.string().default('season-champion'),
  second: z.string().default('season-runner-up'),
  third: z.string().default('season-third-place'),
});

const baseSeasonSchema = z.object({
  name: z.string().min(3).max(100),
  description: z.string().max(500).optional(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  scoringRules: scoringRulesSchema.optional(),
  rewards: rewardsSchema.optional(),
});

export const createSeasonSchema = baseSeasonSchema.refine(
  (data) => new Date(data.endDate) > new Date(data.startDate),
  { message: 'endDate must be after startDate', path: ['endDate'] }
);

export const updateSeasonSchema = baseSeasonSchema.partial().refine(
  (data) => {
    if (data.startDate && data.endDate) {
      return new Date(data.endDate) > new Date(data.startDate);
    }
    return true;
  },
  { message: 'endDate must be after startDate', path: ['endDate'] }
);
