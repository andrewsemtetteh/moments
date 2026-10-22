import * as Haptics from '@/lib/haptics';
import { useEffect, useId } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { create } from 'zustand';

import { DraggableSheet, useKeptWhileClosing } from '@/components/ui/DraggableSheet';
import { insetCardStyle, pressedRowColor, separatorColor } from '@/components/ui/primitives';
import { useTheme } from '@/hooks/useTheme';

export type ChoiceAction = {
  label: string;
  /** Red for anything that deletes or ends something. */
  destructive?: boolean;
  onPress?: () => void;
};

export type ChoiceRequest = {
  title: string;
  message?: string;
  actions: ChoiceAction[];
  /** The bottom button; "Cancel" by default. */
  cancelLabel?: string;
  onCancel?: () => void;
};

type ChoiceState = {
  request: ChoiceRequest | null;
  /** Mounted hosts, oldest first: the newest (the top layer) shows the choices. */
  hosts: string[];
};

const useChoiceStore = create<ChoiceState>(() => ({ request: null, hosts: [] }));

/**
 * The app's own choices drawer, in place of the system alert with buttons ("Delete
 * moment?", "Account options"…): the app's look, drag to close, works on every theme.
 * Shown by whichever ChoiceSheetHost is on top, so it also appears inside Moments,
 * a full page or the live room (where a drawer from the app root couldn't).
 */
export function askChoice(request: ChoiceRequest) {
  useChoiceStore.setState({ request });
}

/** "Delete this?" with one red button. */
export function confirmChoice({
  title,
  message,
  confirmLabel,
  destructive = true,
  onConfirm,
}: {
  title: string;
  message?: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
}) {
  askChoice({ title, message, actions: [{ label: confirmLabel, destructive, onPress: onConfirm }] });
}

/** After the drawer has slid away, so whatever an action opens next isn't covered or dropped. */
const AFTER_CLOSE_MS = 300;

/**
 * Where the choices appear. One at the app root, and one inside each full-screen layer
 * (`inline`): the latest one mounted is the one that shows.
 */
export function ChoiceSheetHost({ inline = false }: { inline?: boolean }) {
  const id = useId();
  const { colors } = useTheme();
  const isTop = useChoiceStore((s) => s.hosts[s.hosts.length - 1] === id);
  const live = useChoiceStore((s) => s.request);
  // Keeps its words while it slides away.
  const request = useKeptWhileClosing(live);

  useEffect(() => {
    useChoiceStore.setState((s) => ({ hosts: [...s.hosts, id] }));
    return () => useChoiceStore.setState((s) => ({ hosts: s.hosts.filter((h) => h !== id) }));
  }, [id]);

  if (!isTop || !request) return null;

  const dismiss = (then?: () => void) => {
    useChoiceStore.setState({ request: null });
    if (then) setTimeout(then, AFTER_CLOSE_MS);
  };

  return (
    <DraggableSheet visible={!!live} onClose={() => dismiss(request.onCancel)} inline={inline} dragAnywhere>
      <Text style={[styles.title, { color: colors.text }]}>{request.title}</Text>
      {request.message ? (
        <Text style={[styles.message, { color: colors.textSecondary }]}>{request.message}</Text>
      ) : null}

      {/* No actions: just the message and its button (e.g. "Moments is for 16 and over"). */}
      {request.actions.length ? (
        <View style={[styles.list, insetCardStyle(colors, 'sheet')]}>
          {request.actions.map((a, i) => (
            <Pressable
              key={a.label}
              onPress={() => {
                void Haptics.selectionAsync();
                dismiss(a.onPress);
              }}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.row,
                i > 0 && { borderTopWidth: 1, borderTopColor: separatorColor(colors) },
                pressed && { backgroundColor: pressedRowColor(colors) },
              ]}
            >
              <Text style={[styles.rowText, { color: a.destructive ? colors.error : colors.text }]}>{a.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <Pressable
        onPress={() => dismiss(request.onCancel)}
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.cancel,
          insetCardStyle(colors, 'sheet'),
          pressed && { backgroundColor: pressedRowColor(colors) },
        ]}
      >
        <Text style={[styles.cancelText, { color: colors.text }]}>{request.cancelLabel ?? 'Cancel'}</Text>
      </Pressable>
    </DraggableSheet>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3, textAlign: 'center' },
  message: { fontSize: 15, lineHeight: 21, textAlign: 'center', marginTop: 6 },
  list: { marginTop: 18, borderRadius: 18, overflow: 'hidden' },
  row: { minHeight: 54, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  rowText: { fontSize: 17, fontWeight: '700' },
  cancel: { marginTop: 10, minHeight: 54, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  cancelText: { fontSize: 17, fontWeight: '800' },
});
