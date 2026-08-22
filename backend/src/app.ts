import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { getEnv } from './config/env';
import { HealthService } from './application/health/health.service';
import { isMongoReady } from './infrastructure/mongodb/connection';
import { isRedisReady } from './infrastructure/redis/client';
import { createOpenApiRouter } from './infrastructure/openapi/openapi';
import { errorMiddleware, notFoundMiddleware } from './shared/http/error-middleware';
import { requestContextMiddleware } from './shared/http/request-context';
import { logger } from './shared/logging/logger';
import { createHealthRouter } from './interfaces/http/health.routes';
import { AuthService } from './modules/identity/application/auth.service';
import { AccountDeletionService } from './modules/identity/application/account-deletion.service';
import { createAuthRouter, createMeRouter } from './modules/identity/interfaces/auth.routes';
import { createSocialRouter } from './modules/social/interfaces/social.routes';
import { createCollaborationRouter } from './modules/collaboration/interfaces/collaboration.routes';
import { createDiscoveryRouter } from './modules/discovery/interfaces/discovery.routes';
import { createCommunicationRouter } from './modules/communication/interfaces/communication.routes';
import { createIntelligenceRouter } from './modules/intelligence/interfaces/intelligence.routes';
import { createNotificationRouter } from './modules/notifications/interfaces/notification.routes';
import { createSettingsRouter } from './modules/settings/interfaces/settings.routes';
import { createProfileRouter } from './modules/profile/interfaces/profile.routes';
import { createAdminRouter } from './modules/admin/interfaces/admin.routes';
import {
  createAdminControlRouter,
  createReportRouter,
} from './modules/admin/interfaces/admin-control.routes';
import type { AdminService } from './modules/admin/application/admin.service';
import type { AdminUserService } from './modules/admin/application/admin-user.service';
import type { AdminControlService } from './modules/admin/application/admin-control.service';
import type { AdminAnalyticsService } from './modules/admin/application/admin-analytics.service';
import { createClubAdminRouter, createClubRouter } from './modules/club/interfaces/club.routes';
import type { ClubService } from './modules/club/application/club.service';

export interface AppDependencies {
  healthService?: HealthService;
  authService?: AuthService;
  accountDeletionService?: Pick<AccountDeletionService, 'deleteAccount'>;
  adminService?: AdminService;
  adminUserService?: AdminUserService;
  adminControlService?: AdminControlService;
  adminAnalyticsService?: AdminAnalyticsService;
  clubService?: ClubService;
}

export function createApp(dependencies: AppDependencies = {}): Express {
  const env = getEnv();
  const healthService =
    dependencies.healthService ?? new HealthService(isMongoReady, isRedisReady, 'api');
  const authService = dependencies.authService ?? new AuthService();
  const accountDeletionService = dependencies.accountDeletionService ?? new AccountDeletionService();
  const app = express();

  app.disable('x-powered-by');
  app.use(requestContextMiddleware);
  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => req.requestId,
      autoLogging: {
        ignore: (req) => req.method === 'OPTIONS',
      },
      customLogLevel: (_req, res) => {
        const requestPath = res.req.url?.split('?')[0];
        const isSuccessfulHealthCheck =
          res.statusCode < 400 && (requestPath === '/api/health' || requestPath === '/health');
        if (isSuccessfulHealthCheck || res.statusCode >= 400) return 'silent';
        return 'info';
      },
      serializers: {
        req: (req) => {
          const request = req as typeof req & { correlationId?: string };
          return {
            method: request.method,
            url: request.url,
            requestId: request.id,
            correlationId: request.correlationId,
          };
        },
        res: (res) => ({ statusCode: res.statusCode }),
      },
    }),
  );
  app.use(helmet());
  app.use(
    cors({
      origin: env.corsOrigins,
      credentials: true,
      allowedHeaders: ['Content-Type', 'Authorization', env.CSRF_HEADER_NAME],
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.get('/', (_req, res) => {
    res.status(200).json({ service: 'CampusConnection API', status: 'ok' });
  });

  const apiRouter = express.Router();
  apiRouter.use(createHealthRouter(healthService));
  apiRouter.use('/auth', createAuthRouter(authService, accountDeletionService));
  apiRouter.use(createMeRouter(authService));
  apiRouter.use(createOpenApiRouter());
  apiRouter.use(createReportRouter(dependencies.adminControlService));
  apiRouter.use(createDiscoveryRouter());
  apiRouter.use(createCommunicationRouter());
  apiRouter.use('/recommendations', createIntelligenceRouter());
  apiRouter.use(createNotificationRouter());
  apiRouter.use(createSettingsRouter());
  apiRouter.use(createProfileRouter());
  apiRouter.use('/admin', createAdminRouter(dependencies.adminService, dependencies.adminUserService));
  apiRouter.use('/admin', createAdminControlRouter(dependencies.adminControlService, dependencies.adminAnalyticsService));
  apiRouter.use('/admin', createClubAdminRouter(dependencies.clubService));
  apiRouter.use(createSocialRouter());
  apiRouter.use(createCollaborationRouter());
  apiRouter.use(createClubRouter(dependencies.clubService));
  app.use('/api', apiRouter);

  app.use(createHealthRouter(healthService));
  app.use(notFoundMiddleware);
  app.use(errorMiddleware);
  return app;
}
