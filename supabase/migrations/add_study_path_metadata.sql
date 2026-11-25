-- Add optional learning-path metadata and original document names to study notes.
ALTER TABLE notes
  ADD COLUMN IF NOT EXISTS study_level TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS curriculum TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS source_file_name TEXT;
