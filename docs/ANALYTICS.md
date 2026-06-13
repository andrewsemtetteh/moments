# ANALYTICS.md

## Moments ❤️

---

# 1. ANALYTICS PHILOSOPHY

Moments does not track users like a social media platform.

It tracks **relationship health signals**, not attention metrics.

Core principle:

> Analytics should help improve connection, not optimize addiction.

---

# 2. ANALYTICS SYSTEM OVERVIEW

Uses:

PostHog

Plus internal Supabase event logging.

---

# 3. EVENT MODEL

All analytics events are scoped to:

```text id="a0"
relationship_id
user_id
```

No global user behavior tracking.

---

# 4. CORE EVENT CATEGORIES

---

## 4.1 Engagement Events

* app_open
* session_start
* session_end
* tab_viewed
* feature_used

---

## 4.2 Communication Events

* message_sent
* message_received
* message_read
* typing_started
* typing_stopped

---

## 4.3 Emotional Events

* mood_selected
* mood_changed
* mood_viewed
* emotional_checkin_completed

---

## 4.4 Memory Events

* moment_created
* moment_viewed
* moment_saved
* memory_timeline_opened

---

## 4.5 Activity Events

* activity_started
* activity_completed
* activity_skipped
* daily_challenge_completed

---

## 4.6 Calendar Events

* calendar_event_created
* calendar_event_updated
* calendar_event_completed

---

## 4.7 Journal Events

* journal_entry_created
* journal_entry_viewed

---

## 4.8 Retention Events

* streak_updated
* streak_broken
* return_after_inactive_days

---

## 4.9 Monetization Events

* paywall_viewed
* subscription_started
* subscription_cancelled
* upgrade_prompt_clicked

---

# 5. RELATIONSHIP HEALTH METRICS

---

Instead of vanity metrics, Moments computes:

---

## 5.1 Communication Balance

Measures:

* message ratio between users
* response time balance
* engagement equality

---

## 5.2 Emotional Sync Score

Based on:

* mood similarity over time
* shared activity participation
* journal overlap themes

---

## 5.3 Activity Engagement Score

Tracks:

* completed vs suggested activities
* consistency of participation
* initiative balance (who starts more activities)

---

## 5.4 Memory Density Score

Measures:

* moments per week
* media richness
* timeline consistency

---

## 5.5 Relationship Stability Score

Derived from:

* streak consistency
* return frequency
* communication gaps

---

# 6. EVENT COLLECTION STRATEGY

---

## 6.1 Real-Time Capture

Events are captured:

* instantly in frontend (lightweight)
* batch sent to backend

---

## 6.2 Batch Upload Strategy

* grouped per session
* sent every few minutes
* reduced network overhead

---

# 7. DATA STORAGE LAYER

Stored in Supabase:

Supabase

---

## Table: analytics_events

```sql id="t1"
CREATE TABLE analytics_events (
  id UUID PRIMARY KEY,
  relationship_id UUID,
  user_id UUID,
  event_type TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

# 8. DASHBOARD STRATEGY

---

## 8.1 Internal Dashboard (Admin Only)

Used for:

* system health
* engagement trends
* feature performance

---

## 8.2 Relationship Insights (User-Facing)

Users only see:

* simple summaries
* emotional insights
* gentle suggestions

NOT raw metrics.

---

# 9. REAL-TIME ANALYTICS

Uses:

Supabase Realtime

---

## Live Signals:

* message activity spikes
* mood changes
* activity completions
* streak updates

---

# 10. EVENT PRIVACY RULES

---

## 10.1 No External Tracking

* no third-party user profiling
* no cross-app tracking
* no ad-based analytics

---

## 10.2 Relationship Isolation

All analytics are strictly:

```text id="a1"
within a single relationship only
```

---

# 11. DATA PROCESSING RULES

---

## 11.1 Aggregation

Raw events are:

* aggregated daily
* summarized weekly
* summarized monthly

---

## 11.2 Retention Policy

* raw events: limited retention (e.g. 90–180 days)
* summaries: long-term storage
* wrapped data: yearly persistence

---

# 12. WRAPPED ANALYTICS ENGINE

---

At end of year:

Generates:

* most active moments
* top shared memories
* emotional trends
* activity breakdown
* relationship highlights

---

# 13. PERFORMANCE RULES

* analytics must not block UI
* all tracking is async
* batch writes preferred
* avoid tracking high-frequency gestures (scroll, typing)

---

# 14. AI INTEGRATION (OPTIONAL)

Uses:

Anthropic

AI is used ONLY for:

* summarizing relationship insights
* generating wrapped stories
* simplifying analytics into emotional language

---

# 15. CORE ANALYTICS RULE

> Analytics exists to strengthen relationships, not to quantify people.

---

# END OF ANALYTICS.md
