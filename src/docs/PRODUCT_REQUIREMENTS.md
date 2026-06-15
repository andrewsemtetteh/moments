# PRODUCT REQUIREMENTS DOCUMENT (PRD)

## Moments ❤️

---

# 1. PRODUCT OVERVIEW

Moments is a private, couples-only mobile application that enables two people in a relationship to:

* communicate
* share moments
* plan activities
* track emotions
* build memories
* maintain consistency through engagement systems

It is designed as a **relationship operating system for two people**.

---

# 2. CORE PRODUCT PRINCIPLE

Everything in Moments is scoped to:

```text
relationship_id
```

There are no public users, feeds, or social graphs.

Every feature exists inside a **2-person relationship container**.

---

# 3. USER MODEL

## 3.1 User

Each user has:

* id
* name
* email
* avatar
* created_at

---

## 3.2 Relationship

A relationship is the core unit.

```text
relationship:
- id
- user_1_id
- user_2_id
- relationship_name
- relationship_type (always "romantic" for now)
- created_at
- streak_count
- status (active | paused | ended)
```

---

## 3.3 Relationship Context Rule

All data must include:

```text
relationship_id
```

This ensures strict data isolation.

---

# 4. AUTHENTICATION FLOW

## 4.1 Signup

* Email authentication (Supabase Auth)
* OAuth (Apple and Google)

---

## 4.2 Relationship Pairing

User flow:

1. Create account
2. Create relationship
3. Generate invite link
4. Partner joins
5. Relationship becomes ACTIVE

---

## 4.3 Invite System

Invite types:

* link-based invite
* code-based invite

---

# 5. NAVIGATION STRUCTURE (MOBILE)

```text
Home
Activities
Chat
Calendar
Profile
```

---

# 6. GLOBAL UI ELEMENTS

## 6.1 Header (Persistent)

* Moment button (left)
* Relationship name (center)
* Notifications (right)
* Journal shortcut (top-right)

---

## 6.2 Moment System (Global Action)

Available from anywhere.

Moment types:

* photo
* text
* voice
* mood
* location

---

# 7. FEATURE SPECIFICATIONS

---

# 7.1 HOME SCREEN

## Purpose

Emotional dashboard of relationship.

---

## Components

### 1. Latest Moment

* most recent shared moment
* shows preview + interaction

---

### 2. Mood Snapshot

* user mood
* partner mood

---

### 3. Daily Question

* one prompt per day
* shared response system

---

### 4. Streak System

Tracks:

* daily interaction
* activity completion
* consistency score

---

### 5. Upcoming Events Preview

Pulls from Calendar:

* date nights
* anniversaries
* planned experiences

---

### 6. Smart Suggestions

Basic rule-based suggestions:

* if inactive → suggest activity
* if mood low → suggest conversation
* if weekend → suggest date idea

---

# 7.2 MOMENTS SYSTEM

## Purpose

Fast emotional capture system.

---

## Moment Types

```text
PHOTO
TEXT
VOICE
MOOD
LOCATION
```

---

## Rules

* Always tied to relationship_id
* Stored in timeline
* Immutable history (no deletion for partner-visible content optional toggle)

---

## Storage

* Supabase Storage for media
* PostgreSQL metadata

---

# 7.3 CHAT SYSTEM

## Features

* real-time messaging (Supabase Realtime)
* text messages
* voice notes
* media sharing
* reactions
* read receipts
* typing indicators
* pinned messages

---

## Rules

* 1 chat per relationship
* no group chats
* no multi-threading

---

# 7.4 ACTIVITIES SYSTEM

---

## 7.4.1 Daily Challenges

Generated daily per relationship.

Types:

* questions
* dares
* bonding tasks

---

## 7.4.2 Activity Generator

Input:

* time_available
* budget
* mood
* distance

Output:

* activity suggestions
* structured ideas

---

## 7.4.3 Compatibility Quizzes

Types:

* love language
* personality
* communication style

---

## 7.4.4 Conversation Cards

Random prompts categorized:

* deep
* funny
* romantic
* future
* weird

---

## 7.4.5 Mini Games

* truth or dare
* would you rather
* never have I ever
* emoji guess

---

## 7.4.6 Date Planner

