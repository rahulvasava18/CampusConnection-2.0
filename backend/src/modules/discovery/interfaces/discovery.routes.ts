import { Router, type NextFunction, type Request, type Response } from 'express';
import {
  SEARCH_ENTITY_TYPES,
  type SearchEntityType,
  type SearchFilters,
} from '@campusconnection/shared';
import { requireAuth } from '../../identity/security/auth.middleware';
import { validateRequest } from '../../../shared/validation/validate';
import { AppError } from '../../../shared/errors/app-error';
import {
  discoveryRateRule,
  RedisRateLimiter,
} from '../../../infrastructure/rate-limit/redis-rate-limiter';
import { DiscoveryService } from '../application/discovery.service';
import {
  autocompleteQuery,
  searchQuery,
  teamMatchParams,
  type AutocompleteQueryInput,
  type SearchQueryInput,
} from './discovery.schemas';

function actor(req: Request) {
  if (!req.auth) throw new AppError('AUTHENTICATION_REQUIRED', 'Authentication is required.', 401);
  return {
    userId: req.auth.userId,
    accountState: req.auth.user.accountState,
    ...(req.auth.user.college ? { college: req.auth.user.college } : {}),
  };
}
function entityTypes(type?: SearchEntityType): SearchEntityType[] {
  return type ? [type] : [...SEARCH_ENTITY_TYPES];
}
function filters(query: Record<string, unknown>): SearchFilters {
  return {
    ...(typeof query.college === 'string' ? { college: query.college } : {}),
    ...(typeof query.course === 'string' ? { course: query.course } : {}),
    ...(typeof query.communityId === 'string' ? { communityId: query.communityId } : {}),
    ...(typeof query.projectId === 'string' ? { projectId: query.projectId } : {}),
    ...(typeof query.skill === 'string' ? { skill: query.skill } : {}),
    ...(typeof query.category === 'string' ? { category: query.category } : {}),
    ...(typeof query.teamStatus === 'string'
      ? { teamStatus: query.teamStatus as NonNullable<SearchFilters['teamStatus']> }
      : {}),
    ...(typeof query.projectStatus === 'string'
      ? { projectStatus: query.projectStatus as NonNullable<SearchFilters['projectStatus']> }
      : {}),
    ...(typeof query.visibility === 'string'
      ? { visibility: query.visibility as NonNullable<SearchFilters['visibility']> }
      : {}),
    ...(typeof query.verifiedOnly === 'boolean' ? { verifiedOnly: query.verifiedOnly } : {}),
  };
}
function param(req: Request, name: string): string {
  const value = req.params[name];
  const result = Array.isArray(value) ? value[0] : value;
  if (!result) throw new AppError('VALIDATION_ERROR', `Missing route parameter: ${name}`, 422);
  return result;
}

function rateLimit(kind: 'search' | 'autocomplete', limiter: RedisRateLimiter) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const current = actor(req);
      const result = await limiter.consume(
        `discovery:${kind}:${current.userId}`,
        discoveryRateRule(kind),
      );
      if (!result.allowed) {
        const error = new AppError(
          'RATE_LIMITED',
          'Too many discovery requests. Try again later.',
          429,
          { retryAfterSeconds: result.retryAfterSeconds },
        );
        _res.setHeader('Retry-After', result.retryAfterSeconds);
        next(error);
        return;
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function createDiscoveryRouter(
  service = new DiscoveryService(),
  limiter = new RedisRateLimiter(),
): Router {
  const router = Router();
  router.use(requireAuth);
  router.get(
    '/search',
    rateLimit('search', limiter),
    validateRequest(searchQuery, 'query'),
    async (req, res, next) => {
      try {
        const query = req.query as unknown as SearchQueryInput;
        res.json({
          data: await service.search(actor(req), {
            query: query.q,
            entityTypes: entityTypes(query.type),
            filters: filters(query as Record<string, unknown>),
            limit: query.limit,
            ...(query.cursor ? { cursor: query.cursor } : {}),
          }),
        });
      } catch (error) {
        next(error);
      }
    },
  );
  for (const type of SEARCH_ENTITY_TYPES) {
    router.get(
      `/search/${type}`,
      rateLimit('search', limiter),
      validateRequest(searchQuery.omit({ type: true }), 'query'),
      async (req, res, next) => {
        try {
          const query = req.query as unknown as SearchQueryInput;
          res.json({
            data: await service.search(actor(req), {
              query: query.q,
              entityTypes: [type],
              filters: filters(query as Record<string, unknown>),
              limit: query.limit,
              ...(query.cursor ? { cursor: query.cursor } : {}),
            }),
          });
        } catch (error) {
          next(error);
        }
      },
    );
  }
  router.get(
    '/search/autocomplete',
    rateLimit('autocomplete', limiter),
    validateRequest(autocompleteQuery, 'query'),
    async (req, res, next) => {
      try {
        const query = req.query as unknown as AutocompleteQueryInput;
        res.json({
          data: await service.autocomplete(actor(req), query.q, entityTypes(query.type), {}),
        });
      } catch (error) {
        next(error);
      }
    },
  );
  router.get(
    '/search/teams/:teamId/match',
    rateLimit('search', limiter),
    validateRequest(teamMatchParams, 'params'),
    async (req, res, next) => {
      try {
        res.json({ data: await service.matchTeam(actor(req), param(req, 'teamId')) });
      } catch (error) {
        next(error);
      }
    },
  );
  return router;
}
