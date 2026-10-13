import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';

const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN ?? '';

/**
 * Crash and error reporting (Sentry). On in real builds only: development
 * errors stay in the console. No personal data is sent beyond an opaque
 * user id (see identifyUser).
 */
export function initMonitoring() {
  if (!DSN) return;
  Sentry.init({
    dsn: DSN,
    enabled: !__DEV__,
    environment: __DEV__ ? 'development' : 'production',
    release: `moments@${Constants.expoConfig?.version ?? '0.0.0'}`,
    sendDefaultPii: false,
    // A sample of screens and requests, to spot slow ones without the cost.
    tracesSampleRate: 0.2,
  });
}

/** Tie reports to the account (its id only), or clear it on sign-out. */
export function identifyUser(userId: string | null) {
  Sentry.setUser(userId ? { id: userId } : null);
}

/** Report a handled error (one we caught and showed a message for). */
export function reportError(error: unknown, context?: Record<string, unknown>) {
  if (__DEV__) {
    console.warn('[reportError]', error, context);
    return;
  }
  Sentry.captureException(error, context ? { extra: context } : undefined);
}

export { Sentry };
