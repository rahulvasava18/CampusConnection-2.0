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
import { createAuthRouter, createMeRouter } from './modules/identity/interfaces/auth.routes';
import { createSocialRouter } from './modules/social/interfaces/social.routes';
import { createCollaborationRouter } from './modules/collaboration/interfaces/collaboration.routes';
import { createDiscoveryRouter } from './modules/discovery/interfaces/discovery.routes';
import { createCommunicationRouter } from './modules/communication/interfaces/communication.routes';
import { createIntelligenceRouter } from './modules/intelligence/interfaces/intelligence.routes';
import { createNotificationRouter } from './modules/notifications/interfaces/notification.routes';
import { createSettingsRouter } from './modules/settings/interfaces/settings.routes';
import { createProfileRouter } from './modules/profile/interfaces/profile.routes';

export interface AppDependencies {
  healthService?: HealthService;
  authService?: AuthService;
}

export function createApp(dependencies: AppDependencies = {}): Express {
  const env = getEnv();
  const healthService =
    dependencies.healthService ?? new HealthService(isMongoReady, isRedisReady, 'api');
  const authService = dependencies.authService ?? new AuthService();
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
  app.use(cors({ origin: env.corsOrigins, credentials: true }));
  app.use(express.json({ limit: '1mb' }));

  const apiRouter = express.Router();
  apiRouter.use(createHealthRouter(healthService));
  apiRouter.use('/auth', createAuthRouter(authService));
  apiRouter.use(createMeRouter(authService));
  apiRouter.use(createOpenApiRouter());
  apiRouter.use(createDiscoveryRouter());
  apiRouter.use(createCommunicationRouter());
  apiRouter.use('/recommendations', createIntelligenceRouter());
  apiRouter.use(createNotificationRouter());
  apiRouter.use(createSettingsRouter());
  apiRouter.use(createProfileRouter());
  apiRouter.use(createSocialRouter());
  apiRouter.use(createCollaborationRouter());
  app.use('/api', apiRouter);

  app.use(createHealthRouter(healthService));
  app.use(notFoundMiddleware);
  app.use(errorMiddleware);
  return app;
}
