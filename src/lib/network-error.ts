export function isNetworkFetchError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const message =
    'message' in error && typeof error.message === 'string'
      ? error.message.toLowerCase()
      : String(error).toLowerCase();
  return (
    message.includes('fetch failed') ||
    message.includes('network request failed') ||
    message.includes('network error') ||
    message.includes('failed to fetch')
  );
}

export function toUserFacingNetworkError(error: unknown, fallback: string): Error {
  if (isNetworkFetchError(error)) {
    return new Error('Could not reach Moments servers. Check your internet connection and try again.');
  }
  if (error instanceof Error) return error;
  return new Error(fallback);
}

export function isMissingTableError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const code = 'code' in error ? String(error.code) : '';
  const message =
    'message' in error && typeof error.message === 'string' ? error.message.toLowerCase() : '';
  return (
    code === 'PGRST205' ||
    code === '42P01' ||
    message.includes('could not find the table') ||
    message.includes('does not exist')
  );
}
