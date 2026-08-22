import { Router, type Request, type NextFunction, type Response } from 'express';
import { requireAuth, requireRole } from '../../identity/security/auth.middleware';
import { requireCsrf } from '../../identity/security/csrf.middleware';
import { validateRequest } from '../../../shared/validation/validate';
import { AppError } from '../../../shared/errors/app-error';
import { ClubService, type ClubActor } from '../application/club.service';
import { adminClubStatus, clubCreate, clubEventCreate, clubIdParams, clubInvitationParams, clubInvite, clubJoin, clubListQuery, clubMemberParams, clubRequestParams, clubRole, clubUpdate } from './club.schemas';

function actor(req: Request): ClubActor {
  if (!req.auth) throw new AppError('AUTHENTICATION_REQUIRED', 'Authentication is required.', 401);
  return { userId: req.auth.userId, accountState: req.auth.user.accountState, roles: req.auth.roles };
}
function param(req: Request, name: string) { const value = req.params[name]; const result = Array.isArray(value) ? value[0] : value; if (!result) throw new AppError('VALIDATION_ERROR', `Missing route parameter: ${name}`, 422); return result; }
function handle(handler: (req: Request) => Promise<unknown>, status = 200) {
  return async (req: Request, res: Response, next: NextFunction) => { try { const data = await handler(req); if (status === 204) res.status(204).send(); else res.status(status).json({ data }); } catch (error) { next(error); } };
}

export function createClubRouter(service = new ClubService()): Router {
  const router = Router(); router.use(requireAuth);
  router.get('/clubs', validateRequest(clubListQuery, 'query'), handle((req) => service.list(actor(req), req.query as never)));
  router.get('/clubs/mine', handle((req) => service.getMine(actor(req))));
  router.post('/clubs', requireCsrf, validateRequest(clubCreate, 'body'), handle((req) => service.create(actor(req), req.body), 201));
  router.get('/clubs/:clubId', validateRequest(clubIdParams, 'params'), handle((req) => service.get(actor(req), param(req, 'clubId'))));
  router.patch('/clubs/:clubId', requireCsrf, validateRequest(clubIdParams, 'params'), validateRequest(clubUpdate, 'body'), handle((req) => service.update(actor(req), param(req, 'clubId'), req.body)));
  router.post('/clubs/:clubId/join', requireCsrf, validateRequest(clubIdParams, 'params'), validateRequest(clubJoin, 'body'), handle((req) => service.requestJoin(actor(req), param(req, 'clubId'), req.body.message), 201));
  router.get('/clubs/:clubId/members', validateRequest(clubIdParams, 'params'), handle((req) => service.listMembers(actor(req), param(req, 'clubId'))));
  router.get('/clubs/:clubId/requests', validateRequest(clubIdParams, 'params'), handle((req) => service.listRequests(actor(req), param(req, 'clubId'))));
  router.post('/clubs/:clubId/requests/:requestId/approve', requireCsrf, validateRequest(clubRequestParams, 'params'), handle((req) => service.reviewRequest(actor(req), param(req, 'clubId'), param(req, 'requestId'), true)));
  router.post('/clubs/:clubId/requests/:requestId/reject', requireCsrf, validateRequest(clubRequestParams, 'params'), handle((req) => service.reviewRequest(actor(req), param(req, 'clubId'), param(req, 'requestId'), false)));
  router.patch('/clubs/:clubId/members/:userId/role', requireCsrf, validateRequest(clubMemberParams, 'params'), validateRequest(clubRole, 'body'), handle((req) => service.updateMemberRole(actor(req), param(req, 'clubId'), param(req, 'userId'), req.body.role)));
  router.delete('/clubs/:clubId/members/:userId', requireCsrf, validateRequest(clubMemberParams, 'params'), handle((req) => service.removeMember(actor(req), param(req, 'clubId'), param(req, 'userId')), 204));
  router.post('/clubs/:clubId/invitations', requireCsrf, validateRequest(clubIdParams, 'params'), validateRequest(clubInvite, 'body'), handle((req) => service.invite(actor(req), param(req, 'clubId'), req.body.inviteeId), 201));
  router.get('/club-invitations', handle((req) => service.listInvitations(actor(req))));
  router.post('/club-invitations/:invitationId/accept', requireCsrf, validateRequest(clubInvitationParams, 'params'), handle((req) => service.respondInvitation(actor(req), param(req, 'invitationId'), true)));
  router.post('/club-invitations/:invitationId/reject', requireCsrf, validateRequest(clubInvitationParams, 'params'), handle((req) => service.respondInvitation(actor(req), param(req, 'invitationId'), false)));
  router.get('/clubs/:clubId/events', validateRequest(clubIdParams, 'params'), handle((req) => service.listEvents(actor(req), param(req, 'clubId'))));
  router.post('/clubs/:clubId/events', requireCsrf, validateRequest(clubIdParams, 'params'), validateRequest(clubEventCreate, 'body'), handle((req) => service.createEvent(actor(req), param(req, 'clubId'), req.body), 201));
  return router;
}

export function createClubAdminRouter(service = new ClubService()): Router {
  const router = Router(); router.use(requireAuth, requireRole('PLATFORM_ADMIN'));
  router.get('/clubs', validateRequest(clubListQuery, 'query'), handle((req) => service.adminList((req.query as { status?: never }).status)));
  router.patch('/clubs/:clubId/status', requireCsrf, validateRequest(clubIdParams, 'params'), validateRequest(adminClubStatus, 'body'), handle((req) => service.adminReview(req.auth!.userId, param(req, 'clubId'), req.body.status, req.body.reason)));
  return router;
}
