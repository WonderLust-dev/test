# Supabase SQL catalog

This directory contains the incremental SQL scripts for existing deployments. The full current database snapshot is [`../schema.sql`](../schema.sql). These files are kept flat because Supabase migration tooling expects migration files in this directory; this index groups them by module without copying the SQL into a second source of truth.

## Module index

| Module | SQL file | Purpose |
| --- | --- | --- |
| Paper sharing | [`add_visibility_column.sql`](add_visibility_column.sql) | Adds private/public visibility and updates paper access policies. |
| Mistake review | [`add_spaced_repetition.sql`](add_spaced_repetition.sql) | Adds SRS fields to mistakes, creates review history, indexes, RLS policies, and review RPC functions. |
| Notes | [`add_notes_table.sql`](add_notes_table.sql) | Creates the notes table, indexes, and owner-only RLS policies. |
| Books and chapters | [`add_book_chapters.sql`](add_book_chapters.sql) | Adds chapter parent/order columns and allows book and HTML lesson record types. |
| User-defined subjects | [`add_dynamic_note_subjects.sql`](add_dynamic_note_subjects.sql) | Removes the default subject label so new notes can use a subject the user chooses or leave it blank. |
| Study-path metadata | [`add_study_path_metadata.sql`](add_study_path_metadata.sql) | Adds level, curriculum, and original-file metadata to notes. |
| Whiteboards | [`add_whiteboard_notes.sql`](add_whiteboard_notes.sql) | Allows JSON-backed whiteboard records in notes. |
| Study planner | [`add_study_planner.sql`](add_study_planner.sql) | Allows saved planner records in notes. |
| Flashcards | [`add_flashcards.sql`](add_flashcards.sql) | Allows note-backed flashcards and their embedded spaced-repetition state. |

## Applying scripts

- New projects should start with [`supabase/schema.sql`](../schema.sql), which is the consolidated current schema.
- Existing projects should apply only missing migrations. Apply `add_notes_table.sql` before migrations that alter `notes`; run the notes feature migrations in the order shown above.
- Apply `add_dynamic_note_subjects.sql` after `add_notes_table.sql` if the project already exists. It changes only the default for future records; it does not rewrite existing subject values.
- Do not rerun the full schema or migrations blindly against a database containing user data. Check the deployed schema and migration history first.
- Keep these incremental scripts in sync with the current schema snapshot whenever a table, policy, or allowed note type changes.

For setup details and security guidance, see [`documents/database/README.md`](../../documents/database/README.md).
