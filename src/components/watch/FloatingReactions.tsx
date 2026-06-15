import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

import type { WatchReaction } from '@/types/database';

interface FloatItem {
  key: string;
  emoji: string;
  anim: Animated.Value;
  x: number;
}

interface Props {
  reactions: WatchReaction[];
}

/**
 * Renders emoji that float up and fade out over the player, Rave/Teleparty
 * style. Each newly-arrived reaction (keyed by timestamp + user) animates once.
 */
export function FloatingReactions({ reactions }: Props) {
  const seen = useRef<Set<string>>(new Set());
  const [items, setItems] = useState<FloatItem[]>([]);

  useEffect(() => {
    const fresh = reactions.filter((r) => !seen.current.has(`${r.at}-${r.user_id}`));
    if (fresh.length === 0) return;

    const created: FloatItem[] = fresh.map((r) => {
      const key = `${r.at}-${r.user_id}`;
      seen.current.add(key);
      return { key, emoji: r.emoji, anim: new Animated.Value(0), x: 10 + Math.random() * 65 };
    });

    setItems((prev) => [...prev, ...created]);

    created.forEach((item) => {
      Animated.timing(item.anim, {
        toValue: 1,
        duration: 2600,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start(() => {
        setItems((prev) => prev.filter((p) => p.key !== item.key));
      });
    });
  }, [reactions]);

  return (
    <View pointerEvents="none" style={styles.layer}>
      {items.map((item) => {
        const translateY = item.anim.interpolate({ inputRange: [0, 1], outputRange: [0, -170] });
        const opacity = item.anim.interpolate({ inputRange: [0, 0.15, 0.75, 1], outputRange: [0, 1, 1, 0] });
        const scale = item.anim.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0.6, 1.15, 1] });
        return (
          <Animated.View
            key={item.key}
            style={[styles.emojiWrap, { right: `${item.x}%`, transform: [{ translateY }, { scale }], opacity }]}>
            <Text style={styles.emoji}>{item.emoji}</Text>
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'flex-end' },
  emojiWrap: { position: 'absolute', bottom: 12 },
  emoji: { fontSize: 34 },
});
