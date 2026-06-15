-- Moments: Full database schema with RLS
-- Run via: supabase db push (or apply in Supabase dashboard)

-- gen_random_uuid() is built into PostgreSQL 13+ (Supabase default)

-- Enums
DO $$ BEGIN
  CREATE TYPE relationship_status AS ENUM ('pending', 'active', 'ended');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE moment_type AS ENUM ('photo', 'text', 'voice', 'mood', 'location');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE mood_type AS ENUM ('happy', 'excited', 'calm', 'stressed', 'lonely');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE activity_status AS ENUM ('pending', 'in_progress', 'completed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE event_type AS ENUM ('date', 'anniversary', 'reminder', 'experience', 'custom');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE journal_type AS ENUM ('reflection', 'gratitude', 'memory', 'emotion', 'plan');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Users (extends auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Relationships
CREATE TABLE IF NOT EXISTS public.relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_1_id UUID NOT NULL REFERENCES public.users(id),
  user_2_id UUID REFERENCES public.users(id),
  relationship_name TEXT DEFAULT 'Our Moments',
  status relationship_status DEFAULT 'pending',
  streak_count INT DEFAULT 0,
  invite_code TEXT UNIQUE,
  distance_mode BOOLEAN DEFAULT FALSE,
  subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'plus')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT one_active_relationship CHECK (user_1_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_relationships_user1 ON relationships(user_1_id);
CREATE INDEX IF NOT EXISTS idx_relationships_user2 ON relationships(user_2_id);
CREATE INDEX IF NOT EXISTS idx_relationships_invite ON relationships(invite_code);

-- Helper: check relationship membership (must run after relationships table exists)
CREATE OR REPLACE FUNCTION public.user_relationship_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM relationships
  WHERE user_1_id = auth.uid() OR user_2_id = auth.uid();
$$;

-- Moments
CREATE TABLE IF NOT EXISTS public.moments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  relationship_id UUID NOT NULL REFERENCES relationships(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  type moment_type NOT NULL,
  content TEXT,
  media_url TEXT,
  mood mood_type,
  reactions JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_moments_relationship ON moments(relationship_id);
CREATE INDEX IF NOT EXISTS idx_moments_created_at ON moments(created_at DESC);

-- Messages
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  relationship_id UUID NOT NULL REFERENCES relationships(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id),
  content TEXT,
  media_url TEXT,
  media_type TEXT CHECK (media_type IN ('image', 'voice', 'video')),
  reactions JSONB DEFAULT '{}',
  is_pinned BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_relationship ON messages(relationship_id, created_at DESC);

-- Activities
CREATE TABLE IF NOT EXISTS public.activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  relationship_id UUID NOT NULL REFERENCES relationships(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  payload JSONB DEFAULT '{}',
  status activity_status DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activities_relationship ON activities(relationship_id);

-- Daily challenges
CREATE TABLE IF NOT EXISTS public.daily_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  relationship_id UUID NOT NULL REFERENCES relationships(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  type TEXT DEFAULT 'question',
  user_1_response TEXT,
  user_2_response TEXT,
  completed BOOLEAN DEFAULT FALSE,
  challenge_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(relationship_id, challenge_date)
);

-- Calendar events
CREATE TABLE IF NOT EXISTS public.calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  relationship_id UUID NOT NULL REFERENCES relationships(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  date_time TIMESTAMPTZ NOT NULL,
  type event_type DEFAULT 'custom',
  source TEXT CHECK (source IN ('manual', 'activity', 'experience')) DEFAULT 'manual',
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_calendar_relationship ON calendar_events(relationship_id, date_time);

-- Journal entries
CREATE TABLE IF NOT EXISTS public.journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  relationship_id UUID NOT NULL REFERENCES relationships(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  content TEXT NOT NULL,
  type journal_type DEFAULT 'reflection',
  is_private BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_journal_relationship ON journal_entries(relationship_id, created_at DESC);

-- Mood logs
CREATE TABLE IF NOT EXISTS public.mood_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  relationship_id UUID NOT NULL REFERENCES relationships(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  mood mood_type NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mood_relationship ON mood_logs(relationship_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mood_user ON mood_logs(user_id, created_at DESC);

-- Bucket list
CREATE TABLE IF NOT EXISTS public.bucket_list (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  relationship_id UUID NOT NULL REFERENCES relationships(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  note TEXT,
  status TEXT CHECK (status IN ('pending', 'completed')) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Shared goals
CREATE TABLE IF NOT EXISTS public.shared_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  relationship_id UUID NOT NULL REFERENCES relationships(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  progress INT DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  status TEXT CHECK (status IN ('active', 'completed')) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Experiences (marketplace - global catalog)
CREATE TABLE IF NOT EXISTS public.experiences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  type TEXT,
  location TEXT,
  price_range TEXT,
  external_url TEXT,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Saved experiences
CREATE TABLE IF NOT EXISTS public.saved_experiences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  relationship_id UUID NOT NULL REFERENCES relationships(id) ON DELETE CASCADE,
  experience_id UUID NOT NULL REFERENCES experiences(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(relationship_id, experience_id)
);

-- Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  relationship_id UUID NOT NULL REFERENCES relationships(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  type TEXT NOT NULL,
  content TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read, created_at DESC);

-- Streaks
CREATE TABLE IF NOT EXISTS public.streaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  relationship_id UUID UNIQUE NOT NULL REFERENCES relationships(id) ON DELETE CASCADE,
  current_streak INT DEFAULT 0,
  longest_streak INT DEFAULT 0,
  last_active_date DATE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Wrapped stats
CREATE TABLE IF NOT EXISTS public.wrapped_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  relationship_id UUID NOT NULL REFERENCES relationships(id) ON DELETE CASCADE,
  year INT NOT NULL,
  moments_count INT DEFAULT 0,
  activities_completed INT DEFAULT 0,
  mood_summary JSONB DEFAULT '{}',
  highlights JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(relationship_id, year)
);

-- Analytics events
CREATE TABLE IF NOT EXISTS public.analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  relationship_id UUID REFERENCES relationships(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Game sessions (multiplayer mini games)
CREATE TABLE IF NOT EXISTS public.game_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  relationship_id UUID NOT NULL REFERENCES relationships(id) ON DELETE CASCADE,
  game_type TEXT NOT NULL,
  state JSONB DEFAULT '{}',
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mood_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bucket_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.experiences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_experiences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.streaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wrapped_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY users_select ON users FOR SELECT USING (id = auth.uid() OR id IN (
  SELECT user_1_id FROM relationships WHERE user_2_id = auth.uid() AND status = 'active'
  UNION SELECT user_2_id FROM relationships WHERE user_1_id = auth.uid() AND status = 'active'
));
CREATE POLICY users_insert ON users FOR INSERT WITH CHECK (id = auth.uid());
CREATE POLICY users_update ON users FOR UPDATE USING (id = auth.uid());

-- Relationships policies
CREATE POLICY relationships_select ON relationships FOR SELECT USING (
  user_1_id = auth.uid() OR user_2_id = auth.uid()
);
CREATE POLICY relationships_insert ON relationships FOR INSERT WITH CHECK (user_1_id = auth.uid());
CREATE POLICY relationships_update ON relationships FOR UPDATE USING (
  user_1_id = auth.uid() OR user_2_id = auth.uid()
);

-- Generic relationship-scoped policy helper macro via individual policies
CREATE POLICY moments_all ON moments FOR ALL USING (
  relationship_id IN (SELECT user_relationship_ids())
) WITH CHECK (
  relationship_id IN (SELECT user_relationship_ids()) AND user_id = auth.uid()
);

CREATE POLICY messages_all ON messages FOR ALL USING (
  relationship_id IN (SELECT user_relationship_ids())
) WITH CHECK (
  relationship_id IN (SELECT user_relationship_ids()) AND sender_id = auth.uid()
);

CREATE POLICY activities_all ON activities FOR ALL USING (
  relationship_id IN (SELECT user_relationship_ids())
);

CREATE POLICY daily_challenges_all ON daily_challenges FOR ALL USING (
  relationship_id IN (SELECT user_relationship_ids())
);

CREATE POLICY calendar_events_all ON calendar_events FOR ALL USING (
  relationship_id IN (SELECT user_relationship_ids())
);

CREATE POLICY journal_entries_all ON journal_entries FOR ALL USING (
  relationship_id IN (SELECT user_relationship_ids())
) WITH CHECK (
  relationship_id IN (SELECT user_relationship_ids()) AND user_id = auth.uid()
);

CREATE POLICY mood_logs_all ON mood_logs FOR ALL USING (
  relationship_id IN (SELECT user_relationship_ids())
) WITH CHECK (
  relationship_id IN (SELECT user_relationship_ids()) AND user_id = auth.uid()
);

CREATE POLICY bucket_list_all ON bucket_list FOR ALL USING (
  relationship_id IN (SELECT user_relationship_ids())
);

CREATE POLICY shared_goals_all ON shared_goals FOR ALL USING (
  relationship_id IN (SELECT user_relationship_ids())
);

CREATE POLICY experiences_select ON experiences FOR SELECT USING (true);

CREATE POLICY saved_experiences_all ON saved_experiences FOR ALL USING (
  relationship_id IN (SELECT user_relationship_ids())
);

CREATE POLICY notifications_all ON notifications FOR ALL USING (
  user_id = auth.uid() AND relationship_id IN (SELECT user_relationship_ids())
);

CREATE POLICY streaks_all ON streaks FOR ALL USING (
  relationship_id IN (SELECT user_relationship_ids())
);

CREATE POLICY wrapped_stats_all ON wrapped_stats FOR ALL USING (
  relationship_id IN (SELECT user_relationship_ids())
);

CREATE POLICY analytics_events_insert ON analytics_events FOR INSERT WITH CHECK (
  user_id = auth.uid()
);

CREATE POLICY game_sessions_all ON game_sessions FOR ALL USING (
  relationship_id IN (SELECT user_relationship_ids())
);

-- Auto-create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Streak update function
CREATE OR REPLACE FUNCTION public.update_streak(p_relationship_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_last DATE;
  v_current INT;
BEGIN
  INSERT INTO streaks (relationship_id, current_streak, longest_streak, last_active_date)
  VALUES (p_relationship_id, 1, 1, CURRENT_DATE)
  ON CONFLICT (relationship_id) DO NOTHING;

  SELECT last_active_date, current_streak INTO v_last, v_current
  FROM streaks WHERE relationship_id = p_relationship_id;

  IF v_last IS NULL OR v_last < CURRENT_DATE - INTERVAL '1 day' THEN
    UPDATE streaks SET current_streak = 1, last_active_date = CURRENT_DATE, updated_at = NOW()
    WHERE relationship_id = p_relationship_id AND (v_last IS NULL OR v_last < CURRENT_DATE - INTERVAL '1 day');
  ELSIF v_last = CURRENT_DATE - INTERVAL '1 day' THEN
    UPDATE streaks SET
      current_streak = v_current + 1,
      longest_streak = GREATEST(longest_streak, v_current + 1),
      last_active_date = CURRENT_DATE,
      updated_at = NOW()
    WHERE relationship_id = p_relationship_id;
  END IF;

  UPDATE relationships SET streak_count = (
    SELECT current_streak FROM streaks WHERE relationship_id = p_relationship_id
  ) WHERE id = p_relationship_id;
END;
$$;

-- Seed sample experiences
INSERT INTO experiences (title, type, location, price_range, external_url, image_url)
SELECT * FROM (VALUES
  ('Sunset Picnic', 'outdoor', 'Local park', '$', null::text, null::text),
  ('Cook Together Night', 'home', 'At home', '$', null::text, null::text),
  ('Stargazing Date', 'outdoor', 'Anywhere clear', 'Free', null::text, null::text),
  ('Virtual Movie Night', 'virtual', 'Online', '$', null::text, null::text),
  ('Spa Day at Home', 'home', 'At home', '$$', null::text, null::text)
) AS seed(title, type, location, price_range, external_url, image_url)
WHERE NOT EXISTS (SELECT 1 FROM experiences LIMIT 1);

-- Realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE moments;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE mood_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE activities;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE calendar_events;
