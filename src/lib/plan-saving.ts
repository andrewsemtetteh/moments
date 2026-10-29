/**
 * Yearly vs paying the full weekly price all year (69.99 vs 4.99 × 52 → 73%). The weekly
 * plan's main price, never its cheaper first week.
 */
export function yearlySavingPercent(yearlyPrice: number, weeklyPrice: number): number | null {
  if (!(yearlyPrice > 0) || !(weeklyPrice > 0)) return null;
  const saving = Math.round((1 - yearlyPrice / (weeklyPrice * 52)) * 100);
  return saving > 0 ? saving : null;
}
