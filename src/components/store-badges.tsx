import Ionicons from '@expo/vector-icons/Ionicons';
import { type ComponentProps, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ExternalLink } from '@/components/external-link';

/** Google's actual Play Store mark (official path data), kept in its real brand colors, never tinted. */
function GooglePlayGlyph({ size = 24 }: { size?: number }) {
  const height = size * (31.99 / 28.99);

  return (
    <Svg width={size} height={height} viewBox="0 0 28.99 31.99">
      <Path
        d="M13.54 15.28.12 29.34a3.66 3.66 0 0 0 5.33 2.16l15.1-8.6Z"
        fill="#ea4335"
      />
      <Path
        d="m27.11 12.89-6.53-3.74-7.35 6.45 7.38 7.28 6.48-3.7a3.54 3.54 0 0 0 1.5-4.79 3.62 3.62 0 0 0-1.5-1.5z"
        fill="#fbbc04"
      />
      <Path
        d="M.12 2.66a3.57 3.57 0 0 0-.12.92v24.84a3.57 3.57 0 0 0 .12.92L14 15.64Z"
        fill="#4285f4"
      />
      <Path
        d="m13.64 16 6.94-6.85L5.5.51A3.73 3.73 0 0 0 3.63 0 3.64 3.64 0 0 0 .12 2.65Z"
        fill="#34a853"
      />
    </Svg>
  );
}

function StoreBadge({
  href,
  glyph,
  eyebrow,
  label,
}: {
  href: ComponentProps<typeof ExternalLink>['href'];
  glyph: ReactNode;
  eyebrow: string;
  label: string;
}) {
  const theme = useTheme();

  return (
    <ExternalLink href={href} asChild>
      <Pressable style={({ pressed }) => [pressed && styles.pressed]}>
        <View style={[styles.badge, { backgroundColor: theme.text }]}>
          {glyph}
          <View>
            <ThemedText type="small" style={{ color: theme.background, opacity: 0.72 }}>
              {eyebrow}
            </ThemedText>
            <ThemedText type="smallBold" style={{ color: theme.background, fontSize: 16 }}>
              {label}
            </ThemedText>
          </View>
        </View>
      </Pressable>
    </ExternalLink>
  );
}

export function StoreBadges({ style }: { style?: object }) {
  const theme = useTheme();

  return (
    <View style={[styles.row, style]}>
      <StoreBadge
        href="https://apps.apple.com"
        glyph={<Ionicons name="logo-apple" size={26} color={theme.background} />}
        eyebrow="Download on the"
        label="App Store"
      />
      <StoreBadge
        href="https://play.google.com/store"
        glyph={<GooglePlayGlyph size={24} />}
        eyebrow="Get it on"
        label="Google Play"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.85,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two + 2,
    paddingHorizontal: Spacing.four,
    borderRadius: Radius.md,
  },
});
