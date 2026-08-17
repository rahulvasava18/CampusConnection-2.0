export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

export function normalizeIdentifier(identifier: string): string {
  const normalized = identifier.trim();
  return normalized.includes('@') ? normalizeEmail(normalized) : normalizeUsername(normalized);
}
