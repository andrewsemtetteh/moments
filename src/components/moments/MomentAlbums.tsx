import * as Haptics from '@/lib/haptics';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  SlideInRight,
  SlideOutRight,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MomentSquircle } from '@/components/moments/MomentSquircle';
import { DraggableSheet } from '@/components/ui/DraggableSheet';
import { HeaderIconButton } from '@/components/ui/HeaderIconButton';
import { Icon, type IconName } from '@/components/ui/Icon';
import { useTheme } from '@/hooks/useTheme';
import { ALBUM_ICONS, markIcon } from '@/lib/mark-icons';
import { albumCoverId, type MomentAlbum } from '@/lib/moment-albums';
import { momentChrome } from '@/lib/moment-theme';
import type { Moment } from '@/types/database';

const CARD_SIZE = 116;

/** Horizontal shelf of album cards at the top of Moment history. */
export function AlbumsShelf({
  albums,
  momentsById,
  onOpen,
  onCreate,
}: {
  albums: MomentAlbum[];
  momentsById: Map<string, Moment>;
  onOpen: (album: MomentAlbum) => void;
  onCreate: () => void;
}) {
  const { colors } = useTheme();
  const chrome = momentChrome(colors);

  return (
    <View style={styles.shelf}>
      <View style={styles.shelfHeader}>
        <Text style={[styles.shelfTitle, { color: chrome.text }]}>Albums</Text>
        {albums.length > 0 ? (
          <Text style={[styles.shelfCount, { color: chrome.textTertiary }]}>{albums.length}</Text>
        ) : null}
      </View>

      {albums.length === 0 ? (
        // First-run invite instead of an empty row.
        <Pressable
          onPress={onCreate}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.invite,
            { backgroundColor: chrome.surfaceSoft, borderColor: chrome.border },
            pressed && styles.pressed,
          ]}>
          <View style={[styles.inviteIcon, { backgroundColor: chrome.accentSoft }]}>
            <Icon name="albums" size={22} color={chrome.accent} />
          </View>
          <View style={styles.inviteText}>
            <Text style={[styles.inviteTitle, { color: chrome.text }]}>Make your first album</Text>
            <Text style={[styles.inviteSub, { color: chrome.textSecondary }]}>
              Trips, date nights, your firsts. Keep them together.
            </Text>
          </View>
          <Icon name="chevronRight" size={18} color={chrome.textTertiary} />
        </Pressable>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shelfRow}>
          {albums.map((album) => {
            const coverId = albumCoverId(album);
            const cover = coverId ? momentsById.get(coverId) : undefined;
            return (
              <Pressable
                key={album.id}
                onPress={() => onOpen(album)}
                accessibilityRole="button"
                accessibilityLabel={`${album.name}, ${album.momentIds.length} moments`}
                style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
                <View style={styles.cardStack}>
                  {/* Two tilted cards behind the cover read as "a stack of photos". */}
                  <View
                    style={[
                      styles.stackBack,
                      {
                        backgroundColor: chrome.surfaceSoft,
                        borderColor: chrome.border,
                        transform: [{ rotate: '-7deg' }],
                      },
                    ]}
                  />
                  <View
                    style={[
                      styles.stackBack,
                      {
                        backgroundColor: chrome.accentSoft,
                        borderColor: chrome.border,
                        transform: [{ rotate: '5deg' }],
                      },
                    ]}
                  />
                  {cover ? (
                    <View pointerEvents="none">
                      <MomentSquircle moment={cover} size={CARD_SIZE} showAuthor={false} />
                    </View>
                  ) : (
                    <View style={[styles.emptyCover, { backgroundColor: chrome.surfaceSoft }]}>
                      <Icon name={markIcon(album.emoji, 'albums')} size={40} color={chrome.accent} filled />
                    </View>
                  )}
                  <View style={[styles.emojiBadge, { backgroundColor: chrome.background }]}>
                    <Icon name={markIcon(album.emoji, 'albums')} size={18} color={chrome.accent} filled />
                  </View>
                </View>
                <Text style={[styles.cardName, { color: chrome.text }]} numberOfLines={1}>
                  {album.name}
                </Text>
                <Text style={[styles.cardCount, { color: chrome.textTertiary }]}>
                  {album.momentIds.length} moment{album.momentIds.length === 1 ? '' : 's'}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

/** Bottom sheet shell drawn inside the moments Modal (a second native Modal would flash). */
/**
 * Album drawers (options, add to album…) are the same drawer as Settings uses:
 * it springs up, drags down to close (from anywhere on it), and the backdrop
 * fades; drawn inline because Moments is already a full-screen Modal.
 */
function Sheet({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <DraggableSheet
      visible
      inline
      dragAnywhere
      avoidKeyboard
      onClose={onClose}
      style={{ paddingBottom: insets.bottom + 16 }}>
      <View style={styles.sheetBody}>{children}</View>
    </DraggableSheet>
  );
}

const PAGE_W = 420;

/**
 * A full page inside the moments Modal (a second native Modal would flash):
 * slides in from the right, back arrow in the header, swipe right to go back.
 */
function Page({
  title,
  onBack,
  footer,
  children,
}: {
  title: string;
  onBack: () => void;
  /** Pinned to the bottom of the page, under the scrolling content. */
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const chrome = momentChrome(colors);
  const translateX = useSharedValue(0);
  const swipeBack = Gesture.Pan()
    .activeOffsetX(14)
    .failOffsetX(-10)
    .failOffsetY([-16, 16])
    .onUpdate((e) => {
      translateX.value = Math.max(0, e.translationX);
    })
    .onEnd((e) => {
      if (e.translationX > 90 || e.velocityX > 650) {
        translateX.value = withSpring(PAGE_W, { damping: 30, stiffness: 260, velocity: e.velocityX }, (done) => {
          if (done) runOnJS(onBack)();
        });
        return;
      }
      translateX.value = withSpring(0, { damping: 30, stiffness: 260 });
    });
  const swipeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: translateX.value }] }));

  return (
    <GestureDetector gesture={swipeBack}>
      <Animated.View
        entering={SlideInRight.duration(240)}
        exiting={SlideOutRight.duration(200)}
        style={[StyleSheet.absoluteFill, { backgroundColor: chrome.background, paddingTop: insets.top }, swipeStyle]}>
        <View style={styles.pageHeader}>
          <View style={styles.pageSide}>
            <HeaderIconButton icon="chevronLeft" onPress={onBack} accessibilityLabel="Back" />
          </View>
          <Text style={[styles.pageTitle, { color: chrome.text }]} numberOfLines={1}>
            {title}
          </Text>
          <View style={styles.pageSide} />
        </View>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
          <ScrollView
            contentContainerStyle={styles.pageBody}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            {children}
          </ScrollView>
          {footer ? <View style={[styles.pageFooter, { paddingBottom: insets.bottom + 14 }]}>{footer}</View> : null}
        </KeyboardAvoidingView>
      </Animated.View>
    </GestureDetector>
  );
}

/** Name + icon for a new album or a place on Our map, or for renaming one: a page of its own. */
export function AlbumEditSheet({
  title,
  submitLabel,
  initialName = '',
  initialEmoji,
  placeholder = 'Album name',
  icons = ALBUM_ICONS,
  onSubmit,
  onClose,
}: {
  title: string;
  submitLabel: string;
  initialName?: string;
  /** The stored mark (an icon name, or an emoji from before). */
  initialEmoji?: string;
  placeholder?: string;
  icons?: readonly IconName[];
  onSubmit: (value: { name: string; emoji: string }) => void;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const chrome = momentChrome(colors);
  const [name, setName] = useState(initialName);
  const [icon, setIcon] = useState<IconName>(() => {
    const current = markIcon(initialEmoji, icons[0]);
    return icons.includes(current) ? current : icons[0];
  });
  const canSubmit = name.trim().length > 0;

  const submit = () => {
    if (!canSubmit) return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    // Stored in the `emoji` field, which now holds an icon name.
    onSubmit({ name: name.trim(), emoji: icon });
  };

  return (
    <Page
      title={title}
      onBack={onClose}
      footer={
        <Pressable
          onPress={submit}
          disabled={!canSubmit}
          style={({ pressed }) => [
            styles.primaryBtn,
            { backgroundColor: chrome.accent, opacity: canSubmit ? (pressed ? 0.9 : 1) : 0.4 },
          ]}>
          <Text style={[styles.primaryBtnText, { color: chrome.onAccent }]}>{submitLabel}</Text>
        </Pressable>
      }>
      {/* Big preview of the mark, then the name. */}
      <View style={[styles.markPreview, { backgroundColor: chrome.accentSoft }]}>
        <Icon name={icon} size={58} color={chrome.accent} filled />
      </View>

      <TextInput
        value={name}
        onChangeText={setName}
        placeholder={placeholder}
        placeholderTextColor={chrome.textTertiary}
        autoFocus
        maxLength={40}
        returnKeyType="done"
        onSubmitEditing={submit}
        style={[
          styles.nameInput,
          { color: chrome.text, borderColor: chrome.border, backgroundColor: chrome.surfaceSoft },
        ]}
      />

      <Text style={[styles.fieldLabel, { color: chrome.textSecondary }]}>Icon</Text>
      <View style={styles.iconGrid}>
        {icons.map((name) => {
          const on = name === icon;
          return (
            <Pressable
              key={name}
              onPress={() => {
                void Haptics.selectionAsync();
                setIcon(name);
              }}
              style={({ pressed }) => [
                styles.iconChip,
                { backgroundColor: on ? chrome.accent : chrome.surfaceSoft },
                pressed && styles.pressed,
              ]}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={name}>
              <Icon name={name} size={30} color={on ? chrome.onAccent : chrome.text} filled={on} />
            </Pressable>
          );
        })}
      </View>
    </Page>
  );
}

export type SheetAction = { label: string; icon: IconName; destructive?: boolean; onPress: () => void };

/** A list of options (album menu, delete confirm…); tapping outside closes it. */
export function ActionSheet({
  title,
  subtitle,
  message,
  thumb,
  actions,
  primary,
  onClose,
}: {
  title: string;
  /** Small line under the title ("12 moments"). */
  subtitle?: string;
  /** A longer explanation (for confirmations). */
  message?: string;
  /** The album cover (or an icon) beside the title. */
  thumb?: React.ReactNode;
  actions: SheetAction[];
  /** One main call to action (e.g. upgrading): a full-width filled button, with "Not now" under it. */
  primary?: { label: string; onPress: () => void };
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const chrome = momentChrome(colors);
  // Like Photos / Instagram menus: everyday actions in one group, destructive ones in their own.
  const groups = [actions.filter((a) => !a.destructive), actions.filter((a) => a.destructive)].filter((g) => g.length);
  return (
    <Sheet onClose={onClose}>
      <View style={styles.actionHead}>
        {thumb ? <View style={styles.actionThumb}>{thumb}</View> : null}
        <View style={styles.actionHeadText}>
          <Text style={[styles.actionTitle, { color: chrome.text }]} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? <Text style={[styles.actionSubtitle, { color: chrome.textSecondary }]}>{subtitle}</Text> : null}
        </View>
      </View>
      {message ? <Text style={[styles.actionMessage, { color: chrome.textSecondary }]}>{message}</Text> : null}
      {primary ? (
        <View style={styles.primaryWrap}>
          <Pressable
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              primary.onPress();
            }}
            accessibilityRole="button"
            style={({ pressed }) => [styles.upgradeBtn, { backgroundColor: colors.accent }, pressed && { opacity: 0.9 }]}>
            <Text style={[styles.upgradeText, { color: colors.onAccent }]}>{primary.label}</Text>
          </Pressable>
          {/* "Not now", off for now: tapping outside the sheet closes it.
          <Pressable onPress={onClose} accessibilityRole="button" hitSlop={8} style={styles.notNow}>
            <Text style={[styles.notNowText, { color: chrome.textSecondary }]}>Not now</Text>
          </Pressable>
          */}
        </View>
      ) : null}
      {groups.map((group, gi) => (
        <View key={gi} style={[styles.actionGroup, { backgroundColor: chrome.surfaceSoft }]}>
          {group.map((a, i) => {
            const tint = a.destructive ? chrome.error : chrome.text;
            return (
              <Pressable
                key={a.label}
                onPress={() => {
                  void Haptics.selectionAsync();
                  a.onPress();
                }}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.actionRow,
                  i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: chrome.border },
                  pressed && { backgroundColor: chrome.border },
                ]}>
                <Text style={[styles.actionLabel, { color: tint }]}>{a.label}</Text>
                <Icon name={a.icon} size={21} color={tint} />
              </Pressable>
            );
          })}
        </View>
      ))}
    </Sheet>
  );
}

