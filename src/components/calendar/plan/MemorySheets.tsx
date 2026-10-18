import { format, formatDistanceToNowStrict, isToday, startOfDay } from 'date-fns';
import * as Haptics from '@/lib/haptics';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { TextInput } from '@/components/ui/ThemedTextInput';
import { ScrollView as GHScrollView } from 'react-native-gesture-handler';

import { Divider, FieldRow, InlineInput, createFormStyles as form } from '@/components/calendar/plan/CreatePlanFlow';
import { FullScreenPage } from '@/components/layout/FullScreenPage';
import { SheetHeader, sheetListStyle } from '@/components/ui/SheetHeader';
import { HeaderIconButton } from '@/components/ui/HeaderIconButton';
import { DraggableSheet, useKeptWhileClosing } from '@/components/ui/DraggableSheet';
import { Icon } from '@/components/ui/Icon';
import { KeyboardAwareScrollView } from '@/components/ui/KeyboardAwareScrollView';
import { cardEdge, colorWithAlpha, paperEdge, separatorColor, cardSurface, pressedRowColor } from '@/components/ui/primitives';
import { ActionSheet, type SheetAction } from '@/components/moments/MomentAlbums';
import { MonthCalendarPicker } from '@/components/ui/MonthCalendarPicker';
import { downloadMultipleMomentMedia } from '@/lib/download-moment-media';
import { useTheme } from '@/hooks/useTheme';
import { getFirstName } from '@/lib/avatar-initial';
import { captureViewAsImage, shareImageFile } from '@/lib/share-image';
import { MEMORY_TYPES, memoryTone, memoryTypeMeta, parsePlanMeta, planIcon, type MemoryType } from '@/lib/plan-meta';
import type { CalendarEvent, Moment, UserProfile } from '@/types/database';

const SCREEN_W = Dimensions.get('window').width;
const SERIF = Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia' });
/** Photo tiles on New memory (and How was it?): ~3 per row on a phone. */
const PHOTO_TILE = 104;

const MAX_PHOTOS = 8;
export const RATINGS = [
  { emoji: '😕', label: 'Meh' },
  { emoji: '🙂', label: 'Nice' },
  { emoji: '😊', label: 'Lovely' },
  { emoji: '😍', label: 'Loved it' },
  { emoji: '🔥', label: 'Best ever' },
] as const;

export type MemoryDraft = {
  title: string;
  date: Date;
  memoryType: MemoryType;
  momentIds: string[];
  photoUrls: string[];
  placeName: string;
  note: string;
};

/** Photos for a memory: its moments when loaded, else the saved URLs. */
export function memoryPhotos(entry: CalendarEvent, momentsById: Map<string, Moment>): string[] {
  const meta = parsePlanMeta(entry.description);
  const fromMoments = (meta.momentIds ?? [])
    .map((id) => momentsById.get(id)?.media_url ?? meta.momentPhotoUrls?.[id])
    .filter((u): u is string => !!u);
  return [...fromMoments, ...(meta.photoUrls ?? [])];
}

// ── Add / edit ──────────────────────────────────────────────────────────

