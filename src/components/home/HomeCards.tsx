import { differenceInCalendarYears, format, isToday, isTomorrow } from 'date-fns';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from '@/lib/haptics';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, Share, StyleSheet, Text, View } from 'react-native';

import { memoryPhotos } from '@/components/calendar/plan/MemorySheets';
import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/hooks/useTheme';
import { getFirstName } from '@/lib/avatar-initial';
import { displayTitle } from '@/lib/plan-day';
import { parsePlanMeta, planIcon } from '@/lib/plan-meta';
import { openCalendar } from '@/lib/router';
import * as api from '@/services/api';
import { useRelationshipStore, useUIStore } from '@/stores';
import type { CalendarEvent, Moment } from '@/types/database';
import { useCardBorder } from '@/hooks/useCardBorder';
import { formatInviteCode } from '@/lib/invite-code';

/** Partner hasn't shared a moment today: nudge to send yours. */
export function NoMomentCard({ partnerName }: { partnerName?: string | null }) {
  const { colors } = useTheme();
  const cardBorder = useCardBorder();
  const setShowMomentCreator = useUIStore((s) => s.setShowMomentCreator);
  const name = getFirstName(partnerName) ?? 'your partner';
  return (
    <View style={[styles.card, styles.momentCard, { backgroundColor: colors.surface }, cardBorder]}>
      <View style={[styles.emptyArea, { borderColor: colors.border }]}>
        <View style={[styles.emptyIcon, { backgroundColor: colors.accentSoft }]}>
          <Icon name="camera" size={30} color={colors.accent} />
        </View>
        <Text style={[styles.emptyTitle, { color: colors.text }]}>Nothing from {name} yet today</Text>
        <Text style={[styles.emptyBody, { color: colors.textSecondary }]}>
          Send yours first. It’ll be the first thing they see when they open Moments.
        </Text>
      </View>
      <Pressable
        onPress={() => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setShowMomentCreator(true);
        }}
        accessibilityRole="button"
        style={({ pressed }) => [styles.primaryBtn, { backgroundColor: colors.accent }, pressed && styles.pressed]}>
        <Icon name="camera" size={20} color={colors.onAccent} />
        <Text style={[styles.primaryBtnText, { color: colors.onAccent }]}>Send a moment</Text>
      </Pressable>
    </View>
  );
}

/**
 * Partner hasn't joined yet: the invite, front and centre. Used on Home and the
 * You page; each screen puts its own "Invite your person" section title above it.
 */
