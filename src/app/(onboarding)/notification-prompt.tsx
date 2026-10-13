import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { BellCharacter } from '@/components/onboarding/Characters';
import { OnboardingStepScreen } from '@/components/onboarding/OnboardingStepScreen';
import { Icon, type IconName } from '@/components/ui/Icon';
import { useTheme } from '@/hooks/useTheme';
import { goNext } from '@/lib/onboarding-v2';
import { markNotificationPromptDone } from '@/lib/onboarding-storage';
import { requestPushNotificationPermission } from '@/lib/push-notifications';
import { useAuthStore } from '@/stores';

const ITEMS: { icon: IconName; title: string; body: string; tint: string }[] = [
  { icon: 'cards', title: 'Conversations and games', body: 'When they start a conversation deck or a game for you two', tint: '#DCEBFF' },
  { icon: 'calendar', title: 'Anniversaries and milestones', body: 'A week’s notice, and on the day', tint: '#FFD6DC' },
  { icon: 'question', title: 'Today’s question', body: 'When they’ve answered and it’s your turn', tint: '#D7F2E3' },
  { icon: 'fire', title: 'Streak saver', body: 'One nudge before your streak ends tonight', tint: '#FFE7A0' },
  { icon: 'messages', title: 'Messages', body: 'Replies and voice notes, even when the app is closed', tint: '#E3DDFF' },
  { icon: 'camera', title: 'New moments', body: 'The second they share a photo or video', tint: '#FFD9CC' },
];

/** Step 9: what notifications are for, then iPhone asks (only on "Turn on"). */
export default function NotificationPromptScreen() {
  const router = useRouter();
  const preview = useLocalSearchParams<{ preview?: string }>().preview === '1';
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const [busy, setBusy] = useState(false);

  const next = async (turnOn: boolean) => {
    setBusy(true);
    try {
      if (turnOn && !preview) await requestPushNotificationPermission().catch(() => undefined);
      if (user && !preview) await markNotificationPromptDone(user.id);
      await goNext(router, 'notification-prompt', { userId: user?.id, preview });
    } finally {
      setBusy(false);
    }
  };

  return (
    <OnboardingStepScreen
      step="notification-prompt"
      art={<BellCharacter size={96} />}
      title="Never miss your person"
      subtitle="Turn these on and you’ll know the moment something happens between you two:"
      primaryLabel="Turn on notifications"
      onPrimary={() => void next(true)}
      busy={busy}
      secondaryLabel="Not now"
      onSecondary={() => void next(false)}>
      <View style={[styles.list, { borderColor: colors.text, backgroundColor: colors.surface }]}>
        {ITEMS.map((n, i) => (
          <View
            key={n.title}
            style={[styles.row, i < ITEMS.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}>
            <View style={[styles.tile, { backgroundColor: n.tint }]}>
              <Icon name={n.icon} size={18} color="#1A1A1A" />
            </View>
            <View style={styles.flex}>
              <Text style={[styles.title, { color: colors.text }]}>{n.title}</Text>
              <Text style={[styles.body, { color: colors.textSecondary }]}>{n.body}</Text>
            </View>
          </View>
        ))}
      </View>
      <View style={styles.reassure}>
        <Icon name="lock" size={14} color={colors.textSecondary} />
        <Text style={[styles.reassureText, { color: colors.textSecondary }]}>No ads or spam, ever.</Text>
      </View>
    </OnboardingStepScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { borderWidth: 2, borderRadius: 22, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingHorizontal: 14 },
  tile: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 15, fontWeight: '800' },
  body: { fontSize: 12, lineHeight: 17, marginTop: 1 },
  reassure: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  reassureText: { fontSize: 13, fontWeight: '700' },
});
