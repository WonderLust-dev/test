-- Add book modules, ordered chapters, and sandboxed HTML lesson storage.
ALTER TABLE notes
  DROP CONSTRAINT IF EXISTS notes_file_type_check;

ALTER TABLE notes
  ADD CONSTRAINT notes_file_type_check
  CHECK (file_type IN ('md', 'txt', 'html', 'book', 'whiteboard'));

ALTER TABLE notes
  ADD COLUMN IF NOT EXISTS parent_id TEXT REFERENCES notes(id) ON DELETE CASCADE;

ALTER TABLE notes
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_notes_parent_id_sort_order
  ON notes(parent_id, sort_order);
