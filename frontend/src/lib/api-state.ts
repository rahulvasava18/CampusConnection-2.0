import type { ApiCollection, ApiErrorBody } from '@campusconnection/shared';

export class ApiRequestError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly requestId: string | undefined;
  public readonly details: Record<string, unknown> | undefined;

  public constructor(
    status: number,
    error: ApiErrorBody['error'] | undefined,
    fallbackMessage = 'The request failed.',
  ) {
    super(error?.message ?? fallbackMessage);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = error?.code ?? 'REQUEST_FAILED';
    this.requestId = error?.requestId;
    this.details = error?.details;
  }
}

export function isRestrictedApiError(error: unknown): error is ApiRequestError {
  return (
    error instanceof ApiRequestError &&
    error.status === 403 &&
    ['ACCOUNT_RESTRICTED', 'ACCOUNT_UNAVAILABLE'].includes(error.code)
  );
}

export function apiErrorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiRequestError && error.message ? error.message : fallback;
}

export function collectionItems<T>(collection: { data?: T[] | null } | null | undefined): T[] {
  return collection && Array.isArray(collection.data) ? collection.data : [];
}

export function paginatedItems<T>(pages: Array<ApiCollection<T>> | null | undefined): T[] {
  return Array.isArray(pages) ? pages.flatMap((page) => collectionItems(page)) : [];
}
