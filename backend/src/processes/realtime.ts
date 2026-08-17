import { createServer } from 'node:http';
import express from 'express';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { HealthService } from '../application/health/health.service';
import { getEnv } from '../config/env';
import { connectMongo, disconnectMongo, isMongoReady } from '../infrastructure/mongodb/connection';
import { connectRedis, disconnectRedis, isRedisReady } from '../infrastructure/redis/client';
import { logger } from '../shared/logging/logger';
import { createHealthRouter } from '../interfaces/http/health.routes';
import { verifyAccessToken } from '../modules/identity/security/jwt.service';
import { UserRepository } from '../modules/identity/infrastructure/identity.repositories';
import { SessionRepository } from '../modules/identity/infrastructure/identity.repositories';
import { createRealtimeGateway } from '../modules/communication/realtime/realtime.gateway';
import { subscribeRealtimeControl } from '../modules/communication/realtime/control';
import { validateJwtKeys } from '../modules/identity/security/jwt.service';

export async function startRealtime(): Promise<void> {
  const env = getEnv();
  validateJwtKeys();
  await connectMongo();
  const redis = await connectRedis();
  const pubClient = redis.duplicate();
  const subClient = redis.duplicate();
  await Promise.all([pubClient.connect(), subClient.connect()]);

  const httpApp = express();
  const healthService = new HealthService(isMongoReady, isRedisReady, 'realtime');
  httpApp.use(createHealthRouter(healthService));
  const httpServer = createServer(httpApp);
  const io = new Server(httpServer, { cors: { origin: env.corsOrigins, credentials: true } });
  io.adapter(createAdapter(pubClient, subClient));
  const users = new UserRepository();
  const sessions = new SessionRepository();
  io.use(async (socket, next) => {
    try {
      const supplied = socket.handshake.auth?.accessToken as unknown;
      const header = socket.handshake.headers.authorization;
      const authorization =
        typeof supplied === 'string'
          ? supplied
          : typeof header === 'string' && header.startsWith('Bearer ')
            ? header.slice('Bearer '.length)
            : undefined;
      if (!authorization) return next(new Error('AUTHENTICATION_REQUIRED'));
      const claims = verifyAccessToken(authorization);
      const user = await users.findById(claims.sub);
      if (!user || ['BANNED', 'DELETED', 'SUSPENDED'].includes(user.accountState))
        return next(new Error('ACCOUNT_UNAVAILABLE'));
      const session = await sessions.findActiveForUser(claims.sub, claims.sid, claims.fid);
      if (!session) return next(new Error('SESSION_UNAVAILABLE'));
      socket.data.userId = user.id;
      socket.data.roles = user.roles;
      socket.data.sessionId = claims.sid;
      next();
    } catch {
      next(new Error('AUTHENTICATION_INVALID'));
    }
  });
  const gateway = createRealtimeGateway(io, redis);
  const closeControl = await subscribeRealtimeControl(redis, io);
  io.on('connection', (socket) =>
    logger.info({ socketId: socket.id, userId: socket.data.userId }, 'Realtime socket connected'),
  );

  const port = env.PORT ?? env.REALTIME_PORT;
  httpServer.listen(port, () =>
    logger.info({ port }, 'Realtime server listening'),
  );

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'Realtime shutdown requested');
    gateway.close();
    await closeControl();
    io.close();
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    await Promise.all([pubClient.quit(), subClient.quit()]);
    await disconnectRedis();
    await disconnectMongo();
  };
  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
}
