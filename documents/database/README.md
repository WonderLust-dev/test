# Database setup

## Choose the correct setup path

### New Supabase project

1. Create a Supabase project and configure the app's `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
2. Open the Supabase SQL Editor.
3. Run the complete current schema in [`supabase/schema.sql`](../../supabase/schema.sql).
4. Enable and configure the authentication providers you plan to use.

`schema.sql` is the current full-schema snapshot. It includes the tables, indexes, policies, mistake-review functions, and scheduled seven-day cleanup for inactive mistakes, including the current note file types.

### Existing Supabase project

Do not rerun the full schema blindly on a database that already contains app data. Apply only migrations that are not already present in that deployment, in dependency order. Track which scripts have been applied.

1. `add_visibility_column.sql` and `add_spaced_repetition.sql` extend the existing paper and mistake tables.
2. `add_mistake_retention.sql` schedules cleanup of mistakes inactive for more than seven days.
3. `add_notes_table.sql` creates the notes table when it is missing.
4. `add_book_chapters.sql` adds parent/ordering support for books and chapters.
5. `add_dynamic_note_subjects.sql` removes the fixed default subject for future notes.
6. `add_study_path_metadata.sql` adds optional learning-path fields.
7. `add_whiteboard_notes.sql`, `add_study_planner.sql`, and `add_flashcards.sql` allow those note file types.

The SQL scripts are in [`supabase/migrations/`](../../supabase/migrations/), with a module-by-module description in its [catalog](../../supabase/migrations/README.md).

The Mistakes page can download retained mistake records as JSON or CSV. Download any records you want to keep before the scheduled cleanup removes them.

If `notes` does not exist on an existing installation, run `add_notes_table.sql` before any notes-related migration. If the full current `schema.sql` has already been applied, do not run migrations that only repeat its schema changes.

## Security

The schema enables row-level security for user-owned records. The app uses the anon/public key from the browser; never put a Supabase service-role key in the frontend or commit it to the repository. Review policies in `schema.sql` before changing access behavior.

## Local validation

After schema changes, run:

```bash
npm run typecheck
npm run build
```
