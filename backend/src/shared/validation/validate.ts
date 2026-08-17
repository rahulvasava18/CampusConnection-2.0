import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { ZodType } from 'zod';

type RequestTarget = 'body' | 'params' | 'query';

export function validateRequest(schema: ZodType, target: RequestTarget): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[target]);
    if (!result.success) {
      next(result.error);
      return;
    }
    Object.defineProperty(req, target, {
      configurable: true,
      enumerable: true,
      value: result.data,
      writable: true,
    });
    next();
  };
}
