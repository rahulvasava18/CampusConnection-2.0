import { describe, expect, it } from 'vitest';
import {
  scoreCommunity,
  scoreProject,
  scoreTeam,
  scoreUser,
} from '../../src/modules/intelligence/application/scoring';
import { getRecommendationReadiness } from '../../src/modules/intelligence/application/readiness';
import type { RecommendationContext } from '../../src/modules/intelligence/application/candidate-generators';

const context: RecommendationContext = {
  profile: {
    id: 'viewer',
    displayName: 'Viewer',
    username: 'viewer',
    college: 'Campus',
    course: 'Computer Science',
    skills: ['React', 'TypeScript'],
    interests: ['AI'],
    goals: ['Build products'],
  },
  blockedIds: [],
  connectedIds: [],
  pendingIds: [],
  communityIds: [],
  teamIds: [],
  projectIds: [],
  dismissedIds: [],
  readiness: { ready: true, signalCount: 3, level: 1, meaningfulActivity: false },
};

const createdAt = new Date();

describe('intelligence scoring', () => {
  it('scores people with transparent profile reasons', () => {
    const result = scoreUser(
      context,
      {
        skills: ['React'],
        interests: ['AI'],
        goals: [],
        college: 'Campus',
        course: 'Computer Science',
        createdAt,
      },
      1,
    );

    expect(result.score).toBeGreaterThan(0);
    expect(result.reasons.map((item) => item.code)).toEqual(
      expect.arrayContaining([
        'SKILL_MATCH',
        'INTEREST_MATCH',
        'MUTUAL_CONNECTION',
        'COLLEGE_CONTEXT',
      ]),
    );
  });

  it('scores team requirements and public team topics', () => {
    const result = scoreTeam(context, {
      requirements: [{ skills: ['Node.js'], interests: [], priority: 80 }],
      category: 'AI',
      tags: ['React'],
      lookingFor: ['Backend'],
      openSlots: 2,
      projectId: 'project',
      createdAt,
    });

    expect(result.reasons.map((item) => item.code)).toEqual(
      expect.arrayContaining(['INTEREST_MATCH', 'CAPACITY_AVAILABLE', 'PROJECT_RELEVANCE']),
    );
  });

  it('scores project technologies and topics', () => {
    const result = scoreProject(context, {
      technologies: ['React', 'AI'],
      category: 'AI',
      tags: ['Campus'],
      lookingFor: ['TypeScript'],
      name: 'Navigator',
      description: 'A campus project',
      createdAt,
    });

    expect(result.reasons.map((item) => item.code)).toEqual(
      expect.arrayContaining(['SKILL_MATCH', 'INTEREST_MATCH', 'PROJECT_RELEVANCE']),
    );
  });

  it('always returns a reason for a recommendation', () => {
    const result = scoreCommunity(context, {
      category: 'Other',
      tags: [],
      name: 'Campus space',
      description: 'A community',
      createdAt: new Date(Date.now() - 365 * 86400000),
    });

    expect(result.reasons.length).toBeGreaterThan(0);
  });
});

describe('recommendation readiness', () => {
  const activity = {
    acceptedConnectionCount: 0,
    communityMembershipCount: 0,
    teamMembershipCount: 0,
    projectMembershipCount: 0,
    authoredPostCount: 0,
  };

  it('does not activate from identity-only fields', () => {
    const result = getRecommendationReadiness({ skills: [], interests: [], goals: [] }, activity);

    expect(result).toEqual({
      ready: false,
      signalCount: 0,
      level: 0,
      meaningfulActivity: false,
    });
  });

  it('activates at three meaningful profile signals', () => {
    const result = getRecommendationReadiness(
      { skills: ['React', 'TypeScript'], interests: ['AI'], goals: [] },
      activity,
    );

    expect(result.ready).toBe(true);
    expect(result.signalCount).toBe(3);
    expect(result.level).toBe(1);
  });

  it('raises the profile readiness level at six signals', () => {
    const result = getRecommendationReadiness(
      {
        skills: ['React', 'TypeScript'],
        interests: ['AI', 'Design'],
        goals: ['Build', 'Learn'],
      },
      activity,
    );

    expect(result).toMatchObject({ ready: true, signalCount: 6, level: 2 });
  });

  it('activates from legitimate activity even without profile signals', () => {
    const result = getRecommendationReadiness(
      { skills: [], interests: [], goals: [] },
      { ...activity, authoredPostCount: 1 },
    );

    expect(result).toMatchObject({
      ready: true,
      signalCount: 1,
      level: 3,
      meaningfulActivity: true,
    });
  });
});
