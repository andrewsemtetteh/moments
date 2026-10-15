export interface Coords {
  latitude: number;
  longitude: number;
}

const EARTH_RADIUS_KM = 6371;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Great-circle distance between two coordinates, in kilometers. */
export function haversineDistanceKm(a: Coords, b: Coords): number {
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/**
 * Rounded hard on purpose — decimal-precision distance between partners reads
 * as surveillance, not romance. Under 5km: "Same City". Under 100km: nearest
 * 10. Otherwise: nearest whole km with a thousands separator.
 */
export function formatDistanceApart(km: number): string {
  // Title case, like the rest of the header ("Same City", "5,712 km Apart").
  if (km < 5) return 'Same City';
  if (km < 100) return `${Math.round(km / 10) * 10} km Apart`;
  return `${Math.round(km).toLocaleString()} km Apart`;
}
