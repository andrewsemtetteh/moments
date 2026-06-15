import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/ui/Icon';
import { PrimaryButton } from '@/components/ui/primitives';
import { Radius } from '@/constants/design-system';
import {
  getTrialCtaLabel,
  getTrialPriceLine,
  PLUS_FEATURES,
  SUBSCRIPTION_PLANS,
  TRIAL_DAYS,
  TRIAL_STEPS,
  type SubscriptionPlanId,
} from '@/constants/subscription';
import { useTheme } from '@/hooks/useTheme';

type Props = {
  onClose?: () => void;
  showClose?: boolean;
  onSubscribe?: (planId: SubscriptionPlanId) => void | Promise<void>;
};

export function PaywallScreen({ onClose, showClose = true, onSubscribe }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlanId>('yearly');
  const [loading, setLoading] = useState(false);

  const selected = SUBSCRIPTION_PLANS.find((p) => p.id === selectedPlan)!;

  const handleSubscribe = async () => {
    setLoading(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      if (onSubscribe) {
        await onSubscribe(selectedPlan);
      } else {
        Alert.alert('Coming soon', 'Moments Plus will be available soon.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = () => {
    Alert.alert('Restore purchase', 'Nothing to restore yet. Purchases will be available once billing is connected.');
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}>
        <LinearGradient
          colors={colors.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.hero, { paddingTop: insets.top + 12 }]}>
          {showClose && onClose && (
            <Pressable
              onPress={onClose}
              accessibilityLabel="Close"
              hitSlop={8}
              style={[styles.closeBtn, { top: insets.top + 8, backgroundColor: 'rgba(255,255,255,0.22)' }]}>
              <Icon name="close" size={20} color="#fff" />
            </Pressable>
          )}

          <Text style={styles.heroEyebrow}>Closer, every day</Text>
          <Text style={styles.heroTitle}>Moments Plus</Text>
          <Text style={styles.heroTrial}>{TRIAL_DAYS}-day free trial included</Text>
          <Text style={styles.heroFeatures}>{PLUS_FEATURES}</Text>
          <Text style={styles.heroNote}>One subscription per relationship.</Text>
        </LinearGradient>

        <View style={[styles.timelineCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
          <Text style={[styles.timelineHeading, { color: colors.text }]}>How your free trial works</Text>
          {TRIAL_STEPS.map((step, index) => (
            <View key={step.day} style={styles.timelineRow}>
              <View style={styles.timelineRail}>
                <View style={[styles.timelineDot, { backgroundColor: colors.accent }]}>
                  <Icon name={step.icon} size={14} color={colors.onAccent} filled />
                </View>
                {index < TRIAL_STEPS.length - 1 && (
                  <View style={[styles.timelineLine, { backgroundColor: colors.accentSoft }]} />
                )}
              </View>
              <View style={styles.timelineCopy}>
                <Text style={[styles.timelineTitle, { color: colors.text }]}>{step.title}</Text>
                <Text style={[styles.timelineBody, { color: colors.textSecondary }]}>{step.body}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.plans}>
          {SUBSCRIPTION_PLANS.map((plan) => {
            const active = plan.id === selectedPlan;
            return (
              <Pressable
                key={plan.id}
                onPress={() => {
                  Haptics.selectionAsync();
                  setSelectedPlan(plan.id);
                }}
                style={[
                  styles.planCard,
                  {
                    backgroundColor: active ? colors.accentSoft : colors.surface,
                    borderColor: active ? colors.accent : colors.border,
                  },
                ]}>
                {plan.badge && (
                  <View style={[styles.planBadge, { backgroundColor: colors.accent }]}>
                    <Text style={[styles.planBadgeText, { color: colors.onAccent }]}>{plan.badge}</Text>
                  </View>
                )}
                <View style={[styles.planRadio, { borderColor: active ? colors.accent : colors.border }]}>
                  {active && <View style={[styles.planRadioFill, { backgroundColor: colors.accent }]} />}
                </View>
                <View style={styles.planCopy}>
                  <Text style={[styles.planLabel, { color: colors.text }]}>{plan.label}</Text>
                  <Text style={[styles.planSub, { color: colors.textSecondary }]}>{plan.sublabel}</Text>
                </View>
                <View style={styles.planPriceCol}>
                  <Text style={[styles.planTrialTag, { color: colors.accent }]}>{TRIAL_DAYS}-day free</Text>
                  {plan.compareAt && (
                    <Text style={[styles.planCompare, { color: colors.textTertiary }]}>{plan.compareAt}</Text>
                  )}
                  <Text style={[styles.planPrice, { color: colors.text }]}>
                    {plan.price}
                    <Text style={[styles.planPeriod, { color: colors.textSecondary }]}>{plan.period}</Text>
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.priceSummary, { color: colors.text }]}>
          {getTrialPriceLine(selectedPlan)}
        </Text>
        <Text style={[styles.priceNote, { color: colors.textSecondary }]}>
          {selected.label} plan · cancel anytime before day {TRIAL_DAYS + 1}
        </Text>

        <PrimaryButton
          label={loading ? 'Starting…' : getTrialCtaLabel()}
          onPress={handleSubscribe}
          loading={loading}
          style={styles.cta}
        />
        <Text style={[styles.cancelNote, { color: colors.textSecondary }]}>Cancel anytime</Text>

        <Pressable onPress={handleRestore} hitSlop={8} style={styles.restore}>
          <Text style={[styles.restoreText, { color: colors.textSecondary }]}>Restore purchase</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flexGrow: 1 },
  hero: {
    paddingHorizontal: 24,
    paddingBottom: 36,
    borderBottomLeftRadius: Radius.xl,
    borderBottomRightRadius: Radius.xl,
  },
  closeBtn: {
    position: 'absolute',
    right: 20,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  heroEyebrow: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
  },
  heroTitle: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.8,
    marginBottom: 8,
  },
  heroTrial: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 12,
  },
  heroFeatures: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 10,
  },
  heroNote: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 13,
    fontWeight: '600',
  },
  timelineCard: {
    marginHorizontal: 20,
    marginTop: -22,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
  timelineHeading: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 16,
  },
  timelineRow: {
    flexDirection: 'row',
    gap: 12,
    minHeight: 72,
  },
  timelineRail: {
    width: 28,
    alignItems: 'center',
  },
  timelineDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineLine: {
    width: 3,
    flex: 1,
    borderRadius: 2,
    marginVertical: 4,
  },
  timelineCopy: { flex: 1, paddingBottom: 14 },
  timelineTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  timelineBody: { fontSize: 14, lineHeight: 20 },
  plans: { paddingHorizontal: 20, marginTop: 20, gap: 12 },
  planCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderRadius: Radius.lg,
    padding: 16,
    gap: 12,
    position: 'relative',
    overflow: 'visible',
  },
  planBadge: {
    position: 'absolute',
    top: -10,
    right: 14,
    borderRadius: Radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  planBadgeText: { fontSize: 11, fontWeight: '800' },
  planRadio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planRadioFill: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  planCopy: { flex: 1 },
  planLabel: { fontSize: 17, fontWeight: '800' },
  planSub: { fontSize: 12, marginTop: 2 },
  planPriceCol: { alignItems: 'flex-end' },
  planTrialTag: { fontSize: 11, fontWeight: '800', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.4 },
  planCompare: {
    fontSize: 12,
    textDecorationLine: 'line-through',
    marginBottom: 2,
  },
  planPrice: { fontSize: 17, fontWeight: '800' },
  planPeriod: { fontSize: 13, fontWeight: '600' },
  priceSummary: {
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '800',
    marginTop: 22,
    paddingHorizontal: 24,
  },
  priceNote: {
    textAlign: 'center',
    fontSize: 13,
    marginTop: 6,
    paddingHorizontal: 24,
  },
  cta: { marginHorizontal: 20, marginTop: 18 },
  cancelNote: {
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 10,
  },
  restore: { alignItems: 'center', marginTop: 18 },
  restoreText: { fontSize: 15, fontWeight: '700' },
});
