import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Every page Settings opens (router.push / navigate / replace, and pathname: …) must be a
 * real screen, so no row leads to "Unmatched route".
 */
const APP = path.resolve(__dirname, '../app');

function routeExists(route: string): boolean {
  const clean = route.split('?')[0].replace(/^\//, '');
  if (!clean) return fs.existsSync(path.join(APP, 'index.tsx'));
  const base = path.join(APP, clean);
  return (
    fs.existsSync(`${base}.tsx`) ||
    fs.existsSync(path.join(base, 'index.tsx')) ||
    // A group's own screens, e.g. /legal/privacy → app/legal/privacy.tsx
    fs.existsSync(path.join(path.dirname(base), `${path.basename(base)}.tsx`))
  );
}

describe('Settings routes', () => {
  const source = fs.readFileSync(path.join(APP, 'settings.tsx'), 'utf8');
  const routes = [
    ...source.matchAll(/router\.(?:push|navigate|replace)\(\s*'([^']+)'/g),
    ...source.matchAll(/pathname:\s*'([^']+)'/g),
  ].map((m) => m[1]);

  it('finds the rows’ routes', () => {
    expect(routes.length).toBeGreaterThan(5);
  });

  it.each([...new Set(routes)])('%s is a real screen', (route) => {
    expect(routeExists(route)).toBe(true);
  });
});
