import type { ReactNode } from 'react';
import { Keyboard, StyleSheet, View } from 'react-native';

/**
 * Tap outside a text field to close the keyboard, on every screen.
 *
 * React Native offers a touch to the deepest view first; buttons, inputs and lists claim it. A tap
 * nobody claims (empty space, plain text, a card's background) bubbles up to this root, which takes
 * it only while the keyboard is open, and closes the keyboard. With the keyboard closed it never
 * claims anything, so it can't get in the way of other touches.
 */
export function KeyboardDismissRoot({ children, enabled = true }: { children: ReactNode; enabled?: boolean }) {
  return (
    <View
      style={styles.root}
      onStartShouldSetResponder={() => enabled && Keyboard.isVisible()}
      onResponderRelease={() => Keyboard.dismiss()}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
