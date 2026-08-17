import mongoose from 'mongoose';
import { getEnv } from '../../config/env';
import { logger } from '../../shared/logging/logger';

export async function connectMongo(): Promise<void> {
  const env = getEnv();
  await mongoose.connect(env.MONGO_URI, {
    dbName: env.MONGO_DB_NAME,
    serverSelectionTimeoutMS: 5000,
    maxPoolSize: 10,
  });
  logger.info({ database: env.MONGO_DB_NAME }, 'MongoDB connected');
}

export async function disconnectMongo(): Promise<void> {
  await mongoose.disconnect();
  logger.info('MongoDB disconnected');
}

export function isMongoReady(): boolean {
  return mongoose.connection.readyState === 1;
}
