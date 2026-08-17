import type { RequestHandler } from 'express';
import { getEnv } from '../../../config/env';
import { AppError } from '../../../shared/errors/app-error';
import { parseCookies } from '../../../shared/http/cookies';

function originAllowed(value: string): boolean {
  return getEnv().corsOrigins.includes(value);
}

export const requireCsrf: RequestHandler = (req, _res, next) => {
  try {
    const env = getEnv();
    const origin = req.header('origin');
    const referer = req.header('referer');
    const refererOrigin = referer ? new URL(referer).origin : undefined;
    const originValue = origin ?? refererOrigin;
    if (
      !originValue ||
      !originAllowed(originValue) ||
      (refererOrigin && !originAllowed(refererOrigin))
    ) {
      next(new AppError('CSRF_ORIGIN_INVALID', 'The request origin is not allowed.', 403));
      return;
    }
    const cookieToken = parseCookies(req.header('cookie'))[env.CSRF_COOKIE_NAME];
    const headerToken = req.header(env.CSRF_HEADER_NAME);
    if (!cookieToken || !headerToken || cookieToken !== headerToken) {
      next(new AppError('CSRF_TOKEN_INVALID', 'The CSRF token is invalid.', 403));
      return;
    }
    next();
  } catch (error) {
    next(error);
  }
};
