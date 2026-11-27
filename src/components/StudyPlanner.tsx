import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowRight, BookOpen, CalendarDays, Check, Clock3, Loader2, Plus, Trash2 } from 'lucide-react';
import type { StudyNote } from '../types';
import { deleteNote, getNotes, saveNote, updateNote } from '../services/database';

interface StudyPlanTask {
  id: string;
  bookId: string;
  bookTitle: string;
  chapterId: string;
  chapterTitle: string;
  date: string;
  completed: boolean;
}

interface StudyPlanData {
  targetDate: string;
  studyDays: number[];
  minutesPerSession: number;
  bookIds: string[];
  tasks: StudyPlanTask[];
}

interface SavedStudyPlan {
  note: StudyNote;
  data: StudyPlanData;
}

const WEEKDAYS = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
];

const cardClass = 'bento-card rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)]';

function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getToday(): string {
  return toDateInputValue(new Date());
}

function getSuggestedPlanDate(targetExamDate?: string): string {
  if (targetExamDate && targetExamDate >= getToday()) return targetExamDate;
  const date = new Date();
  date.setDate(date.getDate() + 30);
  return toDateInputValue(date);
}

function getStudyDates(targetDate: string, studyDays: number[]): string[] {
  const current = new Date();
  current.setHours(0, 0, 0, 0);
  const lastDay = new Date(`${targetDate}T00:00:00`);
  const dates: string[] = [];

  while (current <= lastDay) {
    if (studyDays.includes(current.getDay())) {
      dates.push(toDateInputValue(current));
    }
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isPlanTask(value: unknown): value is StudyPlanTask {
  if (!isRecord(value)) return false;
  return typeof value.id === 'string'
    && typeof value.bookId === 'string'
    && typeof value.bookTitle === 'string'
    && typeof value.chapterId === 'string'
    && typeof value.chapterTitle === 'string'
    && typeof value.date === 'string'
    && typeof value.completed === 'boolean';
}

function parsePlan(note: StudyNote): StudyPlanData | null {
  try {
    const parsed: unknown = JSON.parse(note.content);
    if (!isRecord(parsed)) return null;
    if (
      typeof parsed.targetDate !== 'string'
      || typeof parsed.minutesPerSession !== 'number'
      || !Array.isArray(parsed.studyDays)
      || !Array.isArray(parsed.bookIds)
      || !Array.isArray(parsed.tasks)
    ) return null;

    return {
      targetDate: parsed.targetDate,
      minutesPerSession: parsed.minutesPerSession,
      studyDays: parsed.studyDays.filter((day): day is number => Number.isInteger(day) && day >= 0 && day <= 6),
      bookIds: parsed.bookIds.filter((id): id is string => typeof id === 'string'),
      tasks: parsed.tasks.filter(isPlanTask),
    };
  } catch {
    return null;
  }
}

function formatPlanDate(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

export default function StudyPlanner({
  userId,
  targetExam,
  targetExamDate,
}: {
  userId: string;
  targetExam?: string;
  targetExamDate?: string;
}) {
  const navigate = useNavigate();
  const [materials, setMaterials] = useState<StudyNote[]>([]);
  const [plans, setPlans] = useState<SavedStudyPlan[]>([]);
  const [activePlanId, setActivePlanId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [goal, setGoal] = useState(() => targetExam ? `${targetExam} preparation` : '');
  const [targetDate, setTargetDate] = useState(() => getSuggestedPlanDate(targetExamDate));
  const [studyDays, setStudyDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [minutesPerSession, setMinutesPerSession] = useState(60);
  const [selectedBookIds, setSelectedBookIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    getNotes(userId)
      .then(notes => {
        if (!active) return;
        const savedPlans = notes
          .filter(note => note.file_type === 'study_plan' && !note.parent_id)
          .map(note => {
            const data = parsePlan(note);
            return data ? { note, data } : null;
          })
          .filter((plan): plan is SavedStudyPlan => plan !== null);
        setMaterials(notes);
        setPlans(savedPlans);
        setActivePlanId(savedPlans[0]?.note.id || null);
        setSelectedBookIds(notes.filter(note => note.file_type === 'book').map(book => book.id));
        setShowPlanForm(savedPlans.length === 0 && notes.some(note => note.file_type === 'book'));
        if (savedPlans.length !== notes.filter(note => note.file_type === 'study_plan').length) {
          setError('A saved study plan could not be read. You can create a replacement plan.');
        }
      })
      .catch(loadError => {
        console.error('Failed to load study planner data:', loadError);
        if (active) setError('Could not load your study plan. Please try again.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [userId]);

  const books = useMemo(
    () => materials.filter(note => note.file_type === 'book').sort((a, b) => a.title.localeCompare(b.title)),
    [materials],
  );
  const activePlan = plans.find(plan => plan.note.id === activePlanId) || null;
  const scheduledDays = useMemo(() => {
    if (!activePlan) return [];
    const grouped = new Map<string, StudyPlanTask[]>();
    activePlan.data.tasks.forEach(task => {
      const tasksForDate = grouped.get(task.date) || [];
      tasksForDate.push(task);
      grouped.set(task.date, tasksForDate);
    });
    return Array.from(grouped.entries())
      .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
      .map(([date, tasks]) => ({ date, tasks }));
  }, [activePlan]);

  const createPlan = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!goal.trim()) {
      setError('Give this plan a name, such as “Biology midterm” or “SAT preparation”.');
      return;
    }
    if (studyDays.length === 0) {
      setError('Choose at least one study day each week.');
      return;
    }

    const selectedBooks = books.filter(book => selectedBookIds.includes(book.id));
    const bookById = new Map(selectedBooks.map(book => [book.id, book]));
    const chapters = materials
      .filter(note =>
        note.parent_id
        && selectedBookIds.includes(note.parent_id)
        && (note.file_type === 'md' || note.file_type === 'txt' || note.file_type === 'html')
      )
      .sort((a, b) => {
        const bookTitleA = bookById.get(a.parent_id || '')?.title || '';
        const bookTitleB = bookById.get(b.parent_id || '')?.title || '';
        return bookTitleA.localeCompare(bookTitleB)
          || (a.sort_order ?? 0) - (b.sort_order ?? 0)
          || a.title.localeCompare(b.title);
      });

    if (chapters.length === 0) {
      setError('Add at least one chapter to a selected subject before creating a plan.');
      return;
    }
    const dates = getStudyDates(targetDate, studyDays);
    if (dates.length === 0) {
      setError('Your target date has no selected study days. Choose another date or add a study day.');
      return;
    }

    const existingPlan = editingPlanId ? plans.find(plan => plan.note.id === editingPlanId) : null;
    const completedChapterIds = new Set(
      existingPlan?.data.tasks.filter(task => task.completed).map(task => task.chapterId) || []
    );
    const tasks = chapters.flatMap((chapter, index) => {
      if (!chapter.parent_id) return [];
      const book = bookById.get(chapter.parent_id);
      if (!book) return [];
      const dateIndex = Math.min(dates.length - 1, Math.floor(index * dates.length / chapters.length));
      return [{
        id: chapter.id,
        bookId: book.id,
        bookTitle: book.title,
        chapterId: chapter.id,
        chapterTitle: chapter.title,
        date: dates[dateIndex],
        completed: completedChapterIds.has(chapter.id),
      }];
    });
    const data: StudyPlanData = {
      targetDate,
      studyDays: [...studyDays].sort((a, b) => a - b),
      minutesPerSession,
      bookIds: selectedBooks.map(book => book.id),
      tasks,
    };

    setSaving(true);
    try {
      if (existingPlan) {
        const content = JSON.stringify(data);
        await updateNote(existingPlan.note.id, {
          title: goal.trim(),
          topic: goal.trim(),
          content,
        }, userId);
        const note = { ...existingPlan.note, title: goal.trim(), topic: goal.trim(), content, updated_at: new Date().toISOString() };
        setPlans(current => current.map(plan => plan.note.id === note.id ? { note, data } : plan));
        setActivePlanId(note.id);
      } else {
        const note = await saveNote({
          user_id: userId,
          title: goal.trim(),
          content: JSON.stringify(data),
          file_type: 'study_plan',
          subject: 'Study Planner',
          topic: goal.trim(),
          tags: ['study-plan'],
          is_pinned: false,
        });
        setPlans(current => [{ note, data }, ...current]);
        setActivePlanId(note.id);
      }
      setEditingPlanId(null);
      setShowPlanForm(false);
      setGoal('');
    } catch (saveError) {
      console.error('Failed to save study plan:', saveError);
      setError('Could not save your study plan. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const toggleTask = async (plan: SavedStudyPlan, taskId: string) => {
    setError(null);
    setUpdatingTaskId(taskId);
    const data = {
      ...plan.data,
      tasks: plan.data.tasks.map(task => task.id === taskId ? { ...task, completed: !task.completed } : task),
    };
    try {
      await updateNote(plan.note.id, { content: JSON.stringify(data) }, userId);
      setPlans(current => current.map(item => item.note.id === plan.note.id ? { ...item, data } : item));
    } catch (updateError) {
      console.error('Failed to update study plan progress:', updateError);
      setError('Could not update chapter progress. Please try again.');
    } finally {
      setUpdatingTaskId(null);
    }
  };

  const removePlan = async (plan: SavedStudyPlan) => {
    if (!window.confirm(`Delete the study plan “${plan.note.title}”? Your books and chapters will not be deleted.`)) return;
    setError(null);
    try {
      await deleteNote(plan.note.id, userId);
      const remaining = plans.filter(item => item.note.id !== plan.note.id);
      setPlans(remaining);
      if (activePlanId === plan.note.id) setActivePlanId(remaining[0]?.note.id || null);
      if (editingPlanId === plan.note.id) setEditingPlanId(null);
      if (remaining.length === 0) setShowPlanForm(true);
    } catch (deleteError) {
      console.error('Failed to delete study plan:', deleteError);
      setError('Could not delete this study plan. Please try again.');
    }
  };

  const toggleStudyDay = (day: number) => {
    setStudyDays(current => current.includes(day)
      ? current.filter(value => value !== day)
      : [...current, day].sort((a, b) => a - b));
  };

  const startNewPlan = () => {
    setEditingPlanId(null);
    setGoal(targetExam ? `${targetExam} preparation` : '');
    setTargetDate(getSuggestedPlanDate(targetExamDate));
    setStudyDays([1, 2, 3, 4, 5]);
    setMinutesPerSession(60);
    setSelectedBookIds(books.map(book => book.id));
    setError(null);
    setShowPlanForm(true);
  };

  const editPlan = (plan: SavedStudyPlan) => {
    setEditingPlanId(plan.note.id);
    setGoal(plan.note.title);
    setTargetDate(plan.data.targetDate);
    setStudyDays(plan.data.studyDays);
    setMinutesPerSession(plan.data.minutesPerSession);
    setSelectedBookIds(plan.data.bookIds);
    setError(null);
    setShowPlanForm(true);
  };

  const today = getToday();
  const completedTasks = activePlan?.data.tasks.filter(task => task.completed).length || 0;
  const totalTasks = activePlan?.data.tasks.length || 0;
  const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const todaysTasks = activePlan?.data.tasks.filter(task => task.date === today && !task.completed) || [];

  return (
    <div className="mx-auto max-w-6xl space-y-5 animate-fadeIn">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-indigo-400">
            <CalendarDays size={18} />
            <span className="text-[11px] font-bold uppercase tracking-wider">Study Planner</span>
          </div>
          <h1 className="mt-1 text-2xl font-extrabold text-[var(--text-main)]">Make progress, one chapter at a time</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            {targetExam ? `Plan your ${targetExam} preparation using your own subjects and chapters.` : 'Build a schedule from your own subjects and chapters.'}
          </p>
        </div>
        {books.length > 0 && (
          <button
            type="button"
            onClick={() => showPlanForm ? setShowPlanForm(false) : startNewPlan()}
            className="btn btn-primary flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold"
          >
            <Plus size={16} /> {showPlanForm ? 'Close form' : 'New plan'}
          </button>
        )}
      </header>

      {error && (
        <div role="alert" className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-400">
          <AlertCircle size={16} className="shrink-0" /> {error}
        </div>
      )}

      {loading ? (
        <div className={`${cardClass} flex items-center justify-center gap-2 p-12 text-sm text-[var(--text-muted)]`}>
          <Loader2 size={17} className="animate-spin" /> Loading your books and plans…
        </div>
      ) : books.length === 0 ? (
        <div className={`${cardClass} p-8 text-center`}>
          <BookOpen size={34} className="mx-auto text-indigo-400" />
          <h2 className="mt-3 text-lg font-bold text-[var(--text-main)]">Create a subject space first</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-[var(--text-muted)]">
            The planner turns your subject chapters into a schedule. Add a subject and chapters, then come back to build a plan.
          </p>
          <button
            type="button"
            onClick={() => navigate('/notes?section=books')}
            className="btn btn-primary mt-4 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold"
          >
            Open subjects & chapters <ArrowRight size={15} />
          </button>
        </div>
      ) : (
        <>
          {showPlanForm && (
            <form onSubmit={createPlan} className={`${cardClass} space-y-5 p-4 sm:p-6`}>
              <div>
                <h2 className="text-lg font-extrabold text-[var(--text-main)]">{editingPlanId ? 'Adjust this plan' : 'Plan a course or goal'}</h2>
                <p className="mt-1 text-xs text-[var(--text-muted)]">We’ll spread the selected chapters across your available study days.</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-xs font-bold text-[var(--text-main)]">
                  Goal or plan name
                  <input
                    autoFocus
                    required
                    value={goal}
                    onChange={event => setGoal(event.target.value)}
                    placeholder="e.g. Biology midterm, French A2, or a certification"
                    className="mt-1.5 w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-subcard)] px-3 py-2.5 text-sm font-normal text-[var(--text-main)] focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </label>
                <label className="text-xs font-bold text-[var(--text-main)]">
                  Target date
                  <input
                    type="date"
                    required
                    min={today}
                    value={targetDate}
                    onChange={event => setTargetDate(event.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-subcard)] px-3 py-2.5 text-sm font-normal text-[var(--text-main)] focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </label>
              </div>

              <fieldset>
                <legend className="text-xs font-bold text-[var(--text-main)]">Your available study days</legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {WEEKDAYS.map(day => {
                    const selected = studyDays.includes(day.value);
                    return (
                      <button
                        key={day.value}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => toggleStudyDay(day.value)}
                        className={`rounded-lg border px-3 py-2 text-xs font-bold transition-colors ${
                          selected
                            ? 'border-indigo-500 bg-indigo-500/15 text-indigo-300'
                            : 'border-[var(--border-color)] bg-[var(--bg-subcard)] text-[var(--text-muted)]'
                        }`}
                      >
                        {day.label}
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <label className="block max-w-xs text-xs font-bold text-[var(--text-main)]">
                Minutes per study session
                <input
                  type="number"
                  min={15}
                  max={480}
                  step={15}
                  required
                  value={minutesPerSession}
                  onChange={event => setMinutesPerSession(Number(event.target.value))}
                  className="mt-1.5 w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-subcard)] px-3 py-2.5 text-sm font-normal text-[var(--text-main)] focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </label>

              <fieldset>
                <legend className="text-xs font-bold text-[var(--text-main)]">Subjects to include</legend>
                <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {books.map(book => {
                    const selected = selectedBookIds.includes(book.id);
                    const chapterCount = materials.filter(note => note.parent_id === book.id).length;
                    return (
                      <label key={book.id} className="flex cursor-pointer items-start gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-subcard)] p-3 text-sm">
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => setSelectedBookIds(current => selected
                            ? current.filter(id => id !== book.id)
                            : [...current, book.id])}
                          className="mt-0.5 accent-indigo-500"
                        />
                        <span className="min-w-0">
                          <span className="block truncate font-bold text-[var(--text-main)]">{book.title}</span>
                          <span className="text-xs text-[var(--text-muted)]">{chapterCount} chapter{chapterCount === 1 ? '' : 's'}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--border-color)] pt-4">
                {(plans.length > 0 || editingPlanId) && (
                  <button type="button" onClick={() => setShowPlanForm(false)} className="btn btn-outline rounded-xl px-4 py-2 text-sm font-bold">
                    Cancel
                  </button>
                )}
                <button
                  type="submit"
                  disabled={saving || selectedBookIds.length === 0 || !goal.trim()}
                  className="btn btn-primary inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold disabled:opacity-50"
                >
                  {saving ? <Loader2 size={15} className="animate-spin" /> : <CalendarDays size={15} />}
                  {editingPlanId ? 'Save schedule' : 'Create study plan'}
                </button>
              </div>
            </form>
          )}

          {plans.length > 0 && (
            <>
              {plans.length > 1 && (
                <div className="flex flex-wrap gap-2">
                  {plans.map(plan => (
                    <button
                      key={plan.note.id}
                      type="button"
                      onClick={() => setActivePlanId(plan.note.id)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-bold ${
                        activePlanId === plan.note.id
                          ? 'border-indigo-500 bg-indigo-500/15 text-indigo-300'
                          : 'border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-muted)]'
                      }`}
                    >
                      {plan.note.title}
                    </button>
                  ))}
                </div>
              )}

              {activePlan && (
                <>
                  {todaysTasks.length > 0 && (
                    <div className="flex items-start gap-3 rounded-2xl border border-indigo-500/30 bg-indigo-500/10 p-4">
                      <CalendarDays size={18} className="mt-0.5 shrink-0 text-indigo-400" />
                      <div>
                        <p className="text-sm font-extrabold text-[var(--text-main)]">Your study session is due today</p>
                        <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                          {todaysTasks.length} chapter{todaysTasks.length === 1 ? '' : 's'} · {activePlan.data.minutesPerSession} minutes planned
                        </p>
                      </div>
                    </div>
                  )}
                  <section className={`${cardClass} p-4 sm:p-6`}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-indigo-400">{activePlan.note.topic || 'Study goal'}</p>
                        <h2 className="mt-1 text-xl font-extrabold text-[var(--text-main)]">{activePlan.note.title}</h2>
                        <p className="mt-1 text-xs text-[var(--text-muted)]">
                          Target: {formatPlanDate(activePlan.data.targetDate)} · {activePlan.data.minutesPerSession} minutes per session
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => editPlan(activePlan)}
                        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold text-[var(--text-muted)] hover:bg-indigo-500/10 hover:text-indigo-400"
                      >
                        Adjust schedule
                      </button>
                      <button
                        type="button"
                        onClick={() => removePlan(activePlan)}
                        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold text-[var(--text-muted)] hover:bg-rose-500/10 hover:text-rose-400"
                      >
                        <Trash2 size={14} /> Delete plan
                      </button>
                    </div>
                    <div className="mt-5">
                      <div className="mb-1.5 flex items-center justify-between text-xs">
                        <span className="font-bold text-[var(--text-main)]">{completedTasks} of {totalTasks} chapters complete</span>
                        <span className="font-bold text-[var(--text-muted)]">{progress}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-[var(--bg-subcard)]">
                        <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${progress}%` }} />
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] text-[var(--text-muted)]">
                      <Clock3 size={14} />
                      Study days: {activePlan.data.studyDays.map(day => WEEKDAYS.find(item => item.value === day)?.label).filter(Boolean).join(', ') || 'None'}
                      <button
                        type="button"
                        onClick={() => navigate('/notes?section=books')}
                        className="ml-auto inline-flex items-center gap-1 font-bold text-indigo-400 hover:text-indigo-300"
                      >
                        Open subjects & chapters <ArrowRight size={13} />
                      </button>
                    </div>
                  </section>

                  <section className="space-y-3">
                    <h3 className="text-sm font-extrabold text-[var(--text-main)]">Your schedule</h3>
                    {scheduledDays.length === 0 ? (
                      <div className={`${cardClass} p-6 text-sm text-[var(--text-muted)]`}>This plan has no scheduled chapters.</div>
                    ) : scheduledDays.map(day => (
                      <div key={day.date} className={`${cardClass} p-4`}>
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                          <h4 className="text-sm font-extrabold text-[var(--text-main)]">{formatPlanDate(day.date)}</h4>
                          <span className={`text-[11px] font-bold ${day.date < today ? 'text-rose-400' : day.date === today ? 'text-indigo-400' : 'text-[var(--text-muted)]'}`}>
                            {day.date < today ? 'Past session' : day.date === today ? 'Today' : `${activePlan.data.minutesPerSession} min`}
                          </span>
                        </div>
                        <div className="space-y-2">
                          {day.tasks.map(task => (
                            <div key={task.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-[var(--bg-subcard)] p-3">
                              <button
                                type="button"
                                disabled={updatingTaskId !== null}
                                onClick={() => toggleTask(activePlan, task.id)}
                                aria-label={`${task.completed ? 'Mark incomplete' : 'Mark complete'}: ${task.chapterTitle}`}
                                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-colors ${
                                  task.completed
                                    ? 'border-emerald-500 bg-emerald-500 text-white'
                                    : 'border-[var(--border-color)] text-transparent hover:border-indigo-500'
                                }`}
                              >
                                {updatingTaskId === task.id ? <Loader2 size={14} className="animate-spin text-indigo-400" /> : <Check size={14} />}
                              </button>
                              <div className="min-w-0 flex-1">
                                <p className={`truncate text-sm font-bold ${task.completed ? 'text-[var(--text-muted)] line-through' : 'text-[var(--text-main)]'}`}>
                                  {task.chapterTitle}
                                </p>
                                <p className="truncate text-xs text-[var(--text-muted)]">{task.bookTitle}</p>
                              </div>
                              <span className={`text-[10px] font-bold ${task.completed ? 'text-emerald-400' : 'text-[var(--text-subtle)]'}`}>
                                {task.completed ? 'Done' : 'To do'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </section>
                </>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
