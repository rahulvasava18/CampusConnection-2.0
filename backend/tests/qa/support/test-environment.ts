export interface QaEnvironment {
  mongoUri: string;
  mongoDbName: string;
  redisUrl: string;
}

export function getQaEnvironment(): QaEnvironment {
  const missing = ['QA_MONGO_URI', 'QA_MONGO_DB_NAME', 'QA_REDIS_URL'].filter(
    (key) => !process.env[key],
  );
  if (missing.length > 0) {
    throw new Error(
      `QA_ENV_REQUIRED: dedicated test variables are required: ${missing.join(', ')}. ` +
        'Refusing to use backend/.env or the development database.',
    );
  }
  return {
    mongoUri: process.env.QA_MONGO_URI as string,
    mongoDbName: process.env.QA_MONGO_DB_NAME as string,
    redisUrl: process.env.QA_REDIS_URL as string,
  };
}
