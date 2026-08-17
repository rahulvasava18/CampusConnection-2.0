import { Router, type NextFunction, type Request, type Response } from 'express';
import multer, { MulterError } from 'multer';
import { requireAuth } from '../../identity/security/auth.middleware';
import { requireCsrf } from '../../identity/security/csrf.middleware';
import { validateRequest } from '../../../shared/validation/validate';
import { AppError } from '../../../shared/errors/app-error';
import { SocialService } from '../application/social.service';
import {
  commentCreateSchema,
  commentIdParams,
  commentReactionParams,
  commentUpdateSchema,
  communityPostParams,
  paginationQuery,
  postCreateSchema,
  postIdParams,
  postUpdateSchema,
  reactionParams,
  requestIdParams,
  requestQuery,
  userIdParams,
} from './social.schemas';

function auth(req: Request) {
  if (!req.auth) throw new AppError('AUTHENTICATION_REQUIRED', 'Authentication is required.', 401);
  return { userId: req.auth.userId, accountState: req.auth.user.accountState };
}
function param(req: Request, name: string): string {
  const value = req.params[name];
  const result = Array.isArray(value) ? value[0] : value;
  if (!result) throw new AppError('VALIDATION_ERROR', `Missing route parameter: ${name}`, 422);
  return result;
}
function pagination(req: Request) {
  return req.query as unknown as { limit: number; cursor?: string };
}
function requests(req: Request) {
  return req.query as unknown as {
    limit: number;
    cursor?: string;
    direction: 'incoming' | 'outgoing';
  };
}

const allowedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 4, fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    const extension = file.originalname.toLowerCase().split('.').pop();
    const allowedExtension = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(extension ?? '');
    if (!allowedImageTypes.has(file.mimetype) || !allowedExtension) {
      callback(new AppError('MEDIA_TYPE_NOT_SUPPORTED', "That image type isn't supported.", 422));
      return;
    }
    callback(null, true);
  },
});

function uploadPostMedia(req: Request, res: Response, next: NextFunction) {
  imageUpload.array('media', 4)(req, res, (error: unknown) => {
    if (error instanceof MulterError && error.code === 'LIMIT_FILE_SIZE') {
      next(
        new AppError('MEDIA_TOO_LARGE', 'That image is too large. Choose a smaller image.', 422),
      );
      return;
    }
    if (error instanceof MulterError && error.code === 'LIMIT_FILE_COUNT') {
      next(new AppError('MEDIA_LIMIT_EXCEEDED', 'You can attach up to 4 images.', 422));
      return;
    }
    next(error);
  });
}

