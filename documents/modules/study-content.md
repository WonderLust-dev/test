# Study content

Study content is stored through the shared `notes` table and the local-first note service in `src/services/database.ts`. The same records support ordinary notes, subject books, chapter content, and structured study tools.

## Notes, books, and chapters

- Markdown and text notes are standalone learning material.
- A book is a subject or course container (`file_type = 'book'`).
- Markdown, text, or HTML chapter records link to a book through `parent_id`; `sort_order` controls chapter order.
- Subject names are user-defined. Notes and uploads suggest subjects already present in the user's notes and books, while still allowing new names.
- PDF and DOCX uploads are converted to editable text in the browser. Scanned PDFs require OCR before import.
- HTML chapters are interactive lessons rendered in the book reader.

The notes page is `src/components/StudyNotes.tsx`; book and chapter management is in `src/components/StudyBooks.tsx`.

## Whiteboards

Whiteboards are editable JSON records in `notes.content`, not image-only documents. Users can continue editing the board and optionally export an image. The editor is implemented in `src/components/StudyWhiteboards.tsx` and `src/components/WhiteboardEditor.tsx`.

## Study planner

`src/components/StudyPlanner.tsx` creates plans from books and their chapters. Plans contain the target date, chosen study days, session length, scheduled chapter tasks, and completion state. Each plan is a `study_plan` note record. A due-today reminder appears in the planner.

## Flashcards

`src/components/Flashcards.tsx` creates prompt/answer cards, optionally linked to a chapter through `parent_id`. The card screen links back to Study Notes and can open a card's linked chapter directly. Card content and spaced-repetition state are stored in the note record's JSON `content`. Ratings (Again, Hard, Good, Easy) update the next review date and recall interval in `src/services/flashcards.ts`.

Flashcards are separate from the mistake-review queue: mistake SRS records use the `mistakes` and `reviews` tables, while flashcard progress stays with each `flashcard` note. The regular notes and chapter lists filter by their own file types so flashcards and study plans do not appear as ordinary note pages or chapters.

## Sync and migrations

Guest and offline note edits are stored locally first and queued for cloud sync when needed. Authenticated note records sync to Supabase. Existing databases need the notes, chapter, whiteboard, planner, and flashcard migrations listed in the [SQL catalog](../../supabase/migrations/README.md).
