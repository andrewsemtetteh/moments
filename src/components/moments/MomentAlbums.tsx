import * as Haptics from '@/lib/haptics';
import { useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { TextInput } from '@/components/ui/ThemedTextInput';
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
import { Image } from 'expo-image';

import { DraggableSheet } from '@/components/ui/DraggableSheet';
import { HeaderIconButton } from '@/components/ui/HeaderIconButton';
import { colorWithAlpha } from '@/components/ui/primitives';
import { Icon, type IconName } from '@/components/ui/Icon';
import { useTheme } from '@/hooks/useTheme';
import { ALBUM_ICONS, markIcon } from '@/lib/mark-icons';
import { albumCoverId, type MomentAlbum } from '@/lib/moment-albums';
import { momentChrome } from '@/lib/moment-theme';
import type { Moment } from '@/types/database';

/** Album folder on the shelf. */
const FOLDER_W = 132;
const FOLDER_H = 112;

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
          {albums.map((album) => (
            <AlbumFolder key={album.id} album={album} momentsById={momentsById} onPress={() => onOpen(album)} />
          ))}
          <Pressable
            onPress={onCreate}
            accessibilityRole="button"
            accessibilityLabel="New album"
            style={({ pressed }) => [styles.folderCard, pressed && styles.pressed]}>
            <View style={[styles.newFolder, { borderColor: chrome.border }]}>
              <View style={[styles.newFolderPlus, { backgroundColor: chrome.accentSoft }]}>
                <Icon name="plus" size={22} color={chrome.accent} />
              </View>
            </View>
            <Text style={[styles.cardName, { color: chrome.text }]} numberOfLines={1}>
              New album
            </Text>
          </Pressable>
        </ScrollView>
      )}
    </View>
  );
}

/**
 * One album as a folder: a tinted back with a tab, up to three of its photos peeking out
 * of the top, and the front flap carrying the album's icon and count (Files / Photos).
 */
