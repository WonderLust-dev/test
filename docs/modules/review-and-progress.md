# Review and progress

## Mistake notebook

Incorrect exam and practice answers can be saved as `Mistake` records with their subject, topic, selected answer, correct answer, and available learning notes. Resolved mistakes are kept separate from unresolved review work.

## Mistake spaced repetition

The existing mistake-review feature uses the `mistakes` and `reviews` tables and the SM-2 functions defined in `supabase/schema.sql` (also available in the `add_spaced_repetition.sql` migration). `src/services/srs.ts` schedules due mistakes and stores review history. `ReviewDashboard` summarizes due work and review statistics; `ReviewSession` runs the recall session.

Flashcards have their own schedule embedded in note content; they do not create rows in the mistake-review tables.

## Bookmarks

Bookmarks save questions for later and can be categorized (for example: difficult, formula, shortcut, or revise later). They are stored in the `bookmarks` table and are separate from notes and flashcards.

## Analytics

The dashboard derives exam, subject, topic, accuracy, and timing summaries from attempts and their question-level responses. Analytics are based on recorded user activity; the dashboard should not imply a metric when there is no underlying data.

## Main data tables

- `mistakes` — question-level incorrect-answer records and their review schedule.
- `reviews` — review history for mistake SRS.
- `bookmarks` — saved question references and categories.
- `attempts`, `attempt_questions` — source data for performance analysis.

See [`supabase/schema.sql`](../../supabase/schema.sql) and the [module SQL index](../../supabase/migrations/README.md).
