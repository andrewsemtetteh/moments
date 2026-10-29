import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from '@/lib/haptics';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type NativeScrollEvent, type NativeSyntheticEvent, useWindowDimensions } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/hooks/useTheme';

const CATEGORIES: { label: string; icon: string; emojis: string[] }[] = [
  {
    label: 'Recent',
    icon: '🕐',
    emojis: ['❤️', '😂', '😍', '🥰', '😘', '💕', '🔥', '✨', '😊', '🎉'],
  },
  {
    label: 'Faces',
    icon: '😊',
    emojis: [
      '😀',
      '😁',
      '😂',
      '🤣',
      '😃',
      '😄',
      '😅',
      '😆',
      '😉',
      '😊',
      '😋',
      '😎',
      '😍',
      '🥰',
      '😘',
      '😗',
      '😙',
      '😚',
      '🙂',
      '🤗',
      '🤩',
      '🤔',
      '🤨',
      '😐',
      '😑',
      '😶',
      '🙄',
      '😏',
      '😣',
      '😥',
      '😮',
      '🤐',
      '😯',
      '😪',
      '😫',
      '😴',
      '😌',
      '😛',
      '😜',
      '😝',
      '🤤',
      '😒',
      '😓',
      '😔',
      '😕',
      '🙃',
      '🤑',
      '😲',
      '☹️',
      '🙁',
      '😖',
      '😞',
      '😟',
      '😤',
      '😢',
      '😭',
      '😦',
      '😧',
      '😨',
      '😩',
      '🤯',
      '😬',
      '😰',
      '😱',
      '🥵',
      '🥶',
      '😳',
      '🤪',
      '😵',
      '😡',
      '😠',
      '🤬',
      '😷',
      '🤒',
      '🤕',
      '🤢',
      '🤮',
      '🤧',
      '😇',
      '🥳',
    ],
  },
  {
    label: 'Love',
    icon: '❤️',
    emojis: [
      '❤️',
      '🧡',
      '💛',
      '💚',
      '💙',
      '💜',
      '🖤',
      '🤍',
      '🤎',
      '💔',
      '❣️',
      '💕',
      '💞',
      '💓',
      '💗',
      '💖',
      '💘',
      '💝',
      '💟',
      '☮️',
      '😍',
      '🥰',
      '😘',
      '💋',
      '💏',
      '💑',
      '👫',
      '👬',
      '👭',
      '💒',
    ],
  },
  {
    label: 'Gestures',
    icon: '👋',
    emojis: [
      '👋',
      '🤚',
      '🖐️',
      '✋',
      '🖖',
      '👌',
      '🤌',
      '🤏',
      '✌️',
      '🤞',
      '🤟',
      '🤘',
      '🤙',
      '👈',
      '👉',
      '👆',
      '🖕',
      '👇',
      '☝️',
      '👍',
      '👎',
      '✊',
      '👊',
      '🤛',
      '🤜',
      '👏',
      '🙌',
      '👐',
      '🤲',
      '🤝',
      '🙏',
      '✍️',
      '💅',
      '🤳',
      '💪',
      '🦵',
      '🦶',
      '👂',
      '👃',
      '🦷',
    ],
  },
  {
    label: 'Activity',
    icon: '🎉',
    emojis: [
      '🎉',
      '🎊',
      '🎈',
      '🎁',
      '🎀',
      '🎗️',
      '🎟️',
      '🎫',
      '🏆',
      '🥇',
      '🥈',
      '🥉',
      '⚽',
      '🏀',
      '🏈',
      '⚾',
      '🎾',
      '🏐',
      '🏉',
      '🎱',
      '🏓',
      '🏸',
      '🥊',
      '🎯',
      '⛳',
      '🎲',
      '🎮',
      '🕹️',
      '🎰',
      '🧩',
      '🎭',
      '🎨',
      '🖼️',
      '🎬',
      '🎤',
      '🎧',
      '🎼',
      '🎹',
      '🥁',
      '🎷',
    ],
  },
  {
    label: 'Food',
    icon: '🍕',
    emojis: [
      '🍕',
      '🍔',
      '🍟',
      '🌭',
      '🌮',
      '🌯',
      '🥙',
      '🍱',
      '🍣',
      '🍜',
      '🍝',
      '🍛',
      '🍲',
      '🥘',
      '🥗',
      '🥪',
      '🍿',
      '🧂',
      '🥓',
      '🥩',
      '🍗',
      '🍖',
      '🌽',
      '🥕',
      '🥦',
      '🧅',
      '🍎',
      '🍊',
      '🍋',
      '🍇',
      '🍓',
      '🫐',
      '🍒',
      '🍑',
      '🥭',
      '🍍',
      '🥥',
      '🍆',
      '🥑',
      '🍦',
      '🍩',
      '🍪',
      '🎂',
      '🍰',
      '🧁',
      '🍫',
      '🍬',
      '🍭',
      '☕',
      '🍵',
    ],
  },
  {
    label: 'Travel',
    icon: '✈️',
    emojis: [
      '✈️',
      '🚀',
      '🛸',
      '🚂',
      '🚗',
      '🚕',
      '🚙',
      '🚌',
      '🚎',
      '🏎️',
      '🚓',
      '🚑',
      '🚒',
      '🚐',
      '🛻',
      '🚚',
      '🚛',
      '🚜',
      '🛵',
      '🏍️',
      '🛺',
      '🚲',
      '🛴',
      '🛹',
      '🛼',
      '🚁',
      '🛶',
      '⛵',
      '🚤',
      '🛥️',
      '🌍',
      '🌎',
      '🌏',
      '🗺️',
      '🧭',
      '⛰️',
      '🏔️',
      '🏕️',
      '🏖️',
      '🏗️',
    ],
  },
  {
    label: 'Nature',
    icon: '🌸',
    emojis: [
      '🌸',
      '🌺',
      '🌻',
      '🌹',
      '🌷',
      '🌼',
      '💐',
      '🍀',
      '🌿',
      '🌱',
      '🌲',
      '🌳',
      '🌴',
      '🍁',
      '🍂',
      '🍃',
      '🐾',
      '🦋',
      '🐝',
      '🐛',
      '🐌',
      '🐞',
      '🐜',
      '🦗',
      '🕷️',
      '🦂',
      '🐢',
      '🦎',
      '🐍',
      '🦕',
      '🦖',
      '🦏',
      '🐘',
      '🦛',
      '🦍',
      '🦧',
      '🐅',
      '🐆',
      '🦁',
      '🐻',
    ],
  },
  {
    label: 'Symbols',
    icon: '💯',
    emojis: [
      '💯',
      '✅',
      '❌',
      '❓',
      '❗',
      '💤',
      '💢',
      '💥',
      '💦',
      '💨',
      '🔥',
      '⚡',
      '🌈',
      '☁️',
      '⭐',
      '🌟',
      '💫',
      '✨',
      '🎵',
      '🎶',
      '🔔',
      '🔕',
      '📢',
      '📣',
      '🔊',
      '🔉',
      '🔈',
      '🔇',
      '📱',
      '💻',
      '⌨️',
      '🖥️',
      '🖨️',
      '🖱️',
      '💾',
      '💿',
      '📀',
      '📷',
      '📸',
      '📹',
    ],
  },
];

