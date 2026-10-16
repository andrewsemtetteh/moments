import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';

export type IconName =
  | 'filter'
  | 'home'
  | 'spark'
  | 'plus'
  | 'calendar'
  | 'user'
  | 'people'
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
  | 'time'
  | 'sparkles'
  | 'sync'
  | 'paperPlane'
  | 'link'
  | 'bulb'
  | 'question'
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
  | 'flipCamera'
  | 'flash'
  | 'download'
  | 'document'
  | 'expand'
  | 'reply'
  | 'restore'
  | 'rewind'
  | 'moreVertical'
  | 'more'
  | 'albums'
  | 'map'
  | 'flag'
  | 'balloon'
  | 'cafe'
  | 'walk'
  | 'happy'
  | 'edit'
  | 'warning'
  | 'key'
  | 'mail'
  | 'search'
  | 'airplane'
  | 'diamond'
  | 'sunny'
  | 'share'
  | 'info'
  | 'cart'
  | 'bag'
  | 'instagram'
  | 'xLogo'
  | 'tiktok'
  | 'youtube'
  | 'help'
  | 'phone'
  | 'haptics'
  | 'palette'
  | 'unlock';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

const ICON_MAP: Record<IconName, { outline: IoniconName; filled: IoniconName }> = {
  home: { outline: 'home-outline', filled: 'home' },
  spark: { outline: 'sparkles-outline', filled: 'sparkles' },
  plus: { outline: 'add', filled: 'add' },
  calendar: { outline: 'calendar-outline', filled: 'calendar' },
  user: { outline: 'person-outline', filled: 'person' },
  people: { outline: 'people-outline', filled: 'people' },
  // The two-bubble mark (same as `messages`, used on the Moments camera header)
  // is the app's one chat icon — a conversation between two people.
  chat: { outline: 'chatbubbles-outline', filled: 'chatbubbles' },
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
  time: { outline: 'time-outline', filled: 'time' },
  sparkles: { outline: 'sparkles-outline', filled: 'sparkles' },
  /** A paper plane flying up and to the right (about 2 o'clock): sending a nudge. */
  paperPlane: { outline: 'paper-plane-outline', filled: 'paper-plane' },
  /** Answers that matched, being in sync. */
  sync: { outline: 'sync-outline', filled: 'sync' },
  /** Where two things line up (compatibility). */
  link: { outline: 'link-outline', filled: 'link' },
  /** Smart, generated content (AI games and questions). */
  bulb: { outline: 'bulb-outline', filled: 'bulb' },
  question: { outline: 'help-circle-outline', filled: 'help-circle' },
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
  flash: { outline: 'flash-outline', filled: 'flash' },
  download: { outline: 'download-outline', filled: 'download' },
  document: { outline: 'document-outline', filled: 'document' },
  expand: { outline: 'expand-outline', filled: 'expand' },
  reply: { outline: 'arrow-undo-outline', filled: 'arrow-undo' },
  restore: { outline: 'refresh-outline', filled: 'refresh' },
  rewind: { outline: 'play-back-outline', filled: 'play-back' },
  moreVertical: { outline: 'ellipsis-vertical', filled: 'ellipsis-vertical' },
  more: { outline: 'ellipsis-horizontal', filled: 'ellipsis-horizontal' },
  albums: { outline: 'albums-outline', filled: 'albums' },
  map: { outline: 'map-outline', filled: 'map' },
  flag: { outline: 'flag-outline', filled: 'flag' },
  balloon: { outline: 'balloon-outline', filled: 'balloon' },
  cafe: { outline: 'cafe-outline', filled: 'cafe' },
  walk: { outline: 'walk-outline', filled: 'walk' },
  happy: { outline: 'happy-outline', filled: 'happy' },
  edit: { outline: 'create-outline', filled: 'create' },
  warning: { outline: 'warning-outline', filled: 'warning' },
  key: { outline: 'key-outline', filled: 'key' },
  mail: { outline: 'mail-outline', filled: 'mail' },
  search: { outline: 'search-outline', filled: 'search' },
  filter: { outline: 'options-outline', filled: 'options' },
  airplane: { outline: 'airplane-outline', filled: 'airplane' },
  diamond: { outline: 'diamond-outline', filled: 'diamond' },
  sunny: { outline: 'sunny-outline', filled: 'sunny' },
  share: { outline: 'share-outline', filled: 'share' },
  info: { outline: 'information-circle-outline', filled: 'information-circle' },
  cart: { outline: 'cart-outline', filled: 'cart' },
  bag: { outline: 'bag-handle-outline', filled: 'bag-handle' },
  instagram: { outline: 'logo-instagram', filled: 'logo-instagram' },
  xLogo: { outline: 'logo-x', filled: 'logo-x' },
  tiktok: { outline: 'logo-tiktok', filled: 'logo-tiktok' },
  youtube: { outline: 'logo-youtube', filled: 'logo-youtube' },
  help: { outline: 'help-buoy-outline', filled: 'help-buoy' },
  phone: { outline: 'phone-portrait-outline', filled: 'phone-portrait' },
  haptics: { outline: 'pulse-outline', filled: 'pulse' },
  palette: { outline: 'color-palette-outline', filled: 'color-palette' },
  unlock: { outline: 'lock-open-outline', filled: 'lock-open' },
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
