export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details: Record<string, unknown> | undefined;
  public readonly isOperational: boolean;

  public constructor(
    code: string,
    message: string,
    statusCode = 500,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;
  }
}
