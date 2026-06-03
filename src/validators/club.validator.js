import { z } from 'zod';

export const createClubSchema = z.object({
  name: z.string().min(2).max(50),
  description: z.string().min(10).max(1000),
  isPrivate: z.boolean().optional().default(false),
  tags: z.array(z.string().max(30)).max(10).optional().default([]),
  rules: z.array(z.string().max(200)).max(10).optional().default([]),
});

export const updateClubSchema = z.object({
  name: z.string().min(2).max(50).optional(),
  description: z.string().min(10).max(1000).optional(),
  isPrivate: z.boolean().optional(),
  tags: z.array(z.string().max(30)).max(10).optional(),
  rules: z.array(z.string().max(200)).max(10).optional(),
});
