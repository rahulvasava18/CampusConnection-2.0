import { createServer } from 'node:http';
import { createApp } from '../app';
import { getEnv } from '../config/env';
import { connectMongo, disconnectMongo } from '../infrastructure/mongodb/connection';
import { connectRedis, disconnectRedis } from '../infrastructure/redis/client';
import { logger } from '../shared/logging/logger';
import { validateJwtKeys } from '../modules/identity/security/jwt.service';

export async function startApi(): Promise<void> {
  const env = getEnv();
  validateJwtKeys();
  await connectMongo();
  await connectRedis();
  const server = createServer(createApp());
  const port = env.PORT ?? env.API_PORT;
  server.listen(port, () => logger.info({ port }, 'API server running'));

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'API shutdown requested');
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await disconnectRedis();
    await disconnectMongo();
  };
  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
}
