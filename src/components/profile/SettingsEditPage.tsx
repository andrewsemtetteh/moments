import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import * as Haptics from 'expo-haptics';

import { FullScreenPage, PageFooter } from '@/components/layout/FullScreenPage';
import { DraggableSheet } from '@/components/ui/DraggableSheet';
import { Icon } from '@/components/ui/Icon';
import { PrimaryButton } from '@/components/ui/primitives';
import { useTheme } from '@/hooks/useTheme';

/**
 * The page every typed setting opens (name, space name, email, password,
 * email code): slides in from the right like New plan, closes with the back
 * arrow or a swipe right, and keeps its button pinned just above the keyboard.
 */
export function SettingsEditPage({
  visible,
  title,
  hint,
  buttonLabel,
  canSave,
  saving = false,
  onSave,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  hint?: string;
  buttonLabel: string;
  canSave: boolean;
  saving?: boolean;
  onSave: () => void;
  onClose: () => void;
  children: ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <FullScreenPage visible={visible} title={title} onBack={onClose}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        {hint ? <Text style={[styles.hint, { color: colors.textSecondary }]}>{hint}</Text> : null}
        {children}
      </ScrollView>
      <PageFooter>
        <PrimaryButton
          label={saving ? 'Saving…' : buttonLabel}
          onPress={onSave}
          loading={saving}
          disabled={!canSave || saving}
        />
      </PageFooter>
    </FullScreenPage>
  );
}

/** A labelled text field in the settings style. */
export function SettingsField({ label, ...input }: TextInputProps & { label: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.textTertiary}
        {...input}
        style={[
          styles.input,
          {
            color: colors.text,
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderWidth: colors.boldBorder ? 2 : StyleSheet.hairlineWidth,
          },
        ]}
      />
    </View>
  );
}

/**
 * A pick-one setting (gender, relationship type): tap an option and it saves
 * straight away. Drag the sheet down from anywhere, or tap outside, to close.
 */
export function SettingsChoiceSheet<T extends string>({
  visible,
  title,
  hint,
  options,
  value,
  savingValue,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  hint?: string;
  options: { value: T; label: string }[];
  value: T | null | undefined;
  /** The option being saved right now (shows a spinner on it). */
  savingValue?: T | null;
  onSelect: (value: T) => void;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  return (
    <DraggableSheet visible={visible} onClose={onClose} dragAnywhere>
      <Text style={[styles.sheetTitle, { color: colors.text }]}>{title}</Text>
      {hint ? <Text style={[styles.sheetHint, { color: colors.textSecondary }]}>{hint}</Text> : null}
      <View
        style={[
          styles.list,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderWidth: colors.boldBorder ? 2 : 0,
          },
        ]}>
        {options.map((option, i) => {
          const selected = option.value === value;
          const busy = option.value === savingValue;
          return (
            <Pressable
              key={option.value}
              disabled={!!savingValue}
              onPress={() => {
                void Haptics.selectionAsync();
                if (selected) onClose();
                else onSelect(option.value);
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              style={({ pressed }) => [
                styles.option,
                i < options.length - 1 && {
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: colors.border,
                },
                pressed && { backgroundColor: colors.surfaceElevated },
              ]}>
              <Text style={[styles.optionLabel, { color: colors.text }, selected && styles.optionLabelOn]}>
                {option.label}
              </Text>
              {busy ? (
                <ActivityIndicator size="small" color={colors.accent} />
              ) : selected ? (
                <Icon name="check" size={20} color={colors.accent} />
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </DraggableSheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24, gap: 16 },
  hint: { fontSize: 15, lineHeight: 21 },
  field: { gap: 8 },
  fieldLabel: { fontSize: 14, fontWeight: '700' },
  input: { height: 54, borderRadius: 16, paddingHorizontal: 16, fontSize: 17 },
  sheetTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  sheetHint: { fontSize: 14, lineHeight: 20, marginTop: 4 },
  list: { marginTop: 16, borderRadius: 18, overflow: 'hidden' },
  option: { minHeight: 54, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  optionLabel: { fontSize: 16, fontWeight: '600' },
  optionLabelOn: { fontWeight: '800' },
});
