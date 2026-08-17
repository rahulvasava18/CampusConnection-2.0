import { z } from 'zod';

export const profileIdParams = z
  .object({
    userId: z.string().regex(/^[a-f0-9]{24}$/i),
  })
  .strict();

export const profileQuery = z
  .object({
    limit: z.coerce.number().int().min(1).max(20).default(12),
    cursor: z.string().trim().min(1).max(500).optional(),
  })
  .strict();
