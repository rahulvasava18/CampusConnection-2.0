import { z } from 'zod';

const frontendEnvSchema = z.object({
  VITE_API_BASE_URL: z.string().url().default('http://localhost:4000/api/v1'),
  VITE_REALTIME_URL: z.string().url().default('http://localhost:4001'),
});

export const frontendEnv = frontendEnvSchema.parse({
  VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL,
  VITE_REALTIME_URL: import.meta.env.VITE_REALTIME_URL,
});
