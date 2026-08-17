export interface PaginationMeta {
  nextCursor: string | null;
  hasMore: boolean;
}

export interface ApiSuccess<T> {
  data: T;
}

export interface ApiCollection<T> {
  data: T[];
  pagination: PaginationMeta;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    requestId: string;
  };
}
