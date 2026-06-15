import { useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

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
      '😀','😁','😂','🤣','😃','😄','😅','😆','😉','😊',
      '😋','😎','😍','🥰','😘','😗','😙','😚','🙂','🤗',
      '🤩','🤔','🤨','😐','😑','😶','🙄','😏','😣','😥',
      '😮','🤐','😯','😪','😫','😴','😌','😛','😜','😝',
      '🤤','😒','😓','😔','😕','🙃','🤑','😲','☹️','🙁',
      '😖','😞','😟','😤','😢','😭','😦','😧','😨','😩',
      '🤯','😬','😰','😱','🥵','🥶','😳','🤪','😵','😡',
      '😠','🤬','😷','🤒','🤕','🤢','🤮','🤧','😇','🥳',
    ],
  },
  {
    label: 'Love',
    icon: '❤️',
    emojis: [
      '❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔',
      '❣️','💕','💞','💓','💗','💖','💘','💝','💟','☮️',
      '😍','🥰','😘','💋','💏','💑','👫','👬','👭','💒',
    ],
  },
  {
    label: 'Gestures',
    icon: '👋',
    emojis: [
      '👋','🤚','🖐️','✋','🖖','👌','🤌','🤏','✌️','🤞',
      '🤟','🤘','🤙','👈','👉','👆','🖕','👇','☝️','👍',
      '👎','✊','👊','🤛','🤜','👏','🙌','👐','🤲','🤝',
      '🙏','✍️','💅','🤳','💪','🦵','🦶','👂','👃','🦷',
    ],
  },
  {
    label: 'Activity',
    icon: '🎉',
    emojis: [
      '🎉','🎊','🎈','🎁','🎀','🎗️','🎟️','🎫','🏆','🥇',
      '🥈','🥉','⚽','🏀','🏈','⚾','🎾','🏐','🏉','🎱',
      '🏓','🏸','🥊','🎯','⛳','🎲','🎮','🕹️','🎰','🧩',
      '🎭','🎨','🖼️','🎬','🎤','🎧','🎼','🎹','🥁','🎷',
    ],
  },
  {
    label: 'Food',
    icon: '🍕',
    emojis: [
      '🍕','🍔','🍟','🌭','🌮','🌯','🥙','🍱','🍣','🍜',
      '🍝','🍛','🍲','🥘','🥗','🥪','🍿','🧂','🥓','🥩',
      '🍗','🍖','🌽','🥕','🥦','🧅','🍎','🍊','🍋','🍇',
      '🍓','🫐','🍒','🍑','🥭','🍍','🥥','🍆','🥑','🍦',
      '🍩','🍪','🎂','🍰','🧁','🍫','🍬','🍭','☕','🍵',
    ],
  },
  {
    label: 'Travel',
    icon: '✈️',
    emojis: [
      '✈️','🚀','🛸','🚂','🚗','🚕','🚙','🚌','🚎','🏎️',
      '🚓','🚑','🚒','🚐','🛻','🚚','🚛','🚜','🛵','🏍️',
      '🛺','🚲','🛴','🛹','🛼','🚁','🛶','⛵','🚤','🛥️',
      '🌍','🌎','🌏','🗺️','🧭','⛰️','🏔️','🏕️','🏖️','🏗️',
    ],
  },
  {
    label: 'Nature',
    icon: '🌸',
    emojis: [
      '🌸','🌺','🌻','🌹','🌷','🌼','💐','🍀','🌿','🌱',
      '🌲','🌳','🌴','🍁','🍂','🍃','🐾','🦋','🐝','🐛',
      '🐌','🐞','🐜','🦗','🕷️','🦂','🐢','🦎','🐍','🦕',
      '🦖','🦏','🐘','🦛','🦍','🦧','🐅','🐆','🦁','🐻',
    ],
  },
  {
    label: 'Symbols',
    icon: '💯',
    emojis: [
      '💯','✅','❌','❓','❗','💤','💢','💥','💦','💨',
      '🔥','⚡','🌈','☁️','⭐','🌟','💫','✨','🎵','🎶',
      '🔔','🔕','📢','📣','🔊','🔉','🔈','🔇','📱','💻',
      '⌨️','🖥️','🖨️','🖱️','💾','💿','📀','📷','📸','📹',
    ],
  },
];

const NUM_COLS = 8;

interface Props {
  onSelect: (emoji: string) => void;
}

export function ChatEmojiPicker({ onSelect }: Props) {
  const { colors } = useTheme();
  const [activeCategory, setActiveCategory] = useState(0);

  const emojis = useMemo(() => CATEGORIES[activeCategory].emojis, [activeCategory]);

  return (
    <View style={[styles.root, { backgroundColor: colors.backgroundElevated, borderTopColor: colors.border }]}>
      {/* Category tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.tabs, { borderBottomColor: colors.border }]}
        contentContainerStyle={styles.tabsContent}>
        {CATEGORIES.map((cat, i) => (
          <Pressable
            key={cat.label}
            onPress={() => setActiveCategory(i)}
            style={[
              styles.tab,
              activeCategory === i && { borderBottomColor: colors.accent, borderBottomWidth: 2 },
            ]}>
            <Text style={styles.tabIcon}>{cat.icon}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Emoji grid */}
      <FlatList
        data={emojis}
        keyExtractor={(e) => e}
        numColumns={NUM_COLS}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => onSelect(item)}
            style={({ pressed }) => [styles.emojiCell, pressed && { opacity: 0.6, transform: [{ scale: 0.85 }] }]}>
            <Text style={styles.emoji}>{item}</Text>
          </Pressable>
        )}
        showsVerticalScrollIndicator={false}
        style={styles.grid}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    height: 280,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  tabs: { maxHeight: 44 },
  tabsContent: { paddingHorizontal: 4, gap: 0 },
  tab: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIcon: { fontSize: 22 },
  grid: { flex: 1, paddingHorizontal: 4 },
  emojiCell: {
    flex: 1,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: `${100 / 8}%`,
  },
  emoji: { fontSize: 26 },
});
