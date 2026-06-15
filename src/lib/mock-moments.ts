import type { Moment } from '@/types/database';

/** Toggle off when you no longer need design previews. */
export const PREVIEW_MOCK_MOMENTS = __DEV__;

const SEEDS = [
  'couple-coffee',
  'couple-sunset',
  'couple-walk',
  'couple-dinner',
  'couple-park',
  'couple-beach',
  'couple-city',
  'couple-flowers',
  'couple-laugh',
  'couple-rain',
  'couple-road',
  'couple-sky',
  'couple-bike',
  'couple-cafe',
  'couple-night',
  'couple-snow',
  'couple-lake',
  'couple-bridge',
  'couple-market',
  'couple-roof',
  'couple-train',
  'couple-hike',
  'couple-book',
  'couple-picnic',
] as const;

function photo(seed: string) {
  return `https://picsum.photos/seed/${seed}/600/720`;
}

function hoursAgo(h: number) {
  return new Date(Date.now() - h * 60 * 60 * 1000).toISOString();
}

function daysAgo(d: number, hour = 12) {
  const t = new Date();
  t.setDate(t.getDate() - d);
  t.setHours(hour, 0, 0, 0);
  return t.toISOString();
}

function monthsAgo(m: number, day = 12) {
  const t = new Date();
  t.setMonth(t.getMonth() - m);
  t.setDate(day);
  t.setHours(15, 0, 0, 0);
  return t.toISOString();
}

function yearsAgo(y: number, month = 6, day = 15) {
  const t = new Date();
  t.setFullYear(t.getFullYear() - y);
  t.setMonth(month - 1, day);
  t.setHours(12, 0, 0, 0);
  return t.toISOString();
}

export interface PreviewContext {
  relationshipId: string;
  userId: string;
  partnerId?: string | null;
  partnerName?: string | null;
}

function partnerAuthor(partner: string, partnerLabel: string) {
  return { id: partner, name: partnerLabel, email: '', avatar_url: null, created_at: '' };
}

export function buildPreviewMoments({
  relationshipId,
  userId,
  partnerId,
  partnerName,
}: PreviewContext): Moment[] {
  const partner = partnerId ?? 'preview-partner';
  const partnerLabel = partnerName ?? 'Partner';
  const pa = partnerAuthor(partner, partnerLabel);

  const base = {
    relationship_id: relationshipId,
    content: null,
    mood: null,
    latitude: null,
    longitude: null,
  } as const;

  return [
    // —— Today ——
    {
      ...base,
      id: 'mock-moment-1',
      user_id: partner,
      type: 'photo',
      media_url: photo(SEEDS[0]),
      reactions: { '❤️': [userId], '😂': [userId] },
      created_at: hoursAgo(1),
      author: pa,
    },
    {
      ...base,
      id: 'mock-moment-2',
      user_id: partner,
      type: 'photo',
      media_url: photo(SEEDS[1]),
      reactions: { '❤️': [userId] },
      created_at: hoursAgo(4),
      author: pa,
    },
    {
      ...base,
      id: 'mock-moment-3',
      user_id: userId,
      type: 'photo',
      media_url: photo(SEEDS[2]),
      reactions: { '🔥': [partner], '🥹': [partner] },
      created_at: hoursAgo(7),
    },
    {
      ...base,
      id: 'mock-moment-4',
      user_id: userId,
      type: 'photo',
      media_url: photo(SEEDS[3]),
      reactions: {},
      created_at: hoursAgo(11),
    },
    // —— This week ——
    {
      ...base,
      id: 'mock-moment-5',
      user_id: partner,
      type: 'photo',
      media_url: photo(SEEDS[4]),
      reactions: { '❤️': [userId], '🥹': [userId] },
      created_at: daysAgo(2, 19),
      author: pa,
    },
    {
      ...base,
      id: 'mock-moment-6',
      user_id: userId,
      type: 'photo',
      media_url: photo(SEEDS[5]),
      reactions: { '😂': [partner] },
      created_at: daysAgo(3, 14),
    },
    // —— Last week ——
    {
      ...base,
      id: 'mock-moment-7',
      user_id: partner,
      type: 'photo',
      media_url: photo(SEEDS[6]),
      reactions: { '❤️': [userId] },
      created_at: daysAgo(8, 11),
      author: pa,
    },
    {
      ...base,
      id: 'mock-moment-8',
      user_id: partner,
      type: 'photo',
      media_url: photo(SEEDS[7]),
      reactions: { '🔥': [userId], '😂': [userId] },
      created_at: daysAgo(10, 16),
      author: pa,
    },
    {
      ...base,
      id: 'mock-moment-9',
      user_id: userId,
      type: 'photo',
      media_url: photo(SEEDS[8]),
      reactions: { '❤️': [partner] },
      created_at: daysAgo(12, 9),
    },
    {
      ...base,
      id: 'mock-moment-10',
      user_id: partner,
      type: 'photo',
      media_url: photo(SEEDS[9]),
      reactions: {},
      created_at: daysAgo(13, 20),
      author: pa,
    },
    // —— This month (earlier than last week) ——
    {
      ...base,
      id: 'mock-moment-11',
      user_id: userId,
      type: 'photo',
      media_url: photo(SEEDS[10]),
      reactions: { '🥹': [partner] },
      created_at: daysAgo(18, 8),
    },
    // —— Last month ——
    {
      ...base,
      id: 'mock-moment-12',
      user_id: partner,
      type: 'photo',
      media_url: photo(SEEDS[11]),
      reactions: { '❤️': [userId] },
      created_at: monthsAgo(1, 22),
      author: pa,
    },
    {
      ...base,
      id: 'mock-moment-13',
      user_id: userId,
      type: 'photo',
      media_url: photo(SEEDS[12]),
      reactions: { '❤️': [partner], '🔥': [partner] },
      created_at: monthsAgo(1, 14),
    },
    {
      ...base,
      id: 'mock-moment-14',
      user_id: partner,
      type: 'photo',
      media_url: photo(SEEDS[13]),
      reactions: { '🥹': [userId] },
      created_at: monthsAgo(1, 8),
      author: pa,
    },
    // —— Earlier this year ——
    {
      ...base,
      id: 'mock-moment-15',
      user_id: userId,
      type: 'photo',
      media_url: photo(SEEDS[14]),
      reactions: { '😂': [partner] },
      created_at: monthsAgo(3, 3),
    },
    {
      ...base,
      id: 'mock-moment-16',
      user_id: partner,
      type: 'photo',
      media_url: photo(SEEDS[15]),
      reactions: { '❤️': [userId] },
      created_at: monthsAgo(4, 18),
      author: pa,
    },
    // —— Last year ——
    {
      ...base,
      id: 'mock-moment-17',
      user_id: userId,
      type: 'photo',
      media_url: photo(SEEDS[16]),
      reactions: { '❤️': [partner] },
      created_at: yearsAgo(1, 8, 10),
    },
    {
      ...base,
      id: 'mock-moment-18',
      user_id: partner,
      type: 'photo',
      media_url: photo(SEEDS[17]),
      reactions: { '🔥': [userId], '😂': [userId] },
      created_at: yearsAgo(1, 11, 5),
      author: pa,
    },
    {
      ...base,
      id: 'mock-moment-19',
      user_id: partner,
      type: 'photo',
      media_url: photo(SEEDS[18]),
      reactions: { '❤️': [userId] },
      created_at: yearsAgo(1, 3, 20),
      author: pa,
    },
    // —— Two+ years ago ——
    {
      ...base,
      id: 'mock-moment-20',
      user_id: userId,
      type: 'photo',
      media_url: photo(SEEDS[19]),
      reactions: { '🔥': [partner] },
      created_at: yearsAgo(2, 5, 12),
    },
    {
      ...base,
      id: 'mock-moment-21',
      user_id: partner,
      type: 'photo',
      media_url: photo(SEEDS[20]),
      reactions: { '😂': [userId] },
      created_at: yearsAgo(3, 9, 1),
      author: pa,
    },
  ];
}

