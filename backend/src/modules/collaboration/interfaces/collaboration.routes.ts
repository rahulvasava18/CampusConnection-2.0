import { Router, type NextFunction, type Request, type Response } from 'express';
import { requireAuth } from '../../identity/security/auth.middleware';
import { requireCsrf } from '../../identity/security/csrf.middleware';
import { validateRequest } from '../../../shared/validation/validate';
import { AppError } from '../../../shared/errors/app-error';
import { CollaborationService } from '../application/collaboration.service';
import {
  communityCreate,
  communityListQuery,
  communityMemberParams,
  communityMemberUpdate,
  communityUpdate,
  banCreate,
  banUserParams,
  discussionCreate,
  eventCreate,
  eventListQuery,
  eventRegistrationParams,
  eventRegistrationStatusUpdate,
  eventUpdate,
  idParams,
  invitationCreate,
  invitationIdParams,
  ownershipTransfer,
  joinRequestIdParams,
  milestoneCreate,
  milestoneUpdate,
  paginationQuery,
  projectCreate,
  projectListQuery,
  projectJoinRequestCreate,
  projectJoinRequestParams,
  projectMemberCreate,
  projectMemberParams,
  projectOwnershipTransfer,
  projectInvitationCreate,
  projectResourceCreate,
  projectResourceParams,
  projectResourceUpdate,
  projectUpdateCreate,
  projectUpdate,
  replyCreate,
  reportCreate,
  reportParams,
  reportUpdate,
  taskAssignment,
  taskCreate,
  taskStatus,
  taskUpdate,
  teamCreate,
  teamMemberParams,
  teamListQuery,
  teamJoinRequestCreate,
  teamJoinRequestParams,
  teamOwnershipTransfer,
  teamRoleUpdate,
  teamRequirementCreate,
  teamRequirementUpdate,
  teamUpdate,
} from './collaboration.schemas';

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
function page(req: Request) {
  return req.query as unknown as { limit: number; cursor?: string };
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

export function createCollaborationRouter(service = new CollaborationService()): Router {
  const router = Router();
  router.use(requireAuth);
  router.get(
    '/events',
    validateRequest(eventListQuery, 'query'),
    handle((req) => service.listEvents(actor(req), page(req))),
  );
  router.post(
    '/events',
    requireCsrf,
    validateRequest(eventCreate, 'body'),
    handle(async () => {
      throw new AppError(
        'CLUB_REQUIRED',
        'Official events must be created from an approved club by an owner or secretary.',
        403,
      );
    }, 403),
  );
  router.get(
    '/events/:eventId',
    validateRequest(idParams('eventId'), 'params'),
    handle((req) => service.getEvent(actor(req), param(req, 'eventId'))),
  );
  router.patch(
    '/events/:eventId',
    requireCsrf,
    validateRequest(idParams('eventId'), 'params'),
    validateRequest(eventUpdate, 'body'),
    handle((req) =>
      service.updateEvent(actor(req), param(req, 'eventId'), req.body, req.correlationId),
    ),
  );
  router.delete(
    '/events/:eventId',
    requireCsrf,
    validateRequest(idParams('eventId'), 'params'),
    handle(
      (req) => service.archiveEvent(actor(req), param(req, 'eventId'), req.correlationId),
      204,
    ),
  );
  router.post(
    '/events/:eventId/cancel',
    requireCsrf,
    validateRequest(idParams('eventId'), 'params'),
    handle((req) => service.cancelEvent(actor(req), param(req, 'eventId'), req.correlationId)),
  );
  router.post(
    '/events/:eventId/register',
    requireCsrf,
    validateRequest(idParams('eventId'), 'params'),
    handle((req) => service.registerForEvent(actor(req), param(req, 'eventId'), req.correlationId)),
  );
  router.post(
    '/events/:eventId/cancel-registration',
    requireCsrf,
    validateRequest(idParams('eventId'), 'params'),
    handle((req) =>
      service.cancelEventRegistration(actor(req), param(req, 'eventId'), req.correlationId),
    ),
  );
  router.get(
    '/events/:eventId/registrations',
    validateRequest(idParams('eventId'), 'params'),
    validateRequest(paginationQuery, 'query'),
    handle((req) => service.listEventRegistrations(actor(req), param(req, 'eventId'), page(req))),
  );
  router.patch(
    '/events/:eventId/registrations/:registrationId',
    requireCsrf,
    validateRequest(eventRegistrationParams, 'params'),
    validateRequest(eventRegistrationStatusUpdate, 'body'),
    handle((req) =>
      service.updateEventRegistration(
        actor(req),
        param(req, 'eventId'),
        param(req, 'registrationId'),
        req.body.status,
        req.correlationId,
      ),
    ),
  );
  router.get(
    '/communities',
    validateRequest(communityListQuery, 'query'),
    handle((req) => service.listCommunities(actor(req), page(req))),
  );
  router.get(
    '/me/communities',
    validateRequest(paginationQuery, 'query'),
    handle((req) => service.listMyCommunities(actor(req), page(req))),
  );
  router.post(
    '/communities',
    requireCsrf,
    validateRequest(communityCreate, 'body'),
    handle((req) => service.createCommunity(actor(req), req.body, req.correlationId), 201),
  );
  router.get(
    '/communities/:communityId/requests',
    validateRequest(idParams('communityId'), 'params'),
    validateRequest(paginationQuery, 'query'),
    handle((req) => service.listJoinRequests(actor(req), param(req, 'communityId'), page(req))),
  );
  router.post(
    '/communities/:communityId/requests/:requestId/approve',
    requireCsrf,
    validateRequest(joinRequestIdParams, 'params'),
    handle((req) =>
      service.reviewJoinRequest(
        actor(req),
        param(req, 'communityId'),
        param(req, 'requestId'),
        true,
        req.correlationId,
      ),
    ),
  );
  router.post(
    '/communities/:communityId/requests/:requestId/reject',
    requireCsrf,
    validateRequest(joinRequestIdParams, 'params'),
    handle((req) =>
      service.reviewJoinRequest(
        actor(req),
        param(req, 'communityId'),
        param(req, 'requestId'),
        false,
        req.correlationId,
      ),
    ),
  );
  router.get(
    '/community-invitations',
    validateRequest(paginationQuery, 'query'),
    handle((req) => service.listMyCommunityInvitations(actor(req), page(req))),
  );
  router.post(
    '/communities/:communityId/invitations',
    requireCsrf,
    validateRequest(idParams('communityId'), 'params'),
    validateRequest(invitationCreate, 'body'),
    handle(
      (req) =>
        service.inviteCommunityMember(
          actor(req),
          param(req, 'communityId'),
          req.body.inviteeId,
          req.correlationId,
        ),
      201,
    ),
  );
  router.get(
    '/communities/:communityId/invitations',
    validateRequest(idParams('communityId'), 'params'),
    validateRequest(paginationQuery, 'query'),
    handle((req) =>
      service.listCommunityInvitations(actor(req), param(req, 'communityId'), page(req)),
    ),
  );
  router.post(
    '/community-invitations/:invitationId/accept',
    requireCsrf,
    validateRequest(invitationIdParams, 'params'),
    handle((req) =>
      service.respondToCommunityInvitation(
        actor(req),
        param(req, 'invitationId'),
        true,
        req.correlationId,
      ),
    ),
  );
  router.post(
    '/community-invitations/:invitationId/reject',
    requireCsrf,
    validateRequest(invitationIdParams, 'params'),
    handle((req) =>
      service.respondToCommunityInvitation(
        actor(req),
        param(req, 'invitationId'),
        false,
        req.correlationId,
      ),
    ),
  );
  router.post(
    '/communities/:communityId/bans',
    requireCsrf,
    validateRequest(idParams('communityId'), 'params'),
    validateRequest(banCreate, 'body'),
    handle(
      (req) =>
        service.banCommunityMember(
          actor(req),
          param(req, 'communityId'),
          req.body.userId,
          req.body,
          req.correlationId,
        ),
      201,
    ),
  );
  router.get(
    '/communities/:communityId/bans',
    validateRequest(idParams('communityId'), 'params'),
    validateRequest(paginationQuery, 'query'),
    handle((req) => service.listCommunityBans(actor(req), param(req, 'communityId'), page(req))),
  );
  router.delete(
    '/communities/:communityId/bans/:userId',
    requireCsrf,
    validateRequest(banUserParams, 'params'),
    handle((req) =>
      service.unbanCommunityMember(
        actor(req),
        param(req, 'communityId'),
        param(req, 'userId'),
        req.correlationId,
      ),
    ),
  );
  router.post(
    '/communities/:communityId/reports',
    requireCsrf,
    validateRequest(idParams('communityId'), 'params'),
    validateRequest(reportCreate, 'body'),
    handle(
      (req) =>
        service.createCommunityReport(
          actor(req),
          param(req, 'communityId'),
          req.body,
          req.correlationId,
        ),
      201,
    ),
  );
  router.get(
    '/communities/:communityId/reports',
    validateRequest(idParams('communityId'), 'params'),
    validateRequest(paginationQuery, 'query'),
    handle((req) => service.listCommunityReports(actor(req), param(req, 'communityId'), page(req))),
  );
  router.patch(
    '/communities/:communityId/reports/:reportId',
    requireCsrf,
    validateRequest(reportParams, 'params'),
    validateRequest(reportUpdate, 'body'),
    handle((req) =>
      service.reviewCommunityReport(
        actor(req),
        param(req, 'communityId'),
        param(req, 'reportId'),
        req.body,
      ),
    ),
  );
  router.get(
    '/communities/:communityId',
    validateRequest(idParams('communityId'), 'params'),
    handle((req) => service.getCommunity(actor(req), param(req, 'communityId'))),
  );
  router.patch(
    '/communities/:communityId',
    requireCsrf,
    validateRequest(idParams('communityId'), 'params'),
    validateRequest(communityUpdate, 'body'),
    handle((req) =>
      service.updateCommunity(actor(req), param(req, 'communityId'), req.body, req.correlationId),
    ),
  );
  router.get(
    '/teams/:teamId/requests',
    validateRequest(teamMemberParams.pick({ teamId: true }), 'params'),
    validateRequest(paginationQuery, 'query'),
    handle((req) => service.listTeamJoinRequests(actor(req), param(req, 'teamId'), page(req))),
  );
  router.post(
    '/teams/:teamId/requests/:requestId/approve',
    requireCsrf,
    validateRequest(teamJoinRequestParams, 'params'),
    handle((req) =>
      service.reviewTeamJoinRequest(
        actor(req),
        param(req, 'teamId'),
        param(req, 'requestId'),
        true,
        req.correlationId,
      ),
    ),
  );
  router.post(
    '/teams/:teamId/requests/:requestId/reject',
    requireCsrf,
    validateRequest(teamJoinRequestParams, 'params'),
    handle((req) =>
      service.reviewTeamJoinRequest(
        actor(req),
        param(req, 'teamId'),
        param(req, 'requestId'),
        false,
        req.correlationId,
      ),
    ),
  );
  router.patch(
    '/teams/:teamId/members/:userId/role',
    requireCsrf,
    validateRequest(teamMemberParams, 'params'),
    validateRequest(teamRoleUpdate, 'body'),
    handle((req) =>
      service.updateTeamMemberRole(
        actor(req),
        param(req, 'teamId'),
        param(req, 'userId'),
        req.body.role,
        req.correlationId,
      ),
    ),
  );
  router.post(
    '/teams/:teamId/transfer-ownership',
    requireCsrf,
    validateRequest(idParams('teamId'), 'params'),
    validateRequest(teamOwnershipTransfer, 'body'),
    handle((req) =>
      service.transferTeamOwnership(
        actor(req),
        param(req, 'teamId'),
        req.body.userId,
        req.correlationId,
      ),
    ),
  );
  router.post(
    '/teams/:teamId/complete',
    requireCsrf,
    validateRequest(idParams('teamId'), 'params'),
    handle((req) => service.completeTeam(actor(req), param(req, 'teamId'), req.correlationId)),
  );
  router.post(
    '/teams/:teamId/archive',
    requireCsrf,
    validateRequest(idParams('teamId'), 'params'),
    handle((req) => service.archiveTeam(actor(req), param(req, 'teamId'), req.correlationId), 204),
  );
  router.get(
    '/team-invitations',
    validateRequest(paginationQuery, 'query'),
    handle((req) => service.listMyTeamInvitations(actor(req), page(req))),
  );
  router.delete(
    '/communities/:communityId',
    requireCsrf,
    validateRequest(idParams('communityId'), 'params'),
    handle(
      (req) => service.archiveCommunity(actor(req), param(req, 'communityId'), req.correlationId),
      204,
    ),
  );
  router.post(
    '/communities/:communityId/transfer-ownership',
    requireCsrf,
    validateRequest(idParams('communityId'), 'params'),
    validateRequest(ownershipTransfer, 'body'),
    handle((req) =>
      service.transferCommunityOwnership(
        actor(req),
        param(req, 'communityId'),
        req.body.userId,
        req.correlationId,
      ),
    ),
  );
  router.post(
    '/communities/:communityId/join',
    requireCsrf,
    validateRequest(idParams('communityId'), 'params'),
    handle(
      (req) => service.joinCommunity(actor(req), param(req, 'communityId'), req.correlationId),
      201,
    ),
  );
  router.post(
    '/communities/:communityId/leave',
    requireCsrf,
    validateRequest(idParams('communityId'), 'params'),
    handle(
      (req) => service.leaveCommunity(actor(req), param(req, 'communityId'), req.correlationId),
      204,
    ),
  );
  router.get(
    '/communities/:communityId/members',
    validateRequest(idParams('communityId'), 'params'),
    validateRequest(paginationQuery, 'query'),
    handle((req) => service.listCommunityMembers(actor(req), param(req, 'communityId'), page(req))),
  );
  router.get(
    '/communities/:communityId/discussions',
    validateRequest(idParams('communityId'), 'params'),
    validateRequest(paginationQuery, 'query'),
    handle((req) => service.listDiscussions(actor(req), param(req, 'communityId'), page(req))),
  );
  router.post(
    '/communities/:communityId/discussions',
    requireCsrf,
    validateRequest(idParams('communityId'), 'params'),
    validateRequest(discussionCreate, 'body'),
    handle(
      (req) =>
        service.createDiscussion(
          actor(req),
          param(req, 'communityId'),
          req.body,
          req.correlationId,
        ),
      201,
    ),
  );
  router.get(
    '/discussions/:discussionId',
    validateRequest(idParams('discussionId'), 'params'),
    handle((req) => service.getDiscussion(actor(req), param(req, 'discussionId'))),
  );
  router.get(
    '/discussions',
    validateRequest(paginationQuery, 'query'),
    handle((req) => service.listActiveDiscussions(actor(req), page(req))),
  );
  router.get(
    '/discussions/:discussionId/replies',
    validateRequest(idParams('discussionId'), 'params'),
    validateRequest(paginationQuery, 'query'),
    handle((req) => service.listReplies(actor(req), param(req, 'discussionId'), page(req))),
  );
  router.post(
    '/discussions/:discussionId/replies',
    requireCsrf,
    validateRequest(idParams('discussionId'), 'params'),
    validateRequest(replyCreate, 'body'),
    handle(
      (req) =>
        service.createReply(
          actor(req),
          param(req, 'discussionId'),
          req.body.content,
          req.correlationId,
        ),
      201,
    ),
  );
  router.patch(
    '/communities/:communityId/members/:userId',
    requireCsrf,
    validateRequest(communityMemberParams, 'params'),
    validateRequest(communityMemberUpdate, 'body'),
    handle((req) =>
      service.updateCommunityMember(
        actor(req),
        param(req, 'communityId'),
        param(req, 'userId'),
        req.body,
        req.correlationId,
      ),
    ),
  );

  router.get(
    '/teams',
    validateRequest(teamListQuery, 'query'),
    handle((req) => service.listTeams(actor(req), page(req))),
  );
  router.post(
    '/teams',
    requireCsrf,
    validateRequest(teamCreate, 'body'),
    handle((req) => service.createTeam(actor(req), req.body, req.correlationId), 201),
  );
  router.get(
    '/teams/:teamId/invitation-preview',
    validateRequest(idParams('teamId'), 'params'),
    handle((req) => service.getTeamInvitationPreview(actor(req), param(req, 'teamId'))),
  );
  router.get(
    '/teams/:teamId',
    validateRequest(idParams('teamId'), 'params'),
    handle((req) => service.getTeam(actor(req), param(req, 'teamId'))),
  );
  router.patch(
    '/teams/:teamId',
    requireCsrf,
    validateRequest(idParams('teamId'), 'params'),
    validateRequest(teamUpdate, 'body'),
    handle((req) =>
      service.updateTeam(actor(req), param(req, 'teamId'), req.body, req.correlationId),
    ),
  );
  router.delete(
    '/teams/:teamId',
    requireCsrf,
    validateRequest(idParams('teamId'), 'params'),
    handle((req) => service.archiveTeam(actor(req), param(req, 'teamId'), req.correlationId), 204),
  );
  router.get(
    '/teams/:teamId/members',
    validateRequest(idParams('teamId'), 'params'),
    validateRequest(paginationQuery, 'query'),
    handle((req) => service.listTeamMembers(actor(req), param(req, 'teamId'), page(req))),
  );
  router.post(
    '/teams/:teamId/join',
    requireCsrf,
    validateRequest(idParams('teamId'), 'params'),
    validateRequest(teamJoinRequestCreate, 'body'),
    handle(
      (req) =>
        service.joinTeam(actor(req), param(req, 'teamId'), req.correlationId, req.body.message),
      201,
    ),
  );
  router.post(
    '/teams/:teamId/leave',
    requireCsrf,
    validateRequest(idParams('teamId'), 'params'),
    handle((req) => service.leaveTeam(actor(req), param(req, 'teamId'), req.correlationId), 204),
  );
  router.delete(
    '/teams/:teamId/members/:userId',
    requireCsrf,
    validateRequest(teamMemberParams, 'params'),
    handle(
      (req) =>
        service.removeTeamMember(
          actor(req),
          param(req, 'teamId'),
          param(req, 'userId'),
          req.correlationId,
        ),
      204,
    ),
  );
  router.post(
    '/teams/:teamId/invitations',
    requireCsrf,
    validateRequest(idParams('teamId'), 'params'),
    validateRequest(invitationCreate, 'body'),
    handle(
      (req) =>
        service.inviteToTeam(
          actor(req),
          param(req, 'teamId'),
          req.body.inviteeId,
          req.correlationId,
        ),
      201,
    ),
  );
  router.get(
    '/teams/:teamId/requirements',
    validateRequest(idParams('teamId'), 'params'),
    handle((req) => service.listTeamRequirements(actor(req), param(req, 'teamId'))),
  );
  router.post(
    '/teams/:teamId/requirements',
    requireCsrf,
    validateRequest(idParams('teamId'), 'params'),
    validateRequest(teamRequirementCreate, 'body'),
    handle(
      (req) =>
        service.createTeamRequirement(
          actor(req),
          param(req, 'teamId'),
          req.body,
          req.correlationId,
        ),
      201,
    ),
  );
  router.patch(
    '/team-requirements/:requirementId',
    requireCsrf,
    validateRequest(idParams('requirementId'), 'params'),
    validateRequest(teamRequirementUpdate, 'body'),
    handle((req) =>
      service.updateTeamRequirement(
        actor(req),
        param(req, 'requirementId'),
        req.body,
        req.correlationId,
      ),
    ),
  );
  router.delete(
    '/team-requirements/:requirementId',
    requireCsrf,
    validateRequest(idParams('requirementId'), 'params'),
    handle(
      (req) =>
        service.deleteTeamRequirement(actor(req), param(req, 'requirementId'), req.correlationId),
      204,
    ),
  );
  router.post(
    '/team-invitations/:invitationId/accept',
    requireCsrf,
    validateRequest(idParams('invitationId'), 'params'),
    handle((req) =>
      service.respondToInvitation(actor(req), param(req, 'invitationId'), true, req.correlationId),
    ),
  );
  router.post(
    '/team-invitations/:invitationId/reject',
    requireCsrf,
    validateRequest(idParams('invitationId'), 'params'),
    handle((req) =>
      service.respondToInvitation(actor(req), param(req, 'invitationId'), false, req.correlationId),
    ),
  );

  router.get(
    '/projects',
    validateRequest(projectListQuery, 'query'),
    handle((req) => service.listProjects(actor(req), page(req))),
  );
  router.post(
    '/projects',
    requireCsrf,
    validateRequest(projectCreate, 'body'),
    handle((req) => service.createProject(actor(req), req.body, req.correlationId), 201),
  );
  router.get(
    '/projects/:projectId',
    validateRequest(idParams('projectId'), 'params'),
    handle((req) => service.getProject(actor(req), param(req, 'projectId'))),
  );
  router.post(
    '/projects/:projectId/join',
    requireCsrf,
    validateRequest(idParams('projectId'), 'params'),
    validateRequest(projectJoinRequestCreate, 'body'),
    handle(
      (req) =>
        service.joinProject(
          actor(req),
          param(req, 'projectId'),
          req.correlationId,
          req.body.message,
        ),
      201,
    ),
  );
  router.post(
    '/projects/:projectId/leave',
    requireCsrf,
    validateRequest(idParams('projectId'), 'params'),
    handle(
      (req) => service.leaveProject(actor(req), param(req, 'projectId'), req.correlationId),
      204,
    ),
  );
  router.get(
    '/projects/:projectId/requests',
    validateRequest(idParams('projectId'), 'params'),
    validateRequest(paginationQuery, 'query'),
    handle((req) =>
      service.listProjectJoinRequests(actor(req), param(req, 'projectId'), page(req)),
    ),
  );
  router.post(
    '/projects/:projectId/requests/:requestId/approve',
    requireCsrf,
    validateRequest(projectJoinRequestParams, 'params'),
    handle((req) =>
      service.reviewProjectJoinRequest(
        actor(req),
        param(req, 'projectId'),
        param(req, 'requestId'),
        true,
        req.correlationId,
      ),
    ),
  );
  router.post(
    '/projects/:projectId/requests/:requestId/reject',
    requireCsrf,
    validateRequest(projectJoinRequestParams, 'params'),
    handle((req) =>
      service.reviewProjectJoinRequest(
        actor(req),
        param(req, 'projectId'),
        param(req, 'requestId'),
        false,
        req.correlationId,
      ),
    ),
  );
  router.post(
    '/projects/:projectId/transfer-ownership',
    requireCsrf,
    validateRequest(idParams('projectId'), 'params'),
    validateRequest(projectOwnershipTransfer, 'body'),
    handle((req) =>
      service.transferProjectOwnership(
        actor(req),
        param(req, 'projectId'),
        req.body.userId,
        req.correlationId,
      ),
    ),
  );
  router.post(
    '/projects/:projectId/invitations',
    requireCsrf,
    validateRequest(idParams('projectId'), 'params'),
    validateRequest(projectInvitationCreate, 'body'),
    handle(
      (req) =>
        service.inviteToProject(
          actor(req),
          param(req, 'projectId'),
          req.body.inviteeId,
          req.correlationId,
        ),
      201,
    ),
  );
  router.get(
    '/projects/:projectId/invitations',
    validateRequest(idParams('projectId'), 'params'),
    validateRequest(paginationQuery, 'query'),
    handle((req) => service.listProjectInvitations(actor(req), param(req, 'projectId'), page(req))),
  );
  router.get(
    '/project-invitations',
    validateRequest(paginationQuery, 'query'),
    handle((req) => service.listMyProjectInvitations(actor(req), page(req))),
  );
  router.post(
    '/project-invitations/:invitationId/accept',
    requireCsrf,
    validateRequest(invitationIdParams, 'params'),
    handle((req) =>
      service.respondToProjectInvitation(
        actor(req),
        param(req, 'invitationId'),
        true,
        req.correlationId,
      ),
    ),
  );
  router.post(
    '/project-invitations/:invitationId/decline',
    requireCsrf,
    validateRequest(invitationIdParams, 'params'),
    handle((req) =>
      service.respondToProjectInvitation(
        actor(req),
        param(req, 'invitationId'),
        false,
        req.correlationId,
      ),
    ),
  );
  router.patch(
    '/projects/:projectId',
    requireCsrf,
    validateRequest(idParams('projectId'), 'params'),
    validateRequest(projectUpdate, 'body'),
    handle((req) =>
      service.updateProject(actor(req), param(req, 'projectId'), req.body, req.correlationId),
    ),
  );
  router.delete(
    '/projects/:projectId',
    requireCsrf,
    validateRequest(idParams('projectId'), 'params'),
    handle(
      (req) => service.archiveProject(actor(req), param(req, 'projectId'), req.correlationId),
      204,
    ),
  );
  router.post(
    '/projects/:projectId/complete',
    requireCsrf,
    validateRequest(idParams('projectId'), 'params'),
    handle((req) =>
      service.completeProject(actor(req), param(req, 'projectId'), req.correlationId),
    ),
  );
  router.post(
    '/projects/:projectId/activate',
    requireCsrf,
    validateRequest(idParams('projectId'), 'params'),
    handle((req) =>
      service.activateProject(actor(req), param(req, 'projectId'), req.correlationId),
    ),
  );
  router.post(
    '/projects/:projectId/showcase',
    requireCsrf,
    validateRequest(idParams('projectId'), 'params'),
    handle((req) =>
      service.showcaseProject(actor(req), param(req, 'projectId'), req.correlationId),
    ),
  );
  router.get(
    '/projects/:projectId/members',
    validateRequest(idParams('projectId'), 'params'),
    validateRequest(paginationQuery, 'query'),
    handle((req) => service.listProjectMembers(actor(req), param(req, 'projectId'), page(req))),
  );
  router.post(
    '/projects/:projectId/members',
    requireCsrf,
    validateRequest(idParams('projectId'), 'params'),
    validateRequest(projectMemberCreate, 'body'),
    handle(
      (req) =>
        service.addProjectMember(
          actor(req),
          param(req, 'projectId'),
          req.body.userId,
          'COLLABORATOR',
          req.correlationId,
        ),
      201,
    ),
  );
  router.delete(
    '/projects/:projectId/members/:userId',
    requireCsrf,
    validateRequest(projectMemberParams, 'params'),
    handle(
      (req) =>
        service.removeProjectMember(
          actor(req),
          param(req, 'projectId'),
          param(req, 'userId'),
          req.correlationId,
        ),
      204,
    ),
  );
  router.post(
    '/projects/:projectId/leave',
    requireCsrf,
    validateRequest(idParams('projectId'), 'params'),
    handle(
      (req) => service.leaveProject(actor(req), param(req, 'projectId'), req.correlationId),
      204,
    ),
  );
  router.get(
    '/projects/:projectId/tasks',
    validateRequest(idParams('projectId'), 'params'),
    validateRequest(paginationQuery, 'query'),
    handle((req) => service.listTasks(actor(req), param(req, 'projectId'), page(req))),
  );
  router.post(
    '/projects/:projectId/tasks',
    requireCsrf,
    validateRequest(idParams('projectId'), 'params'),
    validateRequest(taskCreate, 'body'),
    handle(
      (req) => service.createTask(actor(req), param(req, 'projectId'), req.body, req.correlationId),
      201,
    ),
  );
  router.patch(
    '/tasks/:taskId',
    requireCsrf,
    validateRequest(idParams('taskId'), 'params'),
    validateRequest(taskUpdate, 'body'),
    handle((req) =>
      service.updateTask(actor(req), param(req, 'taskId'), req.body, req.correlationId),
    ),
  );
  router.delete(
    '/tasks/:taskId',
    requireCsrf,
    validateRequest(idParams('taskId'), 'params'),
    handle((req) => service.archiveTask(actor(req), param(req, 'taskId'), req.correlationId), 204),
  );
  router.post(
    '/tasks/:taskId/assign',
    requireCsrf,
    validateRequest(idParams('taskId'), 'params'),
    validateRequest(taskAssignment, 'body'),
    handle((req) =>
      service.assignTask(actor(req), param(req, 'taskId'), req.body.assigneeId, req.correlationId),
    ),
  );
  router.post(
    '/tasks/:taskId/status',
    requireCsrf,
    validateRequest(idParams('taskId'), 'params'),
    validateRequest(taskStatus, 'body'),
    handle((req) =>
      service.changeTaskStatus(
        actor(req),
        param(req, 'taskId'),
        req.body.status,
        req.correlationId,
      ),
    ),
  );
  router.get(
    '/projects/:projectId/milestones',
    validateRequest(idParams('projectId'), 'params'),
    handle((req) => service.listMilestones(actor(req), param(req, 'projectId'))),
  );
  router.post(
    '/projects/:projectId/milestones',
    requireCsrf,
    validateRequest(idParams('projectId'), 'params'),
    validateRequest(milestoneCreate, 'body'),
    handle(
      (req) =>
        service.createMilestone(actor(req), param(req, 'projectId'), req.body, req.correlationId),
      201,
    ),
  );
  router.patch(
    '/milestones/:milestoneId',
    requireCsrf,
    validateRequest(idParams('milestoneId'), 'params'),
    validateRequest(milestoneUpdate, 'body'),
    handle((req) =>
      service.updateMilestone(actor(req), param(req, 'milestoneId'), req.body, req.correlationId),
    ),
  );
  router.delete(
    '/milestones/:milestoneId',
    requireCsrf,
    validateRequest(idParams('milestoneId'), 'params'),
    handle(
      (req) => service.deleteMilestone(actor(req), param(req, 'milestoneId'), req.correlationId),
      204,
    ),
  );
  router.get(
    '/projects/:projectId/resources',
    validateRequest(idParams('projectId'), 'params'),
    handle((req) => service.listProjectResources(actor(req), param(req, 'projectId'))),
  );
  router.post(
    '/projects/:projectId/resources',
    requireCsrf,
    validateRequest(idParams('projectId'), 'params'),
    validateRequest(projectResourceCreate, 'body'),
    handle(
      (req) =>
        service.createProjectResource(
          actor(req),
          param(req, 'projectId'),
          req.body,
          req.correlationId,
        ),
      201,
    ),
  );
  router.patch(
    '/projects/:projectId/resources/:resourceId',
    requireCsrf,
    validateRequest(projectResourceParams, 'params'),
    validateRequest(projectResourceUpdate, 'body'),
    handle((req) =>
      service.updateProjectResource(
        actor(req),
        param(req, 'resourceId'),
        req.body,
        req.correlationId,
      ),
    ),
  );
  router.delete(
    '/projects/:projectId/resources/:resourceId',
    requireCsrf,
    validateRequest(projectResourceParams, 'params'),
    handle(
      (req) =>
        service.deleteProjectResource(actor(req), param(req, 'resourceId'), req.correlationId),
      204,
    ),
  );
  router.get(
    '/projects/:projectId/activity',
    validateRequest(idParams('projectId'), 'params'),
    handle((req) => service.listProjectActivity(actor(req), param(req, 'projectId'))),
  );
  router.post(
    '/projects/:projectId/updates',
    requireCsrf,
    validateRequest(idParams('projectId'), 'params'),
    validateRequest(projectUpdateCreate, 'body'),
    handle(
      (req) =>
        service.postProjectUpdate(
          actor(req),
          param(req, 'projectId'),
          req.body.message,
          req.correlationId,
        ),
      201,
    ),
  );
  return router;
}
