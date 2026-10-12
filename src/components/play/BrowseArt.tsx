import Svg, { Circle, Path, Rect, Text as SvgText } from 'react-native-svg';

export type BrowseArtId = 'questions' | 'quizzes' | 'prompts' | 'together' | 'games' | 'live';

/** Flat illustrations for the Browse circles: one bold ink shape with white details, drawn on a 84 box. */
export function BrowseArt({
  id,
  ink,
  paper,
  size = 60,
}: {
  id: BrowseArtId;
  ink: string;
  paper: string;
  size?: number;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 84 84" accessible={false}>
      {id === 'questions' ? (
        <>
          <Path
            d="M14 12h38a10 10 0 0 1 10 10v20a10 10 0 0 1-10 10H30l-12 10v-10h-4A10 10 0 0 1 4 42V22a10 10 0 0 1 10-10Z"
            fill={ink}
          />
          <SvgText x="33" y="44" fontSize="30" fontWeight="900" fill="#FFFFFF" textAnchor="middle">
            ?
          </SvgText>
          <Path
            d="M54 46h16a8 8 0 0 1 8 8v8a8 8 0 0 1-8 8h-2v7l-8-7h-6a8 8 0 0 1-8-8v-8a8 8 0 0 1 8-8Z"
            fill={paper}
            stroke={ink}
            strokeWidth="3"
          />
          <SvgText x="62" y="66" fontSize="17" fontWeight="900" fill={ink} textAnchor="middle">
            ?
          </SvgText>
        </>
      ) : null}

      {id === 'quizzes' ? (
        <>
          <Path
            d="M42 6a24 24 0 0 0-14 43.5c3 2.2 4.5 5 4.5 8.5h19c0-3.5 1.5-6.3 4.5-8.5A24 24 0 0 0 42 6Z"
            fill={ink}
          />
          <Path
            d="M42 46V36c-6-4-9-7-9-11 0-3 2.4-5 5-5 2 0 3.3 1 4 2.6.7-1.6 2-2.6 4-2.6 2.6 0 5 2 5 5 0 4-3 7-9 11"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Rect x="31" y="61" width="22" height="6" rx="3" fill={ink} />
          <Rect x="33" y="70" width="18" height="6" rx="3" fill={ink} />
        </>
      ) : null}

      {id === 'prompts' ? (
        <>
          <Rect
            x="38"
            y="10"
            width="34"
            height="48"
            rx="7"
            fill={paper}
            stroke={ink}
            strokeWidth="3"
            transform="rotate(14 55 34)"
          />
          <Rect x="12" y="20" width="36" height="52" rx="7" fill={ink} transform="rotate(-10 30 46)" />
          <Path
            d="M30 58c-7-5-11-9-11-14 0-3.5 2.6-6 5.8-6 2.2 0 4 1.2 5.2 3 1.2-1.8 3-3 5.2-3 3.2 0 5.8 2.5 5.8 6 0 5-4 9-11 14Z"
            fill="#FFFFFF"
            transform="rotate(-10 30 46)"
          />
        </>
      ) : null}

      {id === 'together' ? (
        <>
          <Path
            d="M10 26a6 6 0 0 1 6-6h52a6 6 0 0 1 6 6v6a8 8 0 0 0 0 16v6a6 6 0 0 1-6 6H16a6 6 0 0 1-6-6v-6a8 8 0 0 0 0-16Z"
            fill={ink}
          />
          <Path d="M56 22v36" stroke={paper} strokeWidth="2.5" strokeDasharray="4 4" />
          <Path
            d="M33 50c-7-5-11-9-11-14 0-3.5 2.6-6 5.8-6 2.2 0 4 1.2 5.2 3 1.2-1.8 3-3 5.2-3 3.2 0 5.8 2.5 5.8 6 0 5-4 9-11 14Z"
            fill="#FFFFFF"
          />
          <Circle cx="66" cy="34" r="2.5" fill="#FFFFFF" />
          <Circle cx="66" cy="46" r="2.5" fill="#FFFFFF" />
        </>
      ) : null}

      {id === 'games' ? (
        <>
          <Path d="M24 14h36v16a18 18 0 0 1-36 0Z" fill={ink} />
          <Path
            d="M24 20H14v4a10 10 0 0 0 10 10M60 20h10v4a10 10 0 0 1-10 10"
            fill="none"
            stroke={ink}
            strokeWidth="5"
            strokeLinecap="round"
          />
          <Rect x="38" y="46" width="8" height="12" fill={ink} />
          <Path d="M28 70a14 10 0 0 1 28 0Z" fill={ink} />
          <Rect x="22" y="10" width="40" height="7" rx="3.5" fill={ink} />
          <Path
            d="M42 38c-6-4.2-9-7.4-9-11.2 0-2.8 2.1-4.8 4.6-4.8 1.8 0 3.3 1 4.4 2.5 1.1-1.5 2.6-2.5 4.4-2.5 2.5 0 4.6 2 4.6 4.8 0 3.8-3 7-9 11.2Z"
            fill="#FFFFFF"
          />
        </>
      ) : null}

      {id === 'live' ? (
        <>
          <Path d="M16 46V40a26 26 0 0 1 52 0v6" fill="none" stroke={ink} strokeWidth="6" strokeLinecap="round" />
          <Rect x="10" y="42" width="16" height="26" rx="8" fill={ink} />
          <Rect x="58" y="42" width="16" height="26" rx="8" fill={ink} />
          <Path d="M36 50v8M42 46v16M48 50v8" stroke={ink} strokeWidth="4" strokeLinecap="round" />
          <Circle cx="70" cy="18" r="7" fill="#FF5A5F" stroke={paper} strokeWidth="3" />
        </>
      ) : null}
    </Svg>
  );
}
