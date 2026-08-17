import { describe, expect, it } from 'vitest';
import { searchDocumentId } from '../../src/modules/discovery/infrastructure/search.provider';

describe('search persistence identifiers', () => {
  it('uses the MongoDB _id exposed by lean documents', () => {
    expect(searchDocumentId({ _id: '507f1f77bcf86cd799439011' })).toBe('507f1f77bcf86cd799439011');
  });

  it('keeps hydrated document ids and rejects missing identifiers', () => {
    expect(searchDocumentId({ id: '507f1f77bcf86cd799439011' })).toBe('507f1f77bcf86cd799439011');
    expect(() => searchDocumentId({})).toThrow('SEARCH_DOCUMENT_ID_MISSING');
  });
});
