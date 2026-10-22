import type { MapStyleElement } from 'react-native-maps';

/**
 * The cartoon map, Snap Map style: bright flat colours, soft white roads, no shop icons or
 * transit, big friendly place names. Google Maps styles (Android); Apple Maps on iPhone
 * can't be restyled, so it uses its own softest look (mutedStandard) instead.
 */
export const CARTOON_MAP_LIGHT: MapStyleElement[] = [
  { elementType: 'geometry', stylers: [{ color: '#EEF6E6' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#3A4657' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#FFFFFF' }, { weight: 4 }] },
  { featureType: 'landscape.man_made', elementType: 'geometry', stylers: [{ color: '#F6F1E7' }] },
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#DDF2CF' }] },
  { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#E6F3DA' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#A8E49B' }] },
  { featureType: 'road', elementType: 'geometry.fill', stylers: [{ color: '#FFFFFF' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#D3DEE8' }] },
  { featureType: 'road.highway', elementType: 'geometry.fill', stylers: [{ color: '#FFD86E' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#EDB940' }] },
  { featureType: 'road', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#BBC9D8' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#7DD3FF' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#1D6FA3' }] },
];

/** The same cartoon map at night: deep blue-grey land, bright water and parks, warm highways. */
export const CARTOON_MAP_DARK: MapStyleElement[] = [
  { elementType: 'geometry', stylers: [{ color: '#28303D' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#DCE4EF' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1B212B' }, { weight: 4 }] },
  { featureType: 'landscape.man_made', elementType: 'geometry', stylers: [{ color: '#2E3746' }] },
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#2A3A33' }] },
  { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#2C3640' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#2F6B45' }] },
  { featureType: 'road', elementType: 'geometry.fill', stylers: [{ color: '#465366' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#1E252F' }] },
  { featureType: 'road.highway', elementType: 'geometry.fill', stylers: [{ color: '#C9A445' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#8E7330' }] },
  { featureType: 'road', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#55647A' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#2D77B3' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#A9DAFF' }] },
];
