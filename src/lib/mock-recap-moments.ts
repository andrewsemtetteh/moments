import type { Moment } from '@/types/database';

const MOCK_BASE = {
  relationship_id: 'mock-relationship',
  user_id: 'mock-user',
  content: null,
  mood: null,
  latitude: null,
  longitude: null,
  reactions: {},
  viewed_by: [] as string[],
};

/** Placeholder moments for previewing the selection recap layout. */
export function getMockRecapMoments(): Moment[] {
  const daysAgo = (n: number) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString();
  };

  return [
    {
      ...MOCK_BASE,
      id: 'mock-recap-1',
      type: 'photo',
      media_url: 'https://picsum.photos/seed/couple-recap-1/480/600',
      created_at: daysAgo(42),
    },
    {
      ...MOCK_BASE,
      id: 'mock-recap-2',
      type: 'video',
      media_url: 'https://picsum.photos/seed/couple-recap-2/480/600',
      created_at: daysAgo(38),
    },
    {
      ...MOCK_BASE,
      id: 'mock-recap-3',
      type: 'photo',
      media_url: 'https://picsum.photos/seed/couple-recap-3/480/600',
      created_at: daysAgo(31),
    },
    {
      ...MOCK_BASE,
      id: 'mock-recap-4',
      type: 'photo',
      media_url: 'https://picsum.photos/seed/couple-recap-4/480/600',
      created_at: daysAgo(24),
    },
    {
      ...MOCK_BASE,
      id: 'mock-recap-5',
      type: 'video',
      media_url: 'https://picsum.photos/seed/couple-recap-5/480/600',
      created_at: daysAgo(18),
    },
    {
      ...MOCK_BASE,
      id: 'mock-recap-6',
      type: 'photo',
      media_url: 'https://picsum.photos/seed/couple-recap-6/480/600',
      created_at: daysAgo(12),
    },
    {
      ...MOCK_BASE,
      id: 'mock-recap-7',
      type: 'photo',
      media_url: 'https://picsum.photos/seed/couple-recap-7/480/600',
      created_at: daysAgo(7),
    },
    {
      ...MOCK_BASE,
      id: 'mock-recap-8',
      type: 'photo',
      media_url: 'https://picsum.photos/seed/couple-recap-8/480/600',
      created_at: daysAgo(3),
    },
    {
      ...MOCK_BASE,
      id: 'mock-recap-9',
      type: 'video',
      media_url: 'https://picsum.photos/seed/couple-recap-9/480/600',
      created_at: daysAgo(1),
    },
  ];
}
