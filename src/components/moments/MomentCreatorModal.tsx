import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Icon, type IconName } from '@/components/ui/Icon';
import { PrimaryButton } from '@/components/ui/primitives';
import { MOOD_EMOJI, MOOD_LABELS } from '@/constants/design-system';
import { useCreateMoment } from '@/hooks/queries';
import { usePlusGate } from '@/hooks/usePlusGate';
import { useSubscription } from '@/hooks/useSubscription';
import { useTheme } from '@/hooks/useTheme';
import * as api from '@/services/api';
import { useAuthStore, useMomentStore, useRelationshipStore, useUIStore } from '@/stores';

type MomentDraftType = 'photo' | 'text' | 'voice' | 'mood' | 'location';

const TYPES: { key: MomentDraftType; label: string; icon: IconName }[] = [
  { key: 'text', label: 'Text', icon: 'chat' },
  { key: 'photo', label: 'Photo', icon: 'camera' },
  { key: 'mood', label: 'Mood', icon: 'heart' },
  { key: 'voice', label: 'Voice', icon: 'mic' },
  { key: 'location', label: 'Location', icon: 'location' },
];

export function MomentCreatorModal() {
  const { colors } = useTheme();
  const visible = useUIStore((s) => s.showMomentCreator);
  const setVisible = useUIStore((s) => s.setShowMomentCreator);
  const { draft, setDraft, clearDraft } = useMomentStore();
  const createMoment = useCreateMoment();
  const relationship = useRelationshipStore((s) => s.relationship);
  const user = useAuthStore((s) => s.user);
  const { dailyMomentsUsed, limits } = useSubscription();
  const { requirePlus } = usePlusGate();
  const momentsRemaining = Math.max(0, limits.dailyMoments - dailyMomentsUsed);
  const atDailyLimit = !Number.isFinite(limits.dailyMoments) ? false : dailyMomentsUsed >= limits.dailyMoments;

  const close = () => {
    clearDraft();
    setVisible(false);
  };

  const handleCreate = async () => {
    if (!draft.type || !relationship || !user) return;
    if (atDailyLimit && !requirePlus('Unlimited daily moments')) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    let mediaUrl: string | undefined;
    if (draft.mediaUri && draft.type === 'photo') {
      const path = `${relationship.id}/${user.id}/${Date.now()}.jpg`;
      mediaUrl = await api.uploadMedia('moments', path, draft.mediaUri, 'image/jpeg');
    }

    await createMoment.mutateAsync({
      type: draft.type,
      content: draft.content || undefined,
      media_url: mediaUrl,
      mood: draft.mood ?? undefined,
    });
    await api.trackEvent(relationship.id, user.id, 'moment_created', { type: draft.type });
    close();
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (!result.canceled && result.assets[0]) {
      setDraft({ type: 'photo', mediaUri: result.assets[0].uri });
    }
  };

  if (!visible) return null;
  const canShare = !!draft.type && (draft.type === 'photo' ? !!draft.mediaUri : draft.type === 'mood' ? !!draft.mood : !!draft.content?.trim());

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Pressable onPress={close} style={[styles.iconBtn, { backgroundColor: colors.surfaceElevated }]}>
            <Icon name="close" size={20} color={colors.text} />
          </Pressable>
          <Text style={[styles.title, { color: colors.text }]}>New Moment</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.types}>
            {TYPES.map((t) => {
              const active = draft.type === t.key;
              return (
                <Pressable
                  key={t.key}
                  onPress={() => setDraft({ type: t.key })}
                  style={[styles.typeBtn, { backgroundColor: active ? colors.accent : colors.surface, borderColor: active ? colors.accent : colors.border }]}>
                  <Icon name={t.icon} size={20} color={active ? colors.onAccent : colors.textSecondary} />
                  <Text style={{ color: active ? colors.onAccent : colors.text, fontSize: 12, fontWeight: '600', marginTop: 4 }}>{t.label}</Text>
                </Pressable>
              );
            })}
          </View>

          {draft.type === 'photo' && (
            <Pressable onPress={pickImage} style={[styles.uploadArea, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {draft.mediaUri ? (
                <Image source={{ uri: draft.mediaUri }} style={styles.preview} contentFit="cover" />
              ) : (
                <>
                  <Icon name="image" size={32} color={colors.textSecondary} />
                  <Text style={{ color: colors.textSecondary, marginTop: 8 }}>Tap to choose a photo</Text>
                </>
              )}
            </Pressable>
          )}

          {draft.type === 'mood' && (
            <View style={styles.moodGrid}>
              {Object.entries(MOOD_EMOJI).map(([key, emoji]) => (
                <Pressable
                  key={key}
                  onPress={() => setDraft({ mood: key, content: `Feeling ${MOOD_LABELS[key] ?? key}` })}
                  style={[styles.moodItem, { backgroundColor: draft.mood === key ? colors.accentSoft : colors.surface, borderColor: draft.mood === key ? colors.accent : colors.border }]}>
                  <Text style={styles.moodEmoji}>{emoji}</Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 4 }}>{MOOD_LABELS[key]}</Text>
                </Pressable>
              ))}
            </View>
          )}

          {(draft.type === 'text' || draft.type === 'location' || draft.type === 'voice') && (
            <TextInput
              style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
              placeholder={
                draft.type === 'location' ? 'Where are you right now?' : draft.type === 'voice' ? 'Add a note for your voice moment…' : 'Share a thought with your partner…'
              }
              placeholderTextColor={colors.textTertiary}
              multiline
              value={draft.content}
              onChangeText={(content) => setDraft({ content })}
              autoFocus
            />
          )}

          {!draft.type && (
            <Text style={{ color: colors.textSecondary, textAlign: 'center', marginTop: 24 }}>
              Pick a type to capture this moment.
            </Text>
          )}
        </ScrollView>

        <View style={[styles.footer, { borderTopColor: colors.border }]}>
          {Number.isFinite(limits.dailyMoments) && (
            <Text style={[styles.limitHint, { color: colors.textSecondary }]}>
              {momentsRemaining} of {limits.dailyMoments} moments left today
            </Text>
          )}
          <PrimaryButton
            label={createMoment.isPending ? 'Sharing…' : 'Share Moment'}
            onPress={handleCreate}
            loading={createMoment.isPending}
            disabled={!canShare}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, paddingTop: 20, borderBottomWidth: StyleSheet.hairlineWidth },
  iconBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '800' },
  content: { padding: 16, gap: 18 },
  types: { flexDirection: 'row', gap: 8, justifyContent: 'space-between' },
  typeBtn: { flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 14, borderWidth: 1.5 },
  uploadArea: { height: 220, borderRadius: 18, borderWidth: 1.5, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  preview: { width: '100%', height: '100%' },
  moodGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },
  moodItem: { width: 88, alignItems: 'center', paddingVertical: 16, borderRadius: 16, borderWidth: 1.5 },
  moodEmoji: { fontSize: 32 },
  input: { minHeight: 140, borderRadius: 16, borderWidth: 1, padding: 16, fontSize: 16, textAlignVertical: 'top' },
  footer: { padding: 16, borderTopWidth: StyleSheet.hairlineWidth, gap: 10 },
  limitHint: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
});
