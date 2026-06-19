import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { formatAnniversaryDisplay, formatAnniversaryForDb, parseAnniversaryDate } from '@/lib/anniversary';
import { useTheme } from '@/hooks/useTheme';

type Props = {
  value: string;
  onChange: (isoDate: string) => void;
};

export function AnniversaryOnboardingField({ value, onChange }: Props) {
  const { colors, theme } = useTheme();
  const [showPicker, setShowPicker] = useState(false);
  const date = parseAnniversaryDate(value);

  const onPickerChange = (event: DateTimePickerEvent, picked?: Date) => {
    if (Platform.OS === 'android') setShowPicker(false);
    if (event.type === 'dismissed' || !picked) return;
    onChange(formatAnniversaryForDb(picked));
  };

  return (
    <View style={[styles.wrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.header}>
        <View style={[styles.iconWrap, { backgroundColor: colors.accentSoft }]}>
          <Text style={styles.emoji}>💒</Text>
        </View>
        <View style={styles.copy}>
          <Text style={[styles.title, { color: colors.text }]}>When did you get together?</Text>
          <Text style={[styles.sub, { color: colors.textSecondary }]}>
            Optional — sets your anniversary countdown. You can change it anytime in Profile.
          </Text>
        </View>
      </View>

      <Pressable
        onPress={() => setShowPicker(true)}
        style={[styles.dateBtn, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
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
          onChange={onPickerChange}
          themeVariant={theme === 'dark' ? 'dark' : 'light'}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    padding: 16,
    marginTop: 20,
    gap: 12,
  },
  header: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 22 },
  copy: { flex: 1, gap: 4 },
  title: { fontSize: 15, fontWeight: '800' },
  sub: { fontSize: 13, lineHeight: 18 },
  dateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  dateText: { flex: 1, fontSize: 16, fontWeight: '700' },
});
