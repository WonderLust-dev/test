-- ============================================================
-- Spaced Repetition System Migration
-- Adds SRS fields to mistakes table and creates reviews table
-- ============================================================

-- Add SRS fields to mistakes table
ALTER TABLE mistakes
ADD COLUMN IF NOT EXISTS next_review_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS interval_days INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS ease_factor REAL DEFAULT 2.5,
ADD COLUMN IF NOT EXISTS review_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_review_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'new' CHECK (status IN ('new', 'learning', 'review', 'relearning'));

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_mistakes_next_review ON mistakes(next_review_date) WHERE resolved = FALSE;
CREATE INDEX IF NOT EXISTS idx_mistakes_status ON mistakes(status) WHERE resolved = FALSE;

-- Create reviews table to track review history
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

-- Enable RLS on reviews table
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- RLS policies for reviews
CREATE POLICY "Users can view own reviews" ON reviews FOR SELECT USING (user_id = auth.uid()::text);
CREATE POLICY "Users can insert own reviews" ON reviews FOR INSERT WITH CHECK (user_id = auth.uid()::text);

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
    -- Calculate streak (simplified - can be enhanced)
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
