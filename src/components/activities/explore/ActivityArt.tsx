import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { useTheme } from '@/hooks/useTheme';

export type ActivityArtId =
  | 'loveQuiz'
  | 'thisOrThat'
  | 'wouldYouRather'
  | 'whosLikely'
  | 'guessAnswer'
  | 'cards'
  | 'truthDare'
  | 'neverHaveI'
  | 'emojiStory'
  | 'finishSentence'
  | 'appreciation'
  | 'thirtySix'
  | 'challenge'
  | 'dateNight'
  | 'memory'
  | 'compatibility'
  | 'personality'
  | 'attachment'
  | 'dateGenerator'
  | 'bucket'
  | 'wheel'
  | 'draw'
  | 'playlist'
  | 'trivia'
  | 'quizLive'
  | 'goals'
  | 'gratitude'
  | 'compliment';

type Props = {
  id: ActivityArtId;
  size?: number;
  /** Override theme accent so cards can use unique tones. */
  accent?: string;
  soft?: string;
};

/** Minimal theme-aware SVG art for Play — geometric, not emoji/3D stock. */
export function ActivityArt({ id, size = 88, accent, soft }: Props) {
  const { colors } = useTheme();
  const a = accent ?? colors.accent;
  const softFill = soft ?? colors.accentSoft;
  const surface = colors.surface;
  const on = '#FFFFFF';

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Svg width={size} height={size} viewBox="0 0 88 88">
        {(id === 'loveQuiz' || id === 'compatibility' || id === 'personality' || id === 'attachment') && (
          <>
            <Path
              d="M44 68C28 56 18 47 18 35c0-8 6-14 13.5-14 4.5 0 8 2.5 10.5 6.5C44.5 23.5 48 21 52.5 21 60 21 66 27 66 35c0 12-10 21-22 33Z"
              fill={a}
            />
            <Circle cx="44" cy="40" r="10" fill={surface} />
            <Path d="M44 34v8M40 42h8" stroke={a} strokeWidth="2.5" strokeLinecap="round" />
          </>
        )}

        {(id === 'thisOrThat' || id === 'wouldYouRather') && (
          <>
            <Rect x="12" y="22" width="28" height="44" rx="10" fill={a} opacity={0.92} />
            <Rect x="48" y="22" width="28" height="44" rx="10" fill={softFill} stroke={a} strokeWidth="2" />
            <Circle cx="44" cy="44" r="11" fill={surface} />
            <Path d="M40 44h8" stroke={a} strokeWidth="2.5" strokeLinecap="round" />
          </>
        )}

        {(id === 'whosLikely' || id === 'guessAnswer') && (
          <>
            <Circle cx="32" cy="36" r="12" fill={a} />
            <Circle cx="56" cy="36" r="12" fill={softFill} stroke={a} strokeWidth="2" />
            <Path
              d="M20 64c4-10 12-14 24-14s20 4 24 14"
              stroke={a}
              strokeWidth="3"
              strokeLinecap="round"
              fill="none"
            />
            <Circle cx="44" cy="52" r="5" fill={a} />
          </>
        )}

        {(id === 'cards' || id === 'thirtySix') && (
          <>
            <Rect x="22" y="18" width="36" height="50" rx="8" fill={softFill} stroke={a} strokeWidth="2" />
            <Rect x="28" y="24" width="36" height="50" rx="8" fill={a} />
            <Path d="M38 42h16M38 50h12" stroke={on} strokeWidth="2.5" strokeLinecap="round" />
            <Circle cx="46" cy="34" r="4" fill={on} opacity={0.85} />
          </>
        )}

        {(id === 'truthDare' || id === 'neverHaveI') && (
          <>
            <Rect x="24" y="24" width="40" height="40" rx="10" fill={a} />
            <Circle cx="36" cy="36" r="3.5" fill={on} />
            <Circle cx="52" cy="36" r="3.5" fill={on} />
            <Circle cx="36" cy="52" r="3.5" fill={on} />
            <Circle cx="52" cy="52" r="3.5" fill={on} opacity={0.45} />
            <Circle cx="44" cy="44" r="3.5" fill={on} />
          </>
        )}

        {(id === 'emojiStory' || id === 'finishSentence') && (
          <>
            <Rect x="14" y="28" width="60" height="32" rx="12" fill={a} />
            <Circle cx="30" cy="44" r="5" fill={on} />
            <Circle cx="44" cy="44" r="5" fill={on} opacity={0.75} />
            <Circle cx="58" cy="44" r="5" fill={on} opacity={0.5} />
          </>
        )}

        {(id === 'appreciation' || id === 'gratitude' || id === 'compliment') && (
          <Path
            d="M44 66C30 55 20 47 20 36c0-7 5.5-12.5 12-12.5 4 0 7 2 10 5.5 3-3.5 6-5.5 10-5.5 6.5 0 12 5.5 12 12.5 0 11-10 19-24 30Z"
            fill={a}
          />
        )}

        {(id === 'challenge' || id === 'dateNight' || id === 'goals') && (
          <>
            <Path d="M28 58V30h32v28" stroke={a} strokeWidth="3" strokeLinecap="round" fill="none" />
            <Path d="M24 58h40" stroke={a} strokeWidth="3" strokeLinecap="round" />
            <Path
              d="M36 30c0-6 4-10 8-10s8 4 8 10"
              stroke={a}
              strokeWidth="3"
              strokeLinecap="round"
              fill="none"
            />
            <Circle cx="44" cy="44" r="6" fill={a} />
          </>
        )}

        {id === 'memory' && (
          <>
            <Rect x="18" y="24" width="52" height="40" rx="8" fill={softFill} stroke={a} strokeWidth="2" />
            <Circle cx="34" cy="40" r="7" fill={a} />
            <Path d="M28 54l12-10 10 8 10-12 10 14H28Z" fill={a} opacity={0.85} />
          </>
        )}

        {(id === 'dateGenerator' || id === 'bucket') && (
          <>
            <Circle cx="44" cy="44" r="26" fill={softFill} stroke={a} strokeWidth="2.5" />
            <Path
              d="M44 24v8M44 56v8M24 44h8M56 44h8"
              stroke={a}
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <Circle cx="44" cy="44" r="5" fill={a} />
            <Path d="M44 44l12-8" stroke={a} strokeWidth="3" strokeLinecap="round" />
          </>
        )}

        {id === 'wheel' && (
          <>
            <Circle cx="44" cy="44" r="26" fill={a} />
            <Path d="M44 18L50 44H38Z" fill={on} />
            <Path d="M44 70L38 44h12Z" fill={on} opacity={0.55} />
            <Path d="M18 44l26-6v12Z" fill={on} opacity={0.75} />
            <Path d="M70 44L44 50V38Z" fill={on} opacity={0.4} />
            <Circle cx="44" cy="44" r="6" fill={surface} />
          </>
        )}

        {id === 'draw' && (
          <>
            <Rect x="20" y="20" width="48" height="48" rx="10" fill={softFill} stroke={a} strokeWidth="2" />
            <Path
              d="M28 54c8-14 16-18 24-8 4 5 8 8 12 6"
              stroke={a}
              strokeWidth="3"
              strokeLinecap="round"
              fill="none"
            />
            <Circle cx="34" cy="34" r="4" fill={a} />
          </>
        )}

        {id === 'playlist' && (
          <>
            <Circle cx="44" cy="44" r="24" fill={softFill} stroke={a} strokeWidth="2" />
            <Circle cx="44" cy="44" r="8" fill={a} />
            <Path
              d="M52 30v22c0 4-3 7-7 7"
              stroke={a}
              strokeWidth="3"
              strokeLinecap="round"
              fill="none"
            />
          </>
        )}

        {(id === 'trivia' || id === 'quizLive') && (
          <>
            <Circle cx="44" cy="40" r="22" fill={a} />
            <Path
              d="M36 36c0-5 3.5-8 8-8s8 3 8 7c0 3-2 5-5 6.5L44 46"
              stroke={on}
              strokeWidth="3"
              strokeLinecap="round"
              fill="none"
            />
            <Circle cx="44" cy="54" r="3" fill={on} />
          </>
        )}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
});
