import { useRef } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';

const LENGTH = 6;

interface Props {
  value: string;
  onChange: (code: string) => void;
  autoFocus?: boolean;
}

export function OtpCodeInput({ value, onChange, autoFocus = true }: Props) {
  const { colors } = useTheme();
  const inputRef = useRef<TextInput>(null);
  const digits = Array.from({ length: LENGTH }, (_, i) => value[i] ?? '');

  const handleChange = (text: string) => {
    onChange(text.replace(/\D/g, '').slice(0, LENGTH));
  };

  return (
    <Pressable style={styles.wrap} onPress={() => inputRef.current?.focus()}>
      <View style={styles.row}>
        {digits.map((char, index) => {
          const focused = value.length === index;
          return (
            <View
              key={index}
              style={[
                styles.box,
                {
                  borderColor: focused || char ? colors.accent : colors.border,
                  backgroundColor: colors.surface,
                },
              ]}>
              <Text style={[styles.digitText, { color: colors.text }]}>{char}</Text>
            </View>
          );
        })}
      </View>
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={handleChange}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={LENGTH}
        style={styles.hiddenInput}
        autoFocus={autoFocus}
        caretHidden
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%' },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  box: {
    flex: 1,
    aspectRatio: 0.85,
    maxWidth: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  digitText: { fontSize: 22, fontWeight: '700', letterSpacing: 0 },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    width: 1,
    height: 1,
  },
});
