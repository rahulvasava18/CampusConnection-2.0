export class PermanentJobError extends Error {
  public readonly retryable = false;

  public constructor(message: string) {
    super(message);
    this.name = 'PermanentJobError';
  }
}

export function isPermanentJobError(error: unknown): error is PermanentJobError {
  return (
    error instanceof PermanentJobError ||
    (typeof error === 'object' &&
      error !== null &&
      'retryable' in error &&
      (error as { retryable?: unknown }).retryable === false)
  );
}
