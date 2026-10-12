import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { useTheme } from '@/hooks/useTheme';
import { closeStackScreen } from '@/lib/router';

interface LegalScreenProps {
  title: string;
  children: string;
}

type LegalSection = { title: string; paragraphs: string[] };

/** Content is `Title\n\nParagraph.\n\nParagraph.\n\nNext Title\n\n...` — a block with no
 * terminal punctuation is a heading, everything else is a paragraph under it. */
function parseLegalContent(raw: string): LegalSection[] {
  const blocks = raw
    .split('\n\n')
    .map((block) => block.trim())
    .filter(Boolean);

  const sections: LegalSection[] = [];
  let current: LegalSection | null = null;

  for (const block of blocks) {
    const isHeading = !/[.!?]$/.test(block);
    if (isHeading) {
      current = { title: block, paragraphs: [] };
      sections.push(current);
    } else if (current) {
      current.paragraphs.push(block);
    } else {
      sections.push({ title: '', paragraphs: [block] });
    }
  }

  return sections;
}

export function LegalScreen({ title, children }: LegalScreenProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  // A real back: returns to wherever this was opened from (Settings, or the
  // sign-up screens) — it used to always jump to Home.
  const goBack = () => closeStackScreen(router);
  const sections = useMemo(() => parseLegalContent(children), [children]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScreenHeader title={title} onBack={goBack} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 16 }]}>
        {sections.map((section, i) => (
          <View key={i} style={styles.section}>
            {section.title ? (
              <Text style={[styles.sectionTitle, { color: colors.text }]}>{section.title}</Text>
            ) : null}
            {section.paragraphs.map((paragraph, j) => (
              <Text
                key={j}
                style={[
                  styles.paragraph,
                  { color: colors.text },
                  j === 0 && styles.firstParagraph,
                ]}>
                {paragraph}
              </Text>
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 8 },
  section: { marginBottom: 22 },
  sectionTitle: { fontSize: 17, fontWeight: '800', marginBottom: 4, letterSpacing: -0.2 },
  paragraph: { fontSize: 15, lineHeight: 24, marginTop: 10 },
  firstParagraph: { marginTop: 0 },
});
