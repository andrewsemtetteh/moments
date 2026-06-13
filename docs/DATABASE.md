# DATABASE.md

## Moments ❤️

---

# 1. DATABASE OVERVIEW

Moments uses a **relationship-scoped PostgreSQL database** (via Supabase).

Core rule:

```text id="db0"
EVERY ROW MUST BELONG TO A relationship_id
```

There are no global or public entities.

---

# 2. CORE DESIGN PRINCIPLE

The database is built around:

```text id="db1"
Users ↔ Relationships ↔ Shared Data
```

All application features exist inside a relationship container.

---

# 3. CORE TABLES

---

# 3.1 USERS

Stores authentication and profile data.

```sql id="t_users"
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

# 3.2 RELATIONSHIPS

The central system table.

```sql id="t_relationships"
CREATE TABLE relationships (
  id UUID PRIMARY KEY,
  user_1_id UUID REFERENCES users(id),
  user_2_id UUID REFERENCES users(id),
  relationship_name TEXT,
  status TEXT CHECK (status IN ('active', 'pending', 'ended')),
  streak_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

# 4. MOMENTS

Core emotional capture system.

```sql id="t_moments"
CREATE TABLE moments (
  id UUID PRIMARY KEY,
  relationship_id UUID REFERENCES relationships(id),
  user_id UUID REFERENCES users(id),
  type TEXT CHECK (
    type IN ('photo', 'text', 'voice', 'mood', 'location')
  ),
  content TEXT,
  media_url TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

Indexes:

```sql id="idx_moments"
CREATE INDEX idx_moments_relationship_id
ON moments(relationship_id);
```

---

# 5. MESSAGES (CHAT)

```sql id="t_messages"
CREATE TABLE messages (
  id UUID PRIMARY KEY,
  relationship_id UUID REFERENCES relationships(id),
  sender_id UUID REFERENCES users(id),
  content TEXT,
  media_url TEXT,
  read_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

Indexes:

```sql id="idx_messages"
CREATE INDEX idx_messages_relationship_id
ON messages(relationship_id);
```

---

# 6. ACTIVITIES

Stores all activity interactions.

```sql id="t_activities"
CREATE TABLE activities (
  id UUID PRIMARY KEY,
  relationship_id UUID REFERENCES relationships(id),
  type TEXT,
  payload JSONB,
  status TEXT CHECK (
    status IN ('pending', 'in_progress', 'completed')
  ),
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

# 7. CALENDAR EVENTS

```sql id="t_calendar"
CREATE TABLE calendar_events (
  id UUID PRIMARY KEY,
  relationship_id UUID REFERENCES relationships(id),
  title TEXT,
  date_time TIMESTAMP,
  type TEXT CHECK (
    type IN ('date', 'anniversary', 'reminder', 'experience', 'custom')
  ),
  source TEXT CHECK (
    source IN ('manual', 'activity', 'experience')
  ),
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

# 8. JOURNAL ENTRIES

```sql id="t_journal"
CREATE TABLE journal_entries (
  id UUID PRIMARY KEY,
  relationship_id UUID REFERENCES relationships(id),
  user_id UUID REFERENCES users(id),
  content TEXT,
  type TEXT CHECK (
    type IN ('reflection', 'gratitude', 'memory', 'emotion', 'plan')
  ),
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

# 9. MOOD LOGS

```sql id="t_mood"
CREATE TABLE mood_logs (
  id UUID PRIMARY KEY,
  relationship_id UUID REFERENCES relationships(id),
  user_id UUID REFERENCES users(id),
  mood TEXT CHECK (
    mood IN ('happy', 'excited', 'calm', 'stressed', 'lonely')
  ),
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

# 10. BUCKET LIST

```sql id="t_bucket"
CREATE TABLE bucket_list (
  id UUID PRIMARY KEY,
  relationship_id UUID REFERENCES relationships(id),
  title TEXT,
  status TEXT CHECK (
    status IN ('pending', 'completed')
  ),
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

# 11. SHARED GOALS

```sql id="t_goals"
CREATE TABLE shared_goals (
  id UUID PRIMARY KEY,
  relationship_id UUID REFERENCES relationships(id),
  title TEXT,
  progress INT DEFAULT 0,
  status TEXT CHECK (
    status IN ('active', 'completed')
  ),
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

# 12. EXPERIENCES (MARKETPLACE LAYER)

```sql id="t_experiences"
CREATE TABLE experiences (
  id UUID PRIMARY KEY,
  title TEXT,
  type TEXT,
  location TEXT,
  price_range TEXT,
  external_url TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

# 13. SAVED EXPERIENCES

```sql id="t_saved_exp"
CREATE TABLE saved_experiences (
  id UUID PRIMARY KEY,
  relationship_id UUID REFERENCES relationships(id),
  experience_id UUID REFERENCES experiences(id),
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

# 14. NOTIFICATIONS

```sql id="t_notifications"
CREATE TABLE notifications (
  id UUID PRIMARY KEY,
  relationship_id UUID REFERENCES relationships(id),
  user_id UUID REFERENCES users(id),
  type TEXT,
  content TEXT,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

# 15. STREAKS

```sql id="t_streaks"
CREATE TABLE streaks (
  id UUID PRIMARY KEY,
  relationship_id UUID REFERENCES relationships(id),
  current_streak INT DEFAULT 0,
  longest_streak INT DEFAULT 0,
  last_active_date DATE,
  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

# 16. WRAPPED DATA

```sql id="t_wrapped"
CREATE TABLE wrapped_stats (
  id UUID PRIMARY KEY,
  relationship_id UUID REFERENCES relationships(id),
  year INT,
  moments_count INT,
  activities_completed INT,
  mood_summary JSONB,
  highlights JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

# 17. INDEXING STRATEGY

## Critical indexes:

* relationship_id (ALL tables)
* created_at (timeline queries)
* user_id (personal filtering)

---

# 18. ROW LEVEL SECURITY (RLS)

---

## Rule 1: Relationship Isolation

```sql id="rls1"
USERS can only access rows where:
relationship_id IN (
  SELECT id FROM relationships
  WHERE user_1_id = auth.uid()
  OR user_2_id = auth.uid()
)
```

---

## Rule 2: Message Security

Users can only:

* read messages in their relationship
* send messages as themselves

---

## Rule 3: Moments Security

Only visible within relationship scope.

---

# 19. DATA FLOW RULES

---

## Moment Flow

1. insert moment
2. upload media (if exists)
3. notify partner
4. update timeline cache

---

## Chat Flow

1. insert message
2. realtime broadcast
3. push notification
4. update read state

---

## Activity Flow

1. create activity record
2. update both users
3. optionally create calendar event

---

# 20. STORAGE SCHEMA (SUPABASE)

Buckets:

```text id="st1"
moments/
chat/
journal/
profile/
```

Rules:

* signed URLs required
* relationship-based folder structure
* auto compression enabled

---

# 21. PERFORMANCE RULES

* paginate all timeline queries
* limit chat fetch to last 50 messages
* lazy-load media content
* cache relationship state locally

---

# 22. CORE DATABASE RULE

> If a record cannot be tied to a relationship, it does not exist in Moments.

---

# END OF DATABASE.md
