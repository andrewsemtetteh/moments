# FEATURES.md

## Moments ❤️

---

# 1. FEATURE SYSTEM OVERVIEW

Moments is composed of 5 core experience layers:

```text id="fx1"
1. Home (Emotional Dashboard)
2. Moments (Expression Layer)
3. Activities (Engagement Engine)
4. Chat (Communication Layer)
5. Calendar (Planning Layer)
6. Profile (Memory + Identity Layer)
```

Everything in the app must belong to one of these systems.

---

# 2. HOME FEATURES

## 2.1 Latest Moment Feed

Shows the most recent interaction between partners.

Supports:

* image preview
* text preview
* voice playback
* mood indicator

---

## 2.2 Mood Snapshot

Displays both users' current emotional state.

States:

* happy
* excited
* calm
* stressed
* lonely

---

## 2.3 Daily Question

A shared prompt delivered once per day.

Rules:

* same question for both users
* both can respond independently
* stored in timeline

---

## 2.4 Streak System Display

Shows:

* daily streak count
* activity streak
* consistency badge

---

## 2.5 Smart Suggestions

Context-aware suggestions:

* inactivity → suggest activity
* low mood → suggest conversation
* weekend → suggest date idea

---

# 3. MOMENTS FEATURES

## 3.1 Moment Creation Types

```text id="m1"
PHOTO MOMENT
TEXT MOMENT
VOICE MOMENT
MOOD MOMENT
LOCATION MOMENT
```

---

## 3.2 Moment Rules

* must be tied to relationship_id
* instantly visible to partner
* stored in timeline
* optionally deletable (configurable rule)

---

## 3.3 Moment Feed Behavior

* chronological order
* infinite scroll
* grouped by day
* fast load caching

---

## 3.4 Moment Interactions

* reactions (❤️ 😂 😢 😍)
* comments (optional lightweight thread)
* save to memory timeline

---

# 4. CHAT FEATURES

## 4.1 Messaging System

* real-time messaging (Supabase Realtime)
* text messages
* emoji reactions
* read receipts
* typing indicators
* video and audio call

---

## 4.2 Media Support

* image sharing
* voice notes
* video (compressed)

---

## 4.3 Message Management

* pin messages
* delete for self
* optional delete for both

---

## 4.4 Chat Structure Rule

* 1 chat per relationship
* no group chats
* no threads

---

# 5. ACTIVITIES FEATURES (CORE ENGINE)

---

## 5.1 Daily Challenges

Automatically generated daily prompts.

Types:

* appreciation prompts
* emotional prompts
* fun dares
* bonding exercises

---

## 5.2 Activity Generator

Input-based system:

Inputs:

* time available
* budget
* mood
* distance

Outputs:

* date ideas
* games
* conversations
* experiences
* productivity activities
* relaxation ideas

---

## 5.3 Conversation Cards

Random prompt generator.

Categories:

* deep
* romantic
* funny
* weird
* future

---

## 5.4 Compatibility Quizzes

Types:

* love language
* communication style
* personality match

Output:

* score visualization
* insights summary
* fun breakdown

---

## 5.5 Mini Games

Real-time interactive games:

* truth or dare
* would you rather
* never have I ever
* emoji guess
* this or that

---

## 5.6 Date Planner

Structured date suggestion system.

Types:

* home dates
* outdoor dates
* virtual dates
* special occasions

Each includes:

* description
* estimated cost
* duration
* vibe (romantic/fun/calm)

---

## 5.7 Bucket List

Shared goal list.

Each item:

* title
* status (pending/completed)
* timestamp
* optional note

---

## 5.8 Shared Goals

Tracked progress system:

* goal name
* progress %
* milestones
* completion status

---

## 5.9 Mood Check-ins

User selects mood state:

* happy
* excited
* calm
* stressed
* lonely

Triggers:

* partner notification
* activity suggestion

---

## 5.10 Long Distance Mode

Activated when partners are apart.

Features:

* watch together sessions (sync placeholder)
* shared games
* countdowns
* prompts
* emotional check-ins

---

## 5.11 Experiences (Marketplace Layer)

External real-world suggestions.

Includes:

* restaurants
* events
* activities
* hotels
* staycations

Actions:

* save experience
* book externally
* add to calendar

---

# 6. CALENDAR FEATURES

## 6.1 Event Types

* date night
* anniversary
* reminder
* experience booking
* custom event

---

## 6.2 Calendar Behavior

* shared between both users
* real-time sync
* notifications enabled

---

## 6.3 Integration Rules

* Activities can auto-create events
* Experiences automatically generate events
* Chat can suggest calendar events

---

# 7. PROFILE FEATURES

## 7.1 Relationship Overview

* partner info
* relationship duration
* streak stats

---

## 7.2 Memory Timeline

Chronological relationship archive:

Includes:

* Moments
* Chat highlights
* Journal entries
* Media

---

## 7.3 Saved Content

* saved moments
* saved experiences
* saved messages

---

## 7.4 Settings

* notifications
* privacy controls
* data export
* account deletion

---

# 8. JOURNAL FEATURES (GLOBAL HEADER)

## 8.1 Entry Types

* reflection
* gratitude
* memory
* emotional note
* future plan

---

## 8.2 Rules

* both users can write
* timestamped entries
* editable only by author (configurable)

---

# 9. NOTIFICATION FEATURES

Triggered events:

* new moment
* daily challenge
* streak warning
* mood update
* activity suggestion
* calendar reminder
* message received

---

# 10. STREAK SYSTEM FEATURES

Tracks:

* daily engagement
* moments sent
* activities completed
* journal entries

Rules:

* resets after inactivity threshold
* grace period allowed
* recovery system optional

---

# 11. WRAPPED FEATURES

Annual recap includes:

* total moments
* activities completed
* mood trends
* relationship highlights
* streak performance

---

# 12. EXPERIENCE SYSTEM (MONETIZATION LAYER)

Supports affiliate integrations:

* restaurants
* hotels
* experiences
* event platforms

Actions:

* discover
* save
* book
* calendar sync

---

# 13. SYSTEM-WIDE RULES

## 13.1 Relationship Isolation

All data must include:

```text id="r1"
relationship_id
```

No cross-relationship visibility.

---

## 13.2 Real-Time Sync Requirement

Must use Supabase Realtime for:

* chat
* moments
* mood updates
* activity responses

---

## 13.3 Performance Rules

* fast initial load (<2s)
* cached timeline data
* optimized media compression
* lazy loading for feeds

---

## 13.4 UX Principle

Every feature must answer:

> “Does this help two people feel closer right now?”

If no → it does not belong.

---

# END OF FEATURES.md
