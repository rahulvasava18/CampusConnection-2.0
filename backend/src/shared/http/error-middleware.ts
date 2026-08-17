import type { ErrorRequestHandler, Request, RequestHandler } from 'express';
import { z } from 'zod';
import type { ApiErrorBody } from '@campusconnection/shared';
import { AppError } from '../errors/app-error';
import { logger } from '../logging/logger';

function logHttpError(req: Request, statusCode: number, message: string): void {
  logger.error(
    {
      req: {
        method: req.method,
        url: req.originalUrl ?? req.url,
        requestId: req.requestId,
        correlationId: req.correlationId,
      },
      res: { statusCode },
      err: { message },
    },
    'HTTP request failed',
  );
}

export const notFoundMiddleware: RequestHandler = (req, _res, next) => {
  next(new AppError('RESOURCE_NOT_FOUND', `Route not found: ${req.method} ${req.path}`, 404));
};

export const errorMiddleware: ErrorRequestHandler = (error: unknown, req, res, _next) => {
  void _next;
  const requestId = req.requestId ?? 'unknown';
  if (error instanceof z.ZodError) {
    logHttpError(req, 422, 'The request failed validation.');
    const body: ApiErrorBody = {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'The request failed validation.',
        details: { issues: error.issues },
        requestId,
      },
    };
    res.status(422).json(body);
    return;
  }

  if (error instanceof AppError) {
    logHttpError(req, error.statusCode, error.message);
    res.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {}),
        requestId,
      },
    } satisfies ApiErrorBody);
    return;
  }

  logger.error(
    {
      req: {
        method: req.method,
        url: req.originalUrl ?? req.url,
        requestId,
        correlationId: req.correlationId,
      },
      res: { statusCode: 500 },
      err: error,
    },
    'HTTP request failed',
  );
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred.',
      requestId,
    },
  } satisfies ApiErrorBody);
};
