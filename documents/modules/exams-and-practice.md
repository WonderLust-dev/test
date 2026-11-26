# Exams and practice

## Paper library

Question papers use the `Paper` and `PaperJSON` models in `src/types/index.ts`. Papers can be created in the authoring studio, imported from JSON, validated before saving, exported, and marked private or public. Exam and course names are user-defined; built-in examples are optional.

The paper library supports searching, filtering, sharing, and bulk management. Public-paper access is handled by Supabase row-level-security policies; private papers remain owner-only.

## Taking an exam

`src/components/ExamInterface.tsx` runs timed exam and practice sessions. An `Attempt` stores the session summary and `AttemptQuestion` stores each response, including unanswered and marked-for-review state. Results are presented by `src/components/ResultsPage.tsx`.

Practice modes can build sessions from the library, selected topics, weak areas, mistakes, or random questions. Scoring and performance aggregation live in `src/utils/grader.ts`.

## Main data tables

- `papers` — paper metadata and the full question JSON.
- `attempts` — score, accuracy, timing, mode, and completion state.
- `attempt_questions` — per-question responses for an attempt.

The baseline definitions and RLS policies are in [`supabase/schema.sql`](../../supabase/schema.sql). Existing installations use the module migrations indexed in [`supabase/migrations/README.md`](../../supabase/migrations/README.md).
