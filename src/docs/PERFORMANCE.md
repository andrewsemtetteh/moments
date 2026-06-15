# PERFORMANCE.md

## Moments ❤️

---

# 1. PERFORMANCE OVERVIEW

Moments is a **real-time emotional system for two users**, meaning performance is not just technical — it directly affects emotional experience.

Core principle:

> The app should feel instant, even when the network is slow.

---

# 2. PERFORMANCE GOALS

## 2.1 Perceived Performance Targets

* App launch: < 2s perceived
* Tab switch: < 100ms
* Chat send → receive: < 500ms
* Moment delivery: < 1s
* Activity generation: < 2s (Edge Function)

---

## 2.2 Experience Rule

If something takes time:

> Always show immediate feedback (optimistic UI)

---

# 3. FRONTEND PERFORMANCE

---

## 3.1 React Native Optimization

Using:

* React Native (Expo)
* Expo Router
* NativeWind
* Zustand
* TanStack Query

---

## 3.2 Rendering Strategy

### Use:

* memoized components
* flat lists for feeds
* virtualized lists for chat and timeline

### Avoid:

* deeply nested re-renders
* unnecessary state updates
* global re-render triggers

---

## 3.3 Image Optimization

All media must:

* be compressed before upload
* use adaptive resolution
* lazy load on scroll
* use cached previews

---

## 3.4 Navigation Performance

Rules:

* tab switching must not re-mount screens
* preserve state per tab
* avoid full screen resets

---

# 4. DATA PERFORMANCE (SUPABASE)

Uses:

Supabase

---

## 4.1 Query Optimization

All queries must:

* be relationship-scoped
* include pagination
* avoid full table scans

---

## 4.2 Pagination Rules

Default limits:

* chat: 50 messages
* moments: 30 items
* timeline: 20 items per batch

---

## 4.3 Index Strategy

Critical indexes:

* relationship_id
* created_at DESC
* user_id

---

# 5. REAL-TIME PERFORMANCE

Uses:

Supabase Realtime

---

## 5.1 Channel Optimization

Only subscribe to:

* current relationship channels

Never:

* global listeners
* unused tables

---

## 5.2 Event Throttling

Prevent overload from:

* rapid messages
* mood spam
* moment bursts

Solution:

* debounce updates
* batch non-critical events

---

## 5.3 Realtime Strategy

* Chat: instant
* Moments: near-instant
* Mood updates: throttled (5–10s window)

---

# 6. STATE MANAGEMENT PERFORMANCE

---

Uses:

* Zustand (UI state)
* TanStack Query (server state)

---

## 6.1 Zustand Rules

* lightweight stores only
* avoid storing large datasets
* no duplication of server data

---

## 6.2 Query Cache Strategy

* stale-while-revalidate
* aggressive caching for timeline
* background refetch on focus

---

# 7. MEMORY OPTIMIZATION

---

## 7.1 List Handling

All scrollable content must use:

* FlatList (React Native)
* windowed rendering

---

## 7.2 Component Optimization

* memo for static components
* callback memoization
* avoid inline heavy functions

---

## 7.3 Image Memory Control

* use thumbnails in feeds
* full image only on expand
* auto-release off-screen images

---

# 8. NETWORK PERFORMANCE

---

## 8.1 Request Strategy

* batch requests where possible
* avoid redundant API calls
* reuse cached responses

---

## 8.2 Offline Handling

Core features must work offline:

* chat (queued messages)
* viewing moments
* viewing calendar
* viewing journal

---

## 8.3 Sync Strategy

When back online:

* sync queued actions
* resolve conflicts by timestamp priority

---

# 9. EDGE FUNCTION PERFORMANCE

---

All Edge Functions must:

* execute < 2s average
* avoid heavy computation
* offload large processing to async jobs if needed

---

## 9.1 Functions Covered

* create-moment
* send-message
* generate-activity
* update-mood
* create-event

---

## 9.2 Optimization Rules

* validate early, fail fast
* avoid multiple DB round trips
* use single transactions where possible

---

# 10. STORAGE PERFORMANCE

Uses:

Supabase Storage

---

## 10.1 Upload Optimization

* compress before upload
* limit file size (images/videos/audio)
* generate thumbnails for images

---

## 10.2 Delivery Optimization

* CDN-backed delivery
* signed URL caching
* lazy media loading

---

# 11. CHAT PERFORMANCE

---

## 11.1 Message Strategy

* paginate last 50 messages
* load older messages on scroll
* optimistic send (instant UI)

---

## 11.2 Typing Optimization

* debounce typing events
* limit realtime updates frequency

---

# 12. MOMENTS PERFORMANCE

---

## 12.1 Feed Strategy

* infinite scroll
* grouped by day
* lazy load media
* prefetch next batch

---

## 12.2 Upload Strategy

* compress before upload
* upload in background
* show instant placeholder card

---

# 13. CALENDAR PERFORMANCE

---

* lazy load monthly data
* prefetch current week
* cache event list locally

---

# 14. ANALYTICS PERFORMANCE

Uses:

PostHog

---

## Rules:

* batch events
* avoid tracking high-frequency actions (typing, scroll)
* sample non-critical events

---

# 15. ERROR TRACKING PERFORMANCE

Uses:

Sentry

---

## Rules:

* sample non-critical errors
* prioritize crash-level errors
* avoid noisy logging

---

# 16. CRITICAL PERFORMANCE RULE

> Emotional latency matters more than technical latency.

If the user *feels* delay, the system has failed.

---

# 17. OPTIMISTIC UX STRATEGY

Always assume success:

* message appears instantly
* moment appears instantly
* activity updates instantly

Server sync happens in background.

---

# 18. CORE PERFORMANCE RULE

> Moments must feel like it is happening in real time, even when it is not.

---

# END OF PERFORMANCE.md
