export interface CursorPosition {
  createdAt: string;
  id: string;
}

export interface SearchCursorPosition extends CursorPosition {
  score: number;
}

export function encodeCursor(position: CursorPosition): string {
  return Buffer.from(JSON.stringify(position), 'utf8').toString('base64url');
}

export function decodeCursor(cursor: string): CursorPosition {
  const parsed: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
  if (!isCursorPosition(parsed)) {
    throw new Error('Invalid cursor');
  }
  return parsed;
}

export function encodeSearchCursor(position: SearchCursorPosition): string {
  return Buffer.from(JSON.stringify(position), 'utf8').toString('base64url');
}

export function decodeSearchCursor(cursor: string): SearchCursorPosition {
  const parsed: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
  if (!isSearchCursorPosition(parsed)) throw new Error('Invalid search cursor');
  return parsed;
}

function isCursorPosition(value: unknown): value is CursorPosition {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.createdAt === 'string' && typeof candidate.id === 'string';
}

function isSearchCursorPosition(value: unknown): value is SearchCursorPosition {
  return (
    isCursorPosition(value) &&
    typeof (value as SearchCursorPosition).score === 'number' &&
    Number.isFinite((value as SearchCursorPosition).score)
  );
}
