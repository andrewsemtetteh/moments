# Moments ❤️

A private, couples-only relationship platform built with React Native (Expo), Supabase, and Claude AI.

## Quick Start

1. **Clone and install**
   ```bash
   npm install
   ```

2. **Configure Supabase**
   - Create a project at [supabase.com](https://supabase.com)
   - Copy `.env.example` to `.env` and fill in your keys:
     ```
     EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
     EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
     ```

3. **Apply database schema**
   ```bash
   npm run db:cli:install   # first time on Windows: downloads CLI to tools/
   tools\supabase.exe login
   tools\supabase.exe link --project-ref your-project-ref
   npm run db:push:all
   ```
   Or paste migration SQL from `supabase/migrations/` into the Supabase SQL editor.

4. **Deploy Edge Functions** (optional, for AI features)
   ```bash
   npx supabase functions deploy generate-activity
   npx supabase secrets set ANTHROPIC_API_KEY=your-key
   ```

5. **Run the app**
   ```bash
   npx expo start
   ```

## Architecture

- **Frontend**: Expo Router, Zustand, TanStack Query, gesture-first UI
- **Backend**: Supabase (Auth, PostgreSQL, Realtime, Storage, Edge Functions)
- **AI**: Claude API via Edge Functions (activity generator, daily challenges, wrapped)

All data is scoped to `relationship_id` with Row Level Security.

## App Structure

```
src/
├── app/           # Expo Router screens
│   ├── (auth)/    # Login & signup
│   ├── (onboarding)/  # Profile, pairing, invite
│   └── (tabs)/    # Home, Activities, Chat, Calendar, Profile
├── components/    # UI components
├── hooks/         # TanStack Query hooks
├── stores/        # Zustand stores
├── services/      # Supabase API layer
├── lib/           # Supabase client
└── types/         # TypeScript types
```

## Features

- Real-time chat with offline queue
- Moments timeline (photo, text, mood, voice, location)
- Activities engine with AI generator
- Shared calendar, journal, mood tracking
- Streak system, bucket list, shared goals
- 5 emotional themes (Soft Ivory, Midnight Calm, etc.)
- Privacy-first: RLS, data export, account deletion

## Documentation

Full specs live in `src/docs/` — see README.md, ARCHITECTURE.md, DATABASE_SCHEMA.md, and more.
