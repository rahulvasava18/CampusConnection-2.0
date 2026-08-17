import type { Logger } from 'pino';
import type { AuthContext } from '../modules/identity/interfaces/auth.types';

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      correlationId: string;
      log: Logger;
      auth?: AuthContext;
    }
  }
}

export {};