/** "Add to album" for moments picked in select mode. */
export function AlbumPickerSheet({
  albums,
  count,
  onPick,
  onNew,
  onClose,
}: {
  albums: MomentAlbum[];
  count: number;
  onPick: (album: MomentAlbum) => void;
  onNew: () => void;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const chrome = momentChrome(colors);
  return (
    <Sheet onClose={onClose}>
      <Text style={[styles.sheetTitle, { color: chrome.text }]}>
        Add {count} moment{count === 1 ? '' : 's'} to…
      </Text>
      <ScrollView style={styles.pickerList} keyboardShouldPersistTaps="handled">
        <Pressable onPress={onNew} style={({ pressed }) => [styles.pickerRow, pressed && styles.pressed]}>
          <View style={[styles.pickerThumb, { backgroundColor: chrome.accentSoft }]}>
            <Icon name="plus" size={22} color={chrome.accent} />
          </View>
          <Text style={[styles.pickerName, { color: chrome.accent }]}>New album</Text>
        </Pressable>
        {albums.map((album) => (
          <Pressable
            key={album.id}
            onPress={() => onPick(album)}
            style={({ pressed }) => [styles.pickerRow, pressed && styles.pressed]}>
            <View style={[styles.pickerThumb, { backgroundColor: chrome.accentSoft }]}>
              <Icon name={markIcon(album.emoji, 'albums')} size={24} color={chrome.accent} filled />
            </View>
            <View style={styles.pickerText}>
              <Text style={[styles.pickerName, { color: chrome.text }]} numberOfLines={1}>
                {album.name}
              </Text>
              <Text style={[styles.cardCount, { color: chrome.textTertiary }]}>
                {album.momentIds.length} moment{album.momentIds.length === 1 ? '' : 's'}
              </Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.75 },
  shelf: { marginBottom: 26 },
  shelfHeader: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 14 },
  shelfTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  shelfCount: { fontSize: 14, fontWeight: '700' },
  shelfRow: { gap: 18, paddingRight: 12, paddingTop: 6 },
  invite: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
  },
  inviteIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  inviteText: { flex: 1, gap: 2 },
  inviteTitle: { fontSize: 15, fontWeight: '800' },
  inviteSub: { fontSize: 13, lineHeight: 18 },
  card: { width: CARD_SIZE },
  cardStack: { width: CARD_SIZE, height: CARD_SIZE, marginBottom: 10 },
  stackBack: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: CARD_SIZE,
    height: CARD_SIZE,
    borderRadius: CARD_SIZE * 0.26,
    borderWidth: StyleSheet.hairlineWidth,
  },
  emptyCover: {
    width: CARD_SIZE,
    height: CARD_SIZE,
    borderRadius: CARD_SIZE * 0.26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiBadge: {
    position: 'absolute',
    bottom: -6,
    right: -6,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardName: { fontSize: 15, fontWeight: '700' },
  cardCount: { fontSize: 13, fontWeight: '600', marginTop: 1 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheetPositioner: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 20,
    paddingTop: 10,
    gap: 16,
  },
  grabberArea: { alignItems: 'center', paddingTop: 2, paddingBottom: 4 },
  grabber: { width: 38, height: 5, borderRadius: 3, opacity: 0.45 },
  sheetBody: { gap: 16 },
  sheetTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  actionHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  actionThumb: { width: 52, height: 52, borderRadius: 14, overflow: 'hidden' },
  actionHeadText: { flex: 1, minWidth: 0, gap: 2 },
  actionTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.2 },
  actionSubtitle: { fontSize: 13, fontWeight: '600' },
  actionMessage: { fontSize: 14, lineHeight: 20, marginTop: -4 },
  primaryWrap: { gap: 6, marginTop: 4 },
  upgradeBtn: { height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center' },
  upgradeText: { fontSize: 17, fontWeight: '800' },
  notNow: { height: 44, alignItems: 'center', justifyContent: 'center' },
  notNowText: { fontSize: 15, fontWeight: '700' },
  actionGroup: { borderRadius: 18, overflow: 'hidden' },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 54,
    paddingHorizontal: 18,
  },
  actionLabel: { fontSize: 16, fontWeight: '600' },
  flex: { flex: 1 },
  pageHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingTop: 6, paddingBottom: 10 },
  pageSide: { width: 52 },
  pageTitle: { flex: 1, textAlign: 'center', fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  pageBody: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20, gap: 14 },
  markPreview: {
    alignSelf: 'center',
    width: 120,
    height: 120,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  fieldLabel: { fontSize: 13, fontWeight: '800', marginTop: 6 },
  // Five big icons a row.
  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between' },
  iconChip: { width: 60, height: 60, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  pageFooter: { paddingHorizontal: 20, paddingTop: 10 },
  ideaWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  nameInput: {
    height: 56,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 17,
    fontWeight: '600',
  },
  ideaChip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999 },
  ideaChipText: { fontSize: 14, fontWeight: '700' },
  primaryBtn: { height: 56, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  primaryBtnText: { fontSize: 16, fontWeight: '800' },
  pickerList: { maxHeight: 360 },
  pickerRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 8 },
  pickerThumb: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  pickerText: { flex: 1, minWidth: 0 },
  pickerName: { fontSize: 16, fontWeight: '700' },
});
