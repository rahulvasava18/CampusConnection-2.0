import { Router, type Request, type Response, type NextFunction } from 'express';
import { AppError } from '../../../shared/errors/app-error';
import { validateRequest } from '../../../shared/validation/validate';
import { requireAuth } from '../../identity/security/auth.middleware';
import { requireCsrf } from '../../identity/security/csrf.middleware';
import { CommunicationService } from '../application/communication.service';
import {
  conversationCreate,
  conversationIdParams,
  conversationPagination,
  conversationUpdate,
  memberCreate,
  memberParams,
  messageCreate,
  messageIdParams,
  messagePagination,
  messageUpdate,
  readCreate,
} from './communication.schemas';

function actor(req: Request) {
  if (!req.auth) throw new AppError('AUTHENTICATION_REQUIRED', 'Authentication is required.', 401);
  return {
    userId: req.auth.userId,
    accountState: req.auth.user.accountState,
    roles: req.auth.roles,
  };
}
function param(req: Request, name: string): string {
  const value = req.params[name];
  const result = Array.isArray(value) ? value[0] : value;
  if (!result) throw new AppError('VALIDATION_ERROR', `Missing route parameter: ${name}`, 422);
  return result;
}
function handle(handler: (req: Request) => Promise<unknown>, status = 200) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await handler(req);
      if (status === 204) res.status(204).send();
      else res.status(status).json({ data });
    } catch (error) {
      next(error);
    }
  };
}

export function createCommunicationRouter(service = new CommunicationService()): Router {
  const router = Router();
  router.use(requireAuth);
  router.get(
    '/conversations',
    validateRequest(conversationPagination, 'query'),
    handle((req) =>
      service.listConversations(
        actor(req),
        req.query as unknown as { limit: number; cursor?: string },
      ),
    ),
  );
  router.post(
    '/conversations',
    requireCsrf,
    validateRequest(conversationCreate, 'body'),
    handle((req) => service.createConversation(actor(req), req.body, req.correlationId), 201),
  );
  router.get(
    '/conversations/:conversationId',
    validateRequest(conversationIdParams, 'params'),
    handle((req) => service.getConversation(actor(req), param(req, 'conversationId'))),
  );
  router.patch(
    '/conversations/:conversationId',
    requireCsrf,
    validateRequest(conversationIdParams, 'params'),
    validateRequest(conversationUpdate, 'body'),
    handle((req) =>
      service.updateConversation(actor(req), param(req, 'conversationId'), req.body.title),
    ),
  );
  router.get(
    '/conversations/:conversationId/members',
    validateRequest(conversationIdParams, 'params'),
    handle((req) => service.listMembers(actor(req), param(req, 'conversationId'))),
  );
  router.post(
    '/conversations/:conversationId/members',
    requireCsrf,
    validateRequest(conversationIdParams, 'params'),
    validateRequest(memberCreate, 'body'),
    handle(
      (req) =>
        service.addMember(
          actor(req),
          param(req, 'conversationId'),
          req.body.userId,
          req.correlationId,
        ),
      201,
    ),
  );
  router.delete(
    '/conversations/:conversationId/members/:userId',
    requireCsrf,
    validateRequest(memberParams, 'params'),
    handle(
      (req) =>
        service.removeMember(
          actor(req),
          param(req, 'conversationId'),
          param(req, 'userId'),
          req.correlationId,
        ),
      204,
    ),
  );
  router.post(
    '/conversations/:conversationId/leave',
    requireCsrf,
    validateRequest(conversationIdParams, 'params'),
    handle(
      (req) =>
        service.leaveConversation(actor(req), param(req, 'conversationId'), req.correlationId),
      204,
    ),
  );
  router.get(
    '/conversations/:conversationId/messages',
    validateRequest(conversationIdParams, 'params'),
    validateRequest(messagePagination, 'query'),
    handle((req) =>
      service.listMessages(
        actor(req),
        param(req, 'conversationId'),
        req.query as unknown as { limit: number; cursor?: string },
      ),
    ),
  );
  router.post(
    '/conversations/:conversationId/messages',
    requireCsrf,
    validateRequest(conversationIdParams, 'params'),
    validateRequest(messageCreate, 'body'),
    handle(
      async (req) =>
        (
          await service.sendMessage(
            {
              ...req.body,
              conversationId: param(req, 'conversationId'),
              senderId: actor(req).userId,
            },
            req.correlationId,
          )
        ).message,
      201,
    ),
  );
  router.post(
    '/conversations/:conversationId/read',
    requireCsrf,
    validateRequest(conversationIdParams, 'params'),
    validateRequest(readCreate, 'body'),
    handle((req) =>
      service.markRead(
        actor(req),
        param(req, 'conversationId'),
        req.body.messageId,
        req.correlationId,
      ),
    ),
  );
  router.patch(
    '/messages/:messageId',
    requireCsrf,
    validateRequest(messageIdParams, 'params'),
    validateRequest(messageUpdate, 'body'),
    handle((req) =>
      service.editMessage(actor(req), param(req, 'messageId'), req.body.content, req.correlationId),
    ),
  );
  router.delete(
    '/messages/:messageId',
    requireCsrf,
    validateRequest(messageIdParams, 'params'),
    handle(
      (req) => service.deleteMessage(actor(req), param(req, 'messageId'), req.correlationId),
      204,
    ),
  );
  return router;
}
