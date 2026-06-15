import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';

export type IconName =
  | 'home'
  | 'spark'
  | 'plus'
  | 'calendar'
  | 'user'
  | 'chat'
  | 'messages'
  | 'journal'
  | 'bell'
  | 'settings'
  | 'heart'
  | 'fire'
  | 'camera'
  | 'mic'
  | 'pin'
  | 'location'
  | 'send'
  | 'close'
  | 'check'
  | 'chevronRight'
  | 'chevronLeft'
  | 'chevronDown'
  | 'dice'
  | 'cards'
  | 'gamepad'
  | 'target'
  | 'list'
  | 'compass'
  | 'globe'
  | 'star'
  | 'gift'
  | 'image'
  | 'logout'
  | 'trash'
  | 'lock'
  | 'sparkles'
  | 'moon'
  | 'eye'
  | 'eyeOff'
  | 'videocam'
  | 'film'
  | 'call'
  | 'checkDone'
  | 'sticker'
  | 'play'
  | 'pause'
  | 'volumeHigh'
  | 'micOff'
  | 'videocamOff'
  | 'flipCamera';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

const ICON_MAP: Record<IconName, { outline: IoniconName; filled: IoniconName }> = {
  home: { outline: 'home-outline', filled: 'home' },
  spark: { outline: 'sparkles-outline', filled: 'sparkles' },
  plus: { outline: 'add', filled: 'add' },
  calendar: { outline: 'calendar-outline', filled: 'calendar' },
  user: { outline: 'person-outline', filled: 'person' },
  chat: { outline: 'chatbubble-ellipses-outline', filled: 'chatbubble-ellipses' },
  messages: { outline: 'chatbubbles-outline', filled: 'chatbubbles' },
  journal: { outline: 'book-outline', filled: 'book' },
  bell: { outline: 'notifications-outline', filled: 'notifications' },
  settings: { outline: 'settings-outline', filled: 'settings' },
  heart: { outline: 'heart-outline', filled: 'heart' },
  fire: { outline: 'flame-outline', filled: 'flame' },
  camera: { outline: 'camera-outline', filled: 'camera' },
  mic: { outline: 'mic-outline', filled: 'mic' },
  pin: { outline: 'pin-outline', filled: 'pin' },
  location: { outline: 'location-outline', filled: 'location' },
  send: { outline: 'send-outline', filled: 'send' },
  close: { outline: 'close', filled: 'close' },
  check: { outline: 'checkmark', filled: 'checkmark' },
  chevronRight: { outline: 'chevron-forward', filled: 'chevron-forward' },
  chevronLeft: { outline: 'chevron-back', filled: 'chevron-back' },
  chevronDown: { outline: 'chevron-down', filled: 'chevron-down' },
  dice: { outline: 'dice-outline', filled: 'dice' },
  cards: { outline: 'copy-outline', filled: 'copy' },
  gamepad: { outline: 'game-controller-outline', filled: 'game-controller' },
  target: { outline: 'radio-button-on-outline', filled: 'radio-button-on' },
  list: { outline: 'list-outline', filled: 'list' },
  compass: { outline: 'compass-outline', filled: 'compass' },
  globe: { outline: 'globe-outline', filled: 'globe' },
  star: { outline: 'star-outline', filled: 'star' },
  gift: { outline: 'gift-outline', filled: 'gift' },
  image: { outline: 'image-outline', filled: 'image' },
  logout: { outline: 'log-out-outline', filled: 'log-out' },
  trash: { outline: 'trash-outline', filled: 'trash' },
  lock: { outline: 'lock-closed-outline', filled: 'lock-closed' },
  sparkles: { outline: 'sparkles-outline', filled: 'sparkles' },
  moon: { outline: 'moon-outline', filled: 'moon' },
  eye: { outline: 'eye-outline', filled: 'eye' },
  eyeOff: { outline: 'eye-off-outline', filled: 'eye-off' },
  videocam: { outline: 'videocam-outline', filled: 'videocam' },
  film: { outline: 'film-outline', filled: 'film' },
  call: { outline: 'call-outline', filled: 'call' },
  checkDone: { outline: 'checkmark-done-outline', filled: 'checkmark-done' },
  sticker: { outline: 'happy-outline', filled: 'happy' },
  play: { outline: 'play-outline', filled: 'play' },
  pause: { outline: 'pause-outline', filled: 'pause' },
  volumeHigh: { outline: 'volume-high-outline', filled: 'volume-high' },
  micOff: { outline: 'mic-off-outline', filled: 'mic-off' },
  videocamOff: { outline: 'videocam-off-outline', filled: 'videocam-off' },
  flipCamera: { outline: 'camera-reverse-outline', filled: 'camera-reverse' },
};

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
  filled?: boolean;
}

/** Ionicons-backed icon set used across the app. */
export function Icon({ name, size = 24, color = '#000', filled = false }: IconProps) {
  const mapped = ICON_MAP[name];
  const ionName = filled ? mapped.filled : mapped.outline;
  return <Ionicons name={ionName} size={size} color={color} />;
}
