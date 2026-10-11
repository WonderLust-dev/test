-- ============================================================
-- SSC CGL Exam Platform — Supabase Database Schema
-- Run this in your Supabase SQL Editor to set up the database
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- PROFILES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PAPERS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS papers (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL,
  exam TEXT NOT NULL DEFAULT 'SSC CGL',
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  difficulty TEXT DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  total_marks INTEGER NOT NULL DEFAULT 0,
  negative_marking REAL DEFAULT 0,
  question_count INTEGER NOT NULL DEFAULT 0,
  subjects TEXT[] DEFAULT '{}',
  raw_json JSONB NOT NULL DEFAULT '{}',
  is_demo BOOLEAN DEFAULT FALSE,
  visibility TEXT DEFAULT 'private' CHECK (visibility IN ('private', 'public')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_papers_user_id ON papers(user_id);
CREATE INDEX IF NOT EXISTS idx_papers_exam ON papers(exam);
CREATE INDEX IF NOT EXISTS idx_papers_created_at ON papers(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_papers_visibility ON papers(visibility);

-- ============================================================
-- ATTEMPTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS attempts (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL,
  paper_id TEXT NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
  paper_title TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  score REAL NOT NULL DEFAULT 0,
  total_marks REAL NOT NULL DEFAULT 0,
  accuracy REAL NOT NULL DEFAULT 0,
  attempted_count INTEGER NOT NULL DEFAULT 0,
  correct_count INTEGER NOT NULL DEFAULT 0,
  incorrect_count INTEGER NOT NULL DEFAULT 0,
  unanswered_count INTEGER NOT NULL DEFAULT 0,
  time_spent_seconds INTEGER NOT NULL DEFAULT 0,
  is_complete BOOLEAN DEFAULT FALSE,
  mode TEXT DEFAULT 'exam' CHECK (mode IN ('exam', 'practice'))
);

CREATE INDEX IF NOT EXISTS idx_attempts_user_id ON attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_attempts_paper_id ON attempts(paper_id);
CREATE INDEX IF NOT EXISTS idx_attempts_started_at ON attempts(started_at DESC);

-- ============================================================
-- ATTEMPT QUESTIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS attempt_questions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  attempt_id TEXT NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL,
  question_index INTEGER NOT NULL DEFAULT 0,
  selected_answer INTEGER,
  is_correct BOOLEAN,
  time_spent_seconds INTEGER DEFAULT 0,
  marked_for_review BOOLEAN DEFAULT FALSE,
  is_answered BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_attempt_questions_attempt_id ON attempt_questions(attempt_id);

-- ============================================================
-- BOOKMARKS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS bookmarks (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL,
  paper_id TEXT NOT NULL,
  question_id TEXT NOT NULL,
  question_text TEXT DEFAULT '',
  category TEXT DEFAULT 'important' CHECK (category IN ('important', 'difficult', 'revise_later', 'shortcut', 'formula', 'doubt')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, paper_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_bookmarks_user_id ON bookmarks(user_id);

-- ============================================================
-- MISTAKES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS mistakes (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL,
  paper_id TEXT NOT NULL,
  paper_title TEXT DEFAULT '',
  question_id TEXT NOT NULL,
  question_text TEXT DEFAULT '',
  subject TEXT DEFAULT '',
  topic TEXT DEFAULT '',
  selected_answer INTEGER,
  correct_answer INTEGER NOT NULL,
  options TEXT[] DEFAULT '{}',
  solution TEXT,
  shortcut TEXT,
  hint TEXT,
  learning_suggestion TEXT,
  incorrect_count INTEGER DEFAULT 1,
  last_attempted_at TIMESTAMPTZ DEFAULT NOW(),
  resolved BOOLEAN DEFAULT FALSE,
  next_review_date TIMESTAMPTZ,
  interval_days INTEGER DEFAULT 1,
  ease_factor REAL DEFAULT 2.5,
  review_count INTEGER DEFAULT 0,
  last_review_date TIMESTAMPTZ,
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'learning', 'review', 'relearning'))
);

CREATE INDEX IF NOT EXISTS idx_mistakes_user_id ON mistakes(user_id);
CREATE INDEX IF NOT EXISTS idx_mistakes_resolved ON mistakes(resolved) WHERE resolved = FALSE;
CREATE INDEX IF NOT EXISTS idx_mistakes_next_review ON mistakes(next_review_date) WHERE resolved = FALSE;
CREATE INDEX IF NOT EXISTS idx_mistakes_status ON mistakes(status) WHERE resolved = FALSE;

-- ============================================================
-- REVIEWS TABLE (Spaced Repetition History)
-- ============================================================
CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL,
  mistake_id TEXT NOT NULL REFERENCES mistakes(id) ON DELETE CASCADE,
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  quality INTEGER NOT NULL CHECK (quality >= 0 AND quality <= 5),
  interval_before INTEGER,
  interval_after INTEGER,
  ease_factor_before REAL,
  ease_factor_after REAL,
  response_time_seconds INTEGER,
  is_correct BOOLEAN NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_mistake_id ON reviews(mistake_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewed_at ON reviews(reviewed_at DESC);

-- ============================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE papers ENABLE ROW LEVEL SECURITY;
ALTER TABLE attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE attempt_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE mistakes ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Papers: Users can see their own papers + all public papers
DROP POLICY IF EXISTS "Users can view own papers" ON papers;
CREATE POLICY "Users can view own papers" ON papers FOR SELECT USING (user_id = auth.uid()::text);

DROP POLICY IF EXISTS "Anyone can view public papers" ON papers;
CREATE POLICY "Anyone can view public papers" ON papers FOR SELECT USING (visibility = 'public');

DROP POLICY IF EXISTS "Users can insert own papers" ON papers;
CREATE POLICY "Users can insert own papers" ON papers FOR INSERT WITH CHECK (user_id = auth.uid()::text);

DROP POLICY IF EXISTS "Users can update own papers" ON papers;
CREATE POLICY "Users can update own papers" ON papers FOR UPDATE USING (user_id = auth.uid()::text);

DROP POLICY IF EXISTS "Users can delete own papers" ON papers;
CREATE POLICY "Users can delete own papers" ON papers FOR DELETE USING (user_id = auth.uid()::text);

-- Attempts: Users can only see their own attempts
DROP POLICY IF EXISTS "Users can view own attempts" ON attempts;
CREATE POLICY "Users can view own attempts" ON attempts FOR SELECT USING (user_id = auth.uid()::text);

DROP POLICY IF EXISTS "Users can insert own attempts" ON attempts;
CREATE POLICY "Users can insert own attempts" ON attempts FOR INSERT WITH CHECK (user_id = auth.uid()::text);

DROP POLICY IF EXISTS "Users can update own attempts" ON attempts;
CREATE POLICY "Users can update own attempts" ON attempts FOR UPDATE USING (user_id = auth.uid()::text);

-- Attempt Questions: Access through attempts
DROP POLICY IF EXISTS "Users can view own attempt questions" ON attempt_questions;
CREATE POLICY "Users can view own attempt questions" ON attempt_questions FOR SELECT USING (
  attempt_id IN (SELECT id FROM attempts WHERE user_id = auth.uid()::text)
);

DROP POLICY IF EXISTS "Users can insert own attempt questions" ON attempt_questions;
CREATE POLICY "Users can insert own attempt questions" ON attempt_questions FOR INSERT WITH CHECK (
  attempt_id IN (SELECT id FROM attempts WHERE user_id = auth.uid()::text)
);

-- Bookmarks: Users can only manage their own bookmarks
DROP POLICY IF EXISTS "Users can view own bookmarks" ON bookmarks;
CREATE POLICY "Users can view own bookmarks" ON bookmarks FOR SELECT USING (user_id = auth.uid()::text);

DROP POLICY IF EXISTS "Users can insert own bookmarks" ON bookmarks;
CREATE POLICY "Users can insert own bookmarks" ON bookmarks FOR INSERT WITH CHECK (user_id = auth.uid()::text);

DROP POLICY IF EXISTS "Users can delete own bookmarks" ON bookmarks;
CREATE POLICY "Users can delete own bookmarks" ON bookmarks FOR DELETE USING (user_id = auth.uid()::text);

-- Mistakes: Users can only manage their own mistakes
DROP POLICY IF EXISTS "Users can view own mistakes" ON mistakes;
CREATE POLICY "Users can view own mistakes" ON mistakes FOR SELECT USING (user_id = auth.uid()::text);

DROP POLICY IF EXISTS "Users can insert own mistakes" ON mistakes;
CREATE POLICY "Users can insert own mistakes" ON mistakes FOR INSERT WITH CHECK (user_id = auth.uid()::text);

DROP POLICY IF EXISTS "Users can update own mistakes" ON mistakes;
CREATE POLICY "Users can update own mistakes" ON mistakes FOR UPDATE USING (user_id = auth.uid()::text);

-- Profiles: Users can only manage their own profile (UUID to UUID match)
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (id = auth.uid());

-- ============================================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', ''),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- REVIEWS TABLE RLS POLICIES
-- ============================================================
DROP POLICY IF EXISTS "Users can view own reviews" ON reviews;
CREATE POLICY "Users can view own reviews" ON reviews FOR SELECT USING (user_id = auth.uid()::text);

DROP POLICY IF EXISTS "Users can insert own reviews" ON reviews;
CREATE POLICY "Users can insert own reviews" ON reviews FOR INSERT WITH CHECK (user_id = auth.uid()::text);

-- ============================================================
-- SPACED REPETITION (SM-2) STORED PROCEDURES
-- ============================================================

-- Function to calculate next review date using SM-2 algorithm
CREATE OR REPLACE FUNCTION calculate_next_review(
  p_mistake_id TEXT,
  p_quality INTEGER,
  p_response_time INTEGER DEFAULT 0
)
RETURNS TIMESTAMPTZ AS $$
DECLARE
  v_mistake RECORD;
  v_new_interval INTEGER;
  v_new_ease_factor REAL;
  v_next_review TIMESTAMPTZ;
BEGIN
  -- Get current mistake data
  SELECT * INTO v_mistake FROM mistakes WHERE id = p_mistake_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mistake not found: %', p_mistake_id;
  END IF;
  
  -- SM-2 Algorithm
  IF p_quality >= 3 THEN
    -- Correct response
    IF v_mistake.review_count = 0 THEN
      v_new_interval := 1;
    ELSIF v_mistake.review_count = 1 THEN
      v_new_interval := 6;
    ELSE
      v_new_interval := ROUND(v_mistake.interval_days * v_mistake.ease_factor);
    END IF;
  ELSE
    -- Incorrect response - reset interval
    v_new_interval := 1;
  END IF;
  
  -- Update ease factor (minimum 1.3)
  v_new_ease_factor := GREATEST(
    1.3,
    v_mistake.ease_factor + (0.1 - (5 - p_quality) * (0.08 + (5 - p_quality) * 0.02))
  );
  
  -- Calculate next review date
  v_next_review := NOW() + (v_new_interval || ' days')::INTERVAL;
  
  -- Update mistake record
  UPDATE mistakes SET
    interval_days = v_new_interval,
    ease_factor = v_new_ease_factor,
    review_count = v_mistake.review_count + 1,
    next_review_date = v_next_review,
    last_review_date = NOW(),
    status = CASE
      WHEN p_quality >= 3 THEN 'review'
      WHEN v_mistake.review_count = 0 THEN 'learning'
      ELSE 'relearning'
    END,
    updated_at = NOW()
  WHERE id = p_mistake_id;
  
  -- Insert review record
  INSERT INTO reviews (
    user_id,
    mistake_id,
    quality,
    interval_before,
    interval_after,
    ease_factor_before,
    ease_factor_after,
    response_time_seconds,
    is_correct
  ) VALUES (
    v_mistake.user_id,
    p_mistake_id,
    p_quality,
    v_mistake.interval_days,
    v_new_interval,
    v_mistake.ease_factor,
    v_new_ease_factor,
    p_response_time,
    p_quality >= 3
  );
  
  RETURN v_next_review;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get due reviews for a user
CREATE OR REPLACE FUNCTION get_due_reviews(p_user_id TEXT, p_limit INTEGER DEFAULT 20)
RETURNS TABLE (
  mistake_id TEXT,
  question_text TEXT,
  subject TEXT,
  topic TEXT,
  interval_days INTEGER,
  ease_factor REAL,
  review_count INTEGER,
  next_review_date TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.id,
    m.question_text,
    m.subject,
    m.topic,
    m.interval_days,
    m.ease_factor,
    m.review_count,
    m.next_review_date
  FROM mistakes m
  WHERE m.user_id = p_user_id
    AND m.resolved = FALSE
    AND (m.next_review_date IS NULL OR m.next_review_date <= NOW())
  ORDER BY m.next_review_date ASC NULLS FIRST
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get review statistics
CREATE OR REPLACE FUNCTION get_review_stats(p_user_id TEXT)
RETURNS TABLE (
  total_reviews INTEGER,
  today_reviews INTEGER,
  week_reviews INTEGER,
  avg_quality REAL,
  due_count INTEGER,
  streak_days INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::INTEGER as total_reviews,
    COUNT(*) FILTER (WHERE reviewed_at >= CURRENT_DATE)::INTEGER as today_reviews,
    COUNT(*) FILTER (WHERE reviewed_at >= CURRENT_DATE - INTERVAL '7 days')::INTEGER as week_reviews,
    COALESCE(AVG(quality), 0)::REAL as avg_quality,
    (SELECT COUNT(*)::INTEGER FROM mistakes WHERE user_id = p_user_id AND resolved = FALSE AND (next_review_date IS NULL OR next_review_date <= NOW())) as due_count,
    COALESCE(
      (SELECT COUNT(DISTINCT DATE(reviewed_at))::INTEGER 
       FROM reviews 
       WHERE user_id = p_user_id 
       AND reviewed_at >= CURRENT_DATE - INTERVAL '30 days'
       AND DATE(reviewed_at) = CURRENT_DATE - (COUNT(*) - 1)
      ), 0
    )::INTEGER as streak_days
  FROM reviews
  WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

