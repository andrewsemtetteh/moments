# API.md

## Moments ❤️

---

# 1. API OVERVIEW

Moments uses a **hybrid API architecture**:

```text id="api0"
Mobile App (React Native)
        ↓
Supabase Client SDK (Primary)
        ↓
Edge Functions (Business Logic Layer)
        ↓
PostgreSQL + Realtime Engine
```

There are **no traditional REST controllers**.

Instead:

* Supabase tables = primary API surface
* Edge Functions = business logic layer
* Realtime = event delivery layer

---

# 2. API DESIGN PRINCIPLE

All API operations must follow:

```text id="api1"
relationship_id SCOPED ACCESS ONLY
```

No endpoint returns cross-relationship data.

---

# 3. AUTH API (SUPABASE AUTH)

---

## 3.1 Sign Up

Handled by Supabase Auth:

```ts id="auth1"
supabase.auth.signUp({
  email,
  password
})
```

---

## 3.2 Sign In

```ts id="auth2"
supabase.auth.signInWithPassword({
  email,
  password
})
```

---

## 3.3 OAuth Sign In

Supported providers:

* Apple
* Google

```ts id="auth3"
supabase.auth.signInWithOAuth({
  provider: 'google'
})
```

---

## 3.4 Session Retrieval

```ts id="auth4"
supabase.auth.getSession()
```

---

# 4. RELATIONSHIP API

---

## 4.1 Create Relationship

```ts id="rel1"
POST /edge/create-relationship
```

### Request

```json
{
  "user_1_id": "uuid",
  "relationship_name": "My Love"
}
```

### Response

```json
{
  "relationship_id": "uuid",
  "status": "pending"
}
```

---

## 4.2 Join Relationship

```ts id="rel2"
POST /edge/join-relationship
```

### Request

```json
{
  "invite_code": "ABC123"
}
```

---

## 4.3 Get Relationship

```ts id="rel3"
GET /relationship
```

Returns:

* partner info
* streak
* status
* metadata

---

# 5. MOMENTS API

---

## 5.1 Create Moment

```ts id="m1"
POST /edge/create-moment
```

### Request

```json
{
  "type": "photo",
  "content": "string",
  "media_url": "optional"
}
```

### Behavior

* uploads media (if exists)
* inserts DB row
* triggers realtime event

---

## 5.2 Fetch Moments

```ts id="m2"
GET /moments?limit=50&cursor=timestamp
```

Returns:

* paginated timeline
* grouped by date

---

## 5.3 Delete Moment

```ts id="m3"
DELETE /moment/:id
```

Rule:

* only creator can delete (optional soft delete)

---

# 6. CHAT API

---

## 6.1 Send Message

```ts id="c1"
POST /edge/send-message
```

### Request

```json
{
  "content": "Hello ❤️",
  "media_url": null
}
```

---

## 6.2 Fetch Messages

```ts id="c2"
GET /messages?limit=50
```

---

## 6.3 Mark as Read

```ts id="c3"
POST /edge/mark-read
```

---

## 6.4 Typing Indicator (Realtime only)

```text id="c4"
channel: relationship:{id}:typing
```

---

# 7. ACTIVITIES API

---

## 7.1 Generate Activity

```ts id="a1"
POST /edge/generate-activity
```

### Request

```json
{
  "mood": "calm",
  "budget": 50,
  "time_available": 2
}
```

### Response

```json
{
  "activities": [
    {
      "title": "Sunset walk",
      "type": "outdoor"
    }
  ]
}
```

---

## 7.2 Complete Activity

```ts id="a2"
POST /edge/complete-activity
```

---

## 7.3 Daily Challenge

```ts id="a3"
GET /daily-challenge
```

---

# 8. CALENDAR API

---

## 8.1 Create Event

```ts id="cal1"
POST /edge/create-event
```

---

## 8.2 Fetch Events

```ts id="cal2"
GET /calendar
```

---

## 8.3 Delete Event

```ts id="cal3"
DELETE /event/:id
```

---

# 9. JOURNAL API

---

## 9.1 Create Entry

```ts id="j1"
POST /edge/create-journal
```

---

## 9.2 Fetch Entries

```ts id="j2"
GET /journal
```

---

# 10. MOOD API

---

## 10.1 Update Mood

```ts id="mood1"
POST /edge/update-mood
```

---

## 10.2 Fetch Mood History

```ts id="mood2"
GET /mood-history
```

---

# 11. BUCKET LIST API

---

## 11.1 Add Item

```ts id="b1"
POST /edge/bucket-list/add
```

---

## 11.2 Update Item

```ts id="b2"
PATCH /bucket-list/:id
```

---

# 12. EXPERIENCES API

---

## 12.1 Fetch Experiences

```ts id="e1"
GET /experiences
```

---

## 12.2 Save Experience

```ts id="e2"
POST /edge/save-experience
```

---

# 13. NOTIFICATIONS API

---

## 13.1 Fetch Notifications

```ts id="n1"
GET /notifications
```

---

## 13.2 Mark as Read

```ts id="n2"
POST /edge/notification-read
```

---

# 14. STREAK API

---

## 14.1 Get Streak

```ts id="s1"
GET /streak
```

---

## 14.2 Update Streak (internal only)

Triggered automatically on:

* moment creation
* activity completion
* journal entry

---

# 15. WRAPPED API

---

## 15.1 Get Wrapped Data

```ts id="w1"
GET /wrapped/:year
```

---

# 16. REAL-TIME EVENT SYSTEM

---

## 16.1 Channels

```text id="rt1"
relationship:{id}:messages
relationship:{id}:moments
relationship:{id}:mood
relationship:{id}:activities
```

---

## 16.2 Event Types

### Message Event

```json id="rt2"
{
  "type": "message_new",
  "payload": {}
}
```

---

### Moment Event

```json id="rt3"
{
  "type": "moment_new"
}
```

---

### Mood Event

```json id="rt4"
{
  "type": "mood_update"
}
```

---

# 17. EDGE FUNCTIONS (CORE LOGIC)

---

## Functions List

```text id="ef1"
create-relationship
join-relationship
create-moment
send-message
generate-activity
complete-activity
update-mood
create-event
```

---

## Responsibilities

Edge Functions handle:

* validation
* business logic
* streak updates
* notifications
* external API calls

---

# 18. SECURITY RULES

---

## 18.1 Authentication Required

All endpoints require:

```text id="sec1"
auth.uid()
```

---

## 18.2 Relationship Check

Every request must validate:

```text id="sec2"
user belongs to relationship_id
```

---

## 18.3 No Cross-Relationship Access

Strict enforcement at:

* database level (RLS)
* edge functions
* client queries

---

# 19. PERFORMANCE RULES

* paginate all GET endpoints
* limit chat fetch to 50 messages
* compress media before upload
* cache relationship state locally
* debounce realtime updates

---

# 20. CORE API RULE

> If an API call does not belong to a relationship context, it is invalid.

---

# END OF API.md
