export function isNetworkFetchError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const message =
    'message' in error && typeof error.message === 'string'
      ? error.message.toLowerCase()
      : String(error).toLowerCase();
  const details =
    'details' in error && typeof error.details === 'string'
      ? error.details.toLowerCase()
      : '';
  const combined = `${message} ${details}`;
  return (
    combined.includes('fetch failed') ||
    combined.includes('network request failed') ||
    combined.includes('network error') ||
    combined.includes('failed to fetch') ||
    combined.includes('unknownhostexception') ||
    combined.includes('unable to resolve host') ||
    combined.includes('no address associated with hostname')
  );
}

export function isJwtExpiredError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const code = 'code' in error ? String(error.code) : '';
  const message =
    'message' in error && typeof error.message === 'string' ? error.message.toLowerCase() : '';
  return code === 'PGRST303' || message.includes('jwt expired');
}

export function toUserFacingNetworkError(error: unknown, fallback: string): Error {
  if (isJwtExpiredError(error)) {
    return new Error('Your session expired. Please sign in again.');
  }
  if (isNetworkFetchError(error)) {
    return new Error('Could not reach Moments servers. Check your internet connection and try again.');
  }
  const message = getErrorMessage(error);
  if (message) return new Error(message);
  if (error instanceof Error) return error;
  return new Error(fallback);
}

export function getErrorMessage(error: unknown): string | null {
  if (!error || typeof error !== 'object') return null;
  if ('message' in error && typeof error.message === 'string' && error.message.trim()) {
    return error.message;
  }
  if ('error_description' in error && typeof error.error_description === 'string') {
    return error.error_description;
  }
  return null;
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
