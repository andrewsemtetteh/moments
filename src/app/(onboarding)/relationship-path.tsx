import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OnboardingChrome } from '@/components/onboarding/OnboardingChrome';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Spacing } from '@/constants/design-system';
import { useTheme } from '@/hooks/useTheme';
import {
  buildOnboardingRelationshipParams,
  paramsFromSearch,
  type OnboardingRelationshipParams,
} from '@/lib/onboarding-relationship-params';
import { goToOnboardingBack } from '@/lib/onboarding-navigation';

type PathOption = {
  id: 'create' | 'join';
  title: string;
  subtitle: string;
  icon: IconName;
};

const PATH_OPTIONS: PathOption[] = [
  {
    id: 'create',
    title: 'Start a new space',
    subtitle: 'Create your shared space and get a code to send your partner',
    icon: 'plus',
  },
  {
    id: 'join',
    title: 'I have an invite code',
    subtitle: 'Enter the 6-character code your partner shared with you',
    icon: 'key',
  },
];

export default function RelationshipPathScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const params = useLocalSearchParams<OnboardingRelationshipParams>();
  const parsed = paramsFromSearch(params);

  const choosePath = (path: 'create' | 'join') => {
    void Haptics.selectionAsync();
    const parsed = paramsFromSearch(params);
    const nextParams = buildOnboardingRelationshipParams({
      ...parsed,
      spacePathChosen: path,
    });

    router.push({
      pathname:
        path === 'create'
          ? '/(onboarding)/create-relationship'
          : '/(onboarding)/join-relationship',
      params: nextParams,
    });
  };

  const goBack = () => goToOnboardingBack(router, 'relationship-path', parsed);

  return (
    <OnboardingChrome stepId="relationship-path" onBack={goBack}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + Spacing.lg, paddingHorizontal: Spacing.lg },
        ]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <Text style={[styles.title, { color: colors.text }]}>How are you joining?</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Start fresh together, or enter the code your partner already shared.
          </Text>

          <View style={styles.options}>
            {PATH_OPTIONS.map((option, index) => (
              <View key={option.id} style={styles.optionBlock}>
                {index > 0 ? (
                  <Text style={[styles.or, { color: colors.textSecondary }]}>or</Text>
                ) : null}
                <Pressable
                  onPress={() => choosePath(option.id)}
                  style={({ pressed }) => [
                    styles.option,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      opacity: pressed ? 0.88 : 1,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={option.title}>
                  <View style={[styles.iconWrap, { backgroundColor: colors.accentSoft }]}>
                    <Icon name={option.icon} size={24} color={colors.accent} filled />
                  </View>
                  <View style={styles.optionCopy}>
                    <Text style={[styles.optionTitle, { color: colors.text }]}>{option.title}</Text>
                    <Text style={[styles.optionSubtitle, { color: colors.textSecondary }]}>
                      {option.subtitle}
                    </Text>
                  </View>
                  <Icon name="chevronRight" size={20} color={colors.textTertiary} />
                </Pressable>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </OnboardingChrome>
  );
}

const styles = StyleSheet.create({
  scrollContent: { flexGrow: 1, justifyContent: 'center' },
  content: { flex: 1, justifyContent: 'center', minHeight: 400, width: '100%' },
  title: { fontSize: 28, fontWeight: '800', textAlign: 'center', letterSpacing: -0.5 },
  subtitle: { fontSize: 16, textAlign: 'center', lineHeight: 22, marginTop: 10, maxWidth: 320, alignSelf: 'center' },
  options: { width: '100%', marginTop: 28, gap: 0 },
  optionBlock: { width: '100%' },
  or: {
    textAlign: 'center',
    fontSize: 15,
    fontStyle: 'italic',
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia' }),
    marginVertical: 14,
  },
  option: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderRadius: 18,
    borderWidth: 2,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionCopy: { flex: 1, gap: 4 },
  optionTitle: { fontSize: 17, fontWeight: '700' },
  optionSubtitle: { fontSize: 14, lineHeight: 20 },
});
