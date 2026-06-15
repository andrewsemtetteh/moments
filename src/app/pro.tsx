import { Platform } from 'react-native';
import { Redirect, useRouter } from 'expo-router';

import { PaywallScreen } from '@/components/subscription/PaywallScreen';

export default function ProScreen() {
  const router = useRouter();

  if (Platform.OS === 'web') {
    return <Redirect href="/(tabs)/home" />;
  }

  return <PaywallScreen showClose onClose={() => router.back()} />;
}
