/** Caps header badges at `max` with a "+" suffix (e.g. 9+). */
export function formatBadgeCount(count: number, max = 9): string {
  if (count <= 0) return '';
  return count > max ? `${max}+` : String(count);
}
