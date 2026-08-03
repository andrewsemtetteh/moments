export type DateIdea = {
  id: string;
  title: string;
  blurb: string;
  cost: string;
  duration: string;
  weather: string;
  image: string;
  gradient: [string, string];
};

/** Curated date ideas for Plan — add-to-plan creates a calendar date. */
export const DATE_IDEAS: DateIdea[] = [
  {
    id: 'sunset-picnic',
    title: 'Sunset Picnic',
    blurb: 'Blanket, snacks, and the golden hour.',
    cost: '$',
    duration: '2 hrs',
    weather: 'Clear skies',
    image: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=800&q=80',
    gradient: ['#FF8FAB', '#FF6B8A'],
  },
  {
    id: 'pottery',
    title: 'Pottery Class',
    blurb: 'Make something messy and keep it forever.',
    cost: '$$',
    duration: '3 hrs',
    weather: 'Indoor',
    image: 'https://images.unsplash.com/photo-1565193566173-7a0ee3dbe511?w=800&q=80',
    gradient: ['#C9A0FF', '#FF8E72'],
  },
  {
    id: 'beach-walk',
    title: 'Beach Walk',
    blurb: 'Barefoot, slow conversations, salt air.',
    cost: 'Free',
    duration: '1.5 hrs',
    weather: 'Mild breeze',
    image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80',
    gradient: ['#6FD3C7', '#7EB6FF'],
  },
  {
    id: 'rooftop',
    title: 'Rooftop Dinner',
    blurb: 'City lights, shared plates, soft music.',
    cost: '$$$',
    duration: '3 hrs',
    weather: 'Evening',
    image: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=80',
    gradient: ['#8B2942', '#FF6B8A'],
  },
  {
    id: 'coffee-crawl',
    title: 'Coffee Crawl',
    blurb: 'Three cafés, one afternoon, no rush.',
    cost: '$',
    duration: '2 hrs',
    weather: 'Any',
    image: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&q=80',
    gradient: ['#E5B567', '#FF8E72'],
  },
];
