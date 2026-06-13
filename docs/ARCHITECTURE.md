# ARCHITECTURE.md

## Moments ❤️

---

# 1. SYSTEM OVERVIEW

Moments is a **real-time, relationship-scoped mobile system** built on a 2-user relational model.

Every feature is scoped to:

```text id="a1"
relationship_id
```

There is no global social graph.

There are no public entities.

Only private relationship spaces.

---

# 2. HIGH-LEVEL ARCHITECTURE

## System Layers

```text id="sys1"
[ Mobile App (React Native Expo) ]
            ↓
[ API Layer (Supabase Edge Functions) ]
            ↓
[ Supabase Backend ]
  - Auth
  - PostgreSQL
  - Realtime Engine
  - Storage
            ↓
[ External Services ]
  - RevenueCat
  - PostHog
  - Sentry
  - Expo Notifications
  - Resend Email
```

---

# 3. FRONTEND ARCHITECTURE

## 3.1 Tech Stack

* React Native (Expo)
* TypeScript
* Expo Router
* NativeWind (UI styling)
* Zustand (state management)
* TanStack Query (server state)

---

## 3.2 Frontend Structure

```text id="fe1"
app/
 ├── (auth)/
 ├── (onboarding)/
 ├── (tabs)/
 │     ├── home/
 │     ├── activities/
 │     ├── chat/
 │     ├── calendar/
 │     ├── profile/
 ├── components/
 ├── stores/
 ├── services/
 ├── hooks/
 ├── utils/
```

---

## 3.3 State Management

### Zustand (Local State)

Used for:

* user session
* relationship state
* UI state
* moment drafts

---

### TanStack Query (Server State)

Used for:

* moments
* chat messages
* activities
* calendar events
* journal entries

Caching rules:

* stale-while-revalidate
* optimistic updates for chat/moments

---

# 4. BACKEND ARCHITECTURE (SUPABASE)

---

## 4.1 Core Services

* Supabase Auth → authentication
* PostgreSQL → data storage
* Realtime → live updates
* Storage → media files
* Edge Functions → business logic

---

## 4.2 Database Design Principle

Everything is scoped:

```text id="db1"
user_id
relationship_id
```

No unscoped data is allowed.

---

# 5. DATABASE ARCHITECTURE

---

## 5.1 Core Tables

### USERS

```text id="t1"
id
email
name
avatar_url
created_at
```

---

### RELATIONSHIPS

```text id="t2"
id
user_1_id
user_2_id
status
relationship_name
created_at
streak_count
```

---

### MOMENTS

```text id="t3"
id
relationship_id
user_id
type
content
media_url
created_at
```

---

### MESSAGES

```text id="t4"
id
relationship_id
sender_id
content
media_url
read_at
created_at
```

---

### ACTIVITIES

```text id="t5"
id
relationship_id
type
payload
status
created_at
```

---

### CALENDAR_EVENTS

```text id="t6"
id
relationship_id
title
date_time
type
source (manual | activity | experience)
created_at
```

---

### JOURNAL_ENTRIES

```text id="t7"
id
relationship_id
user_id
content
type
created_at
```

---

### MOOD_LOGS

```text id="t8"
id
relationship_id
user_id
mood
created_at
```

---

### BUCKET_LIST

```text id="t9"
id
relationship_id
title
status
created_at
```

---

### EXPERIENCES

```text id="t10"
id
title
type
location
price_range
external_url
created_at
```

---

# 6. REAL-TIME SYSTEM DESIGN

## Supabase Realtime Channels

Used for:

### Chat

* message insert events
* typing indicators
* read receipts

---

### Moments

* instant partner updates

---

### Mood Updates

* live emotional state sync

---

### Activity Responses

* shared activity completion

---

# 7. DATA FLOW ARCHITECTURE

---

## 7.1 Moment Flow

```text id="flow1"
User creates Moment
→ Upload media (Supabase Storage)
→ Insert DB record
→ Trigger realtime event
→ Partner receives update
→ UI updates instantly
```

---

## 7.2 Chat Flow

```text id="flow2"
User sends message
→ Insert into messages table
→ Supabase Realtime emits event
→ Receiver UI updates instantly
→ Optional push notification
```

---

## 7.3 Activity Flow

```text id="flow3"
User starts activity
→ Activity stored in DB
→ Partner notified
→ Completion updates shared state
```

---

## 7.4 Calendar Flow

```text id="flow4"
Activity/Experience created
→ Auto-generate calendar event
→ Sync to both users
→ Notification scheduled
```

---

# 8. STORAGE ARCHITECTURE

## Supabase Storage Buckets

```text id="storage1"
moments/
chat_media/
journal_media/
profile_images/
```

Rules:

* all uploads scoped by relationship_id
* signed URLs for secure access
* automatic compression for images/videos

---

# 9. SECURITY ARCHITECTURE

## 9.1 Row Level Security (RLS)

Every table enforces:

```text id="sec1"
WHERE relationship_id = current_user_relationship
```

---

## 9.2 Access Control Rules

* users can only access their own relationship
* no cross-relationship queries allowed
* strict ownership validation

---

## 9.3 Storage Security

* signed URLs required
* expiration-based access
* no public buckets

---

# 10. NOTIFICATION ARCHITECTURE

## Push Notifications (Expo)

Triggers:

* new message
* new moment
* mood update
* activity prompt
* streak warning
* calendar event reminder

---

## Email Notifications (Resend)

Used for:

* weekly summaries
* onboarding emails
* account recovery

---

# 11. STATE ARCHITECTURE

## Zustand Stores

```text id="state1"
authStore
relationshipStore
momentStore
chatStore
activityStore
uiStore
```

---

## TanStack Query Layers

Cached server data:

* chat messages
* moments
* activities
* calendar events

---

# 12. PERFORMANCE ARCHITECTURE

## Rules

* lazy load all feeds
* paginate timeline data
* compress media before upload
* cache chat messages locally
* optimistic UI updates

---

## Targets

* app startup < 2 seconds
* chat latency < 500ms
* moment delivery < 1 second

---

# 13. ANALYTICS ARCHITECTURE

Tracked via PostHog:

Events:

```text id="analytics1"
app_open
moment_created
message_sent
activity_started
activity_completed
calendar_event_created
journal_entry_created
streak_updated
subscription_started
```

---

# 14. ERROR TRACKING ARCHITECTURE

Sentry tracks:

* API failures
* UI crashes
* network issues
* realtime sync failures

---

# 15. MONETIZATION ARCHITECTURE

Managed by RevenueCat.

Entitlements:

```text id="mon1"
free
plus
```

Rules:

* subscription scoped per relationship
* both users share access
* no individual billing

---

# 16. EXTERNAL INTEGRATION ARCHITECTURE

## Services

* RevenueCat → subscriptions
* PostHog → analytics
* Sentry → error tracking
* Expo Notifications → push
* Resend → email

---

## Experiences Layer

External affiliate systems:

* booking links
* restaurant links
* activity platforms

No direct payment handling in MVP.

---

# 17. SCALABILITY MODEL

System is designed for:

* millions of relationships
* high-frequency chat usage
* media-heavy timelines

Scaling strategy:

* Supabase horizontal scaling
* CDN for media
* edge functions for compute-heavy tasks

---

# 18. CORE ARCHITECTURAL PRINCIPLE

> Everything in Moments exists inside a relationship boundary.

If a feature cannot be scoped to:

```text id="core1"
relationship_id
```

it does not belong in the system.

---

# END OF ARCHITECTURE.md
