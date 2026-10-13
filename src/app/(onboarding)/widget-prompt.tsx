import { format } from 'date-fns';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';

import { StreakFlame } from '@/components/home/StreakFlame';
import { OnboardingStepScreen } from '@/components/onboarding/OnboardingStepScreen';
import { Icon, type IconName } from '@/components/ui/Icon';
import { MOOD_EMOJI } from '@/constants/design-system';
import { useTheme } from '@/hooks/useTheme';
import { goNext } from '@/lib/onboarding-v2';
import { markWidgetPromptDone, saveWidgetPreferences } from '@/lib/onboarding-storage';
import { useAuthStore } from '@/stores';

/*
 * Inspired by the best widget apps:
 * - Locket: their latest photo, full bleed, with tap to reply.
 * - Widgetable: mood bubbles for both of you, distance on the Lock Screen.
 * - Long-distance apps (Long Goodbye): both clocks side by side, asleep/awake.
 * - Couple Widgets / Couple+: days together and a countdown, big and simple.
 * - Apple's guidelines: one idea per widget, real Small/Medium sizes, and
 *   Lock Screen widgets (circular, rectangular, inline) as their own set.
 */

const INK = '#1A1A1A';
const GAP = 12;
const SEG_H = 40;
const DOTS_H = 30;

type Size = 'S' | 'M';
type HomeItem = { key: string; name: string; size: Size };

/** Home Screen pages, like swiping between iPhone pages. Each fills 2x2 small slots. */
const PAGES: { title: string; items: HomeItem[] }[] = [
  {
    title: 'Close, wherever you are',
    items: [
      { key: 'time', name: 'Both your times', size: 'M' },
      { key: 'streak', name: 'Streak', size: 'S' },
      { key: 'nextup', name: 'Next plan', size: 'S' },
    ],
  },
  {
    title: 'Your story',
    items: [
      { key: 'question', name: 'Today’s question', size: 'M' },
      { key: 'memory', name: 'On this day', size: 'S' },
      { key: 'countdown', name: 'Anniversary countdown', size: 'S' },
    ],
  },
  {
    title: 'Each other',
    items: [
      { key: 'moment', name: 'Their latest moment', size: 'S' },
      { key: 'mood', name: 'How you both feel', size: 'S' },
      { key: 'days', name: 'Days together', size: 'M' },
    ],
  },
];

/** Home Screen pages move on by themselves this often (until you swipe). */
const AUTO_SLIDE_MS = 5000;

const LOCK_KEYS = ['lock-countdown', 'lock-streak', 'lock-days', 'lock-distance', 'lock-mood'];

/** A clock that ticks every few seconds, like the real widget. */
function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

/** Stand-in for a real photo: a little sunset (no stock photos in the app). */
function PhotoScene({ variant }: { variant: 'sunset' | 'dusk' }) {
  const sky: [string, string, string] = variant === 'sunset' ? ['#FF9A8B', '#FF6A88', '#FFC371'] : ['#2E1A47', '#7B4397', '#DC6B8A'];
  return (
    <View style={StyleSheet.absoluteFill}>
      <LinearGradient colors={sky} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
      <View style={[styles.sun, { backgroundColor: variant === 'sunset' ? '#FFE29A' : '#FFD1DC' }]} />
      <View style={[styles.hill, styles.hillBack, { backgroundColor: variant === 'sunset' ? '#B5485F' : '#3B2152' }]} />
      <View style={[styles.hill, styles.hillFront, { backgroundColor: variant === 'sunset' ? '#7A2E4A' : '#1E1030' }]} />
    </View>
  );
}

function Avatar({ letter, bg, size = 22 }: { letter: string; bg: string; size?: number }) {
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }]}>
      <Text style={[styles.avatarText, { fontSize: size * 0.48 }]}>{letter}</Text>
    </View>
  );
}

