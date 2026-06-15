import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { WebView } from 'react-native-webview';

interface MomentVideoPlayerProps {
  uri: string;
  width?: number;
  height?: number;
  autoPlay?: boolean;
  fill?: boolean;
  style?: StyleProp<ViewStyle>;
}

function buildVideoHtml(uri: string, autoPlay: boolean): string {
  const autoplayAttr = autoPlay ? 'autoplay playsinline muted' : 'controls playsinline';
  return `<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0"/>
<style>
  html, body { margin:0; padding:0; background:#000; height:100%; overflow:hidden; }
  video { width:100%; height:100%; object-fit:cover; }
</style>
</head><body>
<video src="${uri}" ${autoplayAttr} loop></video>
</body></html>`;
}

export function MomentVideoPlayer({ uri, width, height, autoPlay = true, fill, style }: MomentVideoPlayerProps) {
  const sizeStyle = fill
    ? StyleSheet.absoluteFill
    : { width: width ?? ('100%' as const), height: height ?? 200 };

  return (
    <View style={[sizeStyle, { overflow: 'hidden', backgroundColor: '#000' }, style]}>
      <WebView
        source={{ html: buildVideoHtml(uri, autoPlay) }}
        style={styles.webview}
        scrollEnabled={false}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={!autoPlay}
        {...(Platform.OS === 'android' ? { androidLayerType: 'hardware' as const } : {})}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  webview: { flex: 1, backgroundColor: '#000' },
});
