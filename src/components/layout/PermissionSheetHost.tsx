import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { DraggableSheet, useKeptWhileClosing } from '@/components/ui/DraggableSheet';
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
  const live = pending && pending.host === host ? pending : null;
  // Answered: the prompt is gone at once, but the sheet keeps its words while it slides away.
  const shown = useKeptWhileClosing(live);
  const { colors } = useTheme();
  const partner = useRelationshipStore((s) => s.partner);
  const who = getFirstName(partner?.name) ?? 'your person';

  // Dragged away or tapped outside: "not now", but only for this prompt (the next
  // one, e.g. the microphone right after the camera, may already be waiting).
  const dismiss = () => {
    if (live && usePermissionPrompt.getState().pending === live) answerPermissionPrompt(false);
  };

  if (!shown) return null;
  const copy = COPY[shown.kind];
  return (
    <DraggableSheet visible={!!live} onClose={dismiss} inline={inline} dragAnywhere>
      <View style={styles.content}>
        <View style={styles.art}>{copy.art}</View>
        <Text style={[styles.title, { color: colors.text }]}>{copy.title}</Text>
        <Text style={[styles.body, { color: colors.textSecondary }]}>
          {shown.blocked ? `You turned this off before. ${copy.body(who)} Switch it on in Settings.` : copy.body(who)}
        </Text>
        <Pressable
          onPress={() => answerPermissionPrompt(true)}
          accessibilityRole="button"
          style={({ pressed }) => [styles.allow, { backgroundColor: colors.accent, opacity: pressed ? 0.85 : 1 }]}>
          <Text style={[styles.allowText, { color: colors.onAccent }]}>{shown.blocked ? 'Open Settings' : copy.allow}</Text>
        </Pressable>
        <Pressable onPress={() => answerPermissionPrompt(false)} hitSlop={8} accessibilityRole="button" style={styles.later}>
          <Text style={[styles.laterText, { color: colors.textSecondary }]}>Not now</Text>
        </Pressable>
      </View>
    </DraggableSheet>
  );
}

const styles = StyleSheet.create({
  content: { alignItems: 'center', gap: 12 },
  art: { marginVertical: 4 },
  title: { fontSize: 24, fontWeight: '900', letterSpacing: -0.5, textAlign: 'center' },
  body: { fontSize: 15, lineHeight: 21, textAlign: 'center' },
  allow: { alignSelf: 'stretch', height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  allowText: { fontSize: 17, fontWeight: '800' },
  later: { height: 40, justifyContent: 'center' },
  laterText: { fontSize: 15, fontWeight: '700' },
});
