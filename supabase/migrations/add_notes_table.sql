-- ============================================================
-- Migration: Add Notes Table for Study Notes Synchronization
-- Enables cloud sync for Markdown and Text notes across devices
-- ============================================================

CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  file_type TEXT NOT NULL DEFAULT 'md' CHECK (file_type IN ('md', 'txt')),
  subject TEXT DEFAULT 'General Studies',
  topic TEXT DEFAULT '',
  tags TEXT[] DEFAULT '{}',
  file_name TEXT DEFAULT '',
  file_size INTEGER DEFAULT 0,
  is_pinned BOOLEAN DEFAULT FALSE,
  emoji TEXT DEFAULT '📝',
  font_style TEXT DEFAULT 'sans' CHECK (font_style IN ('sans', 'serif', 'mono')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_subject ON notes(subject);
CREATE INDEX IF NOT EXISTS idx_notes_created_at ON notes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notes_is_pinned ON notes(is_pinned);

-- Row Level Security (RLS)
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own notes" ON notes;
CREATE POLICY "Users can view own notes" ON notes
  FOR SELECT USING (user_id = auth.uid()::text);

DROP POLICY IF EXISTS "Users can insert own notes" ON notes;
CREATE POLICY "Users can insert own notes" ON notes
  FOR INSERT WITH CHECK (user_id = auth.uid()::text);

DROP POLICY IF EXISTS "Users can update own notes" ON notes;
CREATE POLICY "Users can update own notes" ON notes
  FOR UPDATE USING (user_id = auth.uid()::text);

DROP POLICY IF EXISTS "Users can delete own notes" ON notes;
CREATE POLICY "Users can delete own notes" ON notes
  FOR DELETE USING (user_id = auth.uid()::text);
