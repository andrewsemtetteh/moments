import { StyleSheet, View, type ViewStyle } from 'react-native';

import { getWebRTCModule } from '@/lib/webrtc-native';

function StreamView({ stream, mirror, style }: { stream: { toURL: () => string } | null; mirror?: boolean; style?: ViewStyle }) {
  const webrtc = getWebRTCModule();
  if (!stream || !webrtc) return null;
  const { RTCView } = webrtc;
  return (
    <RTCView
      streamURL={stream.toURL()}
      objectFit="cover"
      mirror={mirror}
      style={style ?? StyleSheet.absoluteFill}
    />
  );
}

export { StreamView };