/** What each Home Screen widget actually shows. */
function HomeFace({ k, now }: { k: string; now: Date }) {
  switch (k) {
    case 'moment':
      return (
        <View style={styles.fill}>
          <PhotoScene variant="sunset" />
          <View style={styles.photoInner}>
            <View style={styles.glassPill}>
              <Avatar letter="A" bg="#FFFFFF" size={18} />
              <Text style={styles.glassText}>Alex · 12m</Text>
            </View>
            <View style={styles.photoBottom}>
              <Text style={styles.photoCaption} numberOfLines={1}>
                Sunset walk 🌅
              </Text>
              <View style={styles.replyPill}>
                <Icon name="camera" size={12} color={INK} />
                <Text style={styles.replyText}>Reply</Text>
              </View>
            </View>
          </View>
        </View>
      );
    case 'mood':
      return (
        <View style={[styles.face, { backgroundColor: '#D7F2E3' }]}>
          <Text style={styles.kicker}>Right now</Text>
          <View style={styles.bubbles}>
            <View style={[styles.bubble, styles.bubbleBig]}>
              <Text style={styles.bubbleEmojiBig}>{MOOD_EMOJI.loved}</Text>
            </View>
            <View style={[styles.bubble, styles.bubbleSmall]}>
              <Text style={styles.bubbleEmojiSmall}>{MOOD_EMOJI.happy}</Text>
            </View>
          </View>
          <Text style={styles.bodyStrong} numberOfLines={1}>
            Alex feels loved
          </Text>
        </View>
      );
    case 'days':
      return (
        <View style={[styles.face, styles.row, { backgroundColor: '#E3DDFF' }]}>
          <View style={styles.flex}>
            <Text style={styles.kicker}>Together for</Text>
            <Text style={styles.huge} numberOfLines={1} adjustsFontSizeToFit>
              587 days
            </Text>
            <Text style={styles.muted}>since 3 March 2024</Text>
          </View>
          <View style={styles.pair}>
            <Avatar letter="Y" bg="#FFB4A2" size={40} />
            <View style={styles.pairHeart}>
              <Icon name="heart" size={14} color="#FF5A6E" filled />
            </View>
            <Avatar letter="A" bg="#B9A7FF" size={40} />
          </View>
        </View>
      );
    case 'time': {
      const theirs = new Date(now.getTime() + 8 * 3600_000);
      const asleep = theirs.getHours() < 7 || theirs.getHours() >= 23;
      return (
        <View style={[styles.face, styles.row, { backgroundColor: '#DCEBFF' }]}>
          <View style={styles.clock}>
            <Text style={styles.kicker}>You · London</Text>
            <Text style={styles.big}>{format(now, 'HH:mm')}</Text>
            <Text style={styles.muted}>Evening</Text>
          </View>
          <View style={styles.between}>
            <View style={styles.dash} />
            <Icon name="airplane" size={16} color={INK} />
            <Text style={styles.km}>9,560 km</Text>
            <View style={styles.dash} />
          </View>
          <View style={[styles.clock, styles.clockRight]}>
            <Text style={styles.kicker}>Alex · Tokyo</Text>
            <Text style={styles.big}>{format(theirs, 'HH:mm')}</Text>
            <View style={styles.inline}>
              <Icon name={asleep ? 'moon' : 'sunny'} size={12} color={INK} />
              <Text style={styles.muted}>{asleep ? 'Asleep' : 'Awake'}</Text>
            </View>
          </View>
        </View>
      );
    }
    case 'streak':
      return (
        <View style={[styles.face, { backgroundColor: '#FFF1D6' }]}>
          <View style={styles.inline}>
            <StreakFlame size={26} tone="active" effect="flicker" />
            <Text style={styles.big}>42</Text>
          </View>
          <Text style={styles.bodyStrong}>day streak</Text>
          <View style={styles.week}>
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
              <View key={i} style={[styles.weekDot, { backgroundColor: i < 5 ? '#FF7A1A' : 'rgba(26,26,26,0.12)' }]}>
                <Text style={[styles.weekText, { color: i < 5 ? '#FFFFFF' : INK }]}>{d}</Text>
              </View>
            ))}
          </View>
        </View>
      );
    case 'nextup':
      return (
        <View style={[styles.face, { backgroundColor: '#FFFFFF' }]}>
          <View style={styles.calBlock}>
            <View style={styles.calHead}>
              <Text style={styles.calHeadText}>FRI</Text>
            </View>
            <Text style={styles.calDay}>14</Text>
          </View>
          <View>
            <Text style={styles.bodyStrong} numberOfLines={1}>
              Dinner date
            </Text>
            <Text style={styles.muted}>8:00 pm · Nando’s</Text>
          </View>
        </View>
      );
    case 'question':
      return (
        <View style={[styles.face, { backgroundColor: '#FFD6DC' }]}>
          <Text style={styles.kicker}>Today’s question</Text>
          <Text style={styles.question} numberOfLines={2}>
            What’s a small thing I do that makes your day?
          </Text>
          <View style={styles.row}>
            <View style={styles.answered}>
              <Avatar letter="A" bg="#B9A7FF" size={20} />
              <Text style={styles.muted}>Alex answered</Text>
            </View>
            <View style={styles.answerBtn}>
              <Text style={styles.answerText}>Answer</Text>
            </View>
          </View>
        </View>
      );
    case 'memory':
      return (
        <View style={styles.fill}>
          <PhotoScene variant="dusk" />
          <View style={styles.photoInner}>
            <View style={styles.glassPill}>
              <Icon name="time" size={12} color="#FFFFFF" />
              <Text style={styles.glassText}>On this day</Text>
            </View>
            <View>
              <Text style={styles.photoCaption}>Our first trip</Text>
              <Text style={styles.photoSub}>1 year ago</Text>
            </View>
          </View>
        </View>
      );
    default:
      // countdown
      return (
        <View style={[styles.face, { backgroundColor: '#FFE7A0' }]}>
          <Text style={styles.kicker}>Anniversary</Text>
          <View>
            <Text style={styles.big}>143</Text>
            <Text style={styles.bodyStrong}>days to go</Text>
          </View>
          <View style={styles.track}>
            <View style={[styles.trackFill, { width: '61%' }]} />
          </View>
        </View>
      );
  }
}

