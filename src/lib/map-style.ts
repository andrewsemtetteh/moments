import type { StyleSpecification } from '@maplibre/maplibre-react-native';
import type { MapStyleElement } from 'react-native-maps';

/**
 * Expo Go fallback only (react-native-maps, see LocationMapPreview): the cartoon map as a Google
 * Maps style (Android). Apple Maps on iPhone can't be restyled. Real builds use cartoonMapStyle below.
 */
export const CARTOON_MAP_LIGHT: MapStyleElement[] = [
  { elementType: 'geometry', stylers: [{ color: '#EEF6E6' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#3A4657' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#FFFFFF' }, { weight: 4 }] },
  { featureType: 'landscape.man_made', elementType: 'geometry', stylers: [{ color: '#F6F1E7' }] },
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#DDF2CF' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#E6F3DA' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#A8E49B' }] },
  { featureType: 'road', elementType: 'geometry.fill', stylers: [{ color: '#FFFFFF' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#D3DEE8' }] },
  { featureType: 'road.highway', elementType: 'geometry.fill', stylers: [{ color: '#FFD86E' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#EDB940' }] },
  { featureType: 'road', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
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
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#2C3640' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#2F6B45' }] },
  { featureType: 'road', elementType: 'geometry.fill', stylers: [{ color: '#465366' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#1E252F' }] },
  { featureType: 'road.highway', elementType: 'geometry.fill', stylers: [{ color: '#C9A445' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#8E7330' }] },
  { featureType: 'road', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#55647A' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#2D77B3' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#A9DAFF' }] },
];

/** One palette per mode for the MapLibre cartoon map (the same colours as the Google styles above). */
const PALETTE = {
  light: {
    land: '#EEF6E6',
    urban: '#F6F1E7',
    natural: '#DDF2CF',
    wood: '#BFE8AE',
    park: '#A8E49B',
    sand: '#FBEFC8',
    water: '#7DD3FF',
    waterLabel: '#1D6FA3',
    building: '#E9DFF7',
    buildingTop: '#F3ECFB',
    buildingEdge: '#C9B8E6',
    road: '#FFFFFF',
    roadCase: '#D3DEE8',
    major: '#FFFFFF',
    majorCase: '#C4D2E0',
    highway: '#FFD86E',
    highwayCase: '#EDB940',
    path: '#C7D3BE',
    rail: '#B9C3CF',
    boundary: '#BBC9D8',
    text: '#3A4657',
    halo: '#FFFFFF',
    poi: '#FF6FA3',
    poiFood: '#FF9F43',
    poiShop: '#8C7CF0',
    poiPark: '#3DBE6A',
    poiTransit: '#2F9BEA',
  },
  dark: {
    land: '#28303D',
    urban: '#2E3746',
    natural: '#2A3A33',
    wood: '#2C4A38',
    park: '#2F6B45',
    sand: '#4A4536',
    water: '#2D77B3',
    waterLabel: '#A9DAFF',
    building: '#3B4458',
    buildingTop: '#465069',
    buildingEdge: '#1E252F',
    road: '#465366',
    roadCase: '#1E252F',
    major: '#56657B',
    majorCase: '#1E252F',
    highway: '#C9A445',
    highwayCase: '#8E7330',
    path: '#3F4C42',
    rail: '#55647A',
    boundary: '#55647A',
    text: '#DCE4EF',
    halo: '#1B212B',
    poi: '#FF7FAE',
    poiFood: '#FFB066',
    poiShop: '#A99CFF',
    poiPark: '#5ED68A',
    poiTransit: '#5BB6FF',
  },
};

const FONT = ['Noto Sans Regular'];
const FONT_BOLD = ['Noto Sans Bold'];
const NAME = ['coalesce', ['get', 'name:latin'], ['get', 'name']];

/** Road width by zoom, wider for bigger roads (the chunky cartoon look). */
const roadWidth = (base: number) => ['interpolate', ['exponential', 1.5], ['zoom'], 10, base * 0.4, 14, base * 2, 18, base * 9];

/**
 * The cartoon map (Snap Map style) for MapLibre on OpenFreeMap's free OpenStreetMap tiles: flat bright
 * colours, chunky white roads, golden highways, 3D buildings when tilted, coloured place dots with names,
 * and big friendly place names. No API key and no per-load cost.
 */
export function cartoonMapStyle(dark: boolean): StyleSpecification {
  const c = dark ? PALETTE.dark : PALETTE.light;
  const src = { source: 'openmaptiles' };
  const minor = ['literal', ['minor', 'service', 'track']];
  const major = ['literal', ['primary', 'secondary', 'tertiary', 'trunk']];
  const round = { 'line-cap': 'round', 'line-join': 'round' };
  const label = { 'text-color': c.text, 'text-halo-color': c.halo, 'text-halo-width': 1.6 };
  const style = {
    version: 8,
    name: dark ? 'Moments night' : 'Moments',
    glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
    sources: {
      openmaptiles: { type: 'vector', url: 'https://tiles.openfreemap.org/planet' },
    },
    layers: [
      { id: 'land', type: 'background', paint: { 'background-color': c.land } },
      {
        id: 'landuse-urban',
        type: 'fill',
        ...src,
        'source-layer': 'landuse',
        filter: ['in', ['get', 'class'], ['literal', ['residential', 'commercial', 'retail', 'industrial', 'neighbourhood', 'suburb']]],
        paint: { 'fill-color': c.urban },
      },
      {
        id: 'landcover-natural',
        type: 'fill',
        ...src,
        'source-layer': 'landcover',
        filter: ['in', ['get', 'class'], ['literal', ['grass', 'farmland', 'wetland']]],
        paint: { 'fill-color': c.natural },
      },
      {
        id: 'landcover-wood',
        type: 'fill',
        ...src,
        'source-layer': 'landcover',
        filter: ['==', ['get', 'class'], 'wood'],
        paint: { 'fill-color': c.wood },
      },
      {
        id: 'landcover-sand',
        type: 'fill',
        ...src,
        'source-layer': 'landcover',
        filter: ['==', ['get', 'class'], 'sand'],
        paint: { 'fill-color': c.sand },
      },
      {
        id: 'landuse-green',
        type: 'fill',
        ...src,
        'source-layer': 'landuse',
        filter: ['in', ['get', 'class'], ['literal', ['pitch', 'playground', 'cemetery', 'stadium']]],
        paint: { 'fill-color': c.park, 'fill-opacity': 0.7 },
      },
      { id: 'park', type: 'fill', ...src, 'source-layer': 'park', paint: { 'fill-color': c.park } },
      { id: 'water', type: 'fill', ...src, 'source-layer': 'water', paint: { 'fill-color': c.water } },
      {
        id: 'waterway',
        type: 'line',
        ...src,
        'source-layer': 'waterway',
        paint: { 'line-color': c.water, 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1, 16, 4] },
      },
      {
        id: 'boundary',
        type: 'line',
        ...src,
        'source-layer': 'boundary',
        filter: ['<=', ['get', 'admin_level'], 4],
        paint: { 'line-color': c.boundary, 'line-width': 1.2, 'line-dasharray': [3, 2] },
      },
      {
        id: 'path',
        type: 'line',
        ...src,
        'source-layer': 'transportation',
        minzoom: 14,
        filter: ['==', ['get', 'class'], 'path'],
        layout: { 'line-cap': 'round' },
        paint: { 'line-color': c.path, 'line-width': 1.5, 'line-dasharray': [2, 1.5] },
      },
      {
        id: 'rail',
        type: 'line',
        ...src,
        'source-layer': 'transportation',
        filter: ['in', ['get', 'class'], ['literal', ['rail', 'transit']]],
        paint: { 'line-color': c.rail, 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1, 16, 3] },
      },
      // Each road twice: a darker casing under and the fill on top, so they read as soft stickers.
      {
        id: 'road-minor-case',
        type: 'line',
        ...src,
        'source-layer': 'transportation',
        minzoom: 12,
        filter: ['in', ['get', 'class'], minor],
        layout: round,
        paint: { 'line-color': c.roadCase, 'line-width': roadWidth(1.4) },
      },
      {
        id: 'road-major-case',
        type: 'line',
        ...src,
        'source-layer': 'transportation',
        filter: ['in', ['get', 'class'], major],
        layout: round,
        paint: { 'line-color': c.majorCase, 'line-width': roadWidth(2.2) },
      },
      {
        id: 'road-highway-case',
        type: 'line',
        ...src,
        'source-layer': 'transportation',
        filter: ['==', ['get', 'class'], 'motorway'],
        layout: round,
        paint: { 'line-color': c.highwayCase, 'line-width': roadWidth(2.8) },
      },
      {
        id: 'road-minor',
        type: 'line',
        ...src,
        'source-layer': 'transportation',
        minzoom: 12,
        filter: ['in', ['get', 'class'], minor],
        layout: round,
        paint: { 'line-color': c.road, 'line-width': roadWidth(1) },
      },
      {
        id: 'road-major',
        type: 'line',
        ...src,
        'source-layer': 'transportation',
        filter: ['in', ['get', 'class'], major],
        layout: round,
        paint: { 'line-color': c.major, 'line-width': roadWidth(1.7) },
      },
      {
        id: 'road-highway',
        type: 'line',
        ...src,
        'source-layer': 'transportation',
        filter: ['==', ['get', 'class'], 'motorway'],
        layout: round,
        paint: { 'line-color': c.highway, 'line-width': roadWidth(2.2) },
      },
      // Buildings: flat footprints up close, standing up in 3D when the map is tilted.
      {
        id: 'building',
        type: 'fill',
        ...src,
        'source-layer': 'building',
        minzoom: 14,
        paint: { 'fill-color': c.building, 'fill-outline-color': c.buildingEdge },
      },
      {
        id: 'building-3d',
        type: 'fill-extrusion',
        ...src,
        'source-layer': 'building',
        minzoom: 15,
        paint: {
          'fill-extrusion-color': c.buildingTop,
          'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 15, 0, 16, ['coalesce', ['get', 'render_height'], 6]],
          'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
          'fill-extrusion-opacity': 0.9,
        },
      },
      {
        id: 'road-label',
        type: 'symbol',
        ...src,
        'source-layer': 'transportation_name',
        minzoom: 14,
        layout: { 'symbol-placement': 'line', 'text-field': NAME, 'text-font': FONT, 'text-size': 11 },
        paint: label,
      },
      {
        id: 'water-label',
        type: 'symbol',
        ...src,
        'source-layer': 'water_name',
        layout: { 'text-field': NAME, 'text-font': FONT, 'text-size': 13 },
        paint: { ...label, 'text-color': c.waterLabel },
      },
      // Places (cafés, shops, parks, stations) as bright dots with their names, Snap Map style.
      {
        id: 'poi-dot',
        type: 'circle',
        ...src,
        'source-layer': 'poi',
        minzoom: 15,
        filter: ['<=', ['get', 'rank'], 24],
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 15, 3.5, 18, 6],
          'circle-color': [
            'match',
            ['get', 'class'],
            ['restaurant', 'cafe', 'fast_food', 'bar', 'beer', 'ice_cream', 'bakery'],
            c.poiFood,
            ['shop', 'grocery', 'clothing_store', 'alcohol_shop', 'jewelry', 'gift'],
            c.poiShop,
            ['park', 'garden', 'playground', 'campsite', 'zoo'],
            c.poiPark,
            ['railway', 'bus', 'ferry_terminal', 'airport', 'aerialway'],
            c.poiTransit,
            c.poi,
          ],
          'circle-stroke-color': c.halo,
          'circle-stroke-width': 2,
        },
      },
      {
        id: 'poi-label',
        type: 'symbol',
        ...src,
        'source-layer': 'poi',
        minzoom: 16,
        filter: ['<=', ['get', 'rank'], 24],
        layout: {
          'text-field': NAME,
          'text-font': FONT_BOLD,
          'text-size': 11,
          'text-anchor': 'top',
          'text-offset': [0, 0.6],
          'text-max-width': 8,
          'text-optional': true,
        },
        paint: label,
      },
      {
        id: 'place-label',
        type: 'symbol',
        ...src,
        'source-layer': 'place',
        filter: ['!=', ['get', 'class'], 'country'],
        layout: {
          'text-field': NAME,
          'text-font': FONT_BOLD,
          'text-size': ['match', ['get', 'class'], 'city', 18, 'town', 15, ['village', 'suburb'], 13, 12],
          'text-max-width': 8,
        },
        paint: { ...label, 'text-halo-width': 2 },
      },
      {
        id: 'country-label',
        type: 'symbol',
        ...src,
        'source-layer': 'place',
        maxzoom: 7,
        filter: ['==', ['get', 'class'], 'country'],
        layout: { 'text-field': NAME, 'text-font': FONT_BOLD, 'text-size': 14 },
        paint: { ...label, 'text-halo-width': 2 },
      },
    ],
  };
  // Built from plain arrays and objects; the spec's expression types are too strict to spell out here.
  return style as unknown as StyleSpecification;
}