export function InviteCard({ from }: { from?: 'profile' } = {}) {
  const { colors } = useTheme();
  const cardBorder = useCardBorder();
  const relationship = useRelationshipStore((s) => s.relationship);
  const setRelationship = useRelationshipStore((s) => s.setRelationship);
  const code = relationship?.invite_code ?? null;

  useEffect(() => {
    if (!relationship || code) return;
    let cancelled = false;
    api
      .ensureInviteCode(relationship.id)
      .then((rel) => {
        if (!cancelled) setRelationship(rel);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [relationship, code, setRelationship]);

  const [copied, setCopied] = useState(false);
  const copy = async () => {
    if (!code) return;
    await Clipboard.setStringAsync(code);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopied(true);
  };
  // "Copied" for a moment, then the code's copy icon comes back.
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(t);
  }, [copied]);
  const share = async () => {
    if (!code) return;
    await Share.share({
      message: `Join me on Moments! Use invite code: ${formatInviteCode(code)}\n\nMoments is our private relationship space.`,
    });
  };

  return (
    <View style={[styles.card, styles.inviteCard, { backgroundColor: colors.surface }, cardBorder]}>
      <Text style={[styles.emptyBody, { color: colors.textSecondary }]}>
        Moments is made for two. Share your code and you’ll be connected the second they join.
      </Text>
      <Pressable
        onPress={() => void copy()}
        accessibilityRole="button"
        accessibilityLabel={copied ? 'Invite code copied' : 'Copy invite code'}
        style={({ pressed }) => [
          styles.codeBox,
          copied
            ? { borderColor: colors.success, backgroundColor: colors.accentSoft, borderStyle: 'solid' }
            : { borderColor: colors.accent, backgroundColor: colors.accentSoft },
          pressed && styles.pressed,
        ]}>
        <Text style={[styles.code, { color: colors.text }]}>{code ? formatInviteCode(code) : '····-····'}</Text>
        {copied ? (
          <View style={styles.copiedTag}>
            <Icon name="check" size={16} color={colors.success} />
            <Text style={[styles.copiedText, { color: colors.success }]}>Copied</Text>
          </View>
        ) : (
          <Icon name="document" size={18} color={colors.accent} />
        )}
      </Pressable>
      <Pressable
        onPress={() => void share()}
        accessibilityRole="button"
        style={({ pressed }) => [styles.primaryBtn, styles.fullWidth, { backgroundColor: colors.accent }, pressed && styles.pressed]}>
        <Text style={[styles.primaryBtnText, { color: colors.onAccent }]}>Share invite</Text>
      </Pressable>
      <View style={styles.orRow}>
        <View style={[styles.orLine, { backgroundColor: colors.border }]} />
        <Text style={[styles.orText, { color: colors.textTertiary }]}>or</Text>
        <View style={[styles.orLine, { backgroundColor: colors.border }]} />
      </View>
      <Pressable
        onPress={() => router.push(from ? `/(onboarding)/join-relationship?from=${from}` : '/(onboarding)/join-relationship')}
        accessibilityRole="button"
        style={styles.textBtn}>
        <Text style={[styles.textBtnText, { color: colors.textSecondary }]}>I have their code</Text>
      </Pressable>
    </View>
  );
}

function whenLabel(at: Date) {
  if (isToday(at)) return `Today · ${format(at, 'h:mm a')}`;
  if (isTomorrow(at)) return `Tomorrow · ${format(at, 'h:mm a')}`;
  return format(at, "EEE, MMM d '·' h:mm a");
}

/** The next plan from Together. */
export function NextUpCard({ event, viewerId }: { event: CalendarEvent; viewerId?: string }) {
  const { colors } = useTheme();
  const cardBorder = useCardBorder();
  const at = new Date(event.date_time);
  return (
    <Pressable
      onPress={() => openCalendar({ dateISO: event.date_time })}
      accessibilityRole="button"
      style={({ pressed }) => [styles.card, styles.row, { backgroundColor: colors.surface }, cardBorder, pressed && styles.pressed]}>
      <View style={[styles.rowIcon, { backgroundColor: colors.accentSoft }]}>
        <Icon name={planIcon(event)} size={22} color={colors.accent} />
      </View>
      <View style={styles.rowText}>
        <Text style={[styles.kicker, { color: colors.textSecondary }]}>Next up</Text>
        <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={1}>
          {displayTitle(event, viewerId)}
        </Text>
        <Text style={[styles.rowSub, { color: colors.textSecondary }]} numberOfLines={1}>
          {whenLabel(at)}
        </Text>
      </View>
      <Icon name="chevronRight" size={18} color={colors.textTertiary} />
    </Pressable>
  );
}

/** A memory from this date in an earlier year, if there is one. */
export function useOnThisDay(memories: CalendarEvent[]) {
  return useMemo(() => {
    const now = new Date();
    const matches = memories.filter((m) => {
      const d = new Date(m.date_time);
      return d.getMonth() === now.getMonth() && d.getDate() === now.getDate() && d.getFullYear() < now.getFullYear();
    });
    return matches.sort((a, b) => new Date(b.date_time).getTime() - new Date(a.date_time).getTime())[0] ?? null;
  }, [memories]);
}

export function OnThisDayCard({ entry, momentsById }: { entry: CalendarEvent; momentsById: Map<string, Moment> }) {
  const { colors } = useTheme();
  const cardBorder = useCardBorder();
  const years = Math.max(1, differenceInCalendarYears(new Date(), new Date(entry.date_time)));
  const photos = memoryPhotos(entry, momentsById);
  const meta = parsePlanMeta(entry.description);
  const sub = [meta.placeName, photos.length ? `${photos.length} photo${photos.length === 1 ? '' : 's'}` : null]
    .filter(Boolean)
    .join(' · ');
  return (
    <Pressable
      onPress={() => router.navigate({ pathname: '/calendar', params: { tab: 'memories' } })}
      accessibilityRole="button"
      style={({ pressed }) => [styles.card, styles.row, { backgroundColor: colors.surface }, cardBorder, pressed && styles.pressed]}>
      {photos[0] ? (
        <Image source={{ uri: photos[0] }} style={styles.memoryThumb} contentFit="cover" />
      ) : (
        <View style={[styles.memoryThumb, styles.memoryThumbEmpty, { backgroundColor: colors.accentSoft }]}>
          <Icon name="heart" size={28} color={colors.accent} />
        </View>
      )}
      <View style={styles.rowText}>
        <Text style={[styles.kicker, { color: colors.textSecondary }]}>
          {years} year{years === 1 ? '' : 's'} ago today
        </Text>
        <Text style={[styles.memoryTitle, { color: colors.text }]} numberOfLines={1}>
          {entry.title}
        </Text>
        {sub ? (
          <Text style={[styles.rowSub, { color: colors.textSecondary }]} numberOfLines={1}>
            {sub}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 22 },
  pressed: { opacity: 0.8 },
  momentCard: { borderRadius: 28, padding: 12, gap: 12 },
  emptyArea: {
    minHeight: 240,
    borderRadius: 22,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 24,
  },
  emptyIcon: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 19, fontWeight: '800', letterSpacing: -0.3, textAlign: 'center' },
  emptyBody: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
  primaryBtn: {
    height: 52,
    borderRadius: 26,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullWidth: { alignSelf: 'stretch' },
  primaryBtnText: { fontSize: 16, fontWeight: '800' },
  inviteCard: { borderRadius: 28, padding: 18, gap: 12, alignItems: 'center' },
  codeBox: {
    alignSelf: 'stretch',
    height: 54,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  code: { fontSize: 20, fontWeight: '800', letterSpacing: 3 },
  copiedTag: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  copiedText: { fontSize: 14, fontWeight: '800' },
  textBtn: { height: 40, justifyContent: 'center' },
  textBtnText: { fontSize: 15, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14 },
  rowIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  // Small bold sentence-case label (no all-caps anywhere on Home).
  kicker: { fontSize: 14, fontWeight: '800' },
  rowTitle: { fontSize: 15, fontWeight: '800' },
  rowSub: { fontSize: 13, fontWeight: '600' },
  memoryThumb: { width: 84, height: 84, borderRadius: 18 },
  memoryThumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  memoryTitle: { fontSize: 16, fontWeight: '800' },
  orRow: { flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'stretch' },
  orLine: { flex: 1, height: StyleSheet.hairlineWidth },
  orText: { fontSize: 13, fontWeight: '600' },
});
