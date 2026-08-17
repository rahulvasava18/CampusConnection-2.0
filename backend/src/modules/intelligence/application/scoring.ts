import type { RecommendationReason, RecommendationReasonCode } from '@campusconnection/shared';
import type { RecommendationContext } from './candidate-generators';

export interface ScoredCandidate<T> {
  candidate: T;
  score: number;
  reasons: RecommendationReason[];
  createdAt: Date;
}

export function overlap(left: string[], right: string[]): string[] {
  const values = new Set(left.map((item) => item.toLowerCase()));
  return [...new Set(right.filter((item) => values.has(item.toLowerCase())))];
}

export function freshness(date: Date, halfLifeDays = 30): number {
  const ageDays = Math.max(0, (Date.now() - date.valueOf()) / 86400000);
  return Math.max(0, Math.min(1, Math.exp(-ageDays / halfLifeDays)));
}

export function reason(
  code: RecommendationReasonCode,
  message: string,
  matched?: string[],
): RecommendationReason {
  return { code, message, ...(matched?.length ? { matched } : {}) };
}

export function scoreUser<
  T extends {
    skills: string[];
    interests: string[];
    goals: string[];
    college?: string;
    course?: string;
    createdAt: Date;
  },
>(context: RecommendationContext, candidate: T, mutualConnections: number): ScoredCandidate<T> {
  const skills = overlap(context.profile.skills, candidate.skills);
  const interests = overlap(context.profile.interests, candidate.interests);
  const goals = overlap(context.profile.goals, candidate.goals);
  const contextMatch =
    Number(
      Boolean(
        context.profile.college &&
        candidate.college &&
        context.profile.college.toLowerCase() === candidate.college.toLowerCase(),
      ),
    ) +
    Number(
      Boolean(
        context.profile.course &&
        candidate.course &&
        context.profile.course.toLowerCase() === candidate.course.toLowerCase(),
      ),
    );
  const skillScore = candidate.skills.length
    ? skills.length / Math.max(candidate.skills.length, context.profile.skills.length, 1)
    : 0;
  const interestScore = candidate.interests.length
    ? interests.length / Math.max(candidate.interests.length, context.profile.interests.length, 1)
    : 0;
  const goalScore = candidate.goals.length
    ? goals.length / Math.max(candidate.goals.length, context.profile.goals.length, 1)
    : 0;
  const networkScore = Math.min(mutualConnections / 3, 1);
  const score = Math.min(
    1,
    0.3 * skillScore +
      0.25 * interestScore +
      0.15 * goalScore +
      0.15 * networkScore +
      0.1 * Math.min(contextMatch, 1) +
      0.05 * freshness(candidate.createdAt),
  );
  const reasons: RecommendationReason[] = [];
  if (skills.length)
    reasons.push(reason('SKILL_MATCH', `Matches ${skills.length} of your skills.`, skills));
  if (interests.length)
    reasons.push(
      reason('INTEREST_MATCH', `Shares ${interests.length} of your interests.`, interests),
    );
  if (goals.length)
    reasons.push(reason('GOAL_MATCH', `Aligns with ${goals.length} of your goals.`, goals));
  if (mutualConnections)
    reasons.push(reason('MUTUAL_CONNECTION', `${mutualConnections} connected people overlap.`));
  if (contextMatch) reasons.push(reason('COLLEGE_CONTEXT', 'Shares your campus context.'));
  if (freshness(candidate.createdAt) >= 0.7)
    reasons.push(reason('RECENT_ACTIVITY', 'Recently joined CampusConnection.'));
  if (!reasons.length)
    reasons.push(reason('FRESH_CONTENT', 'Suggested from your current campus profile.'));
  return { candidate, score: Number(score.toFixed(4)), reasons, createdAt: candidate.createdAt };
}

export function scoreTeam<
  T extends {
    requirements: Array<{ skills: string[]; interests: string[]; priority: number }>;
    category?: string;
    tags?: string[];
    lookingFor?: string[];
    openSlots: number;
    createdAt: Date;
    projectId?: unknown;
    communityId?: unknown;
  },