Generates structured date experiences:

* home dates
* outdoor dates
* virtual dates

---

## 7.4.7 Bucket List

User-defined shared goals:

* travel
* experiences
* habits
* skills

Each item:

```text
title
status (pending | completed)
created_at
```

---

## 7.4.8 Shared Goals

Tracked progress items:

* fitness
* reading
* savings
* learning

Includes progress percentage.

---

## 7.4.9 Mood Check-ins

States:

* happy
* excited
* calm
* stressed
* lonely

Triggers notifications to partner.

---

## 7.4.10 Long Distance Mode

Activated when distance_flag = true.

Includes:

* watch together sessions (sync system placeholder)
* shared games
* prompts
* countdowns

---

## 7.4.11 Experiences (Marketplace System)

Displays curated external activities:

* restaurants
* events
* experiences
* hotels

Features:

* save experience
* book experience (external link or affiliate)
* add to calendar

---

# 7.5 CALENDAR SYSTEM

## Purpose

Shared relationship planning.

---

## Event Types

* date night
* anniversary
* experience booking
* reminder
* custom event

---

## Event Structure

```text
title
date_time
type
status
```

---

## Integration

* Activities → creates calendar events
* Experiences → auto add events
* Reminders → notify users

---

# 7.6 JOURNAL SYSTEM (GLOBAL HEADER FEATURE)

## Purpose

Shared emotional writing space.

---

## Entry Types

* reflection
* gratitude
* memory
* goal
* emotional note

---

## Rules

* both users can write
* timestamped entries
* editable only by author (configurable)

---

# 7.7 MEMORY TIMELINE

## Purpose

Permanent relationship archive.

Stores:

* moments
* media
* journal entries
* chat highlights (optional saved)

---

## Structure

Chronological timeline:

```text
date → entries
```

---

# 7.8 STREAK SYSTEM

Tracks:

* daily login
* moments sent
* activities completed

---

## Streak Rules

* resets after inactivity threshold
* grace period allowed
* notification warnings

---

# 7.9 WRAPPED SYSTEM

Annual summary:

* total moments
* activity count
* mood trends
* most active days
* relationship highlights

---

# 8. NOTIFICATIONS SYSTEM

Triggered events:

* new moment
* daily challenge
* streak warning
* mood update
* activity suggestion
* calendar reminder

---

# 9. DATA ARCHITECTURE (HIGH LEVEL)

All data is scoped:

```text
user_id
relationship_id
```

---

## Core Tables

* users
* relationships
* moments
* messages
* activities
* calendar_events
* journal_entries
* bucket_list_items
* goals
* mood_logs
* notifications

---

# 10. SECURITY REQUIREMENTS

## Must implement:

* Supabase Row Level Security (RLS)
* relationship-scoped access control
* secure media storage
* authentication required for all endpoints
* no cross-relationship data leakage

---

# 11. PERFORMANCE REQUIREMENTS

* instant chat delivery (<500ms ideal)
* optimized feed loading
* lazy loading for timeline
* image compression for Moments

---

# 12. ANALYTICS EVENTS

Track:

* app_open
* moment_created
* message_sent
* activity_started
* activity_completed
* calendar_event_created
* journal_entry_created
* streak_updated
* subscription_started

---

# 13. MONETIZATION MODEL

## Couple Subscription Model

One subscription covers both users.

---

## Free Tier

* limited Moments
* limited activities
* chat enabled
* calendar enabled
* journal enabled

---

## Paid Tier

* unlimited usage
* voice Moments
* premium activities
* wrapped recap
* long distance mode enhancements
* advanced planning features
* premium experiences access

---

# 14. EXTERNAL INTEGRATIONS

## Payments

* RevenueCat

## Notifications

* Expo Notifications
* Resend email system

## Analytics

* PostHog

## Error Tracking

* Sentry

---

# 15. APP STORE REQUIREMENTS

Must include:

* Privacy Policy URL
* Terms of Service URL
* Data deletion flow
* Account deletion endpoint
* Subscription disclosures
* Support email

---

# 16. CORE SYSTEM RULE

Every feature must answer:

> “Does this help two people feel closer or spend better time together?”

If not → it does not belong in Moments.

---

# END OF DOCUMENT
