import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  CameraCharacter,
  MicCharacter,
  PhotosCharacter,
  PinCharacter,
} from '@/components/onboarding/Characters';
import { useTheme } from '@/hooks/useTheme';
import { getFirstName } from '@/lib/avatar-initial';
import { answerPermissionPrompt, usePermissionPrompt, type PermissionKind } from '@/lib/permissions';
import { useRelationshipStore } from '@/stores';

const COPY: Record<PermissionKind, { art: ReactNode; title: string; body: (who: string) => string; allow: string }> = {
  camera: {
    art: <CameraCharacter size={130} />,
    title: 'Show your person your day',
    body: (who) => `Moments needs your camera to take the photos and videos you send. Only ${who} ever sees them.`,
    allow: 'Allow camera',
  },
  microphone: {
    art: <MicCharacter size={110} />,
    title: 'Say it out loud',
    body: (who) => `Moments needs your microphone for voice notes and video sound. Only ${who} hears them.`,
    allow: 'Allow microphone',
  },
  location: {
    art: <PinCharacter size={100} />,
    title: 'Feel a little closer',
    body: (who) => `Share where you are so ${who} can see how far apart you are, and the time where you are. Turn it off any time.`,
    allow: 'Allow location',
  },
  photos: {
    art: <PhotosCharacter size={120} />,
    title: 'Pick from your photos',
    body: () => 'Moments only sees the photos you choose to send or use. Nothing else leaves your phone.',
    allow: 'Allow photos',
  },
};

/**
 * Shows the "why we need this" sheet for ensurePermission(). Mounted once at
 * the root (`host="root"`) and once inside each camera screen (`host="camera"`,
 * `inline`), since a root modal can't appear over a full-screen modal.
 */
export function PermissionSheetHost({ host = 'root', inline = false }: { host?: string; inline?: boolean }) {
  const pending = usePermissionPrompt((s) => s.pending);
  const visible = !!pending && pending.host === host;
  if (!visible || !pending) return null;
  const sheet = <Sheet kind={pending.kind} blocked={pending.blocked} />;
  if (inline) return <View style={StyleSheet.absoluteFill}>{sheet}</View>;
  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={() => answerPermissionPrompt(false)}>
      {sheet}
    </Modal>
  );
}

function Sheet({ kind, blocked }: { kind: PermissionKind; blocked: boolean }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const partner = useRelationshipStore((s) => s.partner);
  const who = getFirstName(partner?.name) ?? 'your person';
  const copy = COPY[kind];

  return (
    <View style={styles.fill}>
      <Animated.View entering={FadeIn.duration(180)} style={[StyleSheet.absoluteFill, styles.backdrop]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => answerPermissionPrompt(false)} accessibilityLabel="Not now" />
      </Animated.View>
      <Animated.View
        entering={SlideInDown.springify().damping(22)}
        style={[styles.sheet, { backgroundColor: colors.background, paddingBottom: insets.bottom + 18 }]}>
        <View style={[styles.handle, { backgroundColor: colors.border }]} />
        <View style={styles.art}>{copy.art}</View>
        <Text style={[styles.title, { color: colors.text }]}>{copy.title}</Text>
        <Text style={[styles.body, { color: colors.textSecondary }]}>
          {blocked ? `You turned this off before. ${copy.body(who)} Switch it on in Settings.` : copy.body(who)}
        </Text>
        <Pressable
          onPress={() => answerPermissionPrompt(true)}
          accessibilityRole="button"
          style={({ pressed }) => [styles.allow, { backgroundColor: colors.accent, opacity: pressed ? 0.85 : 1 }]}>
          <Text style={[styles.allowText, { color: colors.onAccent }]}>{blocked ? 'Open Settings' : copy.allow}</Text>
        </Pressable>
        <Pressable onPress={() => answerPermissionPrompt(false)} hitSlop={8} accessibilityRole="button" style={styles.later}>
          <Text style={[styles.laterText, { color: colors.textSecondary }]}>Not now</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 24, paddingTop: 10, alignItems: 'center', gap: 12 },
  handle: { width: 40, height: 4, borderRadius: 2, marginBottom: 4 },
  art: { marginVertical: 4 },
  title: { fontSize: 24, fontWeight: '900', letterSpacing: -0.5, textAlign: 'center' },
  body: { fontSize: 15, lineHeight: 21, textAlign: 'center' },
  allow: { alignSelf: 'stretch', height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  allowText: { fontSize: 17, fontWeight: '800' },
  later: { height: 40, justifyContent: 'center' },
  laterText: { fontSize: 15, fontWeight: '700' },
});
