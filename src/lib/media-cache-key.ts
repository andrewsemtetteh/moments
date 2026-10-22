/**
 * The phone's cache key for one of our files: its address without the signature (`e` / `s`),
 * which changes every week. Keyed on the full link, every photo was downloaded again weekly.
 */
export function mediaCacheKey(uri: string): string | undefined {
  const q = uri.indexOf('?');
  if (q < 0 || !uri.includes('/media/')) return undefined;
  const kept = uri
    .slice(q + 1)
    .split('&')
    .filter((part) => part && !part.startsWith('e=') && !part.startsWith('s='));
  return kept.length ? `${uri.slice(0, q)}?${kept.join('&')}` : uri.slice(0, q);
}

/** An Image source for one of our files, cached under its unsigned address (see mediaCacheKey). */
export function mediaSource(uri: string): { uri: string; cacheKey?: string } {
  const cacheKey = mediaCacheKey(uri);
  return cacheKey ? { uri, cacheKey } : { uri };
}
