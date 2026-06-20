import DateTimePicker, { type DateTimePickerChangeEvent } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { formatAnniversaryDisplay, formatAnniversaryForDb, parseAnniversaryDate } from '@/lib/anniversary';
import { useTheme } from '@/hooks/useTheme';

type Props = {
  value: string;
  onChange: (isoDate: string) => void;
};

export function AnniversaryDatePicker({ value, onChange }: Props) {
  const { colors, theme } = useTheme();
  const [showPicker, setShowPicker] = useState(Platform.OS === 'ios');
  const date = parseAnniversaryDate(value);

  const onValueChange = (_event: DateTimePickerChangeEvent, picked: Date) => {
    onChange(formatAnniversaryForDb(picked));
  };

  const onDismiss = () => {
    if (Platform.OS === 'android') setShowPicker(false);
  };

  return (
    <View style={styles.wrap}>
      <View style={[styles.iconWrap, { backgroundColor: colors.accentSoft }]}>
        <Icon name="heart" size={28} color={colors.accent} filled />
      </View>

      <Text style={[styles.title, { color: colors.text }]}>When did you get together?</Text>
      <Text style={[styles.sub, { color: colors.textSecondary }]}>
        We use this for your anniversary countdown. You can change it anytime in Profile.
      </Text>

      <Pressable
        onPress={() => setShowPicker(true)}
        style={[styles.dateBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Icon name="calendar" size={20} color={colors.accent} />
        <Text style={[styles.dateText, { color: colors.text }]}>{formatAnniversaryDisplay(date)}</Text>
        <Icon name="chevronRight" size={18} color={colors.textTertiary} />
      </Pressable>

      {showPicker ? (
        <DateTimePicker
          value={date}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          maximumDate={new Date()}
          onValueChange={onValueChange}
          onDismiss={onDismiss}
          themeVariant={theme === 'dark' ? 'dark' : 'light'}
        />
      ) : null}

      {Platform.OS === 'android' && !showPicker ? (
        <Pressable onPress={() => setShowPicker(true)} style={styles.androidHint}>
          <Text style={[styles.androidHintText, { color: colors.accent }]}>Tap to change date</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', alignItems: 'center', gap: 12 },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: { fontSize: 28, fontWeight: '800', textAlign: 'center', letterSpacing: -0.5 },
  sub: { fontSize: 16, textAlign: 'center', lineHeight: 22, maxWidth: 320, marginBottom: 8 },
  dateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    width: '100%',
    marginTop: 8,
  },
  dateText: { flex: 1, fontSize: 16, fontWeight: '700' },
  androidHint: { paddingVertical: 4 },
  androidHintText: { fontSize: 14, fontWeight: '700' },
});