function AlbumFolder({
  album,
  momentsById,
  onPress,
}: {
  album: MomentAlbum;
  momentsById: Map<string, Moment>;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const chrome = momentChrome(colors);
  const coverId = albumCoverId(album);
  const ordered = coverId ? [coverId, ...album.momentIds.filter((id) => id !== coverId)] : album.momentIds;
  const peeks = ordered
    .map((id) => momentsById.get(id))
    .filter((m): m is Moment => !!m && m.type === 'photo' && !!m.media_url)
    .slice(0, 3);
  const icon = markIcon(album.emoji, 'albums');
  const count = album.momentIds.length;
  // Fanned left, middle, right; the cover sits in the middle, in front.
  const fan = [
    { left: 10, rotate: '-9deg', top: 10, z: 1 },
    { left: 34, rotate: '0deg', top: 2, z: 3 },
    { left: 58, rotate: '9deg', top: 10, z: 2 },
  ];
  const slots = peeks.length === 1 ? [fan[1]] : peeks.length === 2 ? [fan[0], fan[2]] : fan;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${album.name}, ${count} moment${count === 1 ? '' : 's'}`}
      style={({ pressed }) => [styles.folderCard, pressed && styles.pressed]}>
      <View style={styles.folder}>
        <View style={[styles.folderTab, { backgroundColor: colorWithAlpha(chrome.accent, 0.28) }]} />
        <View style={[styles.folderBack, { backgroundColor: colorWithAlpha(chrome.accent, 0.28) }]} />
        {peeks.length > 0 ? (
          peeks.map((m, i) => (
            <View
              key={m.id}
              style={[
                styles.peek,
                { left: slots[i].left, top: slots[i].top, zIndex: slots[i].z, transform: [{ rotate: slots[i].rotate }] },
              ]}>
              <Image source={{ uri: m.media_url! }} style={styles.peekImage} contentFit="cover" transition={150} />
            </View>
          ))
        ) : (
          <View style={styles.peekEmpty}>
            <Icon name={icon} size={30} color={chrome.accent} filled />
          </View>
        )}
        <View style={[styles.folderFront, { backgroundColor: chrome.accent }]}>
          <Icon name={icon} size={18} color={chrome.onAccent} filled />
          <Text style={[styles.folderCount, { color: chrome.onAccent }]}>{count}</Text>
        </View>
      </View>
      <Text style={[styles.cardName, { color: chrome.text }]} numberOfLines={1}>
        {album.name}
      </Text>
      <Text style={[styles.cardCount, { color: chrome.textTertiary }]}>
        {count} moment{count === 1 ? '' : 's'}
      </Text>
    </Pressable>
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
  right,
  children,
}: {
  title: string;
  onBack: () => void;
  /** Pinned to the bottom of the page, under the scrolling content. */
  footer?: React.ReactNode;
  /** Header action on the right (e.g. a ✓ to save). */
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  const back = () => {
    Keyboard.dismiss();
    onBack();
  };
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
          if (done) runOnJS(back)();
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
            <HeaderIconButton icon="chevronLeft" onPress={back} accessibilityLabel="Back" />
          </View>
          <Text style={[styles.pageTitle, { color: chrome.text }]} numberOfLines={1}>
            {title}
          </Text>
          <View style={[styles.pageSide, styles.pageSideRight]}>{right}</View>
        </View>
        {/* iPhone: the scroll view lifts the focused field above the keyboard. Android: this
            layer is a pop-up the system doesn't resize, so shrink it to the space left. */}
        <KeyboardAvoidingView behavior={Platform.OS === 'android' ? 'height' : undefined} style={styles.flex}>
          <ScrollView
            contentContainerStyle={styles.pageBody}
            keyboardShouldPersistTaps="handled"
            automaticallyAdjustKeyboardInsets
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
      right={
        <HeaderIconButton icon="check" onPress={submit} disabled={!canSubmit} accessibilityLabel={submitLabel} />
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
  primary?: { label: string; /** Button fill; defaults to the theme accent. */ color?: string; icon?: IconName; onPress: () => void };
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
            style={({ pressed }) => [styles.upgradeBtn, { backgroundColor: primary.color ?? colors.accent }, pressed && { opacity: 0.9 }]}>
            {primary.icon ? (
              <Icon name={primary.icon} size={20} color={primary.color ? '#FFFFFF' : colors.onAccent} filled />
            ) : null}
            <Text style={[styles.upgradeText, { color: primary.color ? '#FFFFFF' : colors.onAccent }]}>{primary.label}</Text>
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
  folderCard: { width: FOLDER_W },
  folder: { width: FOLDER_W, height: FOLDER_H, marginBottom: 10 },
  folderTab: { position: 'absolute', top: 6, left: 0, width: 50, height: 22, borderTopLeftRadius: 10, borderTopRightRadius: 10 },
  folderBack: { position: 'absolute', top: 18, left: 0, right: 0, bottom: 0, borderRadius: 16, borderTopLeftRadius: 4 },
  peek: {
    position: 'absolute',
    width: 64,
    height: 64,
    borderRadius: 12,
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  peekImage: { width: '100%', height: '100%' },
  peekEmpty: { position: 'absolute', top: 26, left: 0, right: 0, alignItems: 'center', zIndex: 2 },
  folderFront: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 58,
    zIndex: 5,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: -1 },
    elevation: 4,
  },
  folderCount: { fontSize: 18, fontWeight: '900', letterSpacing: -0.4 },
  newFolder: {
    width: FOLDER_W,
    height: FOLDER_H,
    marginBottom: 10,
    borderRadius: 16,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  newFolderPlus: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
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
  upgradeBtn: { height: 54, borderRadius: 27, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
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
  pageSideRight: { alignItems: 'flex-end' },
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
  pickerList: { maxHeight: 360 },
  pickerRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 8 },
  pickerThumb: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  pickerText: { flex: 1, minWidth: 0 },
  pickerName: { fontSize: 16, fontWeight: '700' },
});
