# Moments ❤️

A private, couples-only relationship app built with React Native (Expo) on Cloudflare (Workers, D1, R2, Durable Objects) and Clerk, with Claude (Anthropic) powering AI-generated content. Two partners pair into one shared "relationship" space — chat, moments, calendar, and activities are all scoped to that pair only. There are no public profiles, feeds, followers, or discovery — everything happens between two people.

## Quick Start

1. **Clone and install**
   ```bash
   npm install
   ```

2. **Configure auth + API**: create a Clerk application and deploy the Worker, then add to `.env.local`:
   ```
   EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
   EXPO_PUBLIC_API_URL=https://moments-api.<your-subdomain>.workers.dev
   ```

3. **Deploy the backend** (from `server/`)
   ```bash
   npm install
   npx wrangler d1 migrations apply moments-db --remote
   npx wrangler secret put CLERK_SECRET_KEY
   npx wrangler secret put ANTHROPIC_API_KEY   # optional, enables AI content
   npx wrangler deploy
   ```

4. **Calls off-network** (optional): set `EXPO_PUBLIC_TURN_URL`, `EXPO_PUBLIC_TURN_USERNAME`, `EXPO_PUBLIC_TURN_CREDENTIAL`.

5. **Run the app**
   ```bash
   npx expo start
   ```

## Architecture

- **Frontend**: Expo Router (file-based routing), React 19 / React Native 0.85, Zustand for local/UI state, TanStack Query for server state and caching, Reanimated + Gesture Handler for animations and gestures
- **Backend**: Cloudflare Worker (Hono) in `server/`: D1 (SQLite) database, R2 storage, a Durable Object realtime hub; auth by Clerk
- **AI**: Claude API called from Worker endpoints (`/fn/*`): daily prompts, activities, quiz and game content, push dispatch
- **Calls**: 1:1 audio/video calling over WebRTC (`react-native-webrtc`)
- **Subscriptions**: a "Moments Plus" paywall gates premium features (`usePlusGate` / `useSubscription`)

All data is scoped to `relationship_id` with access rules enforced in the Worker — there is no cross-relationship visibility.

## Design & Layout

**Header** (persistent across tab screens): chat shortcut on the left (with unread badge), partner's name and avatar in the center (tap opens their profile), notification bell on the right (with unread badge). Hidden on full-screen flows like Chat and Notifications.

**Bottom navigation**: a floating pill-shaped bar with four tabs — Home, Play (Activities), Plan (Calendar), You (Profile) — split two-and-two around a center FAB cut into the bar's notch. The FAB opens the Moment creator from anywhere. Chat and Notifications open as full-screen flows with no tab bar.

**Theming**: a single named-theme system (`src/constants/design-system.ts`) with over 20 selectable themes (e.g. `light`, `dark`, `black`, `glass`, `forest`, `deep_blue`, `slate`, `wine`, `espresso`, `dusty_rose`, `plum`, `navy`, `crimson`, `cream`, `twilight`, `burgundy`, and more), each defining background/surface layers, text, accent + gradient colors, chat bubble colors, and feedback colors. A `glass` variant renders translucent surfaces over blurred backdrops.

## Features

### Home
Relationship dashboard — mood snapshot for both partners (with mood history), daily prompt card (with prompt history), streak tracker with animated flame and milestone celebrations, a "continue chat" shortcut, and a live location snapshot of your partner.

### Moments
Quick emotional capture: photo, text, voice, mood, and location moments. Story-style viewer, swipeable media stack, reactions, and recap-video generation from a set of moments.

### Chat
Real-time 1:1 messaging (Durable Object realtime) with read state and partner presence. Supports photo, camera, video, and voice-note messages, emoji reactions, reply-to-message, pin/delete actions, custom chat wallpapers, and in-chat audio/video calling.

### Activities
An explore catalog of games, live quizzes, and curated experiences, plus daily challenges and AI-generated activity suggestions via Edge Functions.

### Calendar / Plan
A shared calendar with day/week/month views, an agenda list, event creation and detail sheets, reminders, date-idea suggestions, "coming up" and celebration highlights, and shared task/list tracking.

### Live Rooms & Play progression
Two-phone live game rooms with optional voice chat (WebRTC — dev build only; Expo Go falls back to text + reactions): Would You Rather, This or That, Who's More Likely, Truth or Dare, Guess My Answer, Two Truths & a Lie and Quiz Showdown. Rounds are AI-generated per vibe via the `generate-game-content` Edge Function (with bundled offline fallbacks). Couples earn shared XP, levels, a play streak, daily quests and badges (`couple_progress` table).

### Profile
Relationship overview with anniversary countdown/milestones, location-sharing and online-status settings, partner presence sync, and account settings (password, gender, relationship type).

### Wrapped
An annual relationship recap covering moments sent, activities completed, mood trends, and streak performance.

### Subscription
A "Moments Plus" paywall that gates premium features.

### Onboarding
A story-style intro, profile setup, relationship-type/path selection, anniversary date picker, and partner pairing (create or join a relationship).

## Documentation

Full specs live in `src/docs/` — see README.md, ARCHITECTURE.md, DATABASE_SCHEMA.md, FEATURES.md, and more.
