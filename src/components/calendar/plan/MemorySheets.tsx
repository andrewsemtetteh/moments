import { format, formatDistanceToNowStrict, isToday, startOfDay } from 'date-fns';
import * as Haptics from '@/lib/haptics';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
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
import { HeaderIconButton } from '@/components/ui/HeaderIconButton';
import { DraggableSheet, useKeptWhileClosing } from '@/components/ui/DraggableSheet';
import { Icon } from '@/components/ui/Icon';
import { colorWithAlpha, paperEdge } from '@/components/ui/primitives';
import { ActionSheet, type SheetAction } from '@/components/moments/MomentAlbums';
import { MonthCalendarPicker } from '@/components/ui/MonthCalendarPicker';
import { downloadMultipleMomentMedia } from '@/lib/download-moment-media';
import { useTheme } from '@/hooks/useTheme';
import { getFirstName } from '@/lib/avatar-initial';
import { MEMORY_TINT, MEMORY_TYPES, memoryTypeMeta, parsePlanMeta, planIcon, type MemoryType } from '@/lib/plan-meta';
import type { CalendarEvent, Moment, UserProfile } from '@/types/database';

const SCREEN_W = Dimensions.get('window').width;
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
  onDelete,
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
  /** Editing an existing memory: a "Delete memory" button at the end of the form. */
  onDelete?: () => void;
}) {
  const { colors } = useTheme();
  // The parent remounts this (new `key`) on every open, so state starts fresh.
  const [draft, setDraft] = useState<MemoryDraft>(() => initial ?? emptyDraft());
  const [dateOpen, setDateOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

  const photoMoments = recentMoments.filter((m) => m.type === 'photo' && m.media_url).slice(0, 30);
  const photoCount = draft.momentIds.length + draft.photoUrls.length;

  const toggleMoment = (id: string) => {
    void Haptics.selectionAsync();
    setDraft((d) =>
      d.momentIds.includes(id)
        ? { ...d, momentIds: d.momentIds.filter((x) => x !== id) }
        : photoCount >= MAX_PHOTOS
          ? d
          : { ...d, momentIds: [...d.momentIds, id] },
    );
  };

  const addFromGallery = async () => {
    if (photoCount >= MAX_PHOTOS) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });
    if (result.canceled || !result.assets[0]) return;
    setUploading(true);
    try {
      const url = await onUploadPhoto(result.assets[0].uri);
      setDraft((d) => ({ ...d, photoUrls: [...d.photoUrls, url] }));
    } catch {
      Alert.alert('Could not add photo', 'Please check your connection and try again.');
    } finally {
      setUploading(false);
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
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="none"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={[form.formScroll, form.formFill]}>
        <TextInput
          value={draft.title}
          onChangeText={(title) => setDraft((d) => ({ ...d, title }))}
          placeholder="Our first date"
          placeholderTextColor={colors.textTertiary}
          maxLength={60}
          style={[form.titleInput, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
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
                style={[styles.chip, { backgroundColor: on ? colors.text : colors.surface }]}>
                <Icon name={t.icon} size={18} color={on ? colors.background : colors.text} />
                <Text style={[styles.chipText, { color: on ? colors.background : colors.text }]}>{t.label}</Text>
              </Pressable>
            );
          })}
        </GHScrollView>

        <View style={[form.group, { backgroundColor: colors.surface, borderColor: colors.border }]}>
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
                style={[styles.chip, { backgroundColor: colors.surface }, paperEdge(colors)]}>
                <Icon name="location" size={14} color={colors.textSecondary} />
                <Text style={[styles.chipText, { color: colors.text }]}>{name}</Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}

        <Text style={[form.sectionLabel, { color: colors.accent }]}>
          Photos{photoCount ? ` · ${photoCount}` : ''}
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
            style={[styles.addTile, { borderColor: colors.border }]}>
            {uploading ? (
              <ActivityIndicator color={colors.accent} />
            ) : (
              <>
                <Icon name="image" size={28} color={colors.text} />
                <Text style={[styles.addTileText, { color: colors.text }]}>Add photo</Text>
              </>
            )}
          </Pressable>
          {draft.photoUrls.map((url) => (
            <Pressable
              key={url}
              onPress={() => setDraft((d) => ({ ...d, photoUrls: d.photoUrls.filter((u) => u !== url) }))}
              accessibilityLabel="Remove photo">
              <Image source={{ uri: url }} style={[styles.photo, { borderColor: colors.accent, borderWidth: 2.5 }]} contentFit="cover" />
            </Pressable>
          ))}
          {photoMoments.map((m) => {
            const on = draft.momentIds.includes(m.id);
            return (
              <Pressable key={m.id} onPress={() => toggleMoment(m.id)} accessibilityState={{ selected: on }}>
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
        {photoMoments.length > 0 ? (
          <Text style={[styles.hint, { color: colors.textTertiary }]}>Tap your moments to add them</Text>
        ) : null}

        {onDelete ? (
          <Pressable
            onPress={() =>
              Alert.alert('Delete this memory?', 'It’s removed for both of you.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: onDelete },
              ])
            }
            accessibilityRole="button"
            style={({ pressed }) => [styles.deleteMemory, pressed && { opacity: 0.6 }]}>
            <Icon name="trash" size={18} color={colors.error} />
            <Text style={[styles.deleteMemoryText, { color: colors.error }]}>Delete memory</Text>
          </Pressable>
        ) : null}
      </ScrollView>

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
}: {
  entry: CalendarEvent | null;
  photos: string[];
  me: UserProfile | null;
  partner: UserProfile | null;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { colors } = useTheme();
  // Still the same memory while the page slides away.
  const entry = useKeptWhileClosing(entryProp);
  const [page, setPage] = useState(0);
  const [menu, setMenu] = useState<'actions' | 'delete' | null>(null);
  const [savingPhotos, setSavingPhotos] = useState(false);
  const meta = entry ? parsePlanMeta(entry.description) : null;
  const type = memoryTypeMeta(meta?.memoryType);
  const date = entry ? new Date(entry.date_time) : new Date();
  const partnerName = getFirstName(partner?.name) ?? 'Partner';
  const ratings = meta?.ratings ?? {};
  const photoW = SCREEN_W - 32;
  const tint = MEMORY_TINT[meta?.memoryType ?? 'justus'] ?? colors.accent;
  const ratingLabel = (emoji: string | undefined) => RATINGS.find((r) => r.emoji === emoji)?.label ?? emoji;

  const share = async () => {
    if (!entry || !meta) return;
    const lines = [
      entry.title,
      `${format(date, 'd MMMM yyyy')}${meta.placeName ? ` · ${meta.placeName}` : ''}`,
      meta.notes ? `“${meta.notes}”` : null,
    ].filter(Boolean);
    try {
      await Share.share({ message: lines.join('\n') });
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
    { label: 'Share', icon: 'share', onPress: () => { setMenu(null); void share(); } },
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
                style={{ width: photoW }}>
                {photos.map((url) => (
                  <Image key={url} source={{ uri: url }} style={[styles.hero, { width: photoW }]} contentFit="cover" />
                ))}
              </ScrollView>
              {photos.length > 1 ? (
                <View style={styles.dots}>
                  {photos.map((url, i) => (
                    <View
                      key={url}
                      style={[styles.dot, { backgroundColor: i === page ? colors.text : colors.border }, i === page && styles.dotOn]}
                    />
                  ))}
                </View>
              ) : null}
            </View>
          ) : (
            // No photos: the timeline's story card look, bigger: a flat wash of the memory's colour, the big
            // date, and the type's icon large and tilted.
            <View
              style={[
                styles.noPhotoHero,
                {
                  width: photoW,
                  backgroundColor: colorWithAlpha(tint, colors.isDark ? 0.22 : 0.14),
                  borderColor: colors.boldBorder ? colors.border : colorWithAlpha(tint, 0.3),
                  borderWidth: colors.boldBorder ? 2 : StyleSheet.hairlineWidth,
                },
              ]}>
              <View style={styles.noPhotoEmoji} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                <Icon name={type.icon} size={120} color={colorWithAlpha(tint, 0.24)} filled />
              </View>
              <View style={styles.noPhotoDate}>
                <Text style={[styles.noPhotoDay, { color: colors.text }]}>{format(date, 'd')}</Text>
                <View>
                  <Text style={[styles.noPhotoMonth, { color: colors.text }]}>{format(date, 'MMMM')}</Text>
                  <Text style={[styles.noPhotoYear, { color: colors.textSecondary }]}>{format(date, 'EEEE, yyyy')}</Text>
                </View>
              </View>
            </View>
          )}

          {/* Title block: type, title, when. */}
          <View style={styles.detailHead}>
            <View style={[styles.tag, { backgroundColor: colorWithAlpha(tint, 0.16) }]}>
              <Icon name={type.icon} size={13} color={tint} />
              <Text style={[styles.tagText, { color: tint }]}>{type.label}</Text>
            </View>
            <Text style={[styles.detailTitle, { color: colors.text }]}>{entry.title}</Text>
            <Text style={[styles.detailDate, { color: colors.textSecondary }]}>
              {format(date, 'EEEE, d MMMM yyyy')} · {isToday(date) ? 'today' : formatDistanceToNowStrict(date, { addSuffix: true })}
            </Text>
          </View>

          {/* The details, in one grouped card like the plan pages. */}
          {meta.placeName || meta.notes || Object.keys(ratings).length > 0 ? (
            <View style={[styles.detailCard, { backgroundColor: colors.surface }, paperEdge(colors)]}>
              {meta.placeName ? (
                <View style={styles.detailRow}>
                  <Icon name="location" size={18} color={colors.textSecondary} />
                  <Text style={[styles.detailRowText, { color: colors.text }]}>{meta.placeName}</Text>
                </View>
              ) : null}
              {meta.notes ? (
                <View style={[styles.detailRow, meta.placeName ? styles.detailRowDivided : null, { borderTopColor: colors.border }]}>
                  <Icon name="journal" size={18} color={colors.textSecondary} />
                  <Text style={[styles.detailRowText, { color: colors.text }]}>{meta.notes}</Text>
                </View>
              ) : null}
              {Object.keys(ratings).length > 0 ? (
                <View
                  style={[
                    styles.detailRow,
                    meta.placeName || meta.notes ? styles.detailRowDivided : null,
                    { borderTopColor: colors.border },
                  ]}>
                  <Icon name="heart" size={18} color={colors.textSecondary} />
                  <Text style={[styles.detailRowText, { color: colors.text }]}>
                    {[
                      me && ratings[me.id] ? `You: ${ratingLabel(ratings[me.id])}` : null,
                      partner && ratings[partner.id] ? `${partnerName}: ${ratingLabel(ratings[partner.id])}` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}
        </ScrollView>
      ) : null}
    </FullScreenPage>
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
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  addTileText: { fontSize: 13, fontWeight: '700' },
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
  deleteMemory: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48, marginTop: 20 },
  deleteMemoryText: { fontSize: 16, fontWeight: '700' },
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
  // Lined up on one 16pt edge: photos, title block and the details card.
  detailBody: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 40, gap: 18 },
  detailHead: { gap: 6 },
  detailCard: { borderRadius: 22, paddingHorizontal: 16 },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 14 },
  detailRowDivided: { borderTopWidth: StyleSheet.hairlineWidth },
  detailRowText: { flex: 1, fontSize: 15, fontWeight: '600', lineHeight: 21 },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  tagText: { fontSize: 13, fontWeight: '800' },
  noPhotoHero: { height: 200, borderRadius: 24, overflow: 'hidden', justifyContent: 'flex-end', padding: 18 },
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
  hero: { height: 300, borderRadius: 28 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 10 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  dotOn: { width: 18 },
  detailTitle: { fontSize: 26, fontWeight: '900', letterSpacing: -0.5 },
  detailDate: { fontSize: 14, fontWeight: '600' },
  howHead: { alignItems: 'center', gap: 4 },
  howIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  ratingRow: { flexDirection: 'row', gap: 8 },
  ratingBtn: { flex: 1, height: 56, borderRadius: 18, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  ratingEmoji: { fontSize: 26 },
  howNote: { fontSize: 15, fontWeight: '500' },
});
