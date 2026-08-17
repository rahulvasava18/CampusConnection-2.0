import { z } from 'zod';
import { SEARCH_ENTITY_TYPES } from '@campusconnection/shared';

const objectId = z.string().regex(/^[a-f0-9]{24}$/i, 'Expected a MongoDB identifier.');
const entityType = z.enum(SEARCH_ENTITY_TYPES);
const common = {
  q: z.string().trim().min(2).max(100),
  type: entityType.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().max(1000).optional(),
  college: z.string().trim().min(1).max(160).optional(),
  course: z.string().trim().min(1).max(160).optional(),
  communityId: objectId.optional(),
  projectId: objectId.optional(),
  skill: z.string().trim().min(1).max(80).optional(),
  category: z.string().trim().min(1).max(80).optional(),
  teamStatus: z.enum(['RECRUITING', 'ACTIVE', 'COMPLETED', 'ARCHIVED']).optional(),
  projectStatus: z.enum(['PLANNING', 'ACTIVE', 'COMPLETED', 'ARCHIVED']).optional(),
  visibility: z.enum(['PUBLIC', 'CAMPUS', 'PRIVATE', 'CONNECTIONS']).optional(),
  verifiedOnly: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
};
export const searchQuery = z.object(common).strict();
export const autocompleteQuery = z
  .object({ q: z.string().trim().min(1).max(80), type: entityType.optional() })
  .strict();
export const teamMatchParams = z.object({ teamId: objectId }).strict();
export type SearchQueryInput = z.infer<typeof searchQuery>;
export type AutocompleteQueryInput = z.infer<typeof autocompleteQuery>;
