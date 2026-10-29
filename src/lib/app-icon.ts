import type { ImageSourcePropType } from 'react-native';
import { Platform } from 'react-native';

type AppIconsModule = typeof import('expo-alternate-app-icons');

/** The native module, only where it exists: a build that ran the plugin (a static import crashes Expo Go). */
let native: AppIconsModule | null = null;
if (Platform.OS !== 'web') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    native = require('expo-alternate-app-icons') as AppIconsModule;
  } catch {
    native = null;
  }
}

export type AppIcon = {
  /** The native icon name (app.json plugin), or null for the default icon. */
  id: string | null;
  label: string;
  preview: ImageSourcePropType;
};

/** Every icon, the original first. Made by app-screenshots/_source/icons.mjs (assets/app-icons). */
export const APP_ICONS: AppIcon[] = [
  { id: null, label: 'Original', preview: require('@/assets/images/app-icon.png') },
  { id: 'Happy', label: 'Happy', preview: require('@/assets/app-icons/Happy.png') },
  { id: 'InLove', label: 'In love', preview: require('@/assets/app-icons/InLove.png') },
  { id: 'Wink', label: 'Wink', preview: require('@/assets/app-icons/Wink.png') },
  { id: 'Sleepy', label: 'Sleepy', preview: require('@/assets/app-icons/Sleepy.png') },
  { id: 'Cool', label: 'Cool', preview: require('@/assets/app-icons/Cool.png') },
  { id: 'Party', label: 'Party', preview: require('@/assets/app-icons/Party.png') },
  { id: 'Shy', label: 'Shy', preview: require('@/assets/app-icons/Shy.png') },
  { id: 'Kiss', label: 'Kiss', preview: require('@/assets/app-icons/Kiss.png') },
  { id: 'Starstruck', label: 'Starstruck', preview: require('@/assets/app-icons/Starstruck.png') },
  { id: 'MissingYou', label: 'Missing you', preview: require('@/assets/app-icons/MissingYou.png') },
  { id: 'Pixel', label: 'Pixel', preview: require('@/assets/app-icons/Pixel.png') },
  { id: 'Neon', label: 'Neon', preview: require('@/assets/app-icons/Neon.png') },
  { id: 'Duo', label: 'Duo', preview: require('@/assets/app-icons/Duo.png') },
];

/** Whether this build and device can change the Home Screen icon. */
export function appIconsSupported(): boolean {
  try {
    return !!native?.supportsAlternateIcons;
  } catch {
    return false;
  }
}

/** The icon on the Home Screen now (null: the original). */
export function currentAppIcon(): string | null {
  if (!appIconsSupported()) return null;
  try {
    return native!.getAppIconName() ?? null;
  } catch {
    return null;
  }
}

/** Puts this icon on the Home Screen (null: back to the original). iOS confirms it with its own alert. */
export async function setAppIcon(id: string | null): Promise<void> {
  if (!appIconsSupported()) throw new Error('Changing the app icon isn’t available in this version of the app.');
  await native!.setAlternateAppIcon(id);
}
