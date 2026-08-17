import { connectMongo, disconnectMongo } from '../infrastructure/mongodb/connection';
import { connectRedis, disconnectRedis } from '../infrastructure/redis/client';
import { createWorkerRuntime, stopWorkerRuntime } from './worker-runtime';
import { logger } from '../shared/logging/logger';

export async function startWorker(): Promise<void> {
  await connectMongo();
  await connectRedis();
  const runtime = await createWorkerRuntime();
  let stopping = false;

  const shutdown = async (signal: string): Promise<void> => {
    if (stopping) return;
    stopping = true;
    logger.info({ signal }, 'Worker shutdown requested');
    await stopWorkerRuntime(runtime);
    await disconnectRedis();
    await disconnectMongo();
  };
  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
}
