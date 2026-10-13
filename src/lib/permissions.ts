import { getRecordingPermissionsAsync, requestRecordingPermissionsAsync } from 'expo-audio';
import { Camera } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { Linking } from 'react-native';
import { create } from 'zustand';

/**
 * Ask for a permission the friendly way: if it isn't granted yet, our own
 * sheet explains why first (PermissionSheetHost), and only "Allow" shows the
 * iPhone dialog. If they said no before, the sheet's button opens Settings.
 *
 *   if (!(await ensurePermission('camera'))) return;
 *
 * `host` picks which sheet shows it: 'root' (the app) or 'camera' (inside the
 * camera screens, which are full-screen modals a root sheet can't cover).
 */
export type PermissionKind = 'camera' | 'microphone' | 'location' | 'photos';

type Status = { granted: boolean; canAskAgain: boolean };

async function getStatus(kind: PermissionKind): Promise<Status> {
  switch (kind) {
    case 'camera':
      return Camera.getCameraPermissionsAsync();
    case 'microphone':
      return getRecordingPermissionsAsync();
    case 'location':
      return Location.getForegroundPermissionsAsync();
    case 'photos':
      return ImagePicker.getMediaLibraryPermissionsAsync();
  }
}

async function request(kind: PermissionKind): Promise<Status> {
  switch (kind) {
    case 'camera':
      return Camera.requestCameraPermissionsAsync();
    case 'microphone':
      return requestRecordingPermissionsAsync();
    case 'location':
      return Location.requestForegroundPermissionsAsync();
    case 'photos':
      return ImagePicker.requestMediaLibraryPermissionsAsync();
  }
}

type Pending = {
  kind: PermissionKind;
  host: string;
  /** Denied before: the button opens Settings instead. */
  blocked: boolean;
  resolve: (allow: boolean) => void;
};

export const usePermissionPrompt = create<{ pending: Pending | null }>(() => ({ pending: null }));

export function answerPermissionPrompt(allow: boolean) {
  const p = usePermissionPrompt.getState().pending;
  usePermissionPrompt.setState({ pending: null });
  p?.resolve(allow);
}

export async function ensurePermission(kind: PermissionKind, opts: { host?: string } = {}): Promise<boolean> {
  try {
    const status = await getStatus(kind);
    if (status.granted) return true;

    const allow = await new Promise<boolean>((resolve) => {
      usePermissionPrompt.getState().pending?.resolve(false);
      usePermissionPrompt.setState({
        pending: { kind, host: opts.host ?? 'root', blocked: !status.canAskAgain, resolve },
      });
    });
    if (!allow) return false;
    if (!status.canAskAgain) {
      void Linking.openSettings();
      return false;
    }
    return (await request(kind)).granted;
  } catch {
    // Unknown status (unsupported runtime): fall back to the plain system ask.
    try {
      return (await request(kind)).granted;
    } catch {
      return false;
    }
  }
}