/** Home card — partner moments in last 24h; dev mocks when none are real. */
export function withHomePartnerMoments(
  partnerMoments: Moment[],
  ctx: PreviewContext | null,
  userId?: string | null,
): Moment[] {
  if (partnerMoments.length > 0) return partnerMoments;
  if (!PREVIEW_MOCK_MOMENTS || !ctx?.relationshipId || !ctx.userId || !userId) return partnerMoments;

  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  return buildPreviewMoments(ctx)
    .filter((m) => m.user_id !== userId)
    .filter((m) => new Date(m.created_at).getTime() >= cutoff)
    .map((m) => ({
      ...m,
      reactions: Object.fromEntries(
        Object.entries(m.reactions ?? {})
          .map(([emoji, ids]) => [emoji, ids.filter((id) => id !== userId)])
          .filter(([, ids]) => ids.length > 0),
      ),
    }));
}

/** Home / strip — only when there are no real moments. */
export function withPreviewMoments(moments: Moment[], ctx: PreviewContext | null): Moment[] {
  if (!PREVIEW_MOCK_MOMENTS || !ctx?.relationshipId || !ctx.userId) return moments;
  if (moments.length > 0) return moments;
  return buildPreviewMoments(ctx);
}

/** History grid — always prepend sample moments in dev so badges & sections are visible. */
export function mergePreviewMomentsForHistory(moments: Moment[], ctx: PreviewContext | null): Moment[] {
  if (!PREVIEW_MOCK_MOMENTS || !ctx?.relationshipId || !ctx.userId) return moments;
  const mocks = buildPreviewMoments(ctx);
  const realIds = new Set(moments.map((m) => m.id));
  const uniqueMocks = mocks.filter((m) => !realIds.has(m.id));
  return [...uniqueMocks, ...moments];
}

export function isPreviewMoment(moment: Moment): boolean {
  return moment.id.startsWith('mock-moment-');
}

export function getPreviewMomentById(momentId: string, ctx: PreviewContext | null): Moment | null {
  if (!PREVIEW_MOCK_MOMENTS || !ctx?.relationshipId || !ctx.userId) return null;
  return buildPreviewMoments(ctx).find((m) => m.id === momentId) ?? null;
}