/** The corner + that turns into a tick when added (no animation). */
function AddButton({ added, small }: { added: boolean; small?: boolean }) {
  const s = small ? 20 : 26;
  return (
    <View style={[styles.add, small && styles.addSmall, { width: s, height: s, borderRadius: s / 2, backgroundColor: added ? INK : '#FFFFFF' }]}>
      <Icon name={added ? 'check' : 'plus'} size={small ? 11 : 14} color={added ? '#FFFFFF' : INK} />
    </View>
  );
}

/** A tappable widget slot (Home or Lock Screen) with its add button. */
function Slot({
  on,
  name,
  onPress,
  style,
  lock,
  children,
}: {
  on: boolean;
  name: string;
  onPress: () => void;
  style: object;
  lock?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on }}
      accessibilityLabel={`${name} widget`}
      style={({ pressed }) => [
        lock ? styles.lockSlot : styles.slot,
        style,
        !lock && { borderColor: on ? INK : 'rgba(26,26,26,0.18)' },
        { opacity: on ? 1 : lock ? 0.55 : 0.62 },
        pressed && styles.pressed,
      ]}>
      {children}
      <AddButton added={on} small={lock} />
    </Pressable>
  );
}

/** The Lock Screen set: inline, circular and rectangular, like iOS. */
function LockScreen({
  now,
  height,
  picked,
  toggle,
}: {
  now: Date;
  height: number;
  picked: string[];
  toggle: (k: string) => void;
}) {
  const circ: { key: string; name: string; icon?: IconName; value: string; label: string; ring: number }[] = [
    { key: 'lock-streak', name: 'Streak ring', value: '42', label: 'streak', ring: 0.7 },
    { key: 'lock-days', name: 'Days together', icon: 'heart', value: '587', label: 'days', ring: 1 },
    { key: 'lock-distance', name: 'Distance', icon: 'location', value: '9.5k', label: 'km', ring: 0.35 },
  ];
  return (
    <View style={[styles.lockPhone, { height }]}>
      <LinearGradient colors={['#1F1B3A', '#5B2A6E', '#E07A8A']} start={{ x: 0, y: 0 }} end={{ x: 0.6, y: 1 }} style={StyleSheet.absoluteFill} />
      <Slot on={picked.includes('lock-countdown')} name="Anniversary countdown" onPress={() => toggle('lock-countdown')} style={styles.inlineSlot} lock>
        <View style={styles.inline}>
          <Icon name="heart" size={12} color="#FFFFFF" filled />
          <Text style={styles.lockInline}>143 days to our anniversary</Text>
        </View>
      </Slot>
      <Text style={styles.lockDate}>{format(now, 'EEEE d MMMM')}</Text>
      <Text style={styles.lockTime} numberOfLines={1} adjustsFontSizeToFit>
        {format(now, 'HH:mm')}
      </Text>
      <View style={styles.lockRow}>
        {circ.map((c) => (
          <Slot key={c.key} on={picked.includes(c.key)} name={c.name} onPress={() => toggle(c.key)} style={styles.circSlot} lock>
            <View style={styles.circ}>
              {/* A gauge ring, like the system's circular widgets. */}
              <View style={[styles.ring, { borderColor: 'rgba(255,255,255,0.25)' }]} />
              <View
                style={[
                  styles.ring,
                  {
                    borderTopColor: '#FFFFFF',
                    borderRightColor: c.ring > 0.25 ? '#FFFFFF' : 'transparent',
                    borderBottomColor: c.ring > 0.5 ? '#FFFFFF' : 'transparent',
                    borderLeftColor: c.ring > 0.75 ? '#FFFFFF' : 'transparent',
                    transform: [{ rotate: '45deg' }],
                  },
                ]}
              />
              {c.icon ? (
                <Icon name={c.icon} size={11} color="#FFFFFF" filled />
              ) : (
                <StreakFlame size={12} tone="active" effect="none" />
              )}
              <Text style={styles.circValue}>{c.value}</Text>
            </View>
          </Slot>
        ))}
        <Slot on={picked.includes('lock-mood')} name="Their mood" onPress={() => toggle('lock-mood')} style={styles.rectSlot} lock>
          <View style={styles.rect}>
            <Text style={styles.rectEmoji}>{MOOD_EMOJI.loved}</Text>
            <View style={styles.flex}>
              <Text style={styles.rectTitle} numberOfLines={1}>
                Alex
              </Text>
              <Text style={styles.rectSub} numberOfLines={1}>
                Loved · 2h ago
              </Text>
            </View>
          </View>
        </Slot>
      </View>
    </View>
  );
}

