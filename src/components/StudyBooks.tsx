import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowUp, BookOpen, FileCode2, FileText, Pencil, Plus, Save, Trash2, Upload, X } from 'lucide-react';
import type { StudyNote } from '../types';
import { deleteNote, getNotes, saveNote, updateNote } from '../services/database';
import MarkdownViewer from './MarkdownViewer';
import { importStudyDocument } from '../utils/studyDocumentImporter';

interface StudyBooksProps {
  userId: string;
}

const cardClass = 'bento-card border border-[var(--border-color)] rounded-2xl bg-[var(--bg-surface)]';

export default function StudyBooks({ userId }: StudyBooksProps) {
  const [materials, setMaterials] = useState<StudyNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeBookId, setActiveBookId] = useState<string | null>(null);
  const [activeChapterId, setActiveChapterId] = useState<string | null>(null);
  const [showBookForm, setShowBookForm] = useState(false);
  const [bookTitle, setBookTitle] = useState('');
  const [bookSubject, setBookSubject] = useState('');
  const [studyLevel, setStudyLevel] = useState('School');
  const [curriculum, setCurriculum] = useState('');
  const [bookSearch, setBookSearch] = useState('');
  const [bookLevelFilter, setBookLevelFilter] = useState('all');
  const [isEditingChapter, setIsEditingChapter] = useState(false);
  const [chapterTitle, setChapterTitle] = useState('');
  const [chapterContent, setChapterContent] = useState('');
  const markdownInputRef = useRef<HTMLInputElement>(null);
  const htmlInputRef = useRef<HTMLInputElement>(null);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      setMaterials(await getNotes(userId));
    } catch (loadError) {
      console.error('Failed to load books and chapters:', loadError);
      setError('Could not load your books. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, [userId]);

  const books = useMemo(
    () => materials.filter(item => item.file_type === 'book').sort((a, b) => a.title.localeCompare(b.title)),
    [materials],
  );
  const filteredBooks = useMemo(() => books.filter(book => {
    const matchesLevel = bookLevelFilter === 'all' || (book.study_level || 'Other') === bookLevelFilter;
    const searchableText = `${book.title} ${book.subject || ''} ${book.curriculum || ''}`.toLowerCase();
    return matchesLevel && searchableText.includes(bookSearch.trim().toLowerCase());
  }), [books, bookLevelFilter, bookSearch]);
  const activeBook = books.find(book => book.id === activeBookId) || null;
  const chapters = useMemo(
    () => materials
      .filter(item => item.parent_id === activeBookId)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.created_at.localeCompare(b.created_at)),
    [materials, activeBookId],
  );
  const activeChapter = chapters.find(chapter => chapter.id === activeChapterId) || null;

  const createBook = async (event: React.FormEvent) => {
    event.preventDefault();
    const title = bookTitle.trim() || bookSubject.trim();
    if (!title) return;
    try {
      const book = await saveNote({
        user_id: userId,
        title,
        content: '',
        file_type: 'book',
        subject: bookSubject.trim() || title,
        study_level: studyLevel,
        curriculum: curriculum.trim(),
        tags: [],
        is_pinned: false,
        emoji: '📚',
      });
      setBookTitle('');
      setBookSubject('');
      setStudyLevel('School');
      setCurriculum('');
      setShowBookForm(false);
      setActiveBookId(book.id);
      setActiveChapterId(null);
      await refresh();
    } catch (saveError) {
      console.error('Failed to create book:', saveError);
      setError('Could not create the book. Please try again.');
    }
  };

  const startNewChapter = () => {
    setActiveChapterId(null);
    setChapterTitle('');
    setChapterContent('');
    setIsEditingChapter(true);
    setError(null);
  };

  const editChapter = (chapter: StudyNote) => {
    setChapterTitle(chapter.title);
    setChapterContent(chapter.content);
    setIsEditingChapter(true);
    setError(null);
  };

  const saveChapter = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!activeBook || !chapterTitle.trim() || !chapterContent.trim()) {
      setError('Add a chapter title and some content before saving.');
      return;
    }
    try {
      if (activeChapter) {
        const extension = activeChapter.file_type === 'txt' ? '.txt' : '.md';
        await updateNote(activeChapter.id, {
          title: chapterTitle.trim(),
          content: chapterContent,
          file_name: `${chapterTitle.trim().replace(/[\\/:*?"<>|]/g, '_')}${extension}`,
        });
      } else {
        const chapter = await saveNote({
          user_id: userId,
          title: chapterTitle.trim(),
          content: chapterContent,
          file_type: 'md',
          parent_id: activeBook.id,
          sort_order: chapters.length,
          subject: activeBook.subject || 'General Studies',
          tags: [],
          file_name: `${chapterTitle.trim().replace(/[\\/:*?"<>|]/g, '_')}.md`,
          is_pinned: false,
        });
        setActiveChapterId(chapter.id);
      }
      setIsEditingChapter(false);
      setError(null);
      await refresh();
    } catch (saveError) {
      console.error('Failed to save book chapter:', saveError);
      setError('Could not save this chapter. Please try again.');
    }
  };

  const uploadHtmlChapter = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !activeBook) return;
    if (!file.name.toLowerCase().endsWith('.html') && !file.name.toLowerCase().endsWith('.htm')) {
      setError('Choose an .html or .htm file.');
      return;
    }
    try {
      const content = await file.text();
      const chapter = await saveNote({
        user_id: userId,
        title: file.name.replace(/\.(html?|HTML?)$/i, '').replace(/[-_]/g, ' '),
        content,
        file_type: 'html',
        parent_id: activeBook.id,
        sort_order: chapters.length,
        subject: activeBook.subject || 'General Studies',
        tags: [],
        file_name: file.name,
        file_size: file.size,
        is_pinned: false,
      });
      await refresh();
      setActiveChapterId(chapter.id);
      setIsEditingChapter(false);
      setError(null);
    } catch (uploadError) {
      console.error('Failed to upload HTML chapter:', uploadError);
      setError('Could not upload this HTML file. Please try again.');
    }
  };

  const uploadNoteChapter = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !activeBook) return;
    try {
      const imported = await importStudyDocument(file);
      const chapter = await saveNote({
        user_id: userId,
        title: file.name.replace(/\.(md|markdown|txt|pdf|docx)$/i, '').replace(/[-_]/g, ' '),
        content: imported.content,
        file_type: imported.fileType,
        parent_id: activeBook.id,
        sort_order: chapters.length,
        subject: activeBook.subject || 'General Studies',
        tags: [],
        file_name: imported.fileName,
        source_file_name: imported.sourceFileName,
        file_size: file.size,
        is_pinned: false,
      });
      await refresh();
      setActiveChapterId(chapter.id);
      setIsEditingChapter(false);
      setError(null);
    } catch (uploadError) {
      console.error('Failed to upload note chapter:', uploadError);
      setError(uploadError instanceof Error ? uploadError.message : 'Could not upload this note chapter. Please try again.');
    }
  };

  const removeChapter = async (chapter: StudyNote) => {
    if (!confirm(`Delete chapter "${chapter.title}"? This cannot be undone.`)) return;
    try {
      await deleteNote(chapter.id, userId);
      setActiveChapterId(null);
      setIsEditingChapter(false);
      await refresh();
    } catch (deleteError) {
      console.error('Failed to delete chapter:', deleteError);
      setError('Could not delete this chapter. Please try again.');
    }
  };

  const removeBook = async () => {
    if (!activeBook || !confirm(`Delete "${activeBook.title}" and all its chapters? This cannot be undone.`)) return;
    try {
      await deleteNote(activeBook.id, userId);
      setActiveBookId(null);
      setActiveChapterId(null);
      setIsEditingChapter(false);
      await refresh();
    } catch (deleteError) {
      console.error('Failed to delete book:', deleteError);
      setError('Could not delete this book. Please try again.');
    }
  };

  const moveChapter = async (chapter: StudyNote, direction: -1 | 1) => {
    const index = chapters.findIndex(item => item.id === chapter.id);
    const target = chapters[index + direction];
    if (!target) return;
    try {
      await Promise.all([
        updateNote(chapter.id, { sort_order: target.sort_order ?? index + direction }),
        updateNote(target.id, { sort_order: chapter.sort_order ?? index }),
      ]);
      await refresh();
    } catch (moveError) {
      console.error('Failed to reorder book chapter:', moveError);
      setError('Could not reorder chapters. Please try again.');
    }
  };

  if (loading) {
    return <div className={`${cardClass} p-8 text-center text-sm text-[var(--text-muted)]`}>Loading books…</div>;
  }

  return (
    <section className="space-y-5">
      {error && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-400">
          <span>{error}</span>
          <button type="button" aria-label="Dismiss error" onClick={() => setError(null)}><X size={16} /></button>
        </div>
      )}

      {!activeBook ? (
        <>
          <div className={`${cardClass} flex flex-wrap items-center justify-between gap-4 p-5`}>
            <div>
              <h2 className="flex items-center gap-2 text-xl font-black text-[var(--text-main)]"><BookOpen size={22} className="text-indigo-400" /> Your study library</h2>
              <p className="mt-1 text-sm text-[var(--text-muted)]">Keep subjects, chapters, and interactive lessons organized for each course or exam.</p>
            </div>
            <button type="button" onClick={() => { setBookTitle(''); setBookSubject(''); setStudyLevel('School'); setCurriculum(''); setShowBookForm(true); }} className="btn btn-primary flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold">
              <Plus size={16} /> Add subject
            </button>
          </div>
          {showBookForm && (
            <form onSubmit={createBook} className={`${cardClass} grid gap-3 p-4 sm:grid-cols-2`}>
              <label className="text-xs font-bold text-[var(--text-main)]">
                Subject space name
                <input autoFocus value={bookTitle} onChange={event => setBookTitle(event.target.value)} placeholder="e.g. Mathematics" aria-label="Subject space name" className="mt-1.5 w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-subcard)] px-3 py-2.5 text-sm font-normal text-[var(--text-main)] focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </label>
              <label className="text-xs font-bold text-[var(--text-main)]">
                Subject
                <input value={bookSubject} onChange={event => setBookSubject(event.target.value)} placeholder="e.g. Physics, History, English" aria-label="Subject" className="mt-1.5 w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-subcard)] px-3 py-2.5 text-sm font-normal text-[var(--text-main)] focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </label>
              <label className="text-xs font-bold text-[var(--text-main)]">
                Study path
                <select value={studyLevel} onChange={event => setStudyLevel(event.target.value)} aria-label="Study path" className="mt-1.5 w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-subcard)] px-3 py-2.5 text-sm font-normal text-[var(--text-main)] focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option>School</option>
                  <option>College / University</option>
                  <option>Competitive exam</option>
                  <option>Self study</option>
                </select>
              </label>
              <label className="text-xs font-bold text-[var(--text-main)]">
                Grade, course, or exam <span className="font-normal text-[var(--text-muted)]">(optional)</span>
                <input value={curriculum} onChange={event => setCurriculum(event.target.value)} placeholder="e.g. Grade 8 Biology, AP Calculus, or SAT 2026" aria-label="Grade, course, or exam" className="mt-1.5 w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-subcard)] px-3 py-2.5 text-sm font-normal text-[var(--text-main)] focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </label>
              <div className="flex justify-end gap-2 sm:col-span-2">
                <button type="button" onClick={() => setShowBookForm(false)} className="btn btn-outline rounded-xl px-4 py-2 text-sm font-semibold">Cancel</button>
                <button type="submit" className="btn btn-primary rounded-xl px-4 py-2 text-sm font-bold">Create subject space</button>
              </div>
            </form>
          )}
          {books.length === 0 ? (
            <div className={`${cardClass} p-10 text-center`}>
              <BookOpen size={34} className="mx-auto text-indigo-400" />
              <h3 className="mt-3 font-bold text-[var(--text-main)]">No subjects yet</h3>
              <p className="mt-1 text-sm text-[var(--text-muted)]">Create a subject space to collect chapters, imported documents, and interactive HTML lessons.</p>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input value={bookSearch} onChange={event => setBookSearch(event.target.value)} placeholder="Search subjects, courses, or exams" aria-label="Search study subjects" className="min-w-0 flex-1 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-2.5 text-sm text-[var(--text-main)] focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                <select value={bookLevelFilter} onChange={event => setBookLevelFilter(event.target.value)} aria-label="Filter by study path" className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-2.5 text-sm text-[var(--text-main)] focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="all">All study paths</option>
                  <option>School</option>
                  <option>College / University</option>
                  <option>Competitive exam</option>
                  <option>Self study</option>
                  <option>Other</option>
                </select>
              </div>
              {filteredBooks.length === 0 ? (
                <div className={`${cardClass} p-8 text-center text-sm text-[var(--text-muted)]`}>No subjects match this search. Try another subject or study path.</div>
              ) : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredBooks.map(book => {
                const chapterCount = materials.filter(item => item.parent_id === book.id).length;
                return (
                  <button key={book.id} type="button" onClick={() => { setActiveBookId(book.id); setActiveChapterId(null); setIsEditingChapter(false); }} className={`${cardClass} group p-5 text-left transition hover:border-indigo-500/50 hover:shadow-lg`}>
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400"><BookOpen size={21} /></span>
                    <span className="mt-4 block truncate text-lg font-extrabold text-[var(--text-main)]">{book.title}</span>
                    <span className="mt-1 block truncate text-xs font-semibold text-indigo-400">{book.subject || 'General Studies'}</span>
                    <span className="mt-1 block truncate text-xs text-[var(--text-muted)]">{[book.study_level, book.curriculum].filter(Boolean).join(' · ') || 'Study path not set'}</span>
                    <span className="mt-1 block text-sm text-[var(--text-muted)]">{chapterCount} chapter{chapterCount === 1 ? '' : 's'}</span>
                  </button>
                );
              })}
              </div>}
            </>
          )}
        </>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(240px,0.8fr)_minmax(0,1.8fr)]">
          <aside className={`${cardClass} p-4`}>
            <button type="button" onClick={() => { setActiveBookId(null); setActiveChapterId(null); setIsEditingChapter(false); }} className="mb-4 flex items-center gap-2 text-sm font-bold text-indigo-400 hover:text-indigo-300">
            <ArrowLeft size={16} /> All subjects
            </button>
            <div className="mb-4 flex items-start justify-between gap-2">
              <h2 className="min-w-0 text-xl font-black text-[var(--text-main)]">{activeBook.title}</h2>
              <button type="button" onClick={removeBook} title="Delete book and chapters" className="rounded-lg p-2 text-rose-400 hover:bg-rose-500/10"><Trash2 size={16} /></button>
            </div>
            <div className="mb-3 grid grid-cols-2 gap-2">
              <button type="button" onClick={startNewChapter} className="flex items-center justify-center gap-1.5 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-2 py-2 text-xs font-bold text-indigo-400 hover:bg-indigo-500/20"><Plus size={14} /> Note chapter</button>
              <button type="button" onClick={() => markdownInputRef.current?.click()} className="flex items-center justify-center gap-1.5 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-2 py-2 text-xs font-bold text-indigo-400 hover:bg-indigo-500/20"><Upload size={14} /> Import notes / docs</button>
              <button type="button" onClick={() => htmlInputRef.current?.click()} className="flex items-center justify-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-2 py-2 text-xs font-bold text-emerald-400 hover:bg-emerald-500/20"><Upload size={14} /> HTML chapter</button>
              <input ref={markdownInputRef} type="file" accept=".md,.markdown,.txt,.pdf,.docx,text/markdown,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="hidden" onChange={uploadNoteChapter} />
              <input ref={htmlInputRef} type="file" accept=".html,.htm,text/html" className="hidden" onChange={uploadHtmlChapter} />
            </div>
            <ol className="space-y-1">
              {chapters.map((chapter, index) => (
                <li key={chapter.id} className={`group flex items-center gap-1 rounded-xl border px-2 py-1.5 ${activeChapterId === chapter.id ? 'border-indigo-500/40 bg-indigo-500/10' : 'border-transparent hover:bg-[var(--bg-subcard)]'}`}>
                  <button type="button" onClick={() => { setActiveChapterId(chapter.id); setIsEditingChapter(false); setError(null); }} className="flex min-w-0 flex-1 items-center gap-2 py-1 text-left">
                    {chapter.file_type === 'html' ? <FileCode2 size={15} className="shrink-0 text-emerald-400" /> : <FileText size={15} className="shrink-0 text-indigo-400" />}
                    <span className="truncate text-sm font-semibold text-[var(--text-main)]">{chapter.title}</span>
                  </button>
                  <div className="flex shrink-0 items-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                    <button type="button" disabled={index === 0} onClick={() => void moveChapter(chapter, -1)} title="Move chapter up" className="rounded p-1 text-[var(--text-muted)] hover:text-[var(--text-main)] disabled:opacity-30"><ArrowUp size={13} /></button>
                    <button type="button" disabled={index === chapters.length - 1} onClick={() => void moveChapter(chapter, 1)} title="Move chapter down" className="rounded p-1 text-[var(--text-muted)] hover:text-[var(--text-main)] disabled:opacity-30"><ArrowDown size={13} /></button>
                  </div>
                </li>
              ))}
            </ol>
            {chapters.length === 0 && <p className="py-5 text-center text-xs text-[var(--text-muted)]">Add the first chapter to this book.</p>}
          </aside>

          <main className={`${cardClass} min-h-[480px] p-4 sm:p-6`}>
            {isEditingChapter ? (
              <form onSubmit={saveChapter} className="flex h-full flex-col gap-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-lg font-extrabold text-[var(--text-main)]">{activeChapter ? 'Edit chapter' : 'New note chapter'}</h3>
                  <button type="button" onClick={() => setIsEditingChapter(false)} aria-label="Cancel editing" className="rounded-lg p-2 text-[var(--text-muted)] hover:bg-[var(--bg-subcard)]"><X size={18} /></button>
                </div>
                <input value={chapterTitle} onChange={event => setChapterTitle(event.target.value)} placeholder="Chapter title" aria-label="Chapter title" className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-subcard)] px-3 py-2.5 text-sm font-bold text-[var(--text-main)] focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                <textarea value={chapterContent} onChange={event => setChapterContent(event.target.value)} placeholder="Write your chapter in Markdown..." aria-label="Chapter content" className="min-h-[280px] flex-1 resize-y rounded-xl border border-[var(--border-color)] bg-[var(--bg-subcard)] p-4 font-mono text-sm text-[var(--text-main)] focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                <button type="submit" className="btn btn-primary flex items-center justify-center gap-2 self-end rounded-xl px-4 py-2.5 text-sm font-bold"><Save size={16} /> Save chapter</button>
              </form>
            ) : activeChapter ? (
              <>
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-color)] pb-4">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                      {activeChapter.file_type === 'html' ? 'Interactive HTML' : 'Note chapter'}
                      {activeChapter.source_file_name ? ` · Imported from ${activeChapter.source_file_name}` : ''}
                    </span>
                    <h3 className="mt-1 text-xl font-black text-[var(--text-main)]">{activeChapter.title}</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    {activeChapter.file_type !== 'html' && <button type="button" onClick={() => editChapter(activeChapter)} className="btn btn-outline flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold"><Pencil size={14} /> Edit</button>}
                    <button type="button" onClick={() => void removeChapter(activeChapter)} aria-label="Delete chapter" className="rounded-xl border border-rose-500/30 p-2 text-rose-400 hover:bg-rose-500/10"><Trash2 size={16} /></button>
                  </div>
                </div>
                {activeChapter.file_type === 'html' ? (
                  <div>
                    <p className="mb-2 text-xs text-[var(--text-muted)]">This page runs in an isolated preview sandbox.</p>
                    <div className="overflow-hidden rounded-xl border border-[var(--border-color)] bg-white">
                    <iframe
                      title={`Preview: ${activeChapter.title}`}
                      srcDoc={activeChapter.content}
                      sandbox="allow-scripts allow-forms"
                      referrerPolicy="no-referrer"
                      className="h-[70vh] min-h-[420px] w-full"
                    />
                    </div>
                  </div>
                ) : (
                  <MarkdownViewer content={activeChapter.content} fileType={activeChapter.file_type === 'txt' ? 'txt' : 'md'} noteTitle={activeChapter.title} className="max-w-none" />
                )}
              </>
            ) : (
              <div className="flex min-h-[440px] flex-col items-center justify-center text-center">
                <BookOpen size={38} className="text-indigo-400" />
                <h3 className="mt-3 text-lg font-bold text-[var(--text-main)]">{chapters.length ? 'Choose a chapter' : 'Start this book'}</h3>
                <p className="mt-1 max-w-sm text-sm text-[var(--text-muted)]">{chapters.length ? 'Pick a chapter from the list to read or preview it.' : 'Add a written chapter or upload an HTML lesson to begin.'}</p>
                {!chapters.length && <button type="button" onClick={startNewChapter} className="btn btn-primary mt-4 flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold"><Plus size={15} /> Add first chapter</button>}
              </div>
            )}
          </main>
        </div>
      )}
    </section>
  );
}
