import { describe, it } from 'vitest';
import { getQaEnvironment } from '../support/test-environment';

describe('database-backed QA environment guard', () => {
  it('requires a dedicated MongoDB database and Redis namespace', () => {
    getQaEnvironment();
  });
});
