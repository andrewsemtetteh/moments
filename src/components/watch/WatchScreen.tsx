import { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SwipeDismissView } from '@/components/layout/SwipeDismissView';
import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/hooks/useTheme';

/** Shared chrome (header + scroll body) for every Watch Together screen. */
export function WatchScreen({
  title,
  onClose,
  onBack,
  right,
  children,
  scroll = true,
  contentStyle,
}: {
  title: string;
  onClose: () => void;
  onBack?: () => void;
  right?: ReactNode;
  children: ReactNode;
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const dismiss = onBack ?? onClose;

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <SwipeDismissView edge="start" onDismiss={dismiss}>
      <View style={styles.header}>
        {onBack ? (
          <Pressable onPress={onBack} hitSlop={8} style={styles.headerBtn}>
            <Icon name="chevronLeft" size={26} color={colors.textSecondary} />
          </Pressable>
        ) : (
          <Pressable onPress={onClose} hitSlop={8} style={styles.headerBtn}>
            <Icon name="close" size={24} color={colors.textSecondary} />
          </Pressable>
        )}
        <View style={styles.headerCenter}>
          <Icon name="film" size={18} color={colors.accent} />
          <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
            {title}
          </Text>
        </View>
        <View style={styles.headerRight}>{right ?? <View style={{ width: 28 }} />}</View>
      </View>

      {scroll ? (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[styles.content, contentStyle]}
          showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.content, { flex: 1 }, contentStyle]}>{children}</View>
      )}
      </SwipeDismissView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  headerBtn: { minWidth: 40 },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800' },
  headerRight: { minWidth: 40, alignItems: 'flex-end' },
  content: { padding: 16, paddingBottom: 40, gap: 18 },
});
