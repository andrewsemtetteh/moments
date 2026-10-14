import { Alert } from 'react-native';

import { BILLING_CONNECTED } from '@/constants/subscription';
import { useSubscription } from '@/hooks/useSubscription';
import { getFirstName } from '@/lib/avatar-initial';
import { openSubscriptionManagement, restorePlus, usePurchasesStore } from '@/lib/purchases';
import { useRelationshipStore, useUIStore } from '@/stores';

/**
 * What "Your plan" and "Restore purchases" do, shared by Settings and the profile Plus card:
 * - Free: the paywall.
 * - Plus, paid on this account: the App Store / Play subscription page (change plan, cancel, refund).
 * - Plus through the partner: a note that they manage it (one plan covers both of you).
 */
export function usePlanActions() {
  const { isPlus, isOwner } = useSubscription();
  const paidHere = usePurchasesStore((s) => s.entitlement.active);
  const partner = useRelationshipStore((s) => s.partner);
  const openPaywall = useUIStore((s) => s.openPaywall);

  const openPlan = () => {
    if (!isPlus) {
      openPaywall();
      return;
    }
    if (isOwner || paidHere) {
      void openSubscriptionManagement();
      return;
    }
    const name = getFirstName(partner?.name) ?? 'Your partner';
    Alert.alert('Plus is on us', `${name} pays for Plus, and it covers you both. They can manage it from their phone.`);
  };

  const restore = async () => {
    if (!BILLING_CONNECTED) {
      Alert.alert('Restore purchases', 'Purchases will be available soon.');
      return;
    }
    try {
      if (await restorePlus()) Alert.alert('Welcome back', 'Moments Plus is active again for both of you.');
      else Alert.alert('Nothing to restore', 'We couldn’t find a Moments Plus purchase on this account.');
    } catch {
      Alert.alert('Couldn’t restore', 'Check your connection and try again.');
    }
  };

  return { openPlan, restore, isPlus };
}
