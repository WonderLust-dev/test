-- Allow synced study plans to be stored as private note records.
ALTER TABLE notes
  DROP CONSTRAINT IF EXISTS notes_file_type_check;

ALTER TABLE notes
  ADD CONSTRAINT notes_file_type_check
  CHECK (file_type IN ('md', 'txt', 'html', 'book', 'whiteboard', 'study_plan', 'flashcard'));
