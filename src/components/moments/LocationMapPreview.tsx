import { useMemo } from 'react';
import { Platform, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { WebView } from 'react-native-webview';

import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/hooks/useTheme';

export interface MapMarker {
  latitude: number;
  longitude: number;
  label?: string;
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
      html, body, #map { margin: 0; padding: 0; width: 100%; height: 100%; background: #e8e4df; }
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
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap',
      }).addTo(map);

      var group = [];
      markers.forEach(function(m) {
        var ring = m.color || '#e85d75';
        var label = escapeHtml(m.label || '');
        var initial = label ? label.charAt(0).toUpperCase() : '?';
        var face = m.avatarUrl
          ? '<img src="' + escapeHtml(m.avatarUrl) + '" alt="" style="width:100%;height:100%;object-fit:cover;display:block;" />'
          : '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:' + ring + ';color:#fff;font-size:12px;font-weight:800;">' + initial + '</div>';
        var icon = L.divIcon({
          className: 'avatar-pin-wrap',
          html: '<div style="width:44px;height:44px;box-sizing:border-box;border-radius:50%;border:3px solid ' + ring + ';background:#fff;padding:2px;box-shadow:0 2px 10px rgba(0,0,0,0.28);overflow:hidden;">' + face + '</div>',
          iconSize: [44, 44],
          iconAnchor: [22, 22],
        });
        var marker = L.marker([m.lat, m.lng], { icon: icon }).addTo(map);
        if (label) {
          marker.bindTooltip('<span class="pin-label">' + label + '</span>', { direction: 'top', offset: [0, -24] });
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
