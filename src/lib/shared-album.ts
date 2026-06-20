import { format } from 'date-fns';

import type { SharedAlbumItem, UserProfile } from '@/types/database';

type AuthorSource = Pick<UserProfile, 'id' | 'name' | 'email' | 'avatar_url'>;

export class SharedAlbumStorageLimitError extends Error {
  readonly name = 'SharedAlbumStorageLimitError';

  constructor(
    readonly usedBytes: number,
    readonly limitBytes: number,
    readonly neededBytes: number,
  ) {
    super('Shared album storage limit reached');
  }
}

export function formatStorageBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 MB';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 100 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function storageUsagePercent(usedBytes: number, limitBytes: number): number {
  if (!Number.isFinite(limitBytes) || limitBytes <= 0) return 0;
  return Math.min(100, Math.round((usedBytes / limitBytes) * 100));
}

function toAuthor(source: AuthorSource): UserProfile {
  return {
    id: source.id,
    email: source.email ?? '',
    name: source.name,
    avatar_url: source.avatar_url,
    created_at: '',
  };
}

export function enrichSharedAlbumItem(
  item: SharedAlbumItem,
  user?: AuthorSource | null,
  partner?: AuthorSource | null,
): SharedAlbumItem {
  if (item.author) return item;
  let author: UserProfile | undefined;
  if (user && item.user_id === user.id) author = toAuthor(user);
  else if (partner && item.user_id === partner.id) author = toAuthor(partner);
  return author ? { ...item, author } : item;
}

export function enrichSharedAlbumItems(
  items: SharedAlbumItem[],
  user?: AuthorSource | null,
  partner?: AuthorSource | null,
): SharedAlbumItem[] {
  return items.map((item) => enrichSharedAlbumItem(item, user, partner));
}

export interface AlbumMonthSection {
  key: string;
  label: string;
  items: SharedAlbumItem[];
}

export interface AlbumYearSection {
  key: string;
  label: string;
  months: AlbumMonthSection[];
}

export function groupSharedAlbumByYearMonth(items: SharedAlbumItem[]): AlbumYearSection[] {
  const byYear = new Map<string, Map<string, SharedAlbumItem[]>>();

  for (const item of items) {
    const d = new Date(item.created_at);
    const yearKey = format(d, 'yyyy');
    const monthKey = format(d, 'yyyy-MM');
    if (!byYear.has(yearKey)) byYear.set(yearKey, new Map());
    const yearMap = byYear.get(yearKey)!;
    const bucket = yearMap.get(monthKey);
    if (bucket) bucket.push(item);
    else yearMap.set(monthKey, [item]);
  }

  return Array.from(byYear.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([yearKey, monthMap]) => ({
      key: yearKey,
      label: yearKey,
      months: Array.from(monthMap.entries())
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([monthKey, monthItems]) => ({
          key: monthKey,
          label: format(new Date(`${monthKey}-01`), 'MMMM'),
          items: monthItems,
        })),
    }));
}

export function groupSharedAlbumByMonth(
  items: SharedAlbumItem[],
): { key: string; label: string; items: SharedAlbumItem[] }[] {
  const groups = new Map<string, SharedAlbumItem[]>();

  for (const item of items) {
    const key = format(new Date(item.created_at), 'yyyy-MM');
    const bucket = groups.get(key);
    if (bucket) bucket.push(item);
    else groups.set(key, [item]);
  }

  return Array.from(groups.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, monthItems]) => ({
      key,
      label: format(new Date(`${key}-01`), 'MMMM yyyy'),
      items: monthItems,
    }));
}
