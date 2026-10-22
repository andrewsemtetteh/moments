import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from '@/lib/haptics';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { EditAnniversaryModal } from '@/components/profile/EditAnniversaryModal';
import { StickerCake } from '@/components/home/StickerCake';
import { Icon } from '@/components/ui/Icon';
import { outlineColor } from '@/components/ui/primitives';
import { useTheme } from '@/hooks/useTheme';
import { getFirstName } from '@/lib/avatar-initial';
import * as api from '@/services/api';
import { useAuthStore, useRelationshipStore } from '@/stores';

const DISMISSED_KEY = (userId: string) => `moments_birthday_prompt_dismissed:${userId}`;

/**
 * "Add your birthday so Sam never forgets": once, on the You page, until you add it
 * or close it. Your partner then gets a countdown and reminders. Also in Settings.
 */
export function BirthdayPrompt() {
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const partner = useRelationshipStore((s) => s.partner);
  const [dismissed, setDismissed] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    void AsyncStorage.getItem(DISMISSED_KEY(user.id))
      .then((v) => setDismissed(v === '1'))
      .catch(() => setDismissed(false));
  }, [user?.id]);

  if (!user || !partner || user.birthday || dismissed !== false) return null;
  const them = getFirstName(partner.name) ?? 'your person';

  const dismiss = () => {
    void Haptics.selectionAsync();
    setDismissed(true);
    void AsyncStorage.setItem(DISMISSED_KEY(user.id), '1').catch(() => undefined);
  };

  const save = async (iso: string) => {
    setSaving(true);
    try {
      const updated = await api.updateProfile(user.id, { birthday: iso });
      setUser(updated);
      setOpen(false);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      Alert.alert('Could not save', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.card,
          // Butter yellow (as on Home), with the theme's own card border.
          { backgroundColor: '#FFE7A0', borderColor: outlineColor(colors), borderWidth: colors.boldBorder ? 2 : 1 },
          pressed && styles.pressed,
        ]}>
        <View style={[styles.icon, { backgroundColor: '#FFFFFF', borderWidth: colors.boldBorder ? 2 : 1, borderColor: outlineColor(colors) }]}>
          <StickerCake size={30} />
        </View>
        <View style={styles.text}>
          <Text style={[styles.title, { color: '#1A1A1A' }]}>Add your birthday</Text>
          <Text style={[styles.sub, { color: '#4A4036' }]}>
            So {them} never forgets. Only {them} sees it.
          </Text>
        </View>
        <Pressable
          onPress={dismiss}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Not now"
          style={({ pressed }) => [{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }, pressed && { opacity: 0.6 }]}>
          <Icon name="close" size={24} color="#1A1A1A" />
        </Pressable>
      </Pressable>

      <EditAnniversaryModal
        visible={open}
        value="1998-01-01"
        saving={saving}
        onClose={() => setOpen(false)}
        onSave={(iso) => void save(iso)}
        title="Your birthday"
        hint={`Only ${them} sees it. They get a countdown and a reminder so they never forget.`}
        minYear={1920}
      />
    </>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 22, paddingVertical: 12, paddingHorizontal: 14 },
  icon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontSize: 15, fontWeight: '800' },
  sub: { fontSize: 13, fontWeight: '600' },
  pressed: { opacity: 0.85 },
});
