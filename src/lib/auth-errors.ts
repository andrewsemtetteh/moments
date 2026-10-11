export function normalizeAuthEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Extracts a user-facing message from a Clerk error (or any thrown error). */
export function formatAuthError(error: unknown): string {
  if (error && typeof error === 'object') {
    // Classic resource methods (user.update, user.updatePassword, ...) throw
    // ClerkAPIResponseError, whose most specific message lives in errors[0].
    const withErrors = error as { errors?: { longMessage?: string; message?: string }[] };
    const first = withErrors.errors?.[0];
    if (first) {
      if (typeof first.longMessage === 'string' && first.longMessage) return first.longMessage;
      if (typeof first.message === 'string' && first.message) return first.message;
    }

    const clerkLike = error as { longMessage?: string; message?: string };
    if (typeof clerkLike.longMessage === 'string' && clerkLike.longMessage) return clerkLike.longMessage;
    if (typeof clerkLike.message === 'string' && clerkLike.message) return clerkLike.message;
  }
  return 'Please try again.';
}
