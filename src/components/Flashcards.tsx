import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Brain,
  CheckCircle2,
  Clock3,
  Eye,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { FlashcardContent, FlashcardRating, StudyNote } from '../types';
import { deleteNote, getNotes, saveNote, updateNote } from '../services/database';
import { parseFlashcardContent, scheduleFlashcardReview } from '../services/flashcards';

interface StoredFlashcard {
  note: StudyNote;
  data: FlashcardContent;
}

type CardFilter = 'all' | 'due' | 'new';

const cardClass = 'bento-card rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)]';

function initialContent(front: string, back: string): FlashcardContent {
  return {
    front,
    back,
    intervalDays: 0,
    easeFactor: 2.5,
    reviewCount: 0,
    repetitions: 0,
    dueAt: new Date().toISOString(),
    lastReviewedAt: null,
  };
}

function dueLabel(content: FlashcardContent): string {
  const milliseconds = Date.parse(content.dueAt) - Date.now();
  if (milliseconds <= 0) return 'Due now';
  const days = Math.ceil(milliseconds / 86_400_000);
  return `Due in ${days} day${days === 1 ? '' : 's'}`;
}

export default function Flashcards({ userId }: { userId?: string }) {
  const effectiveUserId = userId || 'guest';
  const navigate = useNavigate();
  const [notes, setNotes] = useState<StudyNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [chapterId, setChapterId] = useState('');
  const [filter, setFilter] = useState<CardFilter>('all');
  const [sessionIds, setSessionIds] = useState<string[]>([]);
  const [sessionIndex, setSessionIndex] = useState(0);
  const [sessionReviewed, setSessionReviewed] = useState(0);
  const [sessionFinished, setSessionFinished] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getNotes(effectiveUserId)
      .then(data => {
        if (active) setNotes(data);
      })
      .catch(cause => {
        console.error('Failed to load flashcards:', cause);
        if (active) setError('Your flashcards could not be loaded. Please try again.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [effectiveUserId]);

  const parsedCards = useMemo(() => notes.flatMap((note): StoredFlashcard[] => {
    if (note.file_type !== 'flashcard') return [];
    const data = parseFlashcardContent(note.content);
    return data ? [{ note, data }] : [];
  }), [notes]);

  const invalidCardCount = notes.filter(note => note.file_type === 'flashcard').length - parsedCards.length;
  const books = useMemo(
    () => notes.filter(note => note.file_type === 'book'),
    [notes],
  );
  const chapters = useMemo(() => notes
    .filter(note => (
      (note.file_type === 'md' || note.file_type === 'txt' || note.file_type === 'html')
      && !!note.parent_id
      && books.some(book => book.id === note.parent_id)
    ))
    .sort((a, b) => a.title.localeCompare(b.title)), [books, notes]);

  const dueCards = useMemo(() => parsedCards
    .filter(card => Date.parse(card.data.dueAt) <= Date.now())
    .sort((a, b) => Date.parse(a.data.dueAt) - Date.parse(b.data.dueAt)), [parsedCards]);

  const currentSessionCard = sessionIds.length > 0
    ? parsedCards.find(card => card.note.id === sessionIds[sessionIndex])
    : undefined;

  const visibleCards = useMemo(() => parsedCards
    .filter(card => {
      if (filter === 'due') return Date.parse(card.data.dueAt) <= Date.now();
      if (filter === 'new') return card.data.reviewCount === 0;
      return true;
    })
    .sort((a, b) => Date.parse(a.data.dueAt) - Date.parse(b.data.dueAt)), [filter, parsedCards]);

  const getLinkedChapter = (card: StoredFlashcard) => notes.find(note => (
    note.id === card.note.parent_id
    && (note.file_type === 'md' || note.file_type === 'txt' || note.file_type === 'html')
  ));

  const getChapterLabel = (card: StoredFlashcard) => {
    const chapter = getLinkedChapter(card);
    if (!chapter) return 'Unlinked';
    const book = notes.find(note => note.id === chapter.parent_id);
    return book ? `${book.title} · ${chapter.title}` : chapter.title;
  };

  const openStudyNotes = (card?: StoredFlashcard) => {
    const chapter = card ? getLinkedChapter(card) : undefined;
    const destination = chapter
      ? `/notes?section=books&chapter=${encodeURIComponent(chapter.id)}`
      : '/notes?section=books';
    navigate(destination);
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setFront('');
    setBack('');
    setChapterId('');
  };

  const openNewForm = () => {
    setError('');
    setEditingId(null);
    setFront('');
    setBack('');
    setChapterId('');
    setShowForm(true);
  };

  const openEditForm = (card: StoredFlashcard) => {
    setError('');
    setEditingId(card.note.id);
    setFront(card.data.front);
    setBack(card.data.back);
    setChapterId(card.note.parent_id || '');
    setShowForm(true);
  };

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanFront = front.trim();
    const cleanBack = back.trim();
    if (!cleanFront || !cleanBack) {
      setError('Add both a prompt and an answer before saving.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const existing = editingId
        ? parsedCards.find(card => card.note.id === editingId)
        : undefined;
      const content = existing
        ? { ...existing.data, front: cleanFront, back: cleanBack }
        : initialContent(cleanFront, cleanBack);
      const selectedChapter = chapters.find(chapter => chapter.id === chapterId);
      const parentId = selectedChapter?.id || null;

      if (existing) {
        const updatedAt = new Date().toISOString();
        const updates: Partial<StudyNote> = {
          title: cleanFront.slice(0, 120),
          content: JSON.stringify(content),
          parent_id: parentId,
          subject: selectedChapter?.subject,
          updated_at: updatedAt,
        };
        await updateNote(existing.note.id, updates, effectiveUserId);
        setNotes(current => current.map(note => (
          note.id === existing.note.id ? { ...note, ...updates } : note
        )));
      } else {
        const created = await saveNote({
          user_id: effectiveUserId,
          title: cleanFront.slice(0, 120),
          content: JSON.stringify(content),
          file_type: 'flashcard',
          parent_id: parentId,
          subject: selectedChapter?.subject,
        });
        setNotes(current => [created, ...current]);
      }

      resetForm();
    } catch (cause) {
      console.error('Failed to save flashcard:', cause);
      setError('The flashcard could not be saved. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (card: StoredFlashcard) => {
    if (!window.confirm('Delete this flashcard?')) return;
    setError('');
    try {
      await deleteNote(card.note.id, effectiveUserId);
      setNotes(current => current.filter(note => note.id !== card.note.id));
    } catch (cause) {
      console.error('Failed to delete flashcard:', cause);
      setError('The flashcard could not be deleted. Please try again.');
    }
  };

  const startReview = () => {
    setError('');
    setSessionIds(dueCards.map(card => card.note.id));
    setSessionIndex(0);
    setSessionReviewed(0);
    setSessionFinished(false);
    setShowAnswer(false);
  };

  const handleRating = async (rating: FlashcardRating) => {
    if (!currentSessionCard) return;
    setSaving(true);
    setError('');
    try {
      const updatedContent = scheduleFlashcardReview(currentSessionCard.data, rating);
      const serialized = JSON.stringify(updatedContent);
      await updateNote(currentSessionCard.note.id, { content: serialized }, effectiveUserId);
      setNotes(current => current.map(note => (
        note.id === currentSessionCard.note.id ? { ...note, content: serialized } : note
      )));

      const nextIndex = sessionIndex + 1;
      setSessionReviewed(count => count + 1);
      setShowAnswer(false);
      if (nextIndex >= sessionIds.length) {
        setSessionFinished(true);
      } else {
        setSessionIndex(nextIndex);
      }
    } catch (cause) {
      console.error('Failed to save flashcard review:', cause);
      setError('Your review could not be saved. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const finishSession = () => {
    setSessionIds([]);
    setSessionIndex(0);
    setSessionReviewed(0);
    setSessionFinished(false);
    setShowAnswer(false);
  };

  if (loading) {
    return (
      <div className={`${cardClass} flex min-h-56 items-center justify-center`}>
        <div className="flex items-center gap-3 text-sm text-[var(--text-muted)]">
          <Loader2 size={18} className="animate-spin" /> Loading flashcards...
        </div>
      </div>
    );
  }

  if (sessionIds.length > 0 && sessionFinished) {
    return (
      <div className={`${cardClass} mx-auto max-w-3xl p-8 text-center`}>
        <CheckCircle2 size={42} className="mx-auto mb-4 text-emerald-500" />
        <h2 className="text-2xl font-bold text-[var(--text-main)]">Review complete</h2>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          You reviewed {sessionReviewed} card{sessionReviewed === 1 ? '' : 's'}. Your next reviews are scheduled.
        </p>
        <button type="button" onClick={finishSession} className="btn btn-primary mt-6">
          Back to flashcards
        </button>
      </div>
    );
  }

  if (sessionIds.length > 0) {
    if (!currentSessionCard) {
      return (
        <div className={`${cardClass} p-6`}>
          <p className="text-sm text-[var(--text-muted)]">This review card is no longer available.</p>
          <button type="button" onClick={finishSession} className="btn btn-outline mt-4">
            <ArrowLeft size={15} /> Exit review
          </button>
        </div>
      );
    }

    return (
      <section className="mx-auto max-w-3xl space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={finishSession} className="btn btn-ghost">
              <ArrowLeft size={15} /> Exit review
            </button>
            {getLinkedChapter(currentSessionCard) && (
              <button type="button" onClick={() => openStudyNotes(currentSessionCard)} className="btn btn-outline">
                <BookOpen size={15} /> Open chapter
              </button>
            )}
          </div>
          <span className="text-sm font-semibold text-[var(--text-muted)]">
            Card {sessionIndex + 1} of {sessionIds.length}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-[var(--bg-subtle)]" aria-label="Review progress">
          <div
            className="h-full rounded-full bg-indigo-600 transition-all"
            style={{ width: `${((sessionIndex + 1) / sessionIds.length) * 100}%` }}
          />
        </div>
        <div className={`${cardClass} min-h-72 p-6 sm:p-10`}>
          <div className="mb-6 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            <Brain size={15} /> {getChapterLabel(currentSessionCard)}
          </div>
          <div className="rounded-2xl bg-[var(--bg-subtle)] p-6 text-center sm:p-10">
            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">Prompt</p>
            <p className="whitespace-pre-wrap text-xl font-bold text-[var(--text-main)]">
              {currentSessionCard.data.front}
            </p>
          </div>
          {showAnswer ? (
            <div className="mt-4 rounded-2xl border border-[var(--border-color)] p-6 text-center">
              <p className="mb-3 text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">Answer</p>
              <p className="whitespace-pre-wrap text-base text-[var(--text-main)]">
                {currentSessionCard.data.back}
              </p>
            </div>
          ) : (
            <button type="button" onClick={() => setShowAnswer(true)} className="btn btn-primary mt-5 w-full">
              <Eye size={16} /> Reveal answer
            </button>
          )}
          {showAnswer && (
            <div className="mt-5">
              <p className="mb-3 text-center text-sm font-semibold text-[var(--text-main)]">How well did you recall it?</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {([
                  ['again', 'Again', 'bg-rose-50 text-rose-700 hover:bg-rose-100'],
                  ['hard', 'Hard', 'bg-amber-50 text-amber-700 hover:bg-amber-100'],
                  ['good', 'Good', 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'],
                  ['easy', 'Easy', 'bg-sky-50 text-sky-700 hover:bg-sky-100'],
                ] as const).map(([rating, label, style]) => (
                  <button
                    key={rating}
                    type="button"
                    disabled={saving}
                    onClick={() => handleRating(rating)}
                    className={`rounded-xl px-4 py-3 text-sm font-bold transition-colors disabled:opacity-50 ${style}`}
                  >
                    {saving ? <Loader2 size={16} className="mx-auto animate-spin" /> : label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
      </section>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-indigo-600">
            <Brain size={16} /> Active recall
          </div>
          <h1 className="text-2xl font-extrabold text-[var(--text-main)] sm:text-3xl">Flashcards</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Review your own prompts on a spaced schedule, linked to the chapters you study.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => openStudyNotes()} className="btn btn-outline">
            <BookOpen size={15} /> Notes &amp; subjects
          </button>
          <button type="button" onClick={startReview} disabled={dueCards.length === 0} className="btn btn-primary">
            <RotateCcw size={15} /> Review due ({dueCards.length})
          </button>
          <button type="button" onClick={openNewForm} className="btn btn-outline">
            <Plus size={15} /> New card
          </button>
        </div>
      </header>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          <AlertCircle size={17} className="mt-0.5 shrink-0" /> {error}
        </div>
      )}
      {invalidCardCount > 0 && (
        <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          {invalidCardCount} flashcard{invalidCardCount === 1 ? '' : 's'} could not be read. They remain saved in your notes.
        </div>
      )}

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className={`${cardClass} p-4`}>
          <p className="text-xs font-semibold text-[var(--text-muted)]">Total cards</p>
          <p className="mt-1 text-2xl font-extrabold text-[var(--text-main)]">{parsedCards.length}</p>
        </div>
        <div className={`${cardClass} p-4`}>
          <p className="text-xs font-semibold text-[var(--text-muted)]">Due today</p>
          <p className="mt-1 flex items-center gap-2 text-2xl font-extrabold text-indigo-600">
            <Clock3 size={20} /> {dueCards.length}
          </p>
        </div>
        <div className={`${cardClass} p-4`}>
          <p className="text-xs font-semibold text-[var(--text-muted)]">Reviewed at least once</p>
          <p className="mt-1 text-2xl font-extrabold text-emerald-600">
            {parsedCards.filter(card => card.data.reviewCount > 0).length}
          </p>
        </div>
      </section>

      {showForm && (
        <form onSubmit={handleSave} className={`${cardClass} space-y-4 p-5 sm:p-6`}>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-[var(--text-main)]">
              {editingId ? 'Edit flashcard' : 'Create a flashcard'}
            </h2>
            <button type="button" onClick={resetForm} className="btn btn-ghost" aria-label="Close form">
              <X size={17} />
            </button>
          </div>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-[var(--text-main)]">Prompt</span>
            <textarea
              required
              maxLength={2000}
              rows={3}
              value={front}
              onChange={event => setFront(event.target.value)}
              className="input w-full resize-y"
              placeholder="Ask a question or write a cue..."
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-[var(--text-main)]">Answer</span>
            <textarea
              required
              maxLength={5000}
              rows={4}
              value={back}
              onChange={event => setBack(event.target.value)}
              className="input w-full resize-y"
              placeholder="Write the explanation or answer..."
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-[var(--text-main)]">Subject &amp; chapter (optional)</span>
            <select value={chapterId} onChange={event => setChapterId(event.target.value)} className="input w-full">
              <option value="">No chapter linked</option>
              {books.map(book => {
                const bookChapters = chapters.filter(chapter => chapter.parent_id === book.id);
                if (bookChapters.length === 0) return null;
                const groupLabel = book.subject && book.subject !== book.title
                  ? `${book.subject} · ${book.title}`
                  : book.title;
                return (
                  <optgroup key={book.id} label={groupLabel}>
                    {bookChapters.map(chapter => (
                      <option key={chapter.id} value={chapter.id}>{chapter.title}</option>
                    ))}
                  </optgroup>
                );
              })}
            </select>
            {chapters.length === 0 && (
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--text-muted)]">
                <span>Create a subject and chapter first to link this card.</span>
                <button type="button" onClick={() => openStudyNotes()} className="font-semibold text-indigo-600 hover:underline">
                  Open Study Notes
                </button>
              </div>
            )}
          </label>
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" onClick={resetForm} className="btn btn-outline">Cancel</button>
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
              {editingId ? 'Save changes' : 'Create card'}
            </button>
          </div>
        </form>
      )}

      <section className={`${cardClass} overflow-hidden`}>
        <div className="flex flex-col justify-between gap-3 border-b border-[var(--border-color)] p-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="font-bold text-[var(--text-main)]">Your cards</h2>
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">New cards are due immediately. Ratings schedule the next review.</p>
          </div>
          <select
            aria-label="Filter flashcards"
            value={filter}
            onChange={event => setFilter(event.target.value as CardFilter)}
            className="input w-full sm:w-auto"
          >
            <option value="all">All cards</option>
            <option value="due">Due now</option>
            <option value="new">Not reviewed</option>
          </select>
        </div>

        {visibleCards.length === 0 ? (
          <div className="p-8 text-center">
            <BookOpen size={30} className="mx-auto mb-3 text-[var(--text-muted)]" />
            <h3 className="font-bold text-[var(--text-main)]">
              {parsedCards.length === 0 ? 'Create your first flashcard' : 'No cards match this filter'}
            </h3>
            <p className="mx-auto mt-1 max-w-md text-sm text-[var(--text-muted)]">
              {parsedCards.length === 0
                ? 'Turn key facts, formulas, and definitions from your chapters into active-recall practice.'
                : 'Try another filter to see more of your cards.'}
            </p>
            {parsedCards.length === 0 && (
              <button type="button" onClick={openNewForm} className="btn btn-primary mt-4">
                <Plus size={15} /> Create a card
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-[var(--border-color)]">
            {visibleCards.map(card => (
              <article key={card.note.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="whitespace-pre-wrap font-semibold text-[var(--text-main)]">{card.data.front}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--text-muted)]">
                    <span className="inline-flex items-center gap-1"><BookOpen size={13} /> {getChapterLabel(card)}</span>
                    <span>{dueLabel(card.data)}</span>
                    <span>{card.data.reviewCount} review{card.data.reviewCount === 1 ? '' : 's'}</span>
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  {getLinkedChapter(card) && (
                    <button
                      type="button"
                      onClick={() => openStudyNotes(card)}
                      className="btn btn-ghost px-3 text-indigo-600"
                      aria-label={`Open chapter for ${card.data.front}`}
                      title="Open linked chapter"
                    >
                      <ArrowUpRight size={15} />
                    </button>
                  )}
                  <button type="button" onClick={() => openEditForm(card)} className="btn btn-ghost px-3" aria-label={`Edit ${card.data.front}`}>
                    <Pencil size={15} />
                  </button>
                  <button type="button" onClick={() => handleDelete(card)} className="btn btn-ghost px-3 text-rose-600" aria-label={`Delete ${card.data.front}`}>
                    <Trash2 size={15} />
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
