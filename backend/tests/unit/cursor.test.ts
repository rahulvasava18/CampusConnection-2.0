import { describe, expect, it } from 'vitest';
import { decodeCursor, encodeCursor } from '@campusconnection/shared';

describe('cursor primitives', () => {
  it('round-trips the default createdAt and id ordering position', () => {
    const position = { createdAt: '2026-08-14T00:00:00.000Z', id: '507f1f77bcf86cd799439011' };
    expect(decodeCursor(encodeCursor(position))).toEqual(position);
  });

  it('rejects malformed cursor data', () => {
    expect(() => decodeCursor('not-a-valid-json-cursor')).toThrow();
  });
});
