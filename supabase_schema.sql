-- MindVault Supabase Database Schema (safe to re-run on an existing database)

-- 1. FRIENDS TABLE
CREATE TABLE IF NOT EXISTS friends (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  name TEXT NOT NULL,
  relation TEXT NOT NULL,
  avatar TEXT,
  tier TEXT DEFAULT 'Close Circle',
  birthday DATE,
  score INT DEFAULT 80,
  bio TEXT,
  favorites JSONB DEFAULT '{}'::jsonb,
  likes JSONB DEFAULT '[]'::jsonb,
  dislikes JSONB DEFAULT '[]'::jsonb,
  safe_topics JSONB DEFAULT '[]'::jsonb,
  avoid_topics JSONB DEFAULT '[]'::jsonb,
  current_life TEXT,
  ai_summary TEXT,
  gift_ideas JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. DIARIES TABLE
CREATE TABLE IF NOT EXISTS diaries (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  friend_id BIGINT REFERENCES friends(id) ON DELETE CASCADE,
  friend_name TEXT NOT NULL,
  date DATE NOT NULL,
  title TEXT NOT NULL,
  location TEXT,
  mood TEXT,
  content TEXT NOT NULL,
  tags JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. REMINDERS TABLE
CREATE TABLE IF NOT EXISTS reminders (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  date DATE NOT NULL,
  title TEXT NOT NULL,
  friend_id BIGINT REFERENCES friends(id) ON DELETE SET NULL,
  type TEXT DEFAULT 'General',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. TODAYS_TOPICS TABLE
CREATE TABLE IF NOT EXISTS todays_topics (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  text TEXT NOT NULL,
  friend_id BIGINT REFERENCES friends(id) ON DELETE CASCADE,
  priority TEXT DEFAULT 'Medium',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. KNOWLEDGE GRAPH NODES TABLE
CREATE TABLE IF NOT EXISTS knowledge_nodes (
  id BIGINT PRIMARY KEY,
  label TEXT NOT NULL,
  type TEXT NOT NULL
);

-- 6. KNOWLEDGE GRAPH EDGES TABLE
CREATE TABLE IF NOT EXISTS knowledge_edges (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  from_node BIGINT REFERENCES knowledge_nodes(id) ON DELETE CASCADE,
  to_node BIGINT REFERENCES knowledge_nodes(id) ON DELETE CASCADE,
  label TEXT NOT NULL
);

-- 7. USER PROFILES TABLE (Cloud Sync for User Settings)
CREATE TABLE IF NOT EXISTS user_profiles (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id TEXT UNIQUE DEFAULT (auth.uid())::text,
  name TEXT NOT NULL,
  email TEXT,
  quote TEXT,
  avatar TEXT,
  role TEXT DEFAULT 'user',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. DAILY JOURNALS TABLE (id is generated client-side so every device shares it)
CREATE TABLE IF NOT EXISTS daily_journals (
  id BIGINT PRIMARY KEY,
  title TEXT NOT NULL,
  date DATE NOT NULL,
  mood TEXT,
  content TEXT NOT NULL,
  gratitude TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. DREAM JOURNALS TABLE (id is generated client-side so every device shares it)
CREATE TABLE IF NOT EXISTS dream_journals (
  id BIGINT PRIMARY KEY,
  title TEXT NOT NULL,
  date DATE NOT NULL,
  type TEXT,
  characters TEXT,
  content TEXT NOT NULL,
  reflection TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. ENGLISH VOCABULARY (AI breakdown of each word is stored as JSON in data)
CREATE TABLE IF NOT EXISTS vocab_words (
  id BIGINT PRIMARY KEY,
  word TEXT NOT NULL,
  date DATE NOT NULL,
  data JSONB,
  mastered BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- MIGRATIONS for databases created from an older version of this file (safe to re-run)
ALTER TABLE friends ADD COLUMN IF NOT EXISTS milestones JSONB DEFAULT '[]'::jsonb;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS gemini_key TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS topic_starters JSONB;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS topic_reflections JSONB;

-- OWNERSHIP: every row belongs to the Supabase Auth user who created it
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['friends', 'diaries', 'reminders', 'todays_topics', 'daily_journals', 'dream_journals', 'vocab_words'] LOOP
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS owner_id UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE', t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I (owner_id)', t || '_owner_id_idx', t);
  END LOOP;
END $$;

-- user_profiles is keyed by user_id, which now holds the Auth user's id as text
ALTER TABLE user_profiles ALTER COLUMN user_id SET DEFAULT (auth.uid())::text;

-- ROW LEVEL SECURITY: remove the old "public" policies (anyone could read/edit everything)
ALTER TABLE friends ENABLE ROW LEVEL SECURITY;
ALTER TABLE diaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE todays_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_journals ENABLE ROW LEVEL SECURITY;
ALTER TABLE dream_journals ENABLE ROW LEVEL SECURITY;
ALTER TABLE vocab_words ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE p RECORD;
BEGIN
  FOR p IN
    SELECT policyname, tablename FROM pg_policies
    WHERE schemaname = 'public' AND policyname LIKE 'Allow public %'
  LOOP
    EXECUTE format('DROP POLICY %I ON %I', p.policyname, p.tablename);
  END LOOP;
END $$;

-- Owner-only access: a logged-in user can only see and change their own rows
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['friends', 'diaries', 'reminders', 'todays_topics', 'daily_journals', 'dream_journals', 'vocab_words'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Owner full access" ON %I', t);
    EXECUTE format('CREATE POLICY "Owner full access" ON %I FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid())', t);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "Owner full access" ON user_profiles;
CREATE POLICY "Owner full access" ON user_profiles FOR ALL TO authenticated
  USING (user_id = (auth.uid())::text) WITH CHECK (user_id = (auth.uid())::text);

-- Knowledge graph tables are reference data: logged-in users may read, nobody may write via the API
DROP POLICY IF EXISTS "Authenticated read" ON knowledge_nodes;
CREATE POLICY "Authenticated read" ON knowledge_nodes FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated read" ON knowledge_edges;
CREATE POLICY "Authenticated read" ON knowledge_edges FOR SELECT TO authenticated USING (true);

-- Realtime: broadcast changes on synced tables (RLS still applies, so users only receive their own rows)
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['friends', 'diaries', 'user_profiles', 'daily_journals', 'dream_journals', 'vocab_words'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = t) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I', t);
    END IF;
  END LOOP;
END $$;

-- ADMIN ROLE: set it from the dashboard only (app_metadata cannot be edited by users themselves)
-- UPDATE auth.users SET raw_app_meta_data = raw_app_meta_data || '{"role": "admin"}' WHERE email = 'YOUR_EMAIL_HERE';

-- CLAIM EXISTING DATA (run once): rows created before this migration have no owner and are now hidden.
-- Sign up in the app first, then replace YOUR_EMAIL_HERE and run these lines to make that data yours.
-- DO $$
-- DECLARE uid UUID := (SELECT id FROM auth.users WHERE email = 'YOUR_EMAIL_HERE');
-- BEGIN
--   UPDATE friends        SET owner_id = uid WHERE owner_id IS NULL;
--   UPDATE diaries        SET owner_id = uid WHERE owner_id IS NULL;
--   UPDATE reminders      SET owner_id = uid WHERE owner_id IS NULL;
--   UPDATE todays_topics  SET owner_id = uid WHERE owner_id IS NULL;
--   UPDATE daily_journals SET owner_id = uid WHERE owner_id IS NULL;
--   UPDATE dream_journals SET owner_id = uid WHERE owner_id IS NULL;
--   UPDATE user_profiles  SET user_id = uid::text WHERE user_id = 'default_user';
-- END $$;
