import { describe, expect, it } from 'vitest';
import {
  milestoneUpdate,
  projectCreate,
  projectJoinRequestCreate,
  projectListQuery,
  projectOwnershipTransfer,
  projectResourceCreate,
  projectUpdate,
  taskStatus,
} from '../../src/modules/collaboration/interfaces/collaboration.schemas';

describe('project feature boundaries', () => {
  const userId = '507f1f77bcf86cd799439011';

  it('accepts the canonical project creation fields with an optional deadline', () => {
    const result = projectCreate.safeParse({
      name: 'Campus Marketplace',
      slug: 'campus-marketplace',
      description: 'A marketplace for student builders.',
      objective: 'Help students exchange useful resources.',
      category: 'Technology',
      tags: ['campus', 'marketplace'],
      visibility: 'PUBLIC',
      technologies: ['React', 'MongoDB'],
      lookingFor: ['Designer'],
    });
    expect(result.success).toBe(true);
  });

  it('accepts project discovery and membership workflow inputs', () => {
    expect(
      projectListQuery.safeParse({ limit: '20', search: 'campus', status: 'ACTIVE' }).success,
    ).toBe(true);
    expect(
      projectJoinRequestCreate.safeParse({ message: 'I can help with the API.' }).success,
    ).toBe(true);
    expect(projectOwnershipTransfer.safeParse({ userId }).success).toBe(true);
    expect(projectUpdate.safeParse({ visibility: 'PRIVATE', category: 'Research' }).success).toBe(
      true,
    );
    expect(
      projectCreate.safeParse({
        name: 'Private Project',
        slug: 'private-project',
        description: 'A private project.',
        objective: 'Ship a useful prototype.',
        category: 'Research',
        visibility: 'PRIVATE',
        technologies: [],
        lookingFor: [],
      }).success,
    ).toBe(true);
  });

  it('accepts the canonical project work and resource states', () => {
    expect(taskStatus.safeParse({ status: 'TODO' }).success).toBe(true);
    expect(taskStatus.safeParse({ status: 'IN_PROGRESS' }).success).toBe(true);
    expect(taskStatus.safeParse({ status: 'DONE' }).success).toBe(true);
    expect(taskStatus.safeParse({ status: 'BLOCKED' }).success).toBe(false);
    expect(milestoneUpdate.safeParse({ status: 'UPCOMING' }).success).toBe(true);
    expect(milestoneUpdate.safeParse({ status: 'COMPLETED' }).success).toBe(true);
    expect(
      projectResourceCreate.safeParse({
        title: 'Repository',
        url: 'https://github.com/example/project',
        type: 'REPOSITORY',
      }).success,
    ).toBe(true);
  });

  it('rejects legacy visibility and unknown project fields at the API boundary', () => {
    expect(
      projectCreate.safeParse({
        name: 'Invalid Project',
        slug: 'invalid-project',
        description: 'Invalid visibility.',
        objective: 'Invalid visibility.',
        category: 'Technology',
        visibility: 'CONNECTIONS',
        technologies: [],
        lookingFor: [],
        members: [],
      }).success,
    ).toBe(false);
  });
});