const ROWS = 5;
/** Emoji cells: 8½ to the screen's width (capped on tablets / unfolded, where they'd be huge). */
function cellFor(width: number) {
  return Math.floor(Math.min(width, 520) / 8.5);
}
const SECTION_GAP = 14;
const RECENTS_KEY = 'chat-recent-emojis-v1';
const MAX_RECENTS = 30;
const SECTION_NAMES: Record<string, string> = {
  Recent: 'Frequently used',
  Faces: 'Smileys',
  Love: 'Love',
  Gestures: 'People & hands',
  Activity: 'Activities',
  Food: 'Food & drink',
  Travel: 'Travel & places',
  Nature: 'Animals & nature',
  Symbols: 'Symbols',
};

interface Props {
  onSelect: (emoji: string) => void;
  /** Deletes the last character of the draft (the ⌫ key). */
  onBackspace?: () => void;
}

/** Split a list into columns of ROWS, top to bottom then left to right (like the iPhone keyboard). */
function toColumns(list: string[]) {
  const cols: string[][] = [];
  for (let i = 0; i < list.length; i += ROWS) cols.push(list.slice(i, i + ROWS));
  return cols;
}

/**
 * The chat's emoji keyboard, laid out like Apple's: every category in one
 * strip you swipe through sideways, the category bar along the bottom follows
 * along (and jumps there when tapped), recents come first, and ⌫ deletes.
 */
/** Where the panel was when it last closed, so it reopens in the same place. */
const remembered = { x: 0, active: 0 };
function remember(next: Partial<typeof remembered>) {
  Object.assign(remembered, next);
}

