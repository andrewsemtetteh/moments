import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { StatusBar } from 'react-native';

/**
 * This screen's status bar text (clock, battery) while it's in view: 'light' over a strong colour,
 * 'dark' over a pale one. Leaving the screen hands it back.
 *
 * It goes on React Native's status bar stack, where the newest entry wins and is re-applied every
 * time any status bar redraws. A one-off "set the style" call (what this used to do) was undone
 * whenever the app's own status bar redrew (theme loading, a sheet opening), so the icons came
 * out in the wrong colour until the screen set them again.
 */
export function useStatusBarStyle(style: 'light' | 'dark' | null) {
  useFocusEffect(
    useCallback(() => {
      if (!style) return undefined;
      const entry = StatusBar.pushStackEntry({
        barStyle: style === 'light' ? 'light-content' : 'dark-content',
        animated: true,
      });
      return () => StatusBar.popStackEntry(entry);
    }, [style]),
  );
}

/** Light status bar text while this screen is showing (pages whose top is a strong colour). */
export function useLightStatusBar(enabled = true) {
  useStatusBarStyle(enabled ? 'light' : null);
}
