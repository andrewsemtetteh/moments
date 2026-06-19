import type { Experience } from '@/types/database';

export interface DisplayExperience extends Experience {
  tagline: string;
}

/** Fallback catalog when the API has no image-backed rows. */
export const CURATED_EXPERIENCES: DisplayExperience[] = [
  {
    id: 'curated-eat-1',
    title: 'Candlelit tasting menu',
    type: 'restaurant',
    location: 'Lisbon, Portugal',
    price_range: null,
    external_url: null,
    image_url: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1200&q=85',
    created_at: '',
    tagline: 'Seven courses, low lights, nowhere to be',
  },
  {
    id: 'curated-stay-1',
    title: 'Cliffside boutique hotel',
    type: 'hotel',
    location: 'Amalfi Coast, Italy',
    price_range: null,
    external_url: null,
    image_url: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200&q=85',
    created_at: '',
    tagline: 'Wake up above the sea',
  },
  {
    id: 'curated-visit-1',
    title: 'Sunset over the caldera',
    type: 'attraction',
    location: 'Santorini, Greece',
    price_range: null,
    external_url: null,
    image_url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200&q=85',
    created_at: '',
    tagline: 'Golden hour from the rim',
  },
  {
    id: 'curated-stay-2',
    title: 'Glass cabin in the pines',
    type: 'airbnb',
    location: 'Swedish Lapland',
    price_range: null,
    external_url: null,
    image_url: 'https://images.unsplash.com/photo-1449158743715-0a90ebb6d2d8?w=1200&q=85',
    created_at: '',
    tagline: 'Stars through the roof',
  },
  {
    id: 'curated-eat-2',
    title: 'Waterfront brunch',
    type: 'brunch',
    location: 'Copenhagen, Denmark',
    price_range: null,
    external_url: null,
    image_url: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=1200&q=85',
    created_at: '',
    tagline: 'Pastries, coffee, and the harbor',
  },
  {
    id: 'curated-visit-2',
    title: 'After-hours at the museum',
    type: 'museum',
    location: 'Paris, France',
    price_range: null,
    external_url: null,
    image_url: 'https://images.unsplash.com/photo-1541961017774-22349e4a1262?w=1200&q=85',
    created_at: '',
    tagline: 'Art, just the two of you',
  },
  {
    id: 'curated-do-1',
    title: 'Cook the local menu',
    type: 'activity',
    location: 'Barcelona, Spain',
    price_range: null,
    external_url: null,
    image_url: 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=1200&q=85',
    created_at: '',
    tagline: 'Hands-on, then dinner at home',
  },
  {
    id: 'curated-do-2',
    title: 'Jazz & vinyl night',
    type: 'event',
    location: 'New Orleans, USA',
    price_range: null,
    external_url: null,
    image_url: 'https://images.unsplash.com/photo-1415201364774-f6f0ff35a28d?w=1200&q=85',
    created_at: '',
    tagline: 'Live music in a tiny room',
  },
  {
    id: 'curated-visit-3',
    title: 'Temple gardens at dawn',
    type: 'attraction',
    location: 'Kyoto, Japan',
    price_range: null,
    external_url: null,
    image_url: 'https://images.unsplash.com/photo-1493976040374-85c8e577f47f?w=1200&q=85',
    created_at: '',
    tagline: 'Quiet paths before the crowds',
  },
  {
    id: 'curated-stay-3',
    title: 'Desert stargazing camp',
    type: 'hotel',
    location: 'Wadi Rum, Jordan',
    price_range: null,
    external_url: null,
    image_url: 'https://images.unsplash.com/photo-1509316785289-025f5b846b35?w=1200&q=85',
    created_at: '',
    tagline: 'Sleep under a million stars',
  },
];

const TAGLINE_BY_TITLE: Record<string, string> = Object.fromEntries(
  CURATED_EXPERIENCES.map((e) => [e.title.toLowerCase(), e.tagline]),
);

export function enrichExperience(exp: Experience): DisplayExperience {
  return {
    ...exp,
    tagline: TAGLINE_BY_TITLE[exp.title.toLowerCase()] ?? getDefaultTagline(exp.type),
  };
}

function getDefaultTagline(type: string | null): string {
  const category = (type ?? '').toLowerCase();
  if (['restaurant', 'food', 'brunch', 'cafe', 'bar'].includes(category)) return 'A table worth dressing up for';
  if (['hotel', 'airbnb', 'resort', 'stay'].includes(category)) return 'A stay you will talk about';
  if (['museum', 'attraction', 'park', 'landmark'].includes(category)) return 'Worth the trip together';
  return 'Made for two';
}

export function isPersistedExperience(id: string): boolean {
  return !id.startsWith('curated-');
}

export function experiencesWithImages(rows: Experience[] | undefined): DisplayExperience[] {
  const withImages = (rows ?? []).filter((row) => row.image_url?.trim());
  if (withImages.length >= 4) {
    return withImages.map(enrichExperience);
  }
  return CURATED_EXPERIENCES;
}
