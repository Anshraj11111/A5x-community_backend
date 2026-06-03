import { z } from 'zod';

export const createFeatureSchema = z.object({
  title: z.string().min(5).max(200),
  description: z.string().min(20).max(5000),
  tags: z.array(z.string().max(30)).max(10).optional().default([]),
});

export const updateFeatureStatusSchema = z.object({
  status: z.enum(['open', 'under_review', 'planned', 'in_development', 'released', 'rejected']),
  adminNote: z.string().max(2000).optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
});
