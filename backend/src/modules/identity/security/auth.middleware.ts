import type { RequestHandler } from 'express';
import { AppError } from '../../../shared/errors/app-error';
import { verifyAccessToken } from './jwt.service';
import { UserRepository } from '../infrastructure/identity.repositories';
import { toUserView } from '../application/user.mapper';
import { normalizeExpiredSuspension } from './account-state';

const userRepository = new UserRepository();

export const requireAuth: RequestHandler = async (req, _res, next) => {
  try {
    const authorization = req.header('authorization');
    if (!authorization?.startsWith('Bearer '))
      throw new AppError('AUTHENTICATION_REQUIRED', 'Authentication is required.', 401);
    const token = authorization.slice('Bearer '.length);
    const claims = verifyAccessToken(token);
    const user = await userRepository.findById(claims.sub);
    if (user) await normalizeExpiredSuspension(user);
    if (!user || ['BANNED', 'DELETED', 'SUSPENDED'].includes(user.accountState))
      throw new AppError(
        'ACCOUNT_UNAVAILABLE',
        'This account cannot access the requested resource.',
        403,
      );
    req.auth = {
      userId: user.id,
      sessionId: claims.sid,
      familyId: claims.fid,
      roles: user.roles,
      user: toUserView(user),
    };
    next();
  } catch (error) {
    next(
      error instanceof AppError
        ? error
        : new AppError('AUTHENTICATION_INVALID', 'Authentication is required.', 401),
    );
  }
};

export function requireRole(...roles: string[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.auth) {
      next(new AppError('AUTHENTICATION_REQUIRED', 'Authentication is required.', 401));
      return;
    }
    if (!req.auth.roles.some((role) => roles.includes(role))) {
      next(new AppError('FORBIDDEN', 'You do not have permission to perform this action.', 403));
      return;
    }
    next();
  };
}
