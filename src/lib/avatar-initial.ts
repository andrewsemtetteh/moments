/** First letter of the first name only. */
export function getAvatarInitial(name?: string | null): string {
  const trimmed = name?.trim();
  if (!trimmed) return '?';

  const firstName = trimmed.split(/\s+/)[0];
  const letter = firstName[0];
  return letter ? letter.toUpperCase() : '?';
}

/** First name from a full name string. */
export function getFirstName(name?: string | null): string | null {
  const trimmed = name?.trim();
  if (!trimmed) return null;
  return trimmed.split(/\s+/)[0] ?? null;
}
