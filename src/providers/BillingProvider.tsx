import type { ReactNode } from 'react';

import { superwall, SUPERWALL_API_KEYS } from '@/lib/purchases';

/** Module constant: SuperwallProvider reconfigures when its options object changes identity. */
const OPTIONS = {
  // Android: send our billing UUID to Play as the account id, so webhooks carry it unhashed.
  passIdentifiersToPlayStore: true,
  logging: { level: __DEV__ ? 'warn' : 'error' },
} as const;

function onConfigurationError(error: Error) {
  console.warn('[purchases] Superwall failed to configure', error);
}

/**
 * Configures Superwall for the whole app. A pass-through where billing is off (no keys, Expo Go, web),
 * so the rest of the app never has to check.
 */
export function BillingProvider({ children }: { children: ReactNode }) {
  if (!superwall) return <>{children}</>;
  const { SuperwallProvider } = superwall;
  return (
    <SuperwallProvider apiKeys={SUPERWALL_API_KEYS} options={OPTIONS} onConfigurationError={onConfigurationError}>
      {children}
    </SuperwallProvider>
  );
}
