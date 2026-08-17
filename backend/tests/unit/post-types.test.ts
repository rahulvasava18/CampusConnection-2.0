import { describe, expect, it } from 'vitest';
import { DEFAULT_POST_TYPE, POST_TYPES } from '@campusconnection/shared';
import { postCreateSchema } from '../../src/modules/social/interfaces/social.schemas';

describe('canonical post types', () => {
  it('keeps GENERAL first and makes it the default', () => {
    expect(POST_TYPES).toEqual([
      'GENERAL',
      'DISCUSSION',
      'QUESTION',
      'IDEA',
      'OPPORTUNITY',
      'ANNOUNCEMENT',
    ]);
    expect(DEFAULT_POST_TYPE).toBe('GENERAL');
  });

  it('accepts GENERAL and all existing post categories', () => {
    for (const type of POST_TYPES) {
      expect(postCreateSchema.safeParse({ type, content: 'A valid post', tags: [] }).success).toBe(
        true,
      );
    }
  });
});
