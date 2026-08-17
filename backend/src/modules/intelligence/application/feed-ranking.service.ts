import type { PostDocument } from '../../social/infrastructure/social.models';
import { CommentModel, ReactionModel } from '../../social/infrastructure/social.models';
import type { FeedRankingMetadata } from '@campusconnection/shared';
import type { RecommendationContext } from './candidate-generators';
import { freshness, overlap } from './scoring';

export interface RankedPost {
  post: PostDocument;
  ranking: FeedRankingMetadata;
}

export class FeedRankingService {
  public async rank(posts: PostDocument[], context: RecommendationContext): Promise<RankedPost[]> {
    if (!posts.length) return [];
    const ids = posts.map((post) => post._id);
    const [reactions, comments] = await Promise.all([
      ReactionModel.aggregate([
        { $match: { targetType: 'POST', targetId: { $in: ids } } },
        { $group: { _id: '$targetId', count: { $sum: 1 } } },
      ]).exec(),
      CommentModel.aggregate([
        { $match: { postId: { $in: ids }, status: 'ACTIVE' } },
        { $group: { _id: '$postId', count: { $sum: 1 } } },
      ]).exec(),
    ]);
    const reactionCount = new Map(
      reactions.map((item: { _id: unknown; count: number }) => [String(item._id), item.count]),
    );
    const commentCount = new Map(
      comments.map((item: { _id: unknown; count: number }) => [String(item._id), item.count]),
    );
    return posts
      .map((post) => {
        const authorId = post.authorId.toString();
        const tags = overlap(
          [...context.profile.skills, ...context.profile.interests, ...context.profile.goals],
          post.tags,
        );
        const relevance = Math.min(tags.length / 3, 1);
        const relationship =
          authorId === context.profile.id ? 1 : context.connectedIds.includes(authorId) ? 0.9 : 0.2;
        const engagement = Math.min(
          ((reactionCount.get(post.id) ?? 0) + (commentCount.get(post.id) ?? 0)) / 10,
          1,
        );
        const fresh = freshness(post.createdAt, 7);
        const score = Math.min(
          1,
          0.3 * fresh +
            0.25 * relationship +
            0.25 * relevance +
            0.1 * engagement +
            0.1 * (post.type === 'IDEA' || post.type === 'OPPORTUNITY' ? 1 : 0.5),
        );
        const reasonCodes = [
          ...(fresh >= 0.6 ? ['FRESH_CONTENT' as const] : []),
          ...(relationship >= 0.9 ? ['MUTUAL_CONNECTION' as const] : []),
          ...(tags.length ? ['INTEREST_MATCH' as const] : []),
          ...(engagement > 0.2 ? ['ENGAGEMENT_SIGNAL' as const] : []),
        ];
        return {
          post,
          ranking: {
            score: Number(score.toFixed(4)),
            reasonCodes,
            algorithmVersion: 'recommendation-v1' as const,
          },
        };
      })
      .sort(
        (left, right) =>
          right.ranking.score - left.ranking.score ||
          right.post.createdAt.valueOf() - left.post.createdAt.valueOf() ||
          right.post.id.localeCompare(left.post.id),
      );
  }
}