>(context: RecommendationContext, candidate: T): ScoredCandidate<T> {
  const skills = [
    ...new Set(
      candidate.requirements.flatMap((item) => overlap(context.profile.skills, item.skills)),
    ),
  ];
  const interests = [
    ...new Set(
      candidate.requirements.flatMap((item) => overlap(context.profile.interests, item.interests)),
    ),
  ];
  const profileSignals = [
    ...context.profile.skills,
    ...context.profile.interests,
    ...context.profile.goals,
  ];
  const teamSignals = [
    ...(candidate.category ? [candidate.category] : []),
    ...(candidate.tags ?? []),
    ...(candidate.lookingFor ?? []),
  ];
  const topicMatches = overlap(profileSignals, teamSignals);
  const totalRequirements = candidate.requirements.reduce(
    (sum, item) => sum + item.skills.length + item.interests.length,
    0,
  );
  const coverage = totalRequirements
    ? Math.min((skills.length + interests.length) / totalRequirements, 1)
    : 0.15;
  const score = Math.min(
    1,
    0.45 * coverage +
      0.15 * (interests.length ? 1 : 0) +
      0.15 * Math.min(topicMatches.length / 2, 1) +
      0.15 * Number(candidate.openSlots > 0) +
      0.1 * freshness(candidate.createdAt),
  );
  const reasons: RecommendationReason[] = [];
  if (skills.length)
    reasons.push(
      reason(
        'TEAM_REQUIREMENT_MATCH',
        `Matches ${skills.length} open team skill requirements.`,
        skills,
      ),
    );
  if (interests.length)
    reasons.push(
      reason(
        'INTEREST_MATCH',
        `Matches ${interests.length} team interest requirements.`,
        interests,
      ),
    );
  if (topicMatches.length)
    reasons.push(
      reason('INTEREST_MATCH', 'Matches the team topics you have explored.', topicMatches),
    );
  if (candidate.openSlots > 0)
    reasons.push(reason('CAPACITY_AVAILABLE', 'The team has available capacity.'));
  if (candidate.projectId)
    reasons.push(reason('PROJECT_RELEVANCE', 'The team is linked to a project.'));
  if (!reasons.length)
    reasons.push(reason('FRESH_CONTENT', 'Suggested from your current campus profile.'));
  return { candidate, score: Number(score.toFixed(4)), reasons, createdAt: candidate.createdAt };
}

export function scoreProject<
  T extends {
    technologies: string[];
    category?: string;
    tags?: string[];
    lookingFor?: string[];
    name: string;
    description: string;
    ownerTeamId?: unknown;
    createdAt: Date;
  },
>(context: RecommendationContext, candidate: T): ScoredCandidate<T> {
  const skills = overlap(context.profile.skills, candidate.technologies);
  const interests = overlap(context.profile.interests, candidate.technologies);
  const goals = overlap(context.profile.goals, candidate.technologies);
  const profileSignals = [
    ...context.profile.skills,
    ...context.profile.interests,
    ...context.profile.goals,
  ];
  const projectSignals = [
    ...(candidate.category ? [candidate.category] : []),
    ...(candidate.tags ?? []),
    ...(candidate.lookingFor ?? []),
  ];
  const topicMatches = overlap(profileSignals, projectSignals);
  const score = Math.min(
    1,
    0.4 * Math.min(skills.length / 3, 1) +
      0.25 * Math.min(interests.length / 3, 1) +
      0.15 * Math.min(goals.length / 2, 1) +
      0.1 * Math.min(topicMatches.length / 2, 1) +
      0.1 * freshness(candidate.createdAt),
  );
  const reasons: RecommendationReason[] = [];
  if (skills.length)
    reasons.push(reason('SKILL_MATCH', `Uses ${skills.length} of your skills.`, skills));
  if (interests.length)
    reasons.push(
      reason('INTEREST_MATCH', `Uses ${interests.length} related interests.`, interests),
    );
  if (goals.length)
    reasons.push(reason('GOAL_MATCH', `Matches ${goals.length} of your goals.`, goals));
  if (topicMatches.length)
    reasons.push(reason('PROJECT_RELEVANCE', 'Relates to topics in your profile.', topicMatches));
  if (freshness(candidate.createdAt) >= 0.7)
    reasons.push(reason('RECENT_ACTIVITY', 'Recently created or updated project.'));
  if (!reasons.length)
    reasons.push(reason('FRESH_CONTENT', 'Suggested from your current campus profile.'));
  return { candidate, score: Number(score.toFixed(4)), reasons, createdAt: candidate.createdAt };
}

export function scoreCommunity<
  T extends {
    category: string;
    tags?: string[];
    name: string;
    description: string;
    collegeId?: string;
    createdAt: Date;
  },
>(context: RecommendationContext, candidate: T): ScoredCandidate<T> {
  const values = [
    candidate.category,
    ...(candidate.tags ?? []),
    candidate.name,
    candidate.description,
  ]
    .join(' ')
    .toLowerCase();
  const interests = context.profile.interests.filter((item) => values.includes(item.toLowerCase()));
  const skills = context.profile.skills.filter((item) => values.includes(item.toLowerCase()));
  const college = Boolean(
    context.profile.college &&
    candidate.collegeId &&
    context.profile.college.toLowerCase() === candidate.collegeId.toLowerCase(),
  );
  const score = Math.min(
    1,
    0.4 * Math.min(interests.length / 2, 1) +
      0.25 * Math.min(skills.length / 2, 1) +
      0.2 * Number(college) +
      0.15 * freshness(candidate.createdAt),
  );
  const reasons: RecommendationReason[] = [];
  if (interests.length)
    reasons.push(
      reason('INTEREST_MATCH', `Relates to ${interests.length} of your interests.`, interests),
    );
  if (skills.length)
    reasons.push(reason('SKILL_MATCH', `Relates to ${skills.length} of your skills.`, skills));
  if (college) reasons.push(reason('COLLEGE_CONTEXT', 'Available in your campus context.'));
  if (freshness(candidate.createdAt) >= 0.7)
    reasons.push(reason('RECENT_ACTIVITY', 'Recently active community.'));
  if (!reasons.length)
    reasons.push(reason('FRESH_CONTENT', 'Suggested from your current campus profile.'));
  return { candidate, score: Number(score.toFixed(4)), reasons, createdAt: candidate.createdAt };
}
