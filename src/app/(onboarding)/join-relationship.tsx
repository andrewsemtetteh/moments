import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PromptLink } from '@/components/ui/PromptLink';
import { PrimaryButton } from '@/components/ui/primitives';
import { useTheme } from '@/hooks/useTheme';
import { queryClient } from '@/providers/AppProviders';
import * as api from '@/services/api';
import { useAuthStore, useRelationshipStore } from '@/stores';

export default function JoinRelationshipScreen() {
  const router = useRouter();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const setRelationship = useRelationshipStore((s) => s.setRelationship);
  const setPartner = useRelationshipStore((s) => s.setPartner);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const fromProfile = from === 'profile';

  const join = async () => {
    if (!user || !code.trim()) return;
    setLoading(true);
    try {
      await api.joinRelationship(user.id, code.trim());
      const { relationship, partner } = await api.fetchRelationship(user.id);
      setRelationship(relationship);
      setPartner(partner);
      queryClient.clear();
      router.replace('/(onboarding)/welcome');
    } catch (e: unknown) {
      Alert.alert('Could not join', e instanceof Error ? e.message : 'Please check the code and try again.');
    } finally {
      setLoading(false);
    }
  };

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(tabs)/profile');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.text }]}>Join your partner</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {fromProfile
            ? 'Enter your partner\u2019s 6-character code. If you already created a space, your empty one will close when you join theirs.'
            : 'Enter the 6-character invite code they shared with you'}
        </Text>

        <TextInput
          style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
          placeholder="ABC123"
          placeholderTextColor={colors.textTertiary}
          value={code}
          onChangeText={(t) => setCode(t.toUpperCase())}
          autoCapitalize="characters"
          maxLength={6}
          autoFocus
        />

        <PrimaryButton
          label={loading ? 'Joining…' : 'Join Relationship'}
          onPress={join}
          loading={loading}
          disabled={code.length < 6}
          style={styles.btn}
        />

        {fromProfile ? (
          <PromptLink prompt="Changed your mind?" linkLabel="Back to Profile" onPress={goBack} />
        ) : (
          <PromptLink
            prompt="Starting fresh?"
            linkLabel="Create a relationship"
            href="/(onboarding)/create-relationship"
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, padding: 24, justifyContent: 'center', alignItems: 'center', width: '100%' },
  title: { fontSize: 28, fontWeight: '800', textAlign: 'center', letterSpacing: -0.5, width: '100%' },
  subtitle: { fontSize: 16, textAlign: 'center', lineHeight: 22, marginTop: 10, maxWidth: 320 },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 8,
    width: '100%',
    marginTop: 28,
  },
  btn: { width: '100%', marginTop: 20 },
});
