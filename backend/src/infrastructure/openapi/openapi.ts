import { Router } from 'express';

export const openApiDocument = {
  openapi: '3.1.0',
  info: {
    title: 'CampusConnection API',
    version: '0.1.0',
    description:
      'CampusConnection API with durable domain events and asynchronous background processing.',
  },
  servers: [{ url: '/api' }],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      refreshCookie: { type: 'apiKey', in: 'cookie', name: 'cc_refresh' },
    },
    schemas: {
      ApiError: {
        type: 'object',
        required: ['error'],
        properties: {
          error: {
            type: 'object',
            required: ['code', 'message', 'requestId'],
            properties: {
              code: { type: 'string' },
              message: { type: 'string' },
              requestId: { type: 'string' },
              details: { type: 'object' },
            },
          },
        },
      },
      User: {
        type: 'object',
        required: [
          'id',
          'username',
          'email',
          'displayName',
          'accountState',
          'verificationStatus',
          'roles',
        ],
        properties: {
          id: { type: 'string' },
          username: { type: 'string' },
          email: { type: 'string', format: 'email' },
          displayName: { type: 'string' },
          accountState: { type: 'string' },
          verificationStatus: { type: 'string' },
          roles: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  },
  paths: {
    '/health': { get: { summary: 'Process liveness' } },
    '/ready': { get: { summary: 'Dependency readiness' } },
    '/auth/signup': {
      post: {
        summary: 'Legacy signup endpoint; new accounts use Google onboarding',
        responses: {
          '410': { description: 'Google Sign-In is required for new accounts' },
        },
      },
    },
    '/auth/google': {
      get: {
        summary: 'Start Google OAuth authorization',
        responses: { '302': { description: 'Redirect to Google authorization' } },
      },
    },
    '/auth/google/callback': {
      get: {
        summary: 'Complete the server-side Google OAuth callback',
        responses: { '303': { description: 'Redirect to the frontend handoff page' } },
      },
    },
    '/auth/google/exchange': {
      post: {
        summary: 'Exchange a one-time Google handoff token for a session or onboarding state',
        responses: {
          '200': { description: 'Session created or onboarding started' },
          '401': { description: 'Google handoff is invalid or expired' },
        },
      },
    },
    '/auth/google/onboarding': {
      post: {
        summary: 'Create an account from a verified Google onboarding state',
        responses: {
          '201': { description: 'Account and session created' },
          '409': { description: 'Username or email is already in use' },
        },
      },
    },
    '/auth/verify-email': {
      post: {
        summary: 'Consume an email verification token',
        responses: {
          '200': { description: 'Email verified' },
          '400': { description: 'Invalid or expired token' },
        },
      },
    },
    '/auth/resend-verification': {
      post: {
        summary: 'Replace and resend an email verification token',
        responses: {
          '200': { description: 'Verification email sent' },
          '429': { description: 'Resend rate limit exceeded' },
        },
      },
    },
    '/auth/login': {
      post: {
        summary: 'Authenticate with email or username and password',
        responses: {
          '200': { description: 'Session created' },
          '401': { description: 'Invalid credentials' },
          '403': { description: 'Email not verified or password not set' },
        },
      },
    },
    '/auth/refresh': {
      post: {
        summary: 'Rotate a refresh session',
        security: [{ refreshCookie: [] }],
        responses: {
          '200': { description: 'Session rotated' },
          '401': { description: 'Refresh session invalid' },
          '403': { description: 'CSRF validation failed' },
        },
      },
    },
    '/auth/logout': {
      post: {
        summary: 'Revoke the current session',
        security: [{ bearerAuth: [] }],
        responses: { '204': { description: 'Session revoked' } },
      },
    },
    '/auth/logout-all': {
      post: {
        summary: 'Revoke all sessions',
        security: [{ bearerAuth: [] }],
        responses: { '204': { description: 'Sessions revoked' } },
      },
    },
    '/me': {
      get: {
        summary: 'Get the current user',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Current user' } },
      },
      patch: {
        summary: 'Update the current profile',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Profile updated' } },
      },
    },
    '/me/sessions': {
      get: {
        summary: 'List current sessions',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Session list' } },
      },
    },
    '/me/sessions/{sessionId}': {
      delete: {
        summary: 'Revoke one session',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'sessionId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '204': { description: 'Session revoked' } },
      },
    },
    '/users/{userId}/profile': {
      get: {
        summary: 'Get a privacy-filtered CampusConnection profile',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'userId', in: 'path', required: true, schema: { type: 'string' } },
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'integer', minimum: 1, maximum: 20, default: 12 },
          },
          { name: 'cursor', in: 'query', schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Profile returned' },
          '404': { description: 'Profile unavailable or private' },
        },
      },
    },
    '/me/sessions/revoke-others': {
      post: {
        summary: 'Revoke all other active sessions',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Other sessions revoked' } },
      },
    },
    '/settings': {
      get: {
        summary: 'Get account settings and preferences',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Settings returned' } },
      },
      patch: {
        summary: 'Update account settings and preferences',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Settings updated' } },
      },
    },
    '/settings/password': {
      post: {
        summary: 'Set or change the current account password',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'Password updated' },
          '401': { description: 'Current password is invalid' },
          '403': { description: 'CSRF validation failed' },
        },
      },
    },
    '/posts': {
      post: {
        summary: 'Create a social post',
        security: [{ bearerAuth: [] }],
        responses: { '201': { description: 'Post created' } },
      },
    },
    '/posts/{postId}': {
      get: {
        summary: 'Get a social post',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Post returned' } },
      },
      patch: {
        summary: 'Update an owned post',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Post updated' } },
      },
      delete: {
        summary: 'Delete an owned post',
        security: [{ bearerAuth: [] }],
        responses: { '204': { description: 'Post deleted' } },
      },
    },
    '/posts/{postId}/comments': {
      get: {
        summary: 'List post comments',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Comments returned' } },
      },
      post: {
        summary: 'Create a post comment',
        security: [{ bearerAuth: [] }],
        responses: { '201': { description: 'Comment created' } },
      },
    },
    '/comments/{commentId}': {
      patch: {
        summary: 'Update an owned comment',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Comment updated' } },
      },
      delete: {
        summary: 'Delete an owned comment',
        security: [{ bearerAuth: [] }],
        responses: { '204': { description: 'Comment deleted' } },
      },
    },
    '/posts/{postId}/reactions/{reactionType}': {
      put: {
        summary: 'Add a post reaction',
        security: [{ bearerAuth: [] }],
        responses: { '204': { description: 'Reaction added' } },
      },
      delete: {
        summary: 'Remove a post reaction',
        security: [{ bearerAuth: [] }],
        responses: { '204': { description: 'Reaction removed' } },
      },
    },
    '/feed': {
      get: {
        summary: 'List the deterministic social feed',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Feed returned' } },
      },
    },
    '/search': {
      get: {
        summary: 'Search visible CampusConnection entities',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'q',
            in: 'query',
            required: true,
            schema: { type: 'string', minLength: 2, maxLength: 100 },
          },
          {
            name: 'type',
            in: 'query',
            schema: { type: 'string', enum: ['people', 'communities', 'teams', 'projects'] },
          },
          { name: 'limit', in: 'query', schema: { type: 'integer', maximum: 50, default: 20 } },
          { name: 'cursor', in: 'query', schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Search results' },
          '429': { description: 'Search rate limit exceeded' },
        },
      },
    },
    '/search/people': {
      get: {
        summary: 'Search visible people',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'People results' } },
      },
    },
    '/search/communities': {
      get: {
        summary: 'Search visible communities',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Community results' } },
      },
    },
    '/search/teams': {
      get: {
        summary: 'Search visible teams',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Team results' } },
      },
    },
    '/search/projects': {
      get: {
        summary: 'Search visible projects',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Project results' } },
      },
    },
    '/search/autocomplete': {
      get: {
        summary: 'Return bounded search suggestions',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'Autocomplete suggestions' },
          '429': { description: 'Autocomplete rate limit exceeded' },
        },
      },
    },
    '/search/teams/{teamId}/match': {
      get: {
        summary: 'Explain the current user match for a team',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'teamId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Team match explanation' } },
      },
    },
    '/conversations': {
      get: {
        summary: 'List active conversations for the user',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Conversations returned' } },
      },
      post: {
        summary: 'Create a direct, group, team, or community conversation',
        security: [{ bearerAuth: [] }],
        responses: { '201': { description: 'Conversation created' } },
      },
    },
    '/notifications': {
      get: {
        summary: 'List the authenticated user notifications',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Notifications returned' } },
      },
    },
    '/notifications/unread-count': {
      get: {
        summary: 'Get the authenticated user unread notification count',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Unread count returned' } },
      },
    },
    '/notifications/{notificationId}/read': {
      patch: {
        summary: 'Mark an owned notification as read',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Notification marked read' } },
      },
    },
    '/notifications/read-all': {
      post: {
        summary: 'Mark all owned notifications as read',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Notifications marked read' } },
      },
    },
    '/conversations/{conversationId}': {
      get: {
        summary: 'Get an authorized conversation',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Conversation returned' } },
      },
      patch: {
        summary: 'Update conversation metadata',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Conversation updated' } },
      },
    },
    '/conversations/{conversationId}/members': {
      get: {
        summary: 'List conversation members',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Members returned' } },
      },
      post: {
        summary: 'Add a conversation member',
        security: [{ bearerAuth: [] }],
        responses: { '201': { description: 'Member added' } },
      },
    },
    '/conversations/{conversationId}/members/{userId}': {
      delete: {
        summary: 'Remove a conversation member',
        security: [{ bearerAuth: [] }],
        responses: { '204': { description: 'Member removed' } },
      },
    },
    '/conversations/{conversationId}/leave': {
      post: {
        summary: 'Leave a conversation',
        security: [{ bearerAuth: [] }],
        responses: { '204': { description: 'Conversation left' } },
      },
    },
    '/conversations/{conversationId}/messages': {
      get: {
        summary: 'Load cursor-paginated message history',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Messages returned' } },
      },
      post: {
        summary: 'Persist a message over HTTP with idempotency',
        security: [{ bearerAuth: [] }],
        responses: { '201': { description: 'Message persisted' } },
      },
    },
    '/conversations/{conversationId}/read': {
      post: {
        summary: 'Advance the durable read cursor',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Read state updated' } },
      },
    },
    '/messages/{messageId}': {
      patch: {
        summary: 'Edit an owned message',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Message updated' } },
      },
      delete: {
        summary: 'Delete an owned message',
        security: [{ bearerAuth: [] }],
        responses: { '204': { description: 'Message deleted' } },
      },
    },
    '/recommendations/people': {
      get: {
        summary: 'Return explainable people recommendations',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'People recommendations and readiness returned' } },
      },
    },
    '/recommendations/teams': {
      get: {
        summary: 'Return explainable team recommendations',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Team recommendations and readiness returned' } },
      },
    },
    '/recommendations/projects': {
      get: {
        summary: 'Return explainable project recommendations',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Project recommendations and readiness returned' } },
      },
    },
    '/recommendations/communities': {
      get: {
        summary: 'Return explainable community recommendations',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Community recommendations and readiness returned' } },
      },
    },
    '/recommendations/refresh': {
      post: {
        summary: 'Refresh the current user recommendation snapshot',
        security: [{ bearerAuth: [] }],
        responses: { '204': { description: 'Recommendations refreshed' } },
      },
    },
    '/recommendations/{recommendationId}/feedback': {
      post: {
        summary: 'Record recommendation feedback',
        security: [{ bearerAuth: [] }],
        responses: { '204': { description: 'Feedback recorded' } },
      },
    },
    '/users/{userId}/connection-requests': {
      post: {
        summary: 'Request a connection',
        security: [{ bearerAuth: [] }],
        responses: { '201': { description: 'Request created' } },
      },
    },
    '/connection-requests/{requestId}/accept': {
      post: {
        summary: 'Accept a connection request',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Request accepted' } },
      },
    },
    '/connection-requests/{requestId}/reject': {
      post: {
        summary: 'Reject a connection request',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Request rejected' } },
      },
    },
    '/connections/{userId}': {
      delete: {
        summary: 'Remove a connection',
        security: [{ bearerAuth: [] }],
        responses: { '204': { description: 'Connection removed' } },
      },
    },
    '/me/connections': {
      get: {
        summary: 'List accepted connections',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Connections returned' } },
      },
    },
    '/me/connection-requests': {
      get: {
        summary: 'List connection requests',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Requests returned' } },
      },
    },
    '/blocks/{userId}': {
      post: {
        summary: 'Block a user',
        security: [{ bearerAuth: [] }],
        responses: { '204': { description: 'User blocked' } },
      },
      delete: {
        summary: 'Unblock a user',
        security: [{ bearerAuth: [] }],
        responses: { '204': { description: 'User unblocked' } },
      },
    },
    '/communities': {
      get: {
        summary: 'List accessible communities',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Communities returned' } },
      },
      post: {
        summary: 'Create a community',
        security: [{ bearerAuth: [] }],
        responses: { '201': { description: 'Community created' } },
      },
    },
    '/communities/{communityId}': {
      get: {
        summary: 'Get a community',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Community returned' } },
      },
      patch: {
        summary: 'Update a community',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Community updated' } },
      },
      delete: {
        summary: 'Archive a community',
        security: [{ bearerAuth: [] }],
        responses: { '204': { description: 'Community archived' } },
      },
    },
    '/communities/{communityId}/join': {
      post: {
        summary: 'Join or request community membership',
        security: [{ bearerAuth: [] }],
        responses: { '201': { description: 'Membership created' } },
      },
    },
    '/communities/{communityId}/leave': {
      post: {
        summary: 'Leave a community',
        security: [{ bearerAuth: [] }],
        responses: { '204': { description: 'Membership left' } },
      },
    },
    '/communities/{communityId}/members': {
      get: {
        summary: 'List community members',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Members returned' } },
      },
    },
    '/me/communities': {
      get: {
        summary: 'List the current user communities',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Membership communities returned' } },
      },
    },
    '/communities/{communityId}/discussions': {
      get: {
        summary: 'List community discussions',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Discussions returned' } },
      },
      post: {
        summary: 'Create a community discussion',
        security: [{ bearerAuth: [] }],
        responses: { '201': { description: 'Discussion created' } },
      },
    },
    '/discussions/{discussionId}': {
      get: {
        summary: 'Get a community discussion',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Discussion returned' } },
      },
    },
    '/discussions': {
      get: {
        summary: 'List active discussions from accessible communities',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Active discussions returned' } },
      },
    },
    '/discussions/{discussionId}/replies': {
      get: {
        summary: 'List discussion replies',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Replies returned' } },
      },
      post: {
        summary: 'Create a discussion reply',
        security: [{ bearerAuth: [] }],
        responses: { '201': { description: 'Reply created' } },
      },
    },
    '/communities/{communityId}/members/{userId}': {
      patch: {
        summary: 'Manage community membership',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Membership updated' } },
      },
    },
    '/teams': {
      get: {
        summary: 'List accessible teams',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Teams returned' } },
      },
      post: {
        summary: 'Create a team',
        security: [{ bearerAuth: [] }],
        responses: { '201': { description: 'Team created' } },
      },
    },
    '/teams/{teamId}': {
      get: {
        summary: 'Get a team',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Team returned' } },
      },
      patch: {
        summary: 'Update a team',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Team updated' } },
      },
      delete: {
        summary: 'Archive a team',
        security: [{ bearerAuth: [] }],
        responses: { '204': { description: 'Team archived' } },
      },
    },
    '/teams/{teamId}/members': {
      get: {
        summary: 'List team members',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Members returned' } },
      },
    },
    '/teams/{teamId}/join': {
      post: {
        summary: 'Join a team',
        security: [{ bearerAuth: [] }],
        responses: { '201': { description: 'Membership created' } },
      },
    },
    '/teams/{teamId}/leave': {
      post: {
        summary: 'Leave a team',
        security: [{ bearerAuth: [] }],
        responses: { '204': { description: 'Membership left' } },
      },
    },
    '/teams/{teamId}/members/{userId}': {
      delete: {
        summary: 'Remove a team member',
        security: [{ bearerAuth: [] }],
        responses: { '204': { description: 'Member removed' } },
      },
    },
    '/teams/{teamId}/invitations': {
      post: {
        summary: 'Invite a team member',
        security: [{ bearerAuth: [] }],
        responses: { '201': { description: 'Invitation created' } },
      },
    },
    '/teams/{teamId}/requirements': {
      get: {
        summary: 'List team requirements',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Team requirements returned' } },
      },
      post: {
        summary: 'Create a team requirement',
        security: [{ bearerAuth: [] }],
        responses: { '201': { description: 'Team requirement created' } },
      },
    },
    '/team-requirements/{requirementId}': {
      patch: {
        summary: 'Update a team requirement',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Team requirement updated' } },
      },
      delete: {
        summary: 'Delete a team requirement',
        security: [{ bearerAuth: [] }],
        responses: { '204': { description: 'Team requirement deleted' } },
      },
    },
    '/team-invitations/{invitationId}/accept': {
      post: {
        summary: 'Accept a team invitation',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Invitation accepted' } },
      },
    },
    '/team-invitations/{invitationId}/reject': {
      post: {
        summary: 'Reject a team invitation',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Invitation rejected' } },
      },
    },
    '/projects': {
      get: {
        summary: 'List accessible projects',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Projects returned' } },
      },
      post: {
        summary: 'Create a project',
        security: [{ bearerAuth: [] }],
        responses: { '201': { description: 'Project created' } },
      },
    },
    '/projects/{projectId}': {
      get: {
        summary: 'Get a project',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Project returned' } },
      },
      patch: {
        summary: 'Update a project',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Project updated' } },
      },
      delete: {
        summary: 'Archive a project',
        security: [{ bearerAuth: [] }],
        responses: { '204': { description: 'Project archived' } },
      },
    },
    '/projects/{projectId}/complete': {
      post: {
        summary: 'Complete a project',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Project completed' } },
      },
    },
    '/projects/{projectId}/showcase': {
      post: {
        summary: 'Showcase a project',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Project showcased' } },
      },
    },
    '/projects/{projectId}/members': {
      get: {
        summary: 'List project members',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Members returned' } },
      },
      post: {
        summary: 'Add a project member',
        security: [{ bearerAuth: [] }],
        responses: { '201': { description: 'Member added' } },
      },
    },
    '/projects/{projectId}/members/{userId}': {
      delete: {
        summary: 'Remove a project member',
        security: [{ bearerAuth: [] }],
        responses: { '204': { description: 'Member removed' } },
      },
    },
    '/projects/{projectId}/leave': {
      post: {
        summary: 'Leave a project',
        security: [{ bearerAuth: [] }],
        responses: { '204': { description: 'Membership left' } },
      },
    },
    '/projects/{projectId}/tasks': {
      get: {
        summary: 'List project tasks',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Tasks returned' } },
      },
      post: {
        summary: 'Create a project task',
        security: [{ bearerAuth: [] }],
        responses: { '201': { description: 'Task created' } },
      },
    },
    '/tasks/{taskId}': {
      patch: {
        summary: 'Update a task',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Task updated' } },
      },
      delete: {
        summary: 'Archive a task',
        security: [{ bearerAuth: [] }],
        responses: { '204': { description: 'Task archived' } },
      },
    },
    '/tasks/{taskId}/assign': {
      post: {
        summary: 'Assign a task',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Task assigned' } },
      },
    },
    '/tasks/{taskId}/status': {
      post: {
        summary: 'Change task status',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Task status changed' } },
      },
    },
    '/projects/{projectId}/milestones': {
      get: {
        summary: 'List project milestones',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Milestones returned' } },
      },
      post: {
        summary: 'Create a project milestone',
        security: [{ bearerAuth: [] }],
        responses: { '201': { description: 'Milestone created' } },
      },
    },
    '/milestones/{milestoneId}': {
      patch: {
        summary: 'Update a milestone',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Milestone updated' } },
      },
    },
  },
};

export function createOpenApiRouter(): Router {
  const router = Router();
  router.get('/openapi.json', (_req, res) => res.json(openApiDocument));
  return router;
}
