-- Curated marketplace experiences with real imagery (no prices in UI)
INSERT INTO public.experiences (title, type, location, price_range, external_url, image_url)
SELECT * FROM (VALUES
  (
    'Candlelit tasting menu',
    'restaurant',
    'Lisbon, Portugal',
    null::text,
    null::text,
    'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1200&q=85'
  ),
  (
    'Waterfront brunch',
    'brunch',
    'Copenhagen, Denmark',
    null::text,
    null::text,
    'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=1200&q=85'
  ),
  (
    'Cliffside boutique hotel',
    'hotel',
    'Amalfi Coast, Italy',
    null::text,
    null::text,
    'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200&q=85'
  ),
  (
    'Glass cabin in the pines',
    'airbnb',
    'Swedish Lapland',
    null::text,
    null::text,
    'https://images.unsplash.com/photo-1449158743715-0a90ebb6d2d8?w=1200&q=85'
  ),
  (
    'Sunset over the caldera',
    'attraction',
    'Santorini, Greece',
    null::text,
    null::text,
    'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200&q=85'
  ),
  (
    'After-hours at the museum',
    'museum',
    'Paris, France',
    null::text,
    null::text,
    'https://images.unsplash.com/photo-1541961017774-22349e4a1262?w=1200&q=85'
  ),
  (
    'Cook the local menu',
    'activity',
    'Barcelona, Spain',
    null::text,
    null::text,
    'https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=1200&q=85'
  ),
  (
    'Jazz & vinyl night',
    'event',
    'New Orleans, USA',
    null::text,
    null::text,
    'https://images.unsplash.com/photo-1415201364774-f6f0ff35a28d?w=1200&q=85'
  ),
  (
    'Temple gardens at dawn',
    'attraction',
    'Kyoto, Japan',
    null::text,
    null::text,
    'https://images.unsplash.com/photo-1493976040374-85c8e577f47f?w=1200&q=85'
  ),
  (
    'Desert stargazing camp',
    'hotel',
    'Wadi Rum, Jordan',
    null::text,
    null::text,
    'https://images.unsplash.com/photo-1509316785289-025f5b846b35?w=1200&q=85'
  )
) AS seed(title, type, location, price_range, external_url, image_url)
WHERE NOT EXISTS (
  SELECT 1 FROM public.experiences WHERE title = seed.title
);
