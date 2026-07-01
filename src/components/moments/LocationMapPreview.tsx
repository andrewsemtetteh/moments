import { useMemo } from 'react';
import { Platform, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { WebView } from 'react-native-webview';

import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/hooks/useTheme';

export interface MapMarker {
  latitude: number;
  longitude: number;
  /** Tooltip text on the map pin. */
  label?: string;
  /** Profile name used for avatar initials when there is no photo. */
  name?: string | null;
  color?: string;
  avatarUrl?: string | null;
}

interface LocationMapPreviewProps {
  markers: MapMarker[];
  height?: number;
  interactive?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

function buildMapHtml(markers: MapMarker[], interactive: boolean): string {
  const scrollZoom = interactive ? 'true' : 'false';
  const dragging = interactive ? 'true' : 'false';
  const tap = interactive ? 'true' : 'false';
  const markersJson = JSON.stringify(
    markers.map((m) => ({
      lat: m.latitude,
      lng: m.longitude,
      label: m.label ?? '',
      name: m.name?.trim() || m.label?.trim() || '',
      color: m.color ?? '#e85d75',
      avatarUrl: m.avatarUrl?.trim() || '',
    })),
  );

  return `<!DOCTYPE html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <style>
      html, body, #map { margin: 0; padding: 0; width: 100%; height: 100%; background: #1a1a1a; }
      .leaflet-control-attribution { font-size: 9px !important; }
      .pin-label { font-size: 11px; font-weight: 700; white-space: nowrap; }
      .avatar-pin-wrap { background: transparent !important; border: none !important; }
    </style>
  </head>
  <body>
    <div id="map"></div>
    <script>
      function escapeHtml(value) {
        return String(value || '')
          .replace(/&/g, '&amp;')
          .replace(/"/g, '&quot;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
      }

      var markers = ${markersJson};
      var map = L.map('map', {
        zoomControl: ${interactive ? 'true' : 'false'},
        scrollWheelZoom: ${scrollZoom},
        dragging: ${dragging},
        tap: ${tap},
        doubleClickZoom: ${interactive ? 'true' : 'false'},
        touchZoom: ${interactive ? 'true' : 'false'},
      });
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19,
        attribution: '&copy; Esri',
      }).addTo(map);

      var group = [];
      function avatarInitial(name) {
        var trimmed = String(name || '').trim();
        if (!trimmed) return '?';
        var first = trimmed.split(/\\s+/)[0];
        return first ? first.charAt(0).toUpperCase() : '?';
      }

      markers.forEach(function(m) {
        var ring = m.color || '#5b8def';
        var label = escapeHtml(m.label || '');
        var initial = avatarInitial(m.name || m.label);
        var avatarSize = 30;
        var pointerH = 11;
        var pointerW = 14;
        var pinW = 36;
        var pinH = avatarSize + pointerH;
        var face = m.avatarUrl
          ? '<img src="' + escapeHtml(m.avatarUrl) + '" alt="" style="width:100%;height:100%;object-fit:cover;display:block;border-radius:50%;" />'
          : '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;border-radius:50%;background:linear-gradient(135deg,#ffffff 0%,#f4f4f4 100%);color:' + ring + ';font-size:11px;font-weight:800;letter-spacing:-0.3px;">' + initial + '</div>';
        var icon = L.divIcon({
          className: 'avatar-pin-wrap',
          html:
            '<div style="width:' + pinW + 'px;display:flex;flex-direction:column;align-items:center;filter:drop-shadow(0 3px 8px rgba(0,0,0,0.32));">' +
              '<div style="width:' + avatarSize + 'px;height:' + avatarSize + 'px;box-sizing:border-box;border-radius:50%;border:2.5px solid ' + ring + ';background:#fff;padding:2px;overflow:hidden;">' + face + '</div>' +
              '<div style="width:0;height:0;margin-top:-1px;border-left:' + (pointerW / 2) + 'px solid transparent;border-right:' + (pointerW / 2) + 'px solid transparent;border-top:' + pointerH + 'px solid ' + ring + ';"></div>' +
            '</div>',
          iconSize: [pinW, pinH],
          iconAnchor: [pinW / 2, pinH],
        });
        var marker = L.marker([m.lat, m.lng], { icon: icon }).addTo(map);
        if (label) {
          marker.bindTooltip('<span class="pin-label">' + label + '</span>', { direction: 'top', offset: [0, -pinH - 6] });
        }
        group.push(marker);
      });

      if (group.length === 1) {
        map.setView([markers[0].lat, markers[0].lng], 14);
      } else if (group.length > 1) {
        map.fitBounds(L.featureGroup(group).getBounds().pad(0.3));
      }
    </script>
  </body>
</html>`;
}

export function LocationMapPreview({
  markers,
  height = 180,
  interactive = false,
  onPress,
  style,
}: LocationMapPreviewProps) {
  const { colors } = useTheme();
  const html = useMemo(() => buildMapHtml(markers, interactive), [markers, interactive]);

  if (markers.length === 0) return null;

  const sizeStyle = StyleSheet.flatten(style)?.flex != null ? { flex: 1, minHeight: 120 } : { height };

  const map = (
    <View style={[styles.wrapper, sizeStyle, { borderColor: colors.border }, style]}>
      <WebView
        source={{ html }}
        style={styles.webview}
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        pointerEvents={interactive ? 'auto' : 'none'}
        {...(Platform.OS === 'android' ? { androidLayerType: 'hardware' as const } : {})}
      />
      {onPress && (
        <View style={styles.openHint} pointerEvents="none">
          <Icon name="expand" size={14} color="#fff" />
        </View>
      )}
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [pressed && styles.pressed]}>
        {map}
      </Pressable>
    );
  }

  return map;
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  openHint: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.92 },
});
