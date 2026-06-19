import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { WebView } from 'react-native-webview';

interface MomentVideoPlayerProps {
  uri: string;
  width?: number;
  height?: number;
  autoPlay?: boolean;
  fill?: boolean;
  loop?: boolean;
  onEnd?: () => void;
  style?: StyleProp<ViewStyle>;
}

function buildVideoHtml(uri: string, autoPlay: boolean, loop: boolean): string {
  const autoplayAttr = autoPlay ? 'autoplay playsinline muted' : 'controls playsinline';
  const loopAttr = loop ? 'loop' : '';
  const endedHandler = loop
    ? ''
    : `document.querySelector('video').addEventListener('ended', () => window.ReactNativeWebView.postMessage('ended'));`;
  return `<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0"/>
<style>
  html, body { margin:0; padding:0; background:#000; height:100%; overflow:hidden; }
  video { width:100%; height:100%; object-fit:cover; }
</style>
</head><body>
<video src="${uri}" ${autoplayAttr} ${loopAttr} playsinline></video>
<script>${endedHandler}</script>
</body></html>`;
}

export function MomentVideoPlayer({
  uri,
  width,
  height,
  autoPlay = true,
  fill,
  loop = true,
  onEnd,
  style,
}: MomentVideoPlayerProps) {
  const sizeStyle = fill
    ? StyleSheet.absoluteFill
    : { width: width ?? ('100%' as const), height: height ?? 200 };

  return (
    <View style={[sizeStyle, { overflow: 'hidden', backgroundColor: '#000' }, style]}>
      <WebView
        source={{ html: buildVideoHtml(uri, autoPlay, loop) }}
        style={styles.webview}
        scrollEnabled={false}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={!autoPlay}
        onMessage={(event) => {
          if (event.nativeEvent.data === 'ended') onEnd?.();
        }}
        {...(Platform.OS === 'android' ? { androidLayerType: 'hardware' as const } : {})}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  webview: { flex: 1, backgroundColor: '#000' },
});
