import type { PostDocument, CommentDocument } from '../infrastructure/social.models';
import type { Visibility } from '@campusconnection/shared';
import { AppError } from '../../../shared/errors/app-error';

export function assertActiveActor(accountState: string): void {
  if (accountState !== 'ACTIVE')
    throw new AppError(
      'ACCOUNT_RESTRICTED',
      'Your account cannot perform this social action.',
      403,
    );
}
export function assertObjectOwner(actorId: string, ownerId: string): void {
  if (actorId !== ownerId) throw new AppError('FORBIDDEN', 'You do not own this resource.', 403);
}
export function canViewVisibility(
  actorId: string,
  authorId: string,
  visibility: Visibility,
  connected: boolean,
): boolean {
  if (actorId === authorId || visibility === 'PUBLIC' || visibility === 'CAMPUS') return true;
  return visibility === 'CONNECTIONS' && connected;
}
export function assertPostOwner(actorId: string, post: PostDocument): void {
  assertObjectOwner(actorId, post.authorId.toString());
}
export function assertCommentOwner(actorId: string, comment: CommentDocument): void {
  assertObjectOwner(actorId, comment.authorId.toString());
}