function arrayField(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function postInput(req: Request) {
  return postCreateSchema.parse({
    ...req.body,
    tags: arrayField(req.body.tags),
    mediaAssetIds: arrayField(req.body.mediaAssetIds),
  });
}

export function createSocialRouter(service = new SocialService()): Router {
  const router = Router();
  router.use(requireAuth);
  router.get('/feed', validateRequest(paginationQuery, 'query'), async (req, res, next) => {
    try {
      res.json(await service.listFeed(auth(req), pagination(req)));
    } catch (error) {
      next(error);
    }
  });
  router.post('/posts', requireCsrf, uploadPostMedia, async (req, res, next) => {
    try {
      const files = Array.isArray(req.files) ? req.files : [];
      res.status(201).json({
        data: await service.createPost(auth(req), postInput(req), req.correlationId, files),
      });
    } catch (error) {
      next(error);
    }
  });
  router.get(
    '/communities/:communityId/posts',
    validateRequest(communityPostParams, 'params'),
    validateRequest(paginationQuery, 'query'),
    async (req, res, next) => {
      try {
        res.json(
          await service.listCommunityPosts(auth(req), param(req, 'communityId'), pagination(req)),
        );
      } catch (error) {
        next(error);
      }
    },
  );
  router.get('/posts/:postId', validateRequest(postIdParams, 'params'), async (req, res, next) => {
    try {
      res.json({ data: await service.getPost(auth(req), param(req, 'postId')) });
    } catch (error) {
      next(error);
    }
  });
  router.patch(
    '/posts/:postId',
    requireCsrf,
    validateRequest(postIdParams, 'params'),
    validateRequest(postUpdateSchema, 'body'),
    async (req, res, next) => {
      try {
        const actor = auth(req);
        res.json({
          data: await service.updatePost(actor, param(req, 'postId'), req.body, req.correlationId),
        });
      } catch (error) {
        next(error);
      }
    },
  );
  router.delete(
    '/posts/:postId',
    requireCsrf,
    validateRequest(postIdParams, 'params'),
    async (req, res, next) => {
      try {
        await service.deletePost(auth(req), param(req, 'postId'), req.correlationId);
        res.status(204).send();
      } catch (error) {
        next(error);
      }
    },
  );
  router.post(
    '/posts/:postId/comments',
    requireCsrf,
    validateRequest(postIdParams, 'params'),
    validateRequest(commentCreateSchema, 'body'),
    async (req, res, next) => {
      try {
        res.status(201).json({
          data: await service.createComment(
            auth(req),
            param(req, 'postId'),
            req.body,
            req.correlationId,
          ),
        });
      } catch (error) {
        next(error);
      }
    },
  );
  router.get(
    '/posts/:postId/comments',
    validateRequest(postIdParams, 'params'),
    validateRequest(paginationQuery, 'query'),
    async (req, res, next) => {
      try {
        res.json(await service.listComments(auth(req), param(req, 'postId'), pagination(req)));
      } catch (error) {
        next(error);
      }
    },
  );
  router.patch(
    '/comments/:commentId',
    requireCsrf,
    validateRequest(commentIdParams, 'params'),
    validateRequest(commentUpdateSchema, 'body'),
    async (req, res, next) => {
      try {
        res.json({
          data: await service.updateComment(auth(req), param(req, 'commentId'), req.body.content),
        });
      } catch (error) {
        next(error);
      }
    },
  );
  router.delete(
    '/comments/:commentId',
    requireCsrf,
    validateRequest(commentIdParams, 'params'),
    async (req, res, next) => {
      try {
        await service.deleteComment(auth(req), param(req, 'commentId'), req.correlationId);
        res.status(204).send();
      } catch (error) {
        next(error);
      }
    },
  );
  router.put(
    '/posts/:postId/reactions/:reactionType',
    requireCsrf,
    validateRequest(reactionParams, 'params'),
    async (req, res, next) => {
      try {
        await service.setReaction(
          auth(req),
          'POST',
          param(req, 'postId'),
          'LIKE',
          true,
          req.correlationId,
        );
        res.status(204).send();
      } catch (error) {
        next(error);
      }
    },
  );
  router.delete(
    '/posts/:postId/reactions/:reactionType',
    requireCsrf,
    validateRequest(reactionParams, 'params'),
    async (req, res, next) => {
      try {
        await service.setReaction(
          auth(req),
          'POST',
          param(req, 'postId'),
          'LIKE',
          false,
          req.correlationId,
        );
        res.status(204).send();
      } catch (error) {
        next(error);
      }
    },
  );
  router.put(
    '/comments/:commentId/reactions/:reactionType',
    requireCsrf,
    validateRequest(commentReactionParams, 'params'),
    async (req, res, next) => {
      try {
        await service.setReaction(
          auth(req),
          'COMMENT',
          param(req, 'commentId'),
          'LIKE',
          true,
          req.correlationId,
        );
        res.status(204).send();
      } catch (error) {
        next(error);
      }
    },
  );
  router.delete(
    '/comments/:commentId/reactions/:reactionType',
    requireCsrf,
    validateRequest(commentReactionParams, 'params'),
    async (req, res, next) => {
      try {
        await service.setReaction(
          auth(req),
          'COMMENT',
          param(req, 'commentId'),
          'LIKE',
          false,
          req.correlationId,
        );
        res.status(204).send();
      } catch (error) {
        next(error);
      }
    },
  );
  router.post(
    '/users/:userId/connection-requests',
    requireCsrf,
    validateRequest(userIdParams, 'params'),
    async (req, res, next) => {
      try {
        res.status(201).json({
          data: await service.requestConnection(auth(req), param(req, 'userId'), req.correlationId),
        });
      } catch (error) {
        next(error);
      }
    },
  );
  router.post(
    '/connection-requests/:requestId/accept',
    requireCsrf,
    validateRequest(requestIdParams, 'params'),
    async (req, res, next) => {
      try {
        res.json({
          data: await service.respondConnection(
            auth(req),
            param(req, 'requestId'),
            true,
            req.correlationId,
          ),
        });
      } catch (error) {
        next(error);
      }
    },
  );
  router.post(
    '/connection-requests/:requestId/reject',
    requireCsrf,
    validateRequest(requestIdParams, 'params'),
    async (req, res, next) => {
      try {
        res.json({
          data: await service.respondConnection(
            auth(req),
            param(req, 'requestId'),
            false,
            req.correlationId,
          ),
        });
      } catch (error) {
        next(error);
      }
    },
  );
  router.delete(
    '/connections/:userId',
    requireCsrf,
    validateRequest(userIdParams, 'params'),
    async (req, res, next) => {
      try {
        await service.removeConnection(auth(req), param(req, 'userId'), req.correlationId);
        res.status(204).send();
      } catch (error) {
        next(error);
      }
    },
  );
  router.get(
    '/me/connections',
    validateRequest(paginationQuery, 'query'),
    async (req, res, next) => {
      try {
        res.json(await service.listConnections(auth(req), 'ACCEPTED', pagination(req)));
      } catch (error) {
        next(error);
      }
    },
  );
  router.get(
    '/me/connection-requests',
    validateRequest(requestQuery, 'query'),
    async (req, res, next) => {
      try {
        res.json(await service.listRequests(auth(req), requests(req).direction, requests(req)));
      } catch (error) {
        next(error);
      }
    },
  );
  router.post(
    '/users/:userId/block',
    requireCsrf,
    validateRequest(userIdParams, 'params'),
    async (req, res, next) => {
      try {
        await service.blockUser(auth(req), param(req, 'userId'), req.correlationId);
        res.status(204).send();
      } catch (error) {
        next(error);
      }
    },
  );
  router.delete(
    '/users/:userId/block',
    requireCsrf,
    validateRequest(userIdParams, 'params'),
    async (req, res, next) => {
      try {
        await service.unblockUser(auth(req), param(req, 'userId'), req.correlationId);
        res.status(204).send();
      } catch (error) {
        next(error);
      }
    },
  );
  router.post(
    '/blocks/:userId',
    requireCsrf,
    validateRequest(userIdParams, 'params'),
    async (req, res, next) => {
      try {
        await service.blockUser(auth(req), param(req, 'userId'), req.correlationId);
        res.status(204).send();
      } catch (error) {
        next(error);
      }
    },
  );
  router.delete(
    '/blocks/:userId',
    requireCsrf,
    validateRequest(userIdParams, 'params'),
    async (req, res, next) => {
      try {
        await service.unblockUser(auth(req), param(req, 'userId'), req.correlationId);
        res.status(204).send();
      } catch (error) {
        next(error);
      }
    },
  );
  return router;
}
