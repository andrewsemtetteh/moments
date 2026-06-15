# DATABASE_SCHEMA.md

## Moments ❤️

---

# 1. SCHEMA OVERVIEW

This schema is designed for **Supabase PostgreSQL**.

Core rule:

```text id="s0"
ALL DATA IS SCOPED TO relationship_id
```

There is no global application state.

---

# 2. EXTENSIONS REQUIRED

```sql id="ext1"
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

---

# 3. ENUM TYPES

---

## 3.1 Relationship Status

```sql id="e1"
CREATE TYPE relationship_status AS ENUM (
  'pending',
  'active',
  'ended'
);
```

---

## 3.2 Moment Type

```sql id="e2"
CREATE TYPE moment_type AS ENUM (
  'photo',
  'text',
  'voice',
  'mood',
  'location'
);
```

---

## 3.3 Mood Type

```sql id="e3"
CREATE TYPE mood_type AS ENUM (
  'happy',
  'excited',
  'calm',
  'stressed',
  'lonely'
);
```

---

## 3.4 Activity Status

```sql id="e4"
CREATE TYPE activity_status AS ENUM (
  'pending',
  'in_progress',
  'completed'
);
```

---

## 3.5 Event Type

```sql id="e5"
CREATE TYPE event_type AS ENUM (
  'date',
  'anniversary',
  'reminder',
  'experience',
  'custom'
);
```

---

## 3.6 Journal Type

```sql id="e6"
CREATE TYPE journal_type AS ENUM (
  'reflection',
  'gratitude',
  'memory',
  'emotion',
  'plan'
);
```

---

# 4. TABLE DEFINITIONS

---

# 4.1 USERS

```sql id="t1"
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

# 4.2 RELATIONSHIPS

```sql id="t2"
CREATE TABLE relationships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_1_id UUID REFERENCES users(id),
  user_2_id UUID REFERENCES users(id),
  relationship_name TEXT,
  status relationship_status DEFAULT 'pending',
  streak_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

# 4.3 MOMENTS

```sql id="t3"
CREATE TABLE moments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  relationship_id UUID REFERENCES relationships(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  type moment_type NOT NULL,
  content TEXT,
  media_url TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## Indexes

```sql id="i1"
CREATE INDEX idx_moments_relationship
ON moments(relationship_id);

CREATE INDEX idx_moments_created_at
ON moments(created_at DESC);
```

---

# 4.4 MESSAGES

```sql id="t4"
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  relationship_id UUID REFERENCES relationships(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES users(id),
  content TEXT,
  media_url TEXT,
  read_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## Indexes

```sql id="i2"
CREATE INDEX idx_messages_relationship
ON messages(relationship_id, created_at DESC);
```

---

# 4.5 ACTIVITIES

```sql id="t5"
CREATE TABLE activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  relationship_id UUID REFERENCES relationships(id),
  type TEXT NOT NULL,
  payload JSONB,
  status activity_status DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

# 4.6 CALENDAR EVENTS

```sql id="t6"
CREATE TABLE calendar_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  relationship_id UUID REFERENCES relationships(id),
  title TEXT NOT NULL,
  date_time TIMESTAMP NOT NULL,
  type event_type,
  source TEXT CHECK (source IN ('manual', 'activity', 'experience')),
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

# 4.7 JOURNAL ENTRIES

```sql id="t7"
CREATE TABLE journal_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  relationship_id UUID REFERENCES relationships(id),
  user_id UUID REFERENCES users(id),
  content TEXT NOT NULL,
  type journal_type,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

# 4.8 MOOD LOGS

```sql id="t8"
CREATE TABLE mood_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  relationship_id UUID REFERENCES relationships(id),
  user_id UUID REFERENCES users(id),
  mood mood_type,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

# 4.9 BUCKET LIST

```sql id="t9"
CREATE TABLE bucket_list (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  relationship_id UUID REFERENCES relationships(id),
  title TEXT NOT NULL,
  status TEXT CHECK (status IN ('pending', 'completed')) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

# 4.10 SHARED GOALS

```sql id="t10"
CREATE TABLE shared_goals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  relationship_id UUID REFERENCES relationships(id),
  title TEXT NOT NULL,
  progress INT DEFAULT 0,
  status TEXT CHECK (status IN ('active', 'completed')) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

# 4.11 EXPERIENCES (MARKETPLACE)

```sql id="t11"
CREATE TABLE experiences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  type TEXT,
  location TEXT,
  price_range TEXT,
  external_url TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

# 4.12 SAVED EXPERIENCES

```sql id="t12"
CREATE TABLE saved_experiences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  relationship_id UUID REFERENCES relationships(id),
  experience_id UUID REFERENCES experiences(id),
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

# 4.13 NOTIFICATIONS

```sql id="t13"
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  relationship_id UUID REFERENCES relationships(id),
  user_id UUID REFERENCES users(id),
  type TEXT,
  content TEXT,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

# 4.14 STREAKS

```sql id="t14"
CREATE TABLE streaks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  relationship_id UUID UNIQUE,
  current_streak INT DEFAULT 0,
  longest_streak INT DEFAULT 0,
  last_active_date DATE,
  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

# 4.15 WRAPPED STATS

```sql id="t15"
CREATE TABLE wrapped_stats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  relationship_id UUID,
  year INT,
  moments_count INT DEFAULT 0,
  activities_completed INT DEFAULT 0,
  mood_summary JSONB,
  highlights JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

# 5. RELATIONSHIP CONSTRAINT RULES

---

## Rule 1: 2 Users Only

```text id="c1"
A relationship must always have exactly 2 users.
```

Enforced in application layer.

---

## Rule 2: Single Active Relationship

A user can only belong to:

* 1 active relationship at a time

---

## Rule 3: Cascade Delete

Deleting relationship deletes:

* moments
* messages
* activities
* journal entries
* mood logs
* calendar events

---

# 6. ROW LEVEL SECURITY (RLS)

---

## Core Policy

```sql id="r1"
USING (
  relationship_id IN (
    SELECT id FROM relationships
    WHERE user_1_id = auth.uid()
       OR user_2_id = auth.uid()
  )
)
```

---

## Applies to:

* moments
* messages
* activities
* calendar_events
* journal_entries
* mood_logs
* bucket_list
* shared_goals
* notifications

---

# 7. PERFORMANCE INDEX STRATEGY

Required indexes:

```sql id="p1"
relationship_id
created_at DESC
user_id
```

---

# 8. STORAGE STRUCTURE

Supabase buckets:

```text id="st1"
moments/
chat/
journal/
profiles/
```

---

# 9. CRITICAL SYSTEM RULE

> If a table does not include relationship_id, it does not exist in Moments.

---

# END OF DATABASE_SCHEMA.md
