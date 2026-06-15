import * as Haptics from 'expo-haptics';
import { useMemo, useRef, useEffect } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MomentSquircle } from '@/components/moments/MomentSquircle';
import { Icon } from '@/components/ui/Icon';
import { useMoments } from '@/hooks/queries';
import {
  enrichMomentsWithAuthors,
  filterMediaMoments,
  getHistoryReactionBadge,
  groupMomentsForHistory,
} from '@/lib/moment-display';
import { useAuthStore, useRelationshipStore, useUIStore } from '@/stores';
import type { Moment } from '@/types/database';

const SCREEN_W = Dimensions.get('window').width;
const GRID_PAD = 12;
const GRID_GAP = 10;
const COLS = 3;
const TILE = Math.floor((SCREEN_W - GRID_PAD * 2 - GRID_GAP * (COLS - 1)) / COLS);

export function MomentHistoryModal() {
  const insets = useSafeAreaInsets();
  const visible = useUIStore((s) => s.showMomentHistory);
  const setVisible = useUIStore((s) => s.setShowMomentHistory);
  const setShowWrapped = useUIStore((s) => s.setShowWrapped);
  const setShowMomentCreator = useUIStore((s) => s.setShowMomentCreator);
  const openMomentViewer = useUIStore((s) => s.openMomentViewer);
  const setMomentHistoryScrollY = useUIStore((s) => s.setMomentHistoryScrollY);
  const savedScrollY = useUIStore((s) => s.momentHistoryScrollY);
  const scrollRef = useRef<ScrollView>(null);
  const scrollYRef = useRef(0);
  const user = useAuthStore((s) => s.user);
  const partner = useRelationshipStore((s) => s.partner);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useMoments();

  const allMoments = useMemo(() => {
    const real = filterMediaMoments(data?.pages.flat() ?? []);
    return enrichMomentsWithAuthors(real, user, partner);
  }, [data, user, partner]);

  const sections = useMemo(() => groupMomentsForHistory(allMoments), [allMoments]);

  useEffect(() => {
    if (!visible || savedScrollY <= 0) return;
    const t = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: savedScrollY, animated: false });
    }, 50);
    return () => clearTimeout(t);
  }, [visible, savedScrollY]);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollYRef.current = e.nativeEvent.contentOffset.y;
  };

  const close = () => setVisible(false);

  const openMoment = (moment: Moment, sectionMoments: Moment[], sectionLabel: string) => {
    const index = sectionMoments.findIndex((m) => m.id === moment.id);
    if (index < 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMomentHistoryScrollY(scrollYRef.current);
    setVisible(false);
    openMomentViewer(sectionMoments, index, {
      playback: 'focus',
      sectionLabel,
      returnToHistory: true,
    });
  };

  const openRecap = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    close();
    setShowWrapped(true);
  };

  const openCamera = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    close();
    setShowMomentCreator(true);
  };

  if (!visible) return null;

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={close}>
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable onPress={close} hitSlop={12} style={styles.headerIcon}>
            <Icon name="close" size={26} color="#fff" />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.title}>Your moments</Text>
            <Text style={styles.subtitle}>Only visible to you two</Text>
          </View>
          <Pressable onPress={openCamera} hitSlop={12} style={styles.headerIcon} accessibilityLabel="New moment">
            <Icon name="camera" size={24} color="#fff" />
          </Pressable>
        </View>

        {isLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator color="#fff" />
          </View>
        ) : allMoments.length === 0 ? (
          <View style={styles.centered}>
            <Icon name="camera" size={40} color="rgba(255,255,255,0.35)" />
            <Text style={styles.emptyTitle}>No moments yet</Text>
            <Text style={styles.emptySub}>Photos and videos you share will appear here.</Text>
          </View>
        ) : (
          <ScrollView
            ref={scrollRef}
            onScroll={onScroll}
            scrollEventThrottle={32}
            contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 88 }]}
            showsVerticalScrollIndicator={false}>
            {sections.map((section) => (
              <View key={section.key} style={styles.section}>
                <Text style={styles.sectionLabel}>{section.label}</Text>
                <View style={styles.grid}>
                  {section.moments.map((moment) => (
                    <View key={moment.id} style={styles.cell}>
                      <MomentSquircle
                        moment={moment}
                        size={TILE}
                        reactionBadge={getHistoryReactionBadge(moment, user?.id ?? '', partner?.id)}
                        onPress={() => openMoment(moment, section.moments, section.label)}
                      />
                    </View>
                  ))}
                </View>
              </View>
            ))}

            {hasNextPage && (
              <Pressable onPress={() => void fetchNextPage()} disabled={isFetchingNextPage} style={styles.loadMore}>
                {isFetchingNextPage ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.loadMoreText}>Load more</Text>
                )}
              </Pressable>
            )}
          </ScrollView>
        )}

        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]} pointerEvents="box-none">
          <Pressable onPress={openRecap} style={({ pressed }) => [styles.recapBtn, pressed && { opacity: 0.9 }]}>
            <View style={styles.recapIcon}>
              <Icon name="plus" size={16} color="#111" />
            </View>
            <Text style={styles.recapText}>Create recap</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 18,
    paddingTop: 8,
  },
  headerIcon: { width: 40, alignItems: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  title: { color: '#fff', fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  subtitle: { color: 'rgba(255,255,255,0.45)', fontSize: 13, fontWeight: '600', marginTop: 4 },
  scroll: { paddingHorizontal: GRID_PAD },
  section: { marginBottom: 28, overflow: 'visible' },
  sectionLabel: { color: '#fff', fontSize: 22, fontWeight: '800', marginBottom: 14, letterSpacing: -0.3 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -GRID_GAP / 2,
    overflow: 'visible',
  },
  cell: {
    width: `${100 / COLS}%`,
    paddingHorizontal: GRID_GAP / 2,
    paddingTop: 10,
    paddingRight: 6,
    marginBottom: GRID_GAP + 10,
    alignItems: 'center',
    overflow: 'visible',
  },
  loadMore: { alignItems: 'center', paddingVertical: 16 },
  loadMoreText: { color: 'rgba(255,255,255,0.55)', fontWeight: '700', fontSize: 14 },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    paddingTop: 8,
  },
  recapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 999,
  },
  recapIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recapText: { color: '#111', fontSize: 16, fontWeight: '800' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  emptyTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  emptySub: { color: 'rgba(255,255,255,0.5)', fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
