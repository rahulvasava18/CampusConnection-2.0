import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';

export function requestContextMiddleware(req: Request, res: Response, next: NextFunction): void {
  const requestId = req.header('x-request-id') ?? randomUUID();
  const correlationId = req.header('x-correlation-id') ?? requestId;
  req.requestId = requestId;
  req.correlationId = correlationId;
  res.setHeader('x-request-id', requestId);
  res.setHeader('x-correlation-id', correlationId);
  next();
}