/** Step 7: build your home screen, iPhone style; then how to add them. */
export default function WidgetPromptScreen() {
  const router = useRouter();
  const preview = useLocalSearchParams<{ preview?: string }>().preview === '1';
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const now = useNow();
  const [picked, setPicked] = useState<string[]>(['moment', 'days', 'streak', 'lock-days']);
  const [showHow, setShowHow] = useState(false);
  const [screen, setScreen] = useState<'home' | 'lock'>('home');
  const [page, setPage] = useState(0);
  const [box, setBox] = useState({ width: 0, height: 0 });

  // Full page width, so the widgets line up with the tabs and buttons around them.
  // Short screens trim the height instead of narrowing the grid.
  const area = Math.max(0, box.height - SEG_H - GAP - DOTS_H);
  const gridW = box.width;
  const small = box.width ? (box.width - GAP) / 2 : 0;
  const slotH = Math.min(small, (area - GAP) / 2);

  // Auto slide: next page every few seconds, looping. A swipe restarts the wait,
  // and nothing moves while a finger is on it.
  const pager = useRef<ScrollView>(null);
  const touching = useRef(false);
  const goToPage = (i: number) => {
    pager.current?.scrollTo({ x: i * box.width, animated: true });
    setPage(i);
  };
  useEffect(() => {
    if (screen !== 'home' || !box.width) return;
    const id = setTimeout(() => {
      if (touching.current) return;
      const next = (page + 1) % PAGES.length;
      pager.current?.scrollTo({ x: next * box.width, animated: true });
      setPage(next);
    }, AUTO_SLIDE_MS);
    return () => clearTimeout(id);
  }, [page, screen, box.width]);

  const toggle = (key: string) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPicked((p) => (p.includes(key) ? p.filter((k) => k !== key) : [...p, key]));
  };

  // Their picks are saved straight away, so the Moments widgets show exactly
  // these when added (iPhone doesn't let apps place widgets themselves).
  useEffect(() => {
    if (!preview) void saveWidgetPreferences(picked);
  }, [picked, preview]);

  const finish = async () => {
    if (user && !preview) await markWidgetPromptDone(user.id);
    await goNext(router, 'widget-prompt', { userId: user?.id, preview });
  };

  if (showHow) {
    const hasLock = picked.some((k) => LOCK_KEYS.includes(k));
    const hasHome = picked.some((k) => !LOCK_KEYS.includes(k));
    const steps: { icon: IconName; text: string }[] = [
      ...(hasHome
        ? [
            { icon: 'home' as IconName, text: 'Home Screen: touch and hold an empty spot until the apps jiggle, then tap Edit, Add Widget.' },
            { icon: 'search' as IconName, text: 'Search “Moments”. Your picks are ready there; tap Add Widget.' },
          ]
        : []),
      ...(hasLock
        ? [{ icon: 'lock' as IconName, text: 'Lock Screen: touch and hold it, tap Customize, then tap the space under the time and pick Moments.' }]
        : []),
    ];
    return (
      <OnboardingStepScreen
        step="widget-prompt"
        title="Adding them takes ten seconds"
        subtitle={`Your ${picked.length} widget${picked.length === 1 ? ' is' : 's are'} set up. Here’s how to put them on your phone:`}
        primaryLabel="Got it"
        onPrimary={() => void finish()}
        onBack={() => setShowHow(false)}>
        {steps.map((s, i) => (
          <Animated.View
            key={s.text}
            entering={FadeInUp.delay(100 + i * 110).duration(380)}
            style={[styles.step, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: colors.boldBorder ? 2 : 0 }]}>
            <View style={[styles.stepNum, { backgroundColor: colors.accent }]}>
              <Icon name={s.icon} size={16} color={colors.onAccent} />
            </View>
            <Text style={[styles.stepText, { color: colors.text }]}>{s.text}</Text>
          </Animated.View>
        ))}
      </OnboardingStepScreen>
    );
  }

  return (
    <OnboardingStepScreen
      step="widget-prompt"
      title="Build your home screen"
      subtitle="Swipe through and tap + on the ones you want. They’re ready for you right away."
      primaryLabel={picked.length ? `Show me how (${picked.length})` : 'Continue'}
      onPrimary={() => (picked.length ? setShowHow(true) : void finish())}
      secondaryLabel="Maybe later"
      onSecondary={() => void goNext(router, 'widget-prompt', { userId: user?.id, preview })}
      fill>
      <View style={styles.flex} onLayout={(e) => setBox({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}>
        <View style={[styles.seg, { backgroundColor: colors.boldBorder ? colors.backgroundElevated : colors.surfaceElevated }]}>
          {(['home', 'lock'] as const).map((s) => {
            const on = screen === s;
            return (
              <Pressable
                key={s}
                onPress={() => {
                  void Haptics.selectionAsync();
                  setScreen(s);
                }}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                style={[styles.segBtn, on && { backgroundColor: colors.text }]}>
                <Text style={[styles.segText, { color: on ? colors.background : colors.textSecondary }]}>
                  {s === 'home' ? 'Home Screen' : 'Lock Screen'}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {small > 0 && screen === 'home' ? (
          <Animated.View key="home" entering={FadeIn.duration(200)}>
            <ScrollView
              ref={pager}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onScrollBeginDrag={() => {
                touching.current = true;
              }}
              onScrollEndDrag={() => {
                touching.current = false;
              }}
              onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / box.width))}>
              {PAGES.map((p, pi) => (
                <View key={p.title} style={[styles.page, { width: box.width, height: area }]}>
                  <View style={[styles.grid, { width: gridW }]}>
                    {p.items.map((it, i) => {
                      const w = it.size === 'M' ? gridW : small;
                      return (
                        <Animated.View key={it.key} entering={FadeInUp.delay(pi === 0 ? 80 + i * 80 : 0).duration(360)}>
                          <Slot on={picked.includes(it.key)} name={it.name} onPress={() => toggle(it.key)} style={{ width: w, height: slotH }}>
                            <HomeFace k={it.key} now={now} />
                          </Slot>
                        </Animated.View>
                      );
                    })}
                  </View>
                </View>
              ))}
            </ScrollView>
            {/* Page indicator, just above the buttons: the current page is a long pill. Tap to jump. */}
            <View style={styles.dotsRow}>
              {PAGES.map((p, i) => (
                <Pressable
                  key={p.title}
                  onPress={() => {
                    void Haptics.selectionAsync();
                    goToPage(i);
                  }}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`${p.title}, page ${i + 1} of ${PAGES.length}`}
                  accessibilityState={{ selected: i === page }}>
                  <View
                    style={[
                      styles.dot,
                      i === page && styles.dotOn,
                      { backgroundColor: i === page ? colors.text : colors.borderStrong },
                    ]}
                  />
                </Pressable>
              ))}
              <Text style={[styles.pageTitle, { color: colors.textSecondary }]} numberOfLines={1}>
                {PAGES[page]?.title}
              </Text>
            </View>
          </Animated.View>
        ) : null}

        {small > 0 && screen === 'lock' ? (
          <Animated.View key="lock" entering={FadeIn.duration(200)} style={styles.lockWrap}>
            <LockScreen now={now} height={area + DOTS_H} picked={picked} toggle={toggle} />
          </Animated.View>
        ) : null}
      </View>
    </OnboardingStepScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  fill: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pressed: { transform: [{ scale: 0.96 }] },

  seg: { height: SEG_H, borderRadius: SEG_H / 2, flexDirection: 'row', padding: 4, marginBottom: GAP },
  segBtn: { flex: 1, borderRadius: (SEG_H - 8) / 2, alignItems: 'center', justifyContent: 'center' },
  segText: { fontSize: 14, fontWeight: '800' },

  page: { alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  dotsRow: { height: DOTS_H, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotOn: { width: 22 },
  pageTitle: { fontSize: 12, fontWeight: '800', marginLeft: 6, maxWidth: '60%' },

  slot: { borderRadius: 24, borderWidth: 2, overflow: 'hidden' },
  face: { flex: 1, padding: 12, justifyContent: 'space-between' },
  kicker: { fontSize: 11, fontWeight: '800', color: INK, opacity: 0.7 },
  muted: { fontSize: 11, fontWeight: '700', color: INK, opacity: 0.65 },
  bodyStrong: { fontSize: 13, fontWeight: '900', color: INK },
  big: { fontSize: 26, fontWeight: '900', color: INK, letterSpacing: -0.6 },
  huge: { fontSize: 32, fontWeight: '900', color: INK, letterSpacing: -1 },
  question: { fontSize: 15, fontWeight: '900', color: INK, lineHeight: 19 },

  avatar: { alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: INK },
  avatarText: { fontWeight: '900', color: INK },

  sun: { position: 'absolute', width: '42%', aspectRatio: 1, borderRadius: 999, left: '30%', top: '30%' },
  hill: { position: 'absolute', borderTopLeftRadius: 999, borderTopRightRadius: 999 },
  hillBack: { left: '-20%', right: '30%', bottom: '-35%', height: '75%' },
  hillFront: { left: '25%', right: '-25%', bottom: '-45%', height: '75%' },
  photoInner: { flex: 1, padding: 10, justifyContent: 'space-between' },
  glassPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingLeft: 3,
    paddingRight: 8,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.32)',
  },
  glassText: { fontSize: 11, fontWeight: '800', color: '#FFFFFF' },
  photoBottom: { gap: 6 },
  photoCaption: { fontSize: 13, fontWeight: '900', color: '#FFFFFF' },
  photoSub: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.85)' },
  replyPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 24,
    paddingHorizontal: 9,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  replyText: { fontSize: 11, fontWeight: '900', color: INK },

  bubbles: { height: 54, justifyContent: 'center' },
  bubble: { position: 'absolute', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: INK, backgroundColor: '#FFFFFF' },
  bubbleBig: { width: 52, height: 52, borderRadius: 26, left: 0 },
  bubbleSmall: { width: 36, height: 36, borderRadius: 18, left: 42, top: 16 },
  bubbleEmojiBig: { fontSize: 28 },
  bubbleEmojiSmall: { fontSize: 18 },

  pair: { flexDirection: 'row', alignItems: 'center' },
  pairHeart: {
    width: 26,
    height: 26,
    borderRadius: 13,
    marginHorizontal: -8,
    zIndex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: INK,
    alignItems: 'center',
    justifyContent: 'center',
  },

  clock: { gap: 2 },
  clockRight: { alignItems: 'flex-end' },
  between: { flex: 1, alignItems: 'center', gap: 3, paddingHorizontal: 6 },
  dash: { width: 1, height: 10, backgroundColor: 'rgba(26,26,26,0.3)' },
  km: { fontSize: 11, fontWeight: '900', color: INK },

  week: { flexDirection: 'row', justifyContent: 'space-between' },
  weekDot: { width: 15, height: 15, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  weekText: { fontSize: 8, fontWeight: '900' },

  calBlock: { width: 46, borderRadius: 10, borderWidth: 2, borderColor: INK, overflow: 'hidden', alignItems: 'center' },
  calHead: { alignSelf: 'stretch', backgroundColor: '#FF5A6E', alignItems: 'center', paddingVertical: 2 },
  calHeadText: { fontSize: 10, fontWeight: '900', color: '#FFFFFF' },
  calDay: { fontSize: 20, fontWeight: '900', color: INK, paddingVertical: 1 },

  answered: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  answerBtn: { height: 28, paddingHorizontal: 14, borderRadius: 14, backgroundColor: INK, justifyContent: 'center' },
  answerText: { fontSize: 12, fontWeight: '900', color: '#FFFFFF' },

  track: { height: 8, borderRadius: 4, backgroundColor: 'rgba(26,26,26,0.12)', overflow: 'hidden' },
  trackFill: { height: '100%', borderRadius: 4, backgroundColor: INK },

  add: {
    position: 'absolute',
    top: 8,
    right: 8,
    borderWidth: 2,
    borderColor: INK,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addSmall: { top: -6, right: -6, borderWidth: 1.5 },

  lockWrap: { flex: 1 },
  lockPhone: { borderRadius: 30, borderWidth: 2, borderColor: INK, overflow: 'hidden', alignItems: 'center', paddingTop: 18 },
  lockSlot: { borderRadius: 16 },
  inlineSlot: { paddingHorizontal: 10, paddingVertical: 4 },
  lockInline: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  lockDate: { fontSize: 15, fontWeight: '700', color: 'rgba(255,255,255,0.9)', marginTop: 2 },
  lockTime: { fontSize: 76, fontWeight: '800', color: '#FFFFFF', letterSpacing: -2, lineHeight: 84 },
  lockRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10, marginTop: 10, paddingHorizontal: 12 },
  circSlot: { width: 60, height: 60, borderRadius: 30 },
  circ: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 30, backgroundColor: 'rgba(255,255,255,0.16)' },
  ring: { position: 'absolute', top: 4, left: 4, right: 4, bottom: 4, borderRadius: 30, borderWidth: 3, borderColor: 'transparent' },
  circValue: { fontSize: 13, fontWeight: '900', color: '#FFFFFF' },
  rectSlot: { width: 200, height: 60 },
  rect: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  rectEmoji: { fontSize: 26 },
  rectTitle: { fontSize: 14, fontWeight: '900', color: '#FFFFFF' },
  rectSub: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.85)' },

  step: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 18, padding: 14 },
  stepNum: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  stepText: { flex: 1, fontSize: 15, fontWeight: '700', lineHeight: 21 },
});
