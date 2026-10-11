import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MomentSquircle } from '@/components/moments/MomentSquircle';
import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/hooks/useTheme';
import { ALBUM_EMOJIS, ALBUM_NAME_IDEAS, albumCoverId, type MomentAlbum } from '@/lib/moment-albums';
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
              Trips, date nights, your firsts — keep them together.
            </Text>
          </View>
          <Icon name="chevronRight" size={18} color={chrome.textTertiary} />
        </Pressable>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.shelfRow}>
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
                      { backgroundColor: chrome.surfaceSoft, borderColor: chrome.border, transform: [{ rotate: '-7deg' }] },
                    ]}
                  />
                  <View
                    style={[
                      styles.stackBack,
                      { backgroundColor: chrome.accentSoft, borderColor: chrome.border, transform: [{ rotate: '5deg' }] },
                    ]}
                  />
                  {cover ? (
                    <View pointerEvents="none">
                      <MomentSquircle moment={cover} size={CARD_SIZE} showAuthor={false} />
                    </View>
                  ) : (
                    <View style={[styles.emptyCover, { backgroundColor: chrome.surfaceSoft }]}>
                      <Text style={styles.emptyCoverEmoji}>{album.emoji}</Text>
                    </View>
                  )}
                  <View style={[styles.emojiBadge, { backgroundColor: chrome.background }]}>
                    <Text style={styles.emojiBadgeText}>{album.emoji}</Text>
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
function Sheet({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const chrome = momentChrome(colors);
  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(150)} style={StyleSheet.absoluteFill}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
      </Animated.View>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.sheetPositioner}
        pointerEvents="box-none">
        <Animated.View
          entering={SlideInDown.springify().damping(22).stiffness(220)}
          exiting={SlideOutDown.duration(180)}
          style={[
            styles.sheet,
            { backgroundColor: chrome.elevated, borderColor: chrome.border, paddingBottom: insets.bottom + 16 },
          ]}>
          <View style={[styles.grabber, { backgroundColor: chrome.border }]} />
          {children}
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

/** Name + emoji for a new album or a place on Our map, or for renaming one. */
export function AlbumEditSheet({
  title,
  submitLabel,
  initialName = '',
  initialEmoji,
  placeholder = 'Album name',
  emojis = ALBUM_EMOJIS,
  ideas = ALBUM_NAME_IDEAS,
  onSubmit,
  onClose,
}: {
  title: string;
  submitLabel: string;
  initialName?: string;
  initialEmoji?: string;
  placeholder?: string;
  emojis?: readonly string[];
  ideas?: readonly string[];
  onSubmit: (value: { name: string; emoji: string }) => void;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const chrome = momentChrome(colors);
  const [name, setName] = useState(initialName);
  const [emoji, setEmoji] = useState(initialEmoji ?? emojis[0]);
  const canSubmit = name.trim().length > 0;

  const submit = () => {
    if (!canSubmit) return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onSubmit({ name: name.trim(), emoji });
  };

  return (
    <Sheet onClose={onClose}>
      <Text style={[styles.sheetTitle, { color: chrome.text }]}>{title}</Text>

      <View style={styles.nameRow}>
        <View style={[styles.emojiPreview, { backgroundColor: chrome.surfaceSoft }]}>
          <Text style={styles.emojiPreviewText}>{emoji}</Text>
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
          style={[styles.nameInput, { color: chrome.text, borderColor: chrome.border, backgroundColor: chrome.background }]}
        />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow} keyboardShouldPersistTaps="handled">
        {emojis.map((e) => (
          <Pressable
            key={e}
            onPress={() => {
              void Haptics.selectionAsync();
              setEmoji(e);
            }}
            style={[
              styles.emojiChip,
              { backgroundColor: chrome.surfaceSoft, borderColor: e === emoji ? chrome.accent : 'transparent' },
            ]}
            accessibilityLabel={`Use ${e}`}>
            <Text style={styles.emojiChipText}>{e}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {!initialName ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow} keyboardShouldPersistTaps="handled">
          {ideas.map((idea) => (
            <Pressable
              key={idea}
              onPress={() => setName(idea)}
              style={[styles.ideaChip, { backgroundColor: chrome.surfaceSoft }]}>
              <Text style={[styles.ideaChipText, { color: chrome.text }]}>{idea}</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      <Pressable
        onPress={submit}
        disabled={!canSubmit}
        style={({ pressed }) => [
          styles.primaryBtn,
          { backgroundColor: chrome.accent, opacity: canSubmit ? (pressed ? 0.9 : 1) : 0.4 },
        ]}>
        <Text style={[styles.primaryBtnText, { color: chrome.onAccent }]}>{submitLabel}</Text>
      </Pressable>
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
            <View style={[styles.pickerThumb, { backgroundColor: chrome.surfaceSoft }]}>
              <Text style={styles.pickerEmoji}>{album.emoji}</Text>
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
  emptyCoverEmoji: { fontSize: 40 },
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
  emojiBadgeText: { fontSize: 18 },
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
  grabber: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, marginBottom: 2 },
  sheetTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  emojiPreview: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  emojiPreviewText: { fontSize: 28 },
  nameInput: {
    flex: 1,
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 17,
    fontWeight: '600',
  },
  chipRow: { gap: 8 },
  emojiChip: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiChipText: { fontSize: 22 },
  ideaChip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999 },
  ideaChipText: { fontSize: 14, fontWeight: '700' },
  primaryBtn: { height: 54, borderRadius: 999, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  primaryBtnText: { fontSize: 16, fontWeight: '800' },
  pickerList: { maxHeight: 360 },
  pickerRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 8 },
  pickerThumb: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  pickerEmoji: { fontSize: 26 },
  pickerText: { flex: 1, minWidth: 0 },
  pickerName: { fontSize: 16, fontWeight: '700' },
});
