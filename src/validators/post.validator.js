import { z } from 'zod';

export const createPostSchema = z.object({
  title: z.string().min(5).max(200),
  content: z.string().min(10).max(50000),
  type: z.enum(['discussion', 'question', 'announcement']).default('discussion'),
  tags: z.array(z.string().max(30)).max(10).optional().default([]),
  images: z.array(z.string().url()).max(10).optional().default([]),
  clubId: z.string().optional(),
});

export const updatePostSchema = z.object({
  title: z.string().min(5).max(200).optional(),
  content: z.string().min(10).max(50000).optional(),
  tags: z.array(z.string().max(30)).max(10).optional(),
  images: z.array(z.string().url()).max(10).optional(),
});
