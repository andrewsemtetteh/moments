import { ExtensionStorage } from '@bacons/apple-targets';
import { Platform } from 'react-native';

/** Shared with the iOS widget extension (targets/widget). Must match its App Group. */
export const WIDGET_APP_GROUP = 'group.com.vasemti.moments';
const SNAPSHOT_KEY = 'snapshot';

/** What the home-screen widgets show. Keep in sync with targets/widget/Shared.swift. */
export type WidgetSnapshot = {
  partnerName: string;
  /** Days together, counted from the anniversary (or when the space was made). */
  daysTogether: number;
  /** ISO date the count starts from. */
  since: string | null;
  streak: number;
  /** You checked in today, so your streak is safe. */
  streakSafeToday: boolean;
  /** Their latest photo moment (a public image URL), if any. */
  momentImageUrl: string | null;
  momentCaption: string | null;
  momentAt: string | null;
  /** Their latest mood. */
  partnerMoodEmoji: string | null;
  partnerMoodLabel: string | null;
  /** Signed out / not paired: widgets show a gentle "open Moments" state. */
  paired: boolean;
  updatedAt: string;
};

let storage: ExtensionStorage | null = null;
let last = '';

/**
 * Writes the snapshot for the widgets and asks iOS to refresh them. Only on
 * iPhone, and only when something changed. In Expo Go (no widget extension)
 * the library's calls are harmless no-ops.
 */
export function publishWidgetSnapshot(snapshot: Omit<WidgetSnapshot, 'updatedAt'>) {
  if (Platform.OS !== 'ios') return;
  const json = JSON.stringify(snapshot);
  if (json === last) return;
  last = json;
  try {
    storage ??= new ExtensionStorage(WIDGET_APP_GROUP);
    storage.set(SNAPSHOT_KEY, JSON.stringify({ ...snapshot, updatedAt: new Date().toISOString() }));
    ExtensionStorage.reloadWidget();
  } catch {
    // No widget extension in this build: nothing to update.
  }
}

/** On sign-out: widgets go back to their "open Moments" state. */
export function clearWidgetSnapshot() {
  publishWidgetSnapshot({
    partnerName: '',
    daysTogether: 0,
    since: null,
    streak: 0,
    streakSafeToday: false,
    momentImageUrl: null,
    momentCaption: null,
    momentAt: null,
    partnerMoodEmoji: null,
    partnerMoodLabel: null,
    paired: false,
  });
}