export function MemoryEditorSheet({
  visible,
  initial,
  recentMoments,
  placeNames,
  saving,
  onUploadPhoto,
  onClose,
  onSave,
}: {
  visible: boolean;
  /** Editing an existing memory; null = a new one. */
  initial: MemoryDraft | null;
  recentMoments: Moment[];
  placeNames: string[];
  saving: boolean;
  onUploadPhoto: (uri: string) => Promise<string>;
  onClose: () => void;
  onSave: (draft: MemoryDraft) => void;
}) {
  const { colors } = useTheme();
  // The parent remounts this (new `key`) on every open, so state starts fresh.
  const [draft, setDraft] = useState<MemoryDraft>(() => initial ?? emptyDraft());
  const [dateOpen, setDateOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Moments already on this memory (from "Add as memory" or an earlier save), shown so they can be removed.
  const pickedMoments = draft.momentIds
    .map((id) => recentMoments.find((m) => m.id === id))
    .filter((m): m is Moment => !!m?.media_url);
  const photoCount = draft.momentIds.length + draft.photoUrls.length;
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);

  /** Pick several photos at once from the camera roll, then upload them one by one. */
  const addFromGallery = async () => {
    const room = MAX_PHOTOS - photoCount;
    if (room <= 0) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      allowsMultipleSelection: true,
      selectionLimit: room,
      orderedSelection: true,
    });
    if (result.canceled || result.assets.length === 0) return;
    const assets = result.assets.slice(0, room);
    setUploading(true);
    setUploadProgress({ done: 0, total: assets.length });
    let failed = 0;
    let lastError: string | null = null;
    for (const [i, asset] of assets.entries()) {
      try {
        const url = await onUploadPhoto(asset.uri);
        setDraft((d) => ({ ...d, photoUrls: [...d.photoUrls, url] }));
      } catch (e) {
        failed += 1;
        lastError = e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String(e.message) : String(e);
        console.warn('[memory] photo upload failed', e);
      }
      setUploadProgress({ done: i + 1, total: assets.length });
    }
    setUploading(false);
    setUploadProgress(null);
    if (failed > 0) {
      Alert.alert(
        failed === assets.length ? (failed === 1 ? 'Could not add the photo' : 'Could not add the photos') : `${failed} of ${assets.length} photos could not be added`,
        lastError ? `${lastError}\n\nCheck your connection and try again.` : 'Check your connection and try again.',
      );
    }
  };

  const canSave = draft.title.trim().length > 0 && !saving && !uploading;
  const save = () =>
    onSave({ ...draft, title: draft.title.trim(), placeName: draft.placeName.trim(), note: draft.note.trim() });

  // Same structure as New plan (CreatePlanFlow): close · title · ✓ header,
  // big title field, one grouped list of label/value rows, then sections.
  return (
    <FullScreenPage
      dismissKeyboardOnTap
      visible={visible}
      title={initial?.title ? 'Edit memory' : 'New memory'}
      avoidKeyboard={false}
      onBack={onClose}
      right={
        saving ? (
          <ActivityIndicator color={colors.accent} />
        ) : (
          <HeaderIconButton
            icon="check"
            onPress={save}
            disabled={!canSave}
            accessibilityLabel={initial?.title ? 'Save changes' : 'Save memory'}
          />
        )
      }>
      <KeyboardAwareScrollView
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="none"
        contentContainerStyle={[form.formScroll, form.formFill]}>
        <TextInput
          value={draft.title}
          onChangeText={(title) => setDraft((d) => ({ ...d, title }))}
          placeholder="Our first date"
          placeholderTextColor={colors.textTertiary}
          maxLength={60}
          style={[form.titleInput, cardSurface(colors), { color: colors.text }]}
        />

        <GHScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={form.typeChipsScroll}
          contentContainerStyle={form.typeChips}>
          {MEMORY_TYPES.map((t) => {
            const on = draft.memoryType === t.key;
            return (
              <Pressable
                key={t.key}
                onPress={() => {
                  void Haptics.selectionAsync();
                  setDraft((d) => ({ ...d, memoryType: t.key }));
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                style={[styles.chip, on ? { backgroundColor: colors.accent } : cardSurface(colors)]}>
                <Icon name={t.icon} size={18} color={on ? colors.onAccent : colors.text} />
                <Text style={[styles.chipText, { color: on ? colors.onAccent : colors.text }]}>{t.label}</Text>
              </Pressable>
            );
          })}
        </GHScrollView>

        <View style={[form.group, cardSurface(colors)]}>
          <FieldRow
            label="Date"
            value={isToday(draft.date) ? 'Today' : format(draft.date, 'EEEE, MMM d, yyyy')}
            onPress={() => {
              void Haptics.selectionAsync();
              setDateOpen((o) => !o);
            }}
            colors={colors}
          />
          {dateOpen ? (
            <View style={styles.datePicker}>
              <MonthCalendarPicker
                value={draft.date}
                minDate={null}
                maxDate={startOfDay(new Date())}
                onChange={(date) => {
                  setDraft((d) => ({ ...d, date }));
                  setDateOpen(false);
                }}
              />
            </View>
          ) : null}
          <Divider colors={colors} />
          <InlineInput
            label="Place"
            value={draft.placeName}
            onChangeText={(placeName) => setDraft((d) => ({ ...d, placeName }))}
            placeholder="Optional"
            colors={colors}
          />
          <Divider colors={colors} />
          <InlineInput
            label="Note"
            value={draft.note}
            onChangeText={(note) => setDraft((d) => ({ ...d, note }))}
            placeholder="Optional"
            colors={colors}
          />
        </View>
        {placeNames.length > 0 && !draft.placeName ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.bleedRow}
            contentContainerStyle={styles.chips}>
            {placeNames.map((name) => (
              <Pressable
                key={name}
                onPress={() => setDraft((d) => ({ ...d, placeName: name }))}
                style={[styles.chip, cardSurface(colors)]}>
                <Icon name="location" size={14} color={colors.textSecondary} />
                <Text style={[styles.chipText, { color: colors.text }]}>{name}</Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}

        <Text style={[form.sectionLabel, { color: colors.text }]}>
          Photos{photoCount ? ` · ${photoCount} of ${MAX_PHOTOS}` : ''}
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.bleedRow}
          contentContainerStyle={styles.photoRow}>
          <Pressable
            onPress={() => void addFromGallery()}
            accessibilityRole="button"
            accessibilityLabel="Add from your photos"
            disabled={uploading || photoCount >= MAX_PHOTOS}
            style={({ pressed }) => [
              styles.addTile,
              { backgroundColor: colors.surface, borderColor: colors.textSecondary },
              photoCount >= MAX_PHOTOS && styles.addTileOff,
              pressed && { opacity: 0.7 },
            ]}>
            {uploading ? (
              <>
                <ActivityIndicator color={colors.text} />
                {uploadProgress && uploadProgress.total > 1 ? (
                  <Text style={[styles.addTileText, { color: colors.textSecondary }]}>
                    {uploadProgress.done} / {uploadProgress.total}
                  </Text>
                ) : null}
              </>
            ) : (
              <>
                <View style={[styles.addTileIcon, { backgroundColor: colors.text }]}>
                  <Icon name="plus" size={20} color={colors.background} />
                </View>
                <Text style={[styles.addTileText, { color: colors.text }]}>
                  {photoCount >= MAX_PHOTOS ? `${MAX_PHOTOS} max` : 'Add photos'}
                </Text>
              </>
            )}
          </Pressable>
          {/* The memory's photos; tap one to take it off. */}
          {[
            ...pickedMoments.map((m) => ({
              key: m.id,
              uri: m.media_url!,
              remove: () => setDraft((d) => ({ ...d, momentIds: d.momentIds.filter((x) => x !== m.id) })),
            })),
            ...draft.photoUrls.map((url) => ({
              key: url,
              uri: url,
              remove: () => setDraft((d) => ({ ...d, photoUrls: d.photoUrls.filter((u) => u !== url) })),
            })),
          ].map((photo) => (
            <Pressable
              key={photo.key}
              onPress={() => {
                void Haptics.selectionAsync();
                photo.remove();
              }}
              accessibilityRole="button"
              accessibilityLabel="Remove photo">
              <Image source={{ uri: photo.uri }} style={styles.photo} contentFit="cover" />
              <View style={[styles.check, { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
                <Icon name="close" size={13} color="#FFFFFF" />
              </View>
            </Pressable>
          ))}
        </ScrollView>

      </KeyboardAwareScrollView>

    </FullScreenPage>
  );
}

function emptyDraft(): MemoryDraft {
  return {
    title: '',
    date: startOfDay(new Date()),
    memoryType: 'milestone',
    momentIds: [],
    photoUrls: [],
    placeName: '',
    note: '',
  };
}

// ── A memory ────────────────────────────────────────────────────────────

export function MemoryDetailSheet({
  entry: entryProp,
  photos,
  me,
  partner,
  onClose,
  onEdit,
  onDelete,
  editor,
}: {
  entry: CalendarEvent | null;
  photos: string[];
  me: UserProfile | null;
  partner: UserProfile | null;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  /** The memory editor, opened over this page (inside its Modal, so closing it comes back here). */
  editor?: ReactNode;
}) {
  const { colors } = useTheme();
  // Still the same memory while the page slides away.
  const entry = useKeptWhileClosing(entryProp);
  const [page, setPage] = useState(0);
  const [menu, setMenu] = useState<'actions' | 'delete' | 'share' | null>(null);
  const [sharing, setSharing] = useState(false);
  const shareCardRef = useRef<View>(null);
  const [savingPhotos, setSavingPhotos] = useState(false);
  const meta = entry ? parsePlanMeta(entry.description) : null;
  const type = memoryTypeMeta(meta?.memoryType);
  const date = entry ? new Date(entry.date_time) : new Date();
  const partnerName = getFirstName(partner?.name) ?? 'Partner';
  const ratings = meta?.ratings ?? {};
  const photoW = SCREEN_W - 32;
  const tone = memoryTone(meta?.memoryType, colors);
  const edge = cardEdge(colors);
  const ratingLabel = (emoji: string | undefined) => RATINGS.find((r) => r.emoji === emoji)?.label ?? emoji;

  const shareText = () => {
    if (!entry || !meta) return '';
    return [
      entry.title,
      `${format(date, 'd MMMM yyyy')}${meta.placeName ? ` · ${meta.placeName}` : ''}`,
      meta.notes ? `“${meta.notes}”` : null,
      '— from our Moments',
    ]
      .filter(Boolean)
      .join('\n');
  };

  /** The card in the preview, as an image (Instagram, WhatsApp, Messages…). */
  const shareAsImage = async () => {
    if (sharing) return;
    setSharing(true);
    try {
      const uri = await captureViewAsImage(shareCardRef);
      if (uri) await shareImageFile(uri, { title: entry?.title, fallbackText: shareText() });
    } finally {
      setSharing(false);
    }
  };

  const shareAsText = async () => {
    try {
      await Share.share({ message: shareText() });
    } catch {
      // Dismissed or unavailable: nothing to do.
    }
  };

  const savePhotos = async () => {
    if (photos.length === 0 || savingPhotos) return;
    setSavingPhotos(true);
    try {
      await downloadMultipleMomentMedia(photos.map((url) => ({ url, isVideo: false })));
    } finally {
      setSavingPhotos(false);
    }
  };

  const actions: SheetAction[] = [
    { label: 'Edit memory', icon: 'edit', onPress: () => { setMenu(null); onEdit(); } },
    { label: 'Share', icon: 'share', onPress: () => setMenu('share') },
    ...(photos.length > 0
      ? [
          {
            label: photos.length === 1 ? 'Save photo' : `Save ${photos.length} photos`,
            icon: 'download' as const,
            onPress: () => {
              setMenu(null);
              void savePhotos();
            },
          },
        ]
      : []),
    { label: 'Delete memory', icon: 'trash', destructive: true, onPress: () => setMenu('delete') },
  ];

  return (
    <FullScreenPage
      visible={!!entryProp}
      title={type.label}
      onBack={onClose}
      right={
        <HeaderIconButton icon="more" onPress={() => setMenu('actions')} accessibilityLabel="Memory options" />
      }
      overlay={
        menu === 'actions' && entry ? (
          <ActionSheet title={entry.title} subtitle={format(date, 'd MMM yyyy')} actions={actions} onClose={() => setMenu(null)} />
        ) : menu === 'share' && entry && meta ? (
          <DraggableSheet visible inline dragAnywhere onClose={() => setMenu(null)}>
            <View style={styles.shareBody}>
              <SheetHeader title="Share this memory" hint="Send it as a picture, or just the words." onClose={() => setMenu(null)} />
              {/* What gets shared: the memory as a card in its colour. */}
              <View ref={shareCardRef} collapsable={false} style={[styles.shareCard, { backgroundColor: tone.fill }, edge]}>
                {photos[0] ? <Image source={{ uri: photos[0] }} style={styles.shareCover} contentFit="cover" /> : null}
                <View style={styles.shareCopy}>
                  <View style={[styles.tag, { backgroundColor: colors.surface }, paperEdge(colors, 1.5)]}>
                    <Icon name={type.icon} size={13} color={tone.ink} />
                    <Text style={[styles.tagText, { color: colors.text }]}>{type.label}</Text>
                  </View>
                  <Text style={[styles.shareTitle, { color: colors.text }]} numberOfLines={3}>
                    {entry.title}
                  </Text>
                  <Text style={[styles.detailDate, { color: colors.textSecondary }]} numberOfLines={1}>
                    {format(date, 'd MMMM yyyy')}
                    {meta.placeName ? ` · ${meta.placeName}` : ''}
                  </Text>
                  {meta.notes ? (
                    <Text style={[styles.shareNote, { color: colors.text }]} numberOfLines={4}>
                      “{meta.notes}”
                    </Text>
                  ) : null}
                  <View style={[styles.shareBrand, { borderTopColor: separatorColor(colors) }]}>
                    <Icon name="heart" size={12} color={tone.ink} filled />
                    <Text style={[styles.shareBrandText, { color: colors.textSecondary }]}>Moments</Text>
                  </View>
                </View>
              </View>
              {/* The two ways to share, as a Settings list. */}
              <View style={sheetListStyle(colors)}>
                {[
                  { key: 'image', label: 'Share as image', icon: 'image' as const, onPress: () => void shareAsImage(), busy: sharing },
                  { key: 'text', label: 'Share as text', icon: 'share' as const, onPress: () => void shareAsText(), busy: false },
                ].map((row, i) => (
                  <Pressable
                    key={row.key}
                    onPress={row.onPress}
                    disabled={row.busy}
                    accessibilityRole="button"
                    style={({ pressed }) => [
                      styles.shareRow,
                      i === 0 && { borderBottomWidth: 1, borderBottomColor: separatorColor(colors) },
                      pressed && { backgroundColor: pressedRowColor(colors) },
                    ]}>
                    <Text style={[styles.shareRowLabel, { color: colors.text }]}>{row.label}</Text>
                    {row.busy ? <ActivityIndicator color={colors.text} /> : <Icon name={row.icon} size={21} color={colors.text} />}
                  </Pressable>
                ))}
              </View>
            </View>
          </DraggableSheet>
        ) : menu === 'delete' ? (
          <ActionSheet
            title="Delete this memory?"
            message="It’s removed for both of you. Photos stay in Moments."
            actions={[
              {
                label: 'Delete memory',
                icon: 'trash',
                destructive: true,
                onPress: () => {
                  setMenu(null);
                  onDelete();
                },
              },
            ]}
            onClose={() => setMenu(null)}
          />
        ) : null
      }>
      {entry && meta ? (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.detailBody}>
          {photos.length > 0 ? (
            <View>
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / photoW))}
                style={[styles.heroFrame, { width: photoW }, edge]}>
                {photos.map((url) => (
                  <Image key={url} source={{ uri: url }} style={[styles.hero, { width: photoW }]} contentFit="cover" />
                ))}
              </ScrollView>
              {photos.length > 1 ? (
                <View style={styles.heroCount} pointerEvents="none">
                  <Icon name="image" size={12} color="#FFFFFF" />
                  <Text style={styles.heroCountText}>
                    {page + 1} / {photos.length}
                  </Text>
                </View>
              ) : null}
              {photos.length > 1 ? (
                <View style={styles.dots}>
                  {photos.map((url, i) => (
                    <View
                      key={url}
                      style={[styles.dot, { backgroundColor: i === page ? colors.text : colors.textTertiary }, i === page && styles.dotOn]}
                    />
                  ))}
                </View>
              ) : null}
            </View>
          ) : (
            // No photos: the timeline's story card look, bigger: the memory's colour, the big date, and
            // the kind's icon large and tilted.
            <View style={[styles.noPhotoHero, { width: photoW, backgroundColor: tone.fill }, edge]}>
              <View style={styles.noPhotoEmoji} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                <Icon name={type.icon} size={132} color={colorWithAlpha(tone.ink, 0.18)} filled />
              </View>
              <View style={[styles.tag, { backgroundColor: colors.surface }, paperEdge(colors, 1.5)]}>
                <Icon name={type.icon} size={13} color={tone.ink} />
                <Text style={[styles.tagText, { color: colors.text }]}>{type.label}</Text>
              </View>
              <View style={styles.noPhotoDate}>
                <Text style={[styles.noPhotoDay, { color: colors.text }]}>{format(date, 'd')}</Text>
                <View>
                  <Text style={[styles.noPhotoMonth, { color: colors.text }]}>{format(date, 'MMMM yyyy')}</Text>
                  <Text style={[styles.noPhotoYear, { color: colors.textSecondary }]}>{format(date, 'EEEE')}</Text>
                </View>
              </View>
            </View>
          )}

          {/* Title block: kind, title, when. */}
          <View style={styles.detailHead}>
            {photos.length > 0 ? (
              <View style={[styles.tag, { backgroundColor: tone.fill }, paperEdge(colors, 1.5)]}>
                <Icon name={type.icon} size={13} color={tone.ink} />
                <Text style={[styles.tagText, { color: colors.text }]}>{type.label}</Text>
              </View>
            ) : null}
            <Text style={[styles.detailTitle, { color: colors.text }]}>{entry.title}</Text>
            <Text style={[styles.detailDate, { color: colors.textSecondary }]}>
              {format(date, 'EEEE, d MMMM yyyy')} · {isToday(date) ? 'today' : formatDistanceToNowStrict(date, { addSuffix: true })}
            </Text>
          </View>

          {/* The note on its own, as a pull-quote in the memory's colour. */}
          {meta.notes ? (
            <View style={[styles.noteCard, { backgroundColor: tone.fill }, edge]}>
              <Text style={[styles.noteMark, { color: tone.ink }]}>“</Text>
              <Text style={[styles.noteText, { color: colors.text }]}>{meta.notes}</Text>
            </View>
          ) : null}

          {/* The details, in one grouped card like the plan pages: a labelled row each. */}
          <View style={[styles.detailCard, cardSurface(colors)]}>
            <DetailRow icon="calendar" tone={tone} label="When" value={format(date, 'EEEE, d MMMM yyyy')} />
            {meta.placeName ? <DetailRow icon="location" tone={tone} label="Where" value={meta.placeName} divided /> : null}
            {Object.keys(ratings).length > 0 ? (
              <DetailRow
                icon="heart"
                tone={tone}
                label="How it was"
                value={[
                  me && ratings[me.id] ? `You: ${ratingLabel(ratings[me.id])}` : null,
                  partner && ratings[partner.id] ? `${partnerName}: ${ratingLabel(ratings[partner.id])}` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
                divided
              />
            ) : null}
            <DetailRow
              icon="image"
              tone={tone}
              label="Photos"
              value={photos.length === 0 ? 'No photos yet' : `${photos.length} photo${photos.length === 1 ? '' : 's'}`}
              divided
            />
          </View>
        </ScrollView>
      ) : null}
      {editor}
    </FullScreenPage>
  );
}

/** One row of the memory's details: its icon on the memory's colour, a small label, the value. */
function DetailRow({
  icon,
  tone,
  label,
  value,
  divided,
}: {
  icon: 'calendar' | 'location' | 'heart' | 'image';
  tone: { fill: string; ink: string };
  label: string;
  value: string;
  divided?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.detailRow, divided && styles.detailRowDivided, { borderTopColor: separatorColor(colors) }]}>
      <View style={[styles.detailIcon, { backgroundColor: tone.fill }]}>
        <Icon name={icon} size={16} color={tone.ink} />
      </View>
      <View style={styles.detailRowCopy}>
        <Text style={[styles.detailRowLabel, { color: colors.textSecondary }]}>{label}</Text>
        <Text style={[styles.detailRowText, { color: colors.text }]}>{value}</Text>
      </View>
    </View>
  );
}

// ── How was it? ────────────────────────────────────────────────────────

export function HowWasItSheet({
  plan: planProp,
  dayMoments,
  saving,
  onSave,
  onSkip,
}: {
  plan: CalendarEvent | null;
  dayMoments: Moment[];
  saving: boolean;
  onSave: (input: { rating: string | null; momentIds: string[]; note: string }) => void;
  onSkip: () => void;
}) {
  const { colors } = useTheme();
  const photos = useMemo(() => dayMoments.filter((m) => m.type === 'photo' && m.media_url).slice(0, 6), [dayMoments]);
  // Keyed by plan id in the parent, so each plan starts fresh. That day's
  // photos come pre-picked — usually exactly the ones you'd want.
  const [rating, setRating] = useState<string | null>(null);
  const [picked, setPicked] = useState<string[]>(() => photos.slice(0, 3).map((m) => m.id));
  const [note, setNote] = useState('');

  // Still the same plan while the sheet slides away.
  const plan = useKeptWhileClosing(planProp);
  if (!plan) return null;
  const at = new Date(plan.date_time);
  const icon = planIcon(plan);

  return (
    <DraggableSheet visible={!!planProp} onClose={onSkip} avoidKeyboard style={styles.sheet}>
      <ScrollView contentContainerStyle={styles.editorBody} keyboardShouldPersistTaps="handled">
        <View style={styles.howHead}>
          <View style={[styles.howIcon, { backgroundColor: colors.accentSoft }]}>
            <Icon name={icon} size={28} color={colors.accent} />
          </View>
          <Text style={[styles.sheetTitle, { color: colors.text, textAlign: 'center' }]}>How was {plan.title}?</Text>
          <Text style={[styles.detailDate, { color: colors.textSecondary, textAlign: 'center' }]}>
            {format(at, "EEE d MMM 'at' h:mm a")}
          </Text>
        </View>

        <View style={styles.ratingRow}>
          {RATINGS.map((r) => {
            const on = rating === r.emoji;
            return (
              <Pressable
                key={r.emoji}
                onPress={() => {
                  void Haptics.selectionAsync();
                  setRating(r.emoji);
                }}
                accessibilityLabel={r.label}
                accessibilityState={{ selected: on }}
                style={[
                  styles.ratingBtn,
                  { backgroundColor: on ? colors.accentSoft : colors.surface, borderColor: on ? colors.accent : 'transparent' },
                ]}>
                <Text style={styles.ratingEmoji}>{r.emoji}</Text>
              </Pressable>
            );
          })}
        </View>

        {photos.length > 0 ? (
          <>
            <Text style={[styles.label, { color: colors.textSecondary }]}>From that day’s moments</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoRowPlain}>
              {photos.map((m) => {
                const on = picked.includes(m.id);
                return (
                  <Pressable
                    key={m.id}
                    onPress={() => setPicked((p) => (on ? p.filter((x) => x !== m.id) : [...p, m.id]))}
                    accessibilityState={{ selected: on }}>
                    <Image
                      source={{ uri: m.media_url! }}
                      style={[styles.photo, on && { borderColor: colors.accent, borderWidth: 2.5 }]}
                      contentFit="cover"
                    />
                    {on ? (
                      <View style={[styles.check, { backgroundColor: colors.accent }]}>
                        <Icon name="check" size={14} color={colors.onAccent} />
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </>
        ) : null}

        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="One line to remember it by…"
          placeholderTextColor={colors.textTertiary}
          maxLength={200}
          style={[styles.titleInput, styles.howNote, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
        />

        <Pressable
          onPress={() => onSave({ rating, momentIds: picked, note: note.trim() })}
          disabled={saving}
          style={[styles.primary, { backgroundColor: colors.accent }]}>
          {saving ? (
            <ActivityIndicator color={colors.onAccent} />
          ) : (
            <Text style={[styles.primaryText, { color: colors.onAccent }]}>Save as memory</Text>
          )}
        </Pressable>
        <Pressable onPress={onSkip} style={styles.secondary}>
          <Text style={[styles.secondaryText, { color: colors.textSecondary }]}>Not now</Text>
        </Pressable>
      </ScrollView>
    </DraggableSheet>
  );
}

const styles = StyleSheet.create({
  sheet: { maxHeight: '94%' },
  editorBody: { paddingHorizontal: 20, paddingBottom: 30, gap: 14 },
  sheetTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  // Sideways rows run edge to edge (like the type chips) but start on the form's 20pt edge.
  bleedRow: { flexGrow: 0, marginHorizontal: -20 },
  chips: { gap: 8, paddingHorizontal: 20 },
  chip: form.chip,
  chipText: form.chipText,
  titleInput: {
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 17,
    fontWeight: '700',
  },
  group: { borderRadius: 16, overflow: 'hidden' },
  groupRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 14 },
  groupLabel: { flex: 1, fontSize: 15, fontWeight: '600' },
  groupValue: { fontSize: 15, fontWeight: '700' },
  placeInput: { flex: 1, fontSize: 15, fontWeight: '600', padding: 0 },
  datePicker: { paddingHorizontal: 8, paddingBottom: 8 },
  label: { fontSize: 14, fontWeight: '800' },
  photoRow: { gap: 10, paddingHorizontal: 20 },
  photoRowPlain: { gap: 10 },
  // Bigger tiles on New memory so photos are easy to see and tap.
  addTile: {
    width: PHOTO_TILE,
    height: PHOTO_TILE,
    borderRadius: 22,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  addTileOff: { opacity: 0.5 },
  addTileIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  addTileText: { fontSize: 12, fontWeight: '700' },
  photo: { width: PHOTO_TILE, height: PHOTO_TILE, borderRadius: 22 },
  check: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: { fontSize: 12, fontWeight: '600', marginTop: -8 },
  noteInput: {
    minHeight: 84,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 15,
    lineHeight: 21,
    textAlignVertical: 'top',
  },
  primary: { height: 54, borderRadius: 999, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  primaryText: { fontSize: 16, fontWeight: '800' },
  secondary: { height: 44, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { fontSize: 15, fontWeight: '700' },
  shareBody: { gap: 12 },
  shareHeading: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3, marginBottom: 2 },
  shareCard: { borderRadius: 24, overflow: 'hidden' },
  shareCover: { height: 220, width: '100%' },
  shareCopy: { padding: 16, gap: 6 },
  shareTitle: { fontSize: 22, fontWeight: '900', letterSpacing: -0.4, lineHeight: 27 },
  shareNote: { fontSize: 15, lineHeight: 22, fontStyle: 'italic', fontFamily: SERIF, marginTop: 2 },
  shareBrand: { flexDirection: 'row', alignItems: 'center', gap: 5, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, marginTop: 6 },
  shareBrandText: { fontSize: 12, fontWeight: '800', letterSpacing: 0.4 },
  shareBtnRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  shareRow: { minHeight: 54, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  shareRowLabel: { fontSize: 16, fontWeight: '600' },
  shareOutline: { borderWidth: 1.5, borderRadius: 999, height: 50 },
  // Lined up on one 16pt edge: photos, title block and the details card.
  detailBody: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 40, gap: 18 },
  detailHead: { gap: 6 },
  detailCard: { borderRadius: 22, paddingHorizontal: 14 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  detailRowDivided: { borderTopWidth: 1 },
  detailIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  detailRowCopy: { flex: 1, minWidth: 0, gap: 1 },
  detailRowLabel: { fontSize: 12, fontWeight: '700' },
  detailRowText: { fontSize: 15, fontWeight: '700', lineHeight: 20 },
  noteCard: { borderRadius: 22, paddingHorizontal: 18, paddingTop: 6, paddingBottom: 18 },
  noteMark: { fontSize: 54, lineHeight: 54, fontWeight: '900', fontFamily: SERIF, marginBottom: -18 },
  noteText: { fontSize: 18, lineHeight: 27, fontStyle: 'italic', fontFamily: SERIF },
  tag: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  tagText: { fontSize: 13, fontWeight: '800' },
  noPhotoHero: { height: 220, borderRadius: 28, overflow: 'hidden', justifyContent: 'space-between', alignItems: 'flex-start', padding: 18 },
  noPhotoEmoji: {
    position: 'absolute',
    right: -4,
    top: -6,
    transform: [{ rotate: '-12deg' }],
  },
  noPhotoDate: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  noPhotoDay: { fontSize: 56, fontWeight: '900', letterSpacing: -2, lineHeight: 60 },
  noPhotoMonth: { fontSize: 18, fontWeight: '800' },
  noPhotoYear: { fontSize: 14, fontWeight: '600' },
  heroFrame: { borderRadius: 28, overflow: 'hidden' },
  hero: { height: 340 },
  heroCount: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 26,
    paddingHorizontal: 10,
    borderRadius: 13,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  heroCountText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800', fontVariant: ['tabular-nums'] },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 10 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  dotOn: { width: 18 },
  detailTitle: { fontSize: 28, fontWeight: '900', letterSpacing: -0.6, lineHeight: 33 },
  detailDate: { fontSize: 14, fontWeight: '600' },
  howHead: { alignItems: 'center', gap: 4 },
  howIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  ratingRow: { flexDirection: 'row', gap: 8 },
  ratingBtn: { flex: 1, height: 56, borderRadius: 18, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  ratingEmoji: { fontSize: 26 },
  howNote: { fontSize: 15, fontWeight: '500' },
});
