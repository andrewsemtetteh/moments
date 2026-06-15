# FLOW.md

## Moments ❤️

---

# 1. PURPOSE

This document defines the **end-to-end user experience flow** of Moments — from onboarding to daily usage, relationship building, and long-term engagement.

It connects all systems:

* UI/UX
* Backend
* Real-time
* AI
* Monetization

---

# 2. CORE FLOW PHILOSOPHY

> The app should feel like a natural extension of a relationship, not a tool.

Every flow must be:

* simple
* emotional
* fast
* low-friction
* gesture-driven

---

# 3. ONBOARDING FLOW

3.0 For the web it should be the current landing page, just tweak it to suit the app info and the appstore and playstore download. same color scheme and all.

---

## 3.1 Entry Screen

User lands on:
- splash screen

You have freedom to design, be creative in designing the entry screen, subscription display, user story or what shows onn the entry screen based on the app.


* “Create your relationship space”

Options:

* Sign up with Email
* Google OAuth
* Apple OAuth

---

## 3.2 Profile Setup

User enters:

* name
* avatar
* optional nickname for partner

---

## 3.3 Relationship Creation

User selects:

* “Create Relationship” OR “Join Relationship”

---

## 3.4 Invite System

If creating:

* system generates invite code

If joining:

* user enters invite code

---

## 3.5 Relationship Confirmation

System creates:

```text id="f1"
relationship_id
```

Both users now enter shared space.

---

# 4. FIRST TIME EXPERIENCE FLOW

---

## 4.1 Welcome Screen

Displays:

* partner name
* relationship theme
* streak starts at 0

---

## 4.2 First Moment Prompt

User is encouraged to:

* send first message
* or create first moment

---

## 4.3 First Activity Suggestion

AI generates:

* simple bonding activity
* low effort interaction

Powered by:

Anthropic

---

# 5. DAILY APP FLOW

---

## 5.1 Home Screen Entry

User lands on Home:

* relationship mood snapshot
* latest moment
* daily question

---

## 5.2 Daily Loop

User typically flows through:

```text id="f2"
Home → Chat → Activities → Calendar → Moments
```

---

## 5.3 Micro Interactions

Throughout the day:

* messages sent
* mood updates
* small moments shared

---

# 6. CHAT FLOW

---

## 6.1 Open Chat

* loads last 50 messages
* realtime connection established

---

## 6.2 Message Send Flow

```text id="f3"
Type message → Send → Optimistic UI → Sync → Realtime partner update
```

---

## 6.3 Media Sharing

* upload media to storage
* generate signed URL
* attach to message

---

## 6.4 Emotional Layer

Chat is not just messaging:

* reactions
* mood-linked responses
* memory tagging

---

# 7. MOMENTS FLOW

---

## 7.1 Create Moment

User action:

* capture photo/video/text
* optionally add mood tag

---

## 7.2 Processing Flow

```text id="f4"
Upload media → Save to DB → Notify partner → Add to timeline
```

---

## 7.3 Viewing Moments

* vertical timeline
* swipe gestures
* save to memory

---

# 8. ACTIVITIES FLOW

---

## 8.1 Daily Challenge

System generates:

* question / task / mini game

Delivered on Home or Activities tab

---

## 8.2 Activity Generator

User inputs:

* mood
* time available
* budget

AI returns:

* 3–5 suggestions

---

## 8.3 Completion Flow

```text id="f5"
Select activity → Start → Mark complete → Update streak → Save to calendar
```

---

# 9. CALENDAR FLOW

---

## 9.1 Event Creation

Events come from:

* manual input
* completed activities
* experiences

---

## 9.2 Viewing Flow

* monthly view default
* tap date → event details

---

## 9.3 Sync Behavior

* both users receive updates instantly
* reminders triggered via notifications

---

# 10. JOURNAL FLOW

---

## 10.1 Entry Creation

User opens journal (header icon):

* writes reflection
* tags mood (optional)

---

## 10.2 Saving Flow

```text id="f6"
Write → Save → Sync → Add to memory timeline
```

---

## 10.3 Shared Visibility

* optional private entries
* optional shared entries

---

# 11. MOOD FLOW

---

## 11.1 Mood Check-in

User selects:

* happy
* stressed
* calm
* excited
* lonely

---

## 11.2 Sync Flow

```text id="f7"
Select mood → Update DB → Notify partner → Update insights
```

---

# 12. STREAK FLOW

---

## 12.1 Streak Logic

Streak increases when:

* chat activity occurs
* moment is created
* activity is completed

---

## 12.2 Reset Logic

* no interaction within defined period → streak resets

---

# 13. WRAPPED FLOW (YEARLY)

---

## 13.1 Trigger

Once per year or manually:

* system aggregates relationship data

---

## 13.2 AI Processing

Uses:

Anthropic

Generates:

* highlights
* emotional summary
* activity recap

---

## 13.3 Output

Displayed as:

* immersive recap screen
* shareable memory (optional private-first)

---

# 14. NOTIFICATION FLOW

---

Triggers:

* new message
* new moment
* activity reminder
* mood update
* streak status

---

Flow:

```text id="f8"
Event → Edge Function → Expo Push → Device
```

---

# 15. SUBSCRIPTION FLOW

---

## 15.1 Paywall Trigger

Shown when:

* AI limits reached
* storage limits reached
* premium feature accessed

---

## 15.2 Purchase Flow

Handled by:

RevenueCat

---

## 15.3 Unlock Flow

```text id="f9"
Payment success → Entitlement update → UI refresh → Feature unlocked
```

---

# 16. ERROR FLOW

---

If failure occurs:

* fallback UI shown
* retry option provided
* offline cache used where possible

---

# 17. OFFLINE FLOW

---

Supports:

* viewing cached messages
* viewing moments
* drafting messages/moments

Sync happens when online.

---

# 18. CORE FLOW RULE

> Every interaction must strengthen connection, not distract from it.

---

# END OF FLOW.md