export function ChatEmojiPicker({ onSelect, onBackspace }: Props) {
  // Read live, so a fold / unfold, split screen or rotation redraws at the new size.
  const CELL = cellFor(useWindowDimensions().width);
  const { colors } = useTheme();
  const scrollRef = useRef<ScrollView>(null);
  const [recents, setRecents] = useState<string[]>(CATEGORIES[0].emojis);
  const [active, setActive] = useState(remembered.active);
  const jumping = useRef(false);

  useEffect(() => {
    void AsyncStorage.getItem(RECENTS_KEY)
      .then((raw) => {
        const saved = raw ? (JSON.parse(raw) as string[]) : null;
        if (saved?.length) setRecents(saved);
      })
      .catch(() => undefined);
  }, []);

  const sections = useMemo(() => CATEGORIES.map((c, i) => ({ ...c, emojis: i === 0 ? recents : c.emojis })), [recents]);
  // Where each section starts in the strip.
  const offsets = useMemo(
    () =>
      sections.reduce<number[]>((acc, _s, i) => {
        if (i === 0) return [0];
        const prev = sections[i - 1];
        return [...acc, acc[i - 1] + Math.ceil(prev.emojis.length / ROWS) * CELL + SECTION_GAP];
      }, []),
    [sections, CELL],
  );

  const pick = (emoji: string) => {
    void Haptics.selectionAsync();
    onSelect(emoji);
    setRecents((prev) => {
      const next = [emoji, ...prev.filter((e) => e !== emoji)].slice(0, MAX_RECENTS);
      void AsyncStorage.setItem(RECENTS_KEY, JSON.stringify(next)).catch(() => undefined);
      return next;
    });
  };

  const jumpTo = (i: number) => {
    void Haptics.selectionAsync();
    jumping.current = true;
    setActive(i);
    remember({ active: i });
    scrollRef.current?.scrollTo({ x: offsets[i], animated: true });
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    remember({ x: e.nativeEvent.contentOffset.x });
    if (jumping.current) return;
    const x = e.nativeEvent.contentOffset.x + CELL; // a column in counts as "there"
    let i = 0;
    while (i + 1 < offsets.length && offsets[i + 1] <= x) i += 1;
    if (i !== active) setActive(i);
    remember({ active: i });
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.backgroundElevated, borderTopColor: colors.border }]}>
      <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
        {SECTION_NAMES[sections[active].label] ?? sections[active].label}
      </Text>

      <ScrollView
        ref={scrollRef}
        contentOffset={{ x: remembered.x, y: 0 }}
        horizontal
        alwaysBounceHorizontal={false}
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        scrollEventThrottle={32}
        onScroll={onScroll}
        onMomentumScrollEnd={() => {
          jumping.current = false;
        }}
        onScrollBeginDrag={() => {
          jumping.current = false;
        }}
        contentContainerStyle={styles.strip}>
        {sections.map((section) => (
          <View key={section.label} style={styles.section}>
            {toColumns(section.emojis).map((col, ci) => (
              <View key={ci} style={{ width: CELL }}>
                {col.map((emoji) => (
                  <Pressable
                    key={emoji}
                    onPress={() => pick(emoji)}
                    accessibilityLabel={emoji}
                    style={({ pressed }) => [styles.cell, { width: CELL, height: CELL }, pressed && styles.cellPressed]}>
                    <Text style={[styles.emoji, { fontSize: Math.round(CELL * 0.66) }]}>{emoji}</Text>
                  </Pressable>
                ))}
              </View>
            ))}
          </View>
        ))}
      </ScrollView>

      {/* Category bar at the bottom, like the iPhone keyboard, plus delete. */}
      {/* The bar sits on the app's own base colour, running into the space
          below it, so it reads as the bottom of the screen. */}
      <View style={[styles.bar, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
        <View style={styles.tabs}>
          {sections.map((section, i) => {
            const on = i === active;
            return (
              <Pressable
                key={section.label}
                onPress={() => jumpTo(i)}
                hitSlop={4}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                accessibilityLabel={SECTION_NAMES[section.label] ?? section.label}
                style={[styles.tab, on && { backgroundColor: colors.accentSoft }]}>
                {i === 0 ? (
                  <Icon name="time" size={19} color={on ? colors.text : colors.textTertiary} />
                ) : (
                  <Text style={[styles.tabIcon, !on && styles.tabIconOff]}>{section.icon}</Text>
                )}
              </Pressable>
            );
          })}
        </View>
        {onBackspace ? (
          <Pressable
            onPress={() => {
              void Haptics.selectionAsync();
              onBackspace();
            }}
            onLongPress={onBackspace}
            hitSlop={8}
            accessibilityLabel="Delete"
            style={styles.backspace}>
            <Icon name="close" size={20} color={colors.textSecondary} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8 },
  sectionLabel: { fontSize: 12, fontWeight: '800', paddingHorizontal: 14, marginBottom: 2 },
  strip: { paddingHorizontal: 6 },
  section: { flexDirection: 'row', marginRight: SECTION_GAP },
  cell: { alignItems: 'center', justifyContent: 'center' },
  cellPressed: { opacity: 0.55, transform: [{ scale: 0.86 }] },
  emoji: {},
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 8,
    paddingTop: 6,
    paddingBottom: 6,
    marginTop: 4,
  },
  tabs: { flex: 1, flexDirection: 'row', justifyContent: 'space-between' },
  tab: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  tabIcon: { fontSize: 18 },
  tabIconOff: { opacity: 0.45 },
  backspace: { width: 40, height: 32, alignItems: 'center', justifyContent: 'center', marginLeft: 6 },
});
