import * as Haptics from '@/lib/haptics';
import { addDays, format, subYears } from 'date-fns';
import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { StreakRestoreBanner } from '@/components/home/StreakRestoreBanner';
import { BirthdayPage } from '@/components/home/BirthdayCelebration';
import { MyBirthdayCard, PartnerBirthdayCard } from '@/components/home/HomeCards';
import { introBand, WelcomeCard } from '@/components/home/WelcomeCard';
import { AppHeader } from '@/components/layout/AppHeader';
import { Icon } from '@/components/ui/Icon';
import { ThemedStatusBar } from '@/components/ui/ThemedStatusBar';
import { useTheme } from '@/hooks/useTheme';
import { applyStreakScenario } from '@/lib/dev-streak-scenario';
import { StreakAtRiskBanner } from '@/components/home/StreakAtRiskBanner';
import { Spacing } from '@/constants/design-system';
import { partnerClockAt } from '@/lib/partner-header-line';
import { emptyStreakStatus } from '@/lib/streak';
import { type BirthdayCelebration, useAuthStore, useRelationshipStore } from '@/stores';

export type DesignPreviewKind = 'header' | 'streak' | 'birthday';

const VARIANTS: Record<DesignPreviewKind, { key: string; label: string }[]> = {
  birthday: [
    { key: 'mine', label: 'Yours' },
    { key: 'today', label: 'Theirs' },
    { key: 'tomorrow', label: 'Tomorrow' },
    { key: 'soon', label: 'In 5 days' },
  ],
  header: [
    { key: 'day', label: 'Their daytime' },
    { key: 'night', label: 'Their night' },
  ],
  streak: [
    { key: 'at_risk', label: 'At risk' },
    { key: 'frozen', label: 'Frozen' },
    { key: 'restore', label: 'Lost' },
  ],
};

/**
 * Settings › Developer: one feature on its own, drawn by the real components with sample
 * data (your real streak and header are never touched). A switch at the bottom flips
 * between its looks; the close button goes back to Settings.
 */
export function DesignPreviewModal({ kind, onClose }: { kind: DesignPreviewKind | null; onClose: () => void }) {
  if (!kind) return null;
  return <DesignPreview key={kind} kind={kind} onClose={onClose} />;
}

function DesignPreview({ kind, onClose }: { kind: DesignPreviewKind; onClose: () => void }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const partner = useRelationshipStore((s) => s.partner);
  const relationship = useRelationshipStore((s) => s.relationship);
  const [variant, setVariant] = useState(VARIANTS[kind][0].key);
  const band = introBand(colors);

  // At risk is drawn as at 9pm today (3 hours left), when Home shows it at its strongest.
  const now = useMemo(() => {
    const d = new Date();
    if (variant === 'at_risk' || variant === 'frozen') d.setHours(21, 0, 0, 0);
    return d;
  }, [variant]);
  const status = useMemo(() => {
    const base = emptyStreakStatus(relationship?.id ?? 'preview');
    if (kind !== 'streak') return { ...base, current_streak: 12, longest_streak: 12, user_active_today: true };
    return applyStreakScenario(base, variant === 'restore' ? 'restore' : variant === 'frozen' ? 'frozen' : 'at_risk', now);
  }, [kind, variant, relationship?.id, now]);

  // Birthdays: made-up dates (27 years ago), so the Home cards show for each case.
  const [birthdayPage, setBirthdayPage] = useState<BirthdayCelebration | null>(null);
  const bornOn = (inDays: number) => format(subYears(addDays(new Date(), inDays), 27), 'yyyy-MM-dd');
  const previewMe = user ? { ...user, birthday: bornOn(0) } : null;
  const previewPartner = partner
    ? { ...partner, birthday: bornOn(variant === 'today' ? 0 : variant === 'tomorrow' ? 1 : 5) }
    : null;

  // A long distance, so you can also see that it fits.
  const header = {
    location: '4,812 km Away',
    clock: variant === 'night' ? partnerClockAt(23, 40) : partnerClockAt(14, 15),
  };

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <ThemedStatusBar />
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        {/* The top of Home, as it looks with this feature. */}
        <AppHeader band={band} preview={kind === 'header' ? header : undefined} />
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <WelcomeCard
            user={user ?? null}
            partner={partner}
            spaceName={relationship?.relationship_name}
            status={status}
            joinedAt={relationship?.created_at}
            band
            now={now}
          />
          {/* Where Home puts them: just under the card. */}
          {kind === 'birthday' ? (
            <View style={styles.cards}>
              {variant === 'mine' && previewMe ? (
                <MyBirthdayCard user={previewMe} onOpen={setBirthdayPage} />
              ) : previewPartner ? (
                <PartnerBirthdayCard partner={previewPartner} onOpen={setBirthdayPage} />
              ) : (
                <Text style={{ color: colors.textSecondary }}>Pair with your partner to see their birthday card.</Text>
              )}
            </View>
          ) : null}
          {kind === 'streak' ? (
            <View style={styles.cards}>
              <StreakAtRiskBanner status={status} now={now} preview />
              <StreakRestoreBanner status={status} now={now} preview />
            </View>
          ) : null}
        </ScrollView>

        <View style={[styles.bar, { paddingBottom: insets.bottom + 12, borderTopColor: colors.border }]}>
          <View style={[styles.seg, { backgroundColor: colors.surfaceElevated }]}>
            {VARIANTS[kind].map((v) => {
              const on = v.key === variant;
              return (
                <Pressable
                  key={v.key}
                  onPress={() => {
                    void Haptics.selectionAsync();
                    setVariant(v.key);
                  }}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: on }}
                  style={[styles.segBtn, on && { backgroundColor: colors.text }]}>
                  <Text style={[styles.segText, { color: on ? colors.background : colors.textSecondary }]}>{v.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close preview"
            style={({ pressed }) => [styles.close, { backgroundColor: colors.text }, pressed && styles.pressed]}>
            <Icon name="close" size={20} color={colors.background} />
          </Pressable>
        </View>
      </View>
      {birthdayPage ? <BirthdayPage celebration={{ ...birthdayPage, preview: true }} onClose={() => setBirthdayPage(null)} /> : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingBottom: 24, gap: 16 },
  cards: { paddingHorizontal: Spacing.lg, gap: 12 },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  seg: { flex: 1, height: 44, borderRadius: 22, flexDirection: 'row', padding: 4 },
  segBtn: { flex: 1, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  segText: { fontSize: 14, fontWeight: '800' },
  close: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.8 },
});
