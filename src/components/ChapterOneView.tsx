import React, { useState, useMemo } from 'react';
import { StudyNote } from '../types';
import {
  QuietSeaCover,
  BrighterDayCover,
  LastHorizonCover,
  SmallDeparturesCover,
  ChapterOneLandscapeIllustration,
  NoteCoverArtwork,
} from './ChapterOneArtworks';
import {
  Search,
  Bookmark,
  BookmarkCheck,
  ChevronRight,
  Home,
  BookOpen,
  FileText,
  MoreHorizontal,
  Plus,
  ArrowRight,
  X,
  Compass,
  Check,
  Sparkles,
  SlidersHorizontal,
  Trash2,
  Edit3,
  Download,
  Pin,
  Copy,
} from 'lucide-react';

export type ChapterOneTab = 'home' | 'library' | 'notes' | 'more';

interface ChapterOneViewProps {
  notes: StudyNote[];
  onOpenNote: (note: StudyNote) => void;
  onNewNote: () => void;
  onTogglePin?: (noteId: string) => void;
  onEditNote?: (note: StudyNote) => void;
  onDeleteNote?: (note: StudyNote) => void;
  onDownloadNote?: (note: StudyNote) => void;
  onExitEditorial?: () => void;
}

export interface EditorialBook {
  id: string;
  title: string;
  author: string;
  chapter: string;
  progress: number;
  status: 'reading' | 'to_read' | 'finished';
  timeLeft: string;
  coverType: 'quiet_sea' | 'brighter_day' | 'last_horizon' | 'small_departures';
  quote?: string;
  quoteChapter?: string;
  quoteDate?: string;
  reflectionTitle?: string;
  reflectionSnippet?: string;
  reflectionDate?: string;
  content: string;
  rawNote?: StudyNote;
}

// Curated Literary & Revision sample notes matching the mockup
const CURATED_EDITORIAL_BOOKS: EditorialBook[] = [
  {
    id: 'curated-quiet-sea',
    title: 'The Quiet Sea',
    author: 'A Novel & Study on Serenity',
    chapter: 'Chapter 12 of 18',
    progress: 68,
    status: 'reading',
    timeLeft: 'About 2 hours left',
    coverType: 'quiet_sea',
    quote: 'There is a kind of freedom in not knowing what comes next.',
    quoteChapter: 'The Quiet Sea · Chapter 8',
    quoteDate: 'May 12',
    reflectionTitle: 'A slower kind of life',
    reflectionSnippet: "The sea isn't empty — it's full of possibilities. A reminder to find space, even in uncertainty.",
    reflectionDate: 'May 9',
    content: `# The Quiet Sea

*A reflection on deliberate attention, continuous learning, and quiet mastery.*

## Chapter 12: Finding Stillness in Motion

Quieter people see a brighter world. When you silence the noisy notifications and allow yourself dedicated uninterrupted reading sessions, retention increases exponentially.

> "There is a kind of freedom in not knowing what comes next." — Chapter 8

### Key Reading Observations
1. **Patience over haste**: Depth of comprehension always beats superficial skimming.
2. **Formula for steady focus**: \\( \\text{Retention} = \\text{Attention} \\times \\text{Revision Frequency} \\).
3. **The quiet sea within**: The sea isn't empty — it's full of possibilities. A reminder to find space, even in uncertainty.
`,
  },
  {
    id: 'curated-brighter-day',
    title: 'A Brighter Day',
    author: 'Reflections on Wonder & Growth',
    chapter: 'Chapter 3 of 10',
    progress: 25,
    status: 'to_read',
    timeLeft: 'About 4 hours left',
    coverType: 'brighter_day',
    quote: 'Morning light changes everything it touches, including our thoughts.',
    quoteChapter: 'A Brighter Day · Chapter 2',
    quoteDate: 'May 7',
    reflectionTitle: 'On wonder',
    reflectionSnippet: 'Not everything needs an answer. Some things are meant to be felt, not solved.',
    reflectionDate: 'May 4',
    content: `# A Brighter Day

*Notes on curiosity, botanical balance, and intellectual wonder.*

## Chapter 3: The Architecture of Wonder

Not everything needs an immediate answer. Some things are meant to be felt, digested, and reflected upon rather than solved on the spot.

### Principles of Daily Renewal
- **Natural light and mental clarity**: Early morning revision retains 35% higher recall.
- **Incremental steps**: Each small idea planted today blossoms into tomorrow's mastery.
`,
  },
  {
    id: 'curated-last-horizon',
    title: 'The Last Horizon',
    author: 'Navigating Frontiers & Examination Peaks',
    chapter: 'Chapter 14 of 14',
    progress: 100,
    status: 'finished',
    timeLeft: 'Completed',
    coverType: 'last_horizon',
    quote: 'The farthest horizon is simply the next shore waiting to be charted.',
    quoteChapter: 'The Last Horizon · Epilogue',
    quoteDate: 'April 28',
    reflectionTitle: 'Beyond the horizon',
    reflectionSnippet: 'Looking back from the summit reveals that the steep ascent was the true reward.',
    reflectionDate: 'April 25',
    content: `# The Last Horizon

*A comprehensive revision journey from initial preparation to final mastery.*

## Epilogue: Crossing the Threshold

When preparation meets opportunity, anxiety transforms into poised confidence.
`,
  },
  {
    id: 'curated-small-departures',
    title: 'Small Departures',
    author: 'Desert Essays & Concise Study Distillations',
    chapter: 'Chapter 1 of 8',
    progress: 10,
    status: 'to_read',
    timeLeft: 'About 5 hours left',
    coverType: 'small_departures',
    quote: 'Every great expedition begins with the quiet decision to leave familiar ground.',
    quoteChapter: 'Small Departures · Chapter 1',
    quoteDate: 'May 1',
    reflectionTitle: 'Shifting sands',
    reflectionSnippet: 'Dunes shift under the wind, yet the bedrock below remains completely unmoved.',
    reflectionDate: 'April 20',
    content: `# Small Departures

*Distilled study formulas and short essays on perseverance.*
`,
  },
];

export default function ChapterOneView({
  notes,
  onOpenNote,
  onNewNote,
  onTogglePin,
  onEditNote,
  onDeleteNote,
  onDownloadNote,
  onExitEditorial,
}: ChapterOneViewProps) {
  const [activeTab, setActiveTab] = useState<ChapterOneTab>('home');
  const [libraryFilter, setLibraryFilter] = useState<'all' | 'reading' | 'to_read' | 'finished'>('all');
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [notesFilter, setNotesFilter] = useState<'all' | 'highlights' | 'reflections' | 'quotes'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [bookmarkedQuotes, setBookmarkedQuotes] = useState<Record<string, boolean>>({
    'curated-quiet-sea': true,
  });

  // Unique subjects across notes
  const availableSubjects = useMemo(() => {
    const subs = new Set<string>();
    notes.forEach(n => {
      if (n.subject) subs.add(n.subject);
    });
    return Array.from(subs);
  }, [notes]);

  // Toggle quote bookmark
  const toggleBookmark = (id: string) => {
    setBookmarkedQuotes(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Combine curated books with user notes so user's actual notes appear as books!
  const allBooks: EditorialBook[] = useMemo(() => {
    // Convert user's study notes into book format with real word counts
    const userBooks = notes.map((n, idx) => {
      const words = n.content.trim().split(/\s+/).filter(Boolean).length;
      const mins = Math.max(1, Math.ceil(words / 200));
      return {
        id: n.id,
        title: n.title,
        author: n.subject || 'Study Note',
        chapter: `${words} words · ${mins} min read`,
        progress: n.is_pinned ? 100 : 50,
        status: n.is_pinned ? ('reading' as const) : ('to_read' as const),
        timeLeft: `${mins} min read`,
        coverType: (['quiet_sea', 'brighter_day', 'last_horizon', 'small_departures'] as const)[idx % 4],
        quote: n.content.split('\n').find(l => l.startsWith('>'))?.replace(/^>\s*/, '') || undefined,
        quoteChapter: `${n.title} · Notes`,
        quoteDate: new Date(n.updated_at || n.created_at || Date.now()).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        reflectionTitle: n.title,
        reflectionSnippet: n.content.replace(/^#+.*$/gm, '').trim().slice(0, 120) + '...',
        reflectionDate: new Date(n.created_at || Date.now()).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        content: n.content,
        rawNote: n,
      };
    });

    // Deduplicate against curated items
    return [...CURATED_EDITORIAL_BOOKS, ...userBooks];
  }, [notes]);

  // Featured book for "Continue reading" (Screen 1)
  const featuredBook = allBooks[0] || CURATED_EDITORIAL_BOOKS[0];

  // Filtered books for "Your library" (Screen 2)
  const filteredLibrary = useMemo(() => {
    return allBooks.filter(b => {
      if (searchQuery && !b.title.toLowerCase().includes(searchQuery.toLowerCase()) && !b.author.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      if (selectedSubject !== 'all' && b.author !== selectedSubject) {
        return false;
      }
      if (libraryFilter === 'reading') return b.status === 'reading';
      if (libraryFilter === 'to_read') return b.status === 'to_read';
      if (libraryFilter === 'finished') return b.status === 'finished';
      return true;
    });
  }, [allBooks, libraryFilter, selectedSubject, searchQuery]);

  // Handle opening a book (converts curated or user note to StudyNote for EReaderView)
  const handleOpenBook = (book: typeof allBooks[0]) => {
    if ('rawNote' in book && book.rawNote) {
      onOpenNote(book.rawNote as StudyNote);
    } else {
      const pseudoNote: StudyNote = {
        id: book.id,
        user_id: 'editorial',
        title: book.title,
        content: book.content,
        file_type: 'md',
        subject: book.author,
        tags: ['editorial', 'chapter-one'],
        is_pinned: book.status === 'reading',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      onOpenNote(pseudoNote);
    }
  };

  return (
    <div className="w-full min-h-full pb-20 md:pb-6 animate-fadeIn font-sans text-[#1C2321]">
      {/* ============================================================ */}
      {/* DESKTOP HERO SPREAD (Matches Left Poster in Mockup Image) */}
      {/* ============================================================ */}
      <div className="hidden lg:grid lg:grid-cols-12 gap-8 mb-8 p-8 rounded-3xl bg-gradient-to-br from-[#FAF7F2] via-[#FFFFFF] to-[#F5EFEB] border border-[#E8DFD1] shadow-sm relative overflow-hidden">
        {/* Left Column: Inspiring Poster Editorial Typography */}
        <div className="lg:col-span-5 flex flex-col justify-between py-2 z-10">
          <div>
            {/* Brand Logo Header */}
            <div className="flex items-center gap-2 select-none mb-6">
              <span className="font-mono tracking-[0.25em] text-xs uppercase font-extrabold text-[#1C2321]">
                CHAPTER
              </span>
              <span className="text-[#B85338] font-black text-sm">/</span>
              <span className="font-mono tracking-[0.25em] text-xs uppercase font-extrabold text-[#1C2321]">
                ONE
              </span>
            </div>

            {/* Poster Headline */}
            <h1 className="text-4xl xl:text-5xl font-black text-[#1C2321] leading-[1.1] tracking-tight font-editorial mb-4">
              A little<br />
              more<br />
              wonder.
            </h1>

            {/* Overline Taglines */}
            <div className="space-y-1 my-6 font-mono text-[10px] uppercase tracking-[0.3em] text-[#7A7268] font-bold">
              <div>GOOD BOOKS</div>
              <div>A BRIGHTER YOU</div>
            </div>

            <p className="text-sm text-[#7A7268] max-w-xs font-serif leading-relaxed">
              A reading companion for a calmer, more curious life. Immerse yourself in uninterrupted study notes and revision chapters.
            </p>
          </div>

          <div className="pt-6 flex items-center gap-3">
            <button
              onClick={() => handleOpenBook(featuredBook)}
              className="px-5 py-2.5 rounded-full bg-[#B85338] hover:bg-[#A3452D] text-white text-xs font-bold shadow-sm flex items-center gap-2 transition-all cursor-pointer active:scale-95"
            >
              <span>Continue reading</span>
              <ChevronRight size={14} />
            </button>
            <button
              onClick={onNewNote}
              className="px-4 py-2.5 rounded-full bg-[#FFFFFF] hover:bg-[#F5EFEB] border border-[#E8DFD1] text-xs font-bold text-[#1C2321] transition-all cursor-pointer"
            >
              + New Note
            </button>
          </div>
        </div>

        {/* Right Column: Landscape mountain illustration with terracotta sun */}
        <div className="lg:col-span-7 relative flex items-center justify-center">
          <ChapterOneLandscapeIllustration className="w-full max-h-[340px] opacity-90 select-none pointer-events-none" />
          <div className="absolute bottom-4 right-4 text-right font-mono text-[9px] uppercase tracking-[0.25em] text-[#7A7268] font-bold">
            SAME STORIES.<br />A CALMER YOU.
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* MOBILE / RESPONSIVE CHAPTER ONE PHONE INTERFACE (3 Screens) */}
      {/* ============================================================ */}
      <div className="max-w-md mx-auto bg-[#FFFFFF] border border-[#E8DFD1] rounded-[2.5rem] shadow-xl overflow-hidden relative">
        {/* Top App Bar Header (Matches top of all 3 screens) */}
        <header className="px-6 pt-6 pb-3 flex items-center justify-between border-b border-[#FAF5EE] bg-[#FFFFFF]/90 backdrop-blur-md sticky top-0 z-20 select-none">
          {/* Logo: CHAPTER / ONE */}
          <div className="flex items-center gap-2">
            <span className="font-mono tracking-[0.25em] text-xs uppercase font-extrabold text-[#1C2321]">
              CHAPTER
            </span>
            <span className="text-[#B85338] font-bold text-sm">/</span>
            <span className="font-mono tracking-[0.25em] text-xs uppercase font-extrabold text-[#1C2321]">
              ONE
            </span>
          </div>

          {/* Right Header Controls: Search & Avatar/Menu */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              onClick={() => setIsSearchOpen(!isSearchOpen)}
              className="p-1.5 sm:p-2 rounded-full text-[#7A7268] hover:text-[#1C2321] hover:bg-[#F5EFEB] transition-colors cursor-pointer"
              aria-label="Search library"
            >
              <Search size={16} />
            </button>
            <button
              onClick={onNewNote}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#F5EFEB] border border-[#E8DFD1] text-[#B85338] flex items-center justify-center font-bold text-xs hover:bg-[#B85338] hover:text-white transition-all cursor-pointer"
              title="Create note"
            >
              <Plus size={14} />
            </button>
            {onExitEditorial && (
              <button
                onClick={onExitEditorial}
                className="px-2 py-1 rounded-full text-[10px] font-bold border border-[#E8DFD1] text-[#7A7268] hover:text-[#1C2321] hover:bg-[#F5EFEB] transition-all cursor-pointer"
                title="Switch back to standard notes view"
              >
                Grid
              </button>
            )}
          </div>
        </header>

        {/* Quick Search Drawer if open */}
        {isSearchOpen && (
          <div className="px-6 py-2 bg-[#FAF7F2] border-b border-[#E8DFD1] animate-fadeIn flex items-center gap-2">
            <Search size={14} className="text-[#7A7268]" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search books, chapters, quotes..."
              className="flex-1 bg-transparent text-xs text-[#1C2321] focus:outline-none placeholder-[#A39B8F]"
              autoFocus
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="text-[#7A7268] hover:text-[#1C2321]">
                <X size={13} />
              </button>
            )}
          </div>
        )}

        {/* Screen Content based on Active Tab */}
        <main className="p-6 space-y-6">
          {/* ======================================================== */}
          {/* SCREEN 1: "Continue reading" (Home Dashboard) */}
          {/* ======================================================== */}
          {activeTab === 'home' && (
            <div className="space-y-6 animate-fadeIn">
              {/* Heading */}
              <h2 className="text-2xl font-black text-[#1C2321] tracking-tight font-editorial">
                Continue reading
              </h2>

              {/* Featured Book Card (The centerpiece of Screen 1) */}
              <div className="p-5 rounded-3xl bg-[#FAF7F2] border border-[#E8DFD1] shadow-2xs space-y-4">
                <div className="grid grid-cols-12 gap-4 items-center">
                  {/* Left: Book Cover Artwork */}
                  <div className="col-span-7">
                    <div className="shadow-md rounded-2xl overflow-hidden hover:scale-[1.02] transition-transform cursor-pointer" onClick={() => handleOpenBook(featuredBook)}>
                      <QuietSeaCover title={featuredBook.title} subtitle="A NOVEL" />
                    </div>
                  </div>

                  {/* Right: Quote Pill & Literary Whisper */}
                  <div className="col-span-5 flex flex-col justify-center space-y-3 pl-1">
                    <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#7A7268] leading-relaxed font-bold">
                      QUIETER PEOPLE SEE A BRIGHTER WORLD.
                    </div>
                    <div className="w-8 h-[1px] bg-[#B85338]" />
                  </div>
                </div>

                {/* Book Meta & Progress */}
                <div className="pt-2 space-y-2">
                  <div className="flex items-center justify-between">
                    <h3
                      onClick={() => handleOpenBook(featuredBook)}
                      className="text-lg font-black text-[#1C2321] font-editorial cursor-pointer hover:text-[#B85338] transition-colors"
                    >
                      {featuredBook.title}
                    </h3>
                    <span className="font-editorial text-sm font-bold text-[#1C2321]">
                      {featuredBook.progress}%
                    </span>
                  </div>

                  {/* Slim Terracotta Progress Bar */}
                  <div className="w-full h-1.5 bg-[#E8DFD1] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#B85338] rounded-full transition-all duration-500"
                      style={{ width: `${featuredBook.progress}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-[#7A7268] font-medium pt-0.5">
                    <span>{featuredBook.chapter}</span>
                    <span>{featuredBook.timeLeft}</span>
                  </div>
                </div>

                {/* Action Button: Continue reading > */}
                <button
                  onClick={() => handleOpenBook(featuredBook)}
                  className="w-full py-3 rounded-2xl bg-[#B85338] hover:bg-[#A3452D] active:scale-[0.98] text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
                >
                  <span>Continue reading</span>
                  <ChevronRight size={15} />
                </button>
              </div>

              {/* Up Next Mini Shelf */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#7A7268] uppercase tracking-wider font-mono">
                    Next in library
                  </span>
                  <button
                    onClick={() => setActiveTab('library')}
                    className="text-xs font-bold text-[#B85338] hover:underline"
                  >
                    View all
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {allBooks.slice(1, 3).map((book, idx) => (
                    <div
                      key={book.id}
                      onClick={() => handleOpenBook(book)}
                      className="p-3 rounded-2xl bg-[#FAF7F2] border border-[#E8DFD1] hover:border-[#B85338]/40 transition-all cursor-pointer group space-y-2"
                    >
                      <div className="w-full aspect-[3/4] rounded-xl overflow-hidden shadow-2xs group-hover:scale-105 transition-transform">
                        <NoteCoverArtwork title={book.title} index={idx + 1} />
                      </div>
                      <div className="text-xs font-bold text-[#1C2321] font-editorial truncate">
                        {book.title}
                      </div>
                      <div className="text-[10px] text-[#7A7268] truncate">
                        {book.status === 'reading' ? `${book.progress}% done` : 'To Read'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* SCREEN 2: "Your library" (Shelf & Book List) */}
          {/* ======================================================== */}
          {activeTab === 'library' && (
            <div className="space-y-5 animate-fadeIn">
              {/* Heading */}
              <h2 className="text-2xl font-black text-[#1C2321] tracking-tight font-editorial">
                Your library
              </h2>

              {/* Category Filter Pills (Matches Image 2 Screen 2: All, Reading, To Read, Finished) */}
              <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar pb-1">
                {(['all', 'reading', 'to_read', 'finished'] as const).map(tabKey => {
                  const labelMap = {
                    all: 'All',
                    reading: 'Reading',
                    to_read: 'To Read',
                    finished: 'Finished',
                  };
                  const isActive = libraryFilter === tabKey;
                  return (
                    <button
                      key={tabKey}
                      onClick={() => setLibraryFilter(tabKey)}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                        isActive
                          ? 'bg-[#B85338] text-white shadow-xs'
                          : 'bg-[#F5EFEB] text-[#7A7268] hover:text-[#1C2321] hover:bg-[#EFE7DC]'
                      }`}
                    >
                      {labelMap[tabKey]}
                    </button>
                  );
                })}
              </div>

              {/* Subject Filter Row (when notes have subjects) */}
              {availableSubjects.length > 0 && (
                <div className="flex items-center gap-1.5 overflow-x-auto hide-scrollbar pb-1 text-[11px]">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-[#7A7268] font-bold mr-1 shrink-0">
                    Subject:
                  </span>
                  <button
                    onClick={() => setSelectedSubject('all')}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap transition-all cursor-pointer ${
                      selectedSubject === 'all'
                        ? 'bg-[#1C2321] text-white shadow-2xs'
                        : 'bg-[#F5EFEB] text-[#7A7268] hover:text-[#1C2321]'
                    }`}
                  >
                    All Subjects
                  </button>
                  {availableSubjects.map(sub => (
                    <button
                      key={sub}
                      onClick={() => setSelectedSubject(sub)}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap transition-all cursor-pointer ${
                        selectedSubject === sub
                          ? 'bg-[#1C2321] text-white shadow-2xs'
                          : 'bg-[#F5EFEB] text-[#7A7268] hover:text-[#1C2321]'
                      }`}
                    >
                      {sub}
                    </button>
                  ))}
                </div>
              )}

              {/* Books List Items (Clean stacked rows with thumbnail, serif title, status & chevron) */}
              <div className="space-y-2 divide-y divide-[#FAF5EE]">
                {filteredLibrary.map((book, idx) => (
                  <div
                    key={book.id}
                    onClick={() => handleOpenBook(book)}
                    className="pt-3 pb-2 flex items-center justify-between gap-3 group cursor-pointer hover:bg-[#FAF7F2] -mx-2 px-2 rounded-2xl transition-all"
                  >
                    {/* Thumbnail Cover Art */}
                    <div className="w-12 h-16 rounded-xl overflow-hidden shadow-2xs shrink-0 group-hover:scale-105 transition-transform">
                      <NoteCoverArtwork title={book.title} index={idx} />
                    </div>

                    {/* Book Info */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <h3 className="text-sm font-bold text-[#1C2321] font-editorial truncate group-hover:text-[#B85338] transition-colors">
                        {book.title}
                      </h3>
                      <div className="flex items-center gap-2 text-xs text-[#7A7268]">
                        <span className="truncate">
                          {book.status === 'reading'
                            ? `Reading · ${book.progress}%`
                            : book.status === 'finished'
                            ? 'Finished'
                            : 'To Read'}
                        </span>
                        {book.author && book.author !== 'Study Note' && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#FAF5EE] border border-[#E8DFD1] text-[#7A7268] shrink-0 font-medium truncate max-w-[100px]">
                            {book.author}
                          </span>
                        )}
                      </div>
                      {book.status === 'reading' && (
                        <div className="w-24 h-1 bg-[#E8DFD1] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#B85338] rounded-full"
                            style={{ width: `${book.progress}%` }}
                          />
                        </div>
                      )}
                    </div>

                    {/* Action Controls for User Notes */}
                    {book.rawNote ? (
                      <div
                        className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity shrink-0"
                        onClick={e => e.stopPropagation()}
                      >
                        {onTogglePin && (
                          <button
                            onClick={() => onTogglePin(book.rawNote!.id)}
                            className={`p-1.5 rounded-lg hover:bg-[#E8DFD1] transition-colors cursor-pointer ${
                              book.rawNote.is_pinned ? 'text-[#B85338]' : 'text-[#7A7268]'
                            }`}
                            title={book.rawNote.is_pinned ? 'Unpin' : 'Pin to top'}
                          >
                            <Pin size={13} className={book.rawNote.is_pinned ? 'fill-[#B85338]' : ''} />
                          </button>
                        )}
                        {onEditNote && (
                          <button
                            onClick={() => onEditNote(book.rawNote!)}
                            className="p-1.5 rounded-lg hover:bg-[#E8DFD1] text-[#7A7268] hover:text-[#1C2321] transition-colors cursor-pointer"
                            title="Edit Note"
                          >
                            <Edit3 size={13} />
                          </button>
                        )}
                        {onDownloadNote && (
                          <button
                            onClick={() => onDownloadNote(book.rawNote!)}
                            className="p-1.5 rounded-lg hover:bg-[#E8DFD1] text-[#7A7268] hover:text-[#1C2321] transition-colors cursor-pointer"
                            title="Download Note"
                          >
                            <Download size={13} />
                          </button>
                        )}
                        {onDeleteNote && (
                          <button
                            onClick={() => onDeleteNote(book.rawNote!)}
                            className="p-1.5 rounded-lg hover:bg-rose-100 text-[#7A7268] hover:text-rose-600 transition-colors cursor-pointer"
                            title="Delete Note"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                        <ChevronRight
                          size={15}
                          className="text-[#A39B8F] group-hover:text-[#B85338] group-hover:translate-x-0.5 transition-all ml-0.5"
                        />
                      </div>
                    ) : (
                      <ChevronRight
                        size={16}
                        className="text-[#A39B8F] group-hover:text-[#B85338] group-hover:translate-x-0.5 transition-all shrink-0"
                      />
                    )}
                  </div>
                ))}

                {filteredLibrary.length === 0 && (
                  <div className="py-12 text-center text-xs text-[#7A7268] space-y-2">
                    <BookOpen size={24} className="mx-auto text-[#A39B8F] opacity-60" />
                    <div>No books found in this section.</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* SCREEN 3: "Reading notes" (Quotes, Reflections, Highlights) */}
          {/* ======================================================== */}
          {activeTab === 'notes' && (
            <div className="space-y-5 animate-fadeIn">
              {/* Heading */}
              <h2 className="text-2xl font-black text-[#1C2321] tracking-tight font-editorial">
                Reading notes
              </h2>

              {/* Filter Pills: All, Highlights, Reflections, Quotes */}
              <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar pb-1">
                {(['all', 'highlights', 'reflections', 'quotes'] as const).map(tabKey => {
                  const labelMap = {
                    all: 'All',
                    highlights: 'Highlights',
                    reflections: 'Reflections',
                    quotes: 'Quotes',
                  };
                  const isActive = notesFilter === tabKey;
                  return (
                    <button
                      key={tabKey}
                      onClick={() => setNotesFilter(tabKey)}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                        isActive
                          ? 'bg-[#B85338] text-white shadow-xs'
                          : 'bg-[#F5EFEB] text-[#7A7268] hover:text-[#1C2321] hover:bg-[#EFE7DC]'
                      }`}
                    >
                      {labelMap[tabKey]}
                    </button>
                  );
                })}
              </div>

              {/* Reading Notes Cards Stream */}
              <div className="space-y-3.5">
                {/* 1. Signature Quote Card (Matches Screen 3 Top) */}
                {(notesFilter === 'all' || notesFilter === 'quotes') && (
                  <div className="p-4 rounded-2xl bg-[#FAF7F2] border border-[#E8DFD1] space-y-3 shadow-2xs">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-[#1C2321] font-editorial leading-relaxed italic">
                        “ There is a kind of freedom in not knowing what comes next. ”
                      </p>
                      <button
                        onClick={() => toggleBookmark('curated-quiet-sea')}
                        className="text-[#B85338] hover:scale-110 transition-transform cursor-pointer shrink-0 mt-0.5"
                        title="Bookmark quote"
                      >
                        {bookmarkedQuotes['curated-quiet-sea'] ? (
                          <BookmarkCheck size={16} className="fill-[#B85338]" />
                        ) : (
                          <Bookmark size={16} />
                        )}
                      </button>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-[#7A7268]">
                      <span>The Quiet Sea · Chapter 8</span>
                      <span>May 12</span>
                    </div>
                  </div>
                )}

                {/* 2. Reflection Card 1 (Matches Screen 3 Mid: "A slower kind of life") */}
                {(notesFilter === 'all' || notesFilter === 'reflections') && (
                  <div className="p-4 rounded-2xl bg-[#FAF7F2] border border-[#E8DFD1] space-y-2.5 shadow-2xs">
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 shadow-2xs">
                        <QuietSeaCover title="" subtitle="" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-bold text-[#1C2321] font-editorial">
                            A slower kind of life
                          </h3>
                          <button className="text-[#A39B8F] hover:text-[#1C2321] p-0.5">
                            <MoreHorizontal size={14} />
                          </button>
                        </div>
                        <p className="text-xs text-[#7A7268] leading-relaxed mt-1 font-serif line-clamp-2">
                          The sea isn't empty — it's full of possibilities. A reminder to find space, even in uncertainty.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-[#7A7268] pt-1 border-t border-[#E8DFD1]/40">
                      <span>The Quiet Sea · Chapter 11</span>
                      <span>May 9</span>
                    </div>
                  </div>
                )}

                {/* 3. Reflection Card 2 (Matches Screen 3 Bottom: "On wonder") */}
                {(notesFilter === 'all' || notesFilter === 'reflections' || notesFilter === 'highlights') && (
                  <div className="p-4 rounded-2xl bg-[#FAF7F2] border border-[#E8DFD1] space-y-2.5 shadow-2xs">
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 shadow-2xs bg-[#F4EFE6]">
                        <BrighterDayCover title="" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-bold text-[#1C2321] font-editorial">
                            On wonder
                          </h3>
                          <button className="text-[#A39B8F] hover:text-[#1C2321] p-0.5">
                            <MoreHorizontal size={14} />
                          </button>
                        </div>
                        <p className="text-xs text-[#7A7268] leading-relaxed mt-1 font-serif line-clamp-2">
                          Not everything needs an answer. Some things are meant to be felt, not solved.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-[#7A7268] pt-1 border-t border-[#E8DFD1]/40">
                      <span>The Quiet Sea · Chapter 6</span>
                      <span>May 4</span>
                    </div>
                  </div>
                )}

                {/* Dynamic user notes blockquotes if any */}
                {notes
                  .filter(n => n.content.includes('>'))
                  .slice(0, 3)
                  .map(userNote => {
                    const quoteLine = userNote.content.split('\n').find(l => l.startsWith('>'))?.replace(/^>\s*/, '') || '';
                    return (
                      <div
                        key={userNote.id}
                        onClick={() => onOpenNote(userNote)}
                        className="p-4 rounded-2xl bg-[#FAF7F2] border border-[#E8DFD1] space-y-2 shadow-2xs cursor-pointer hover:border-[#B85338]/40 transition-colors"
                      >
                        <p className="text-xs font-serif text-[#1C2321] italic leading-relaxed">
                          “ {quoteLine} ”
                        </p>
                        <div className="flex items-center justify-between text-[11px] text-[#7A7268] pt-1">
                          <span className="font-editorial font-bold">{userNote.title}</span>
                          <span className="text-[#B85338] font-semibold">Open Note &rarr;</span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* SCREEN 4: "More / Settings & Views" */}
          {/* ======================================================== */}
          {activeTab === 'more' && (
            <div className="space-y-5 animate-fadeIn">
              <h2 className="text-2xl font-black text-[#1C2321] tracking-tight font-editorial">
                Settings & Themes
              </h2>
              <div className="space-y-3">
                <div className="p-4 rounded-2xl bg-[#FAF7F2] border border-[#E8DFD1] space-y-2">
                  <div className="text-xs font-bold text-[#1C2321]">Editorial Chapter One Mode</div>
                  <p className="text-xs text-[#7A7268]">
                    You are currently enjoying the warm cream and terracotta Chapter One reading companion.
                  </p>
                </div>
                {onExitEditorial && (
                  <button
                    onClick={onExitEditorial}
                    className="w-full py-2.5 rounded-xl border border-[#E8DFD1] text-xs font-bold text-[#1C2321] hover:bg-[#F5EFEB] transition-all"
                  >
                    Switch back to Standard Grid View
                  </button>
                )}
              </div>
            </div>
          )}
        </main>

        {/* ======================================================== */}
        {/* BOTTOM NAVIGATION DOCK (Matches Bottom of All 3 Screens) */}
        {/* ======================================================== */}
        <nav className="border-t border-[#FAF5EE] bg-[#FFFFFF]/95 backdrop-blur-md px-6 py-2.5 flex items-center justify-around select-none">
          {[
            { id: 'home' as const, label: 'Home', icon: Home },
            { id: 'library' as const, label: 'Library', icon: BookOpen },
            { id: 'notes' as const, label: 'Notes', icon: Compass },
            { id: 'more' as const, label: 'More', icon: MoreHorizontal },
          ].map(tab => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all cursor-pointer ${
                  isActive ? 'text-[#B85338] font-bold' : 'text-[#A39B8F] hover:text-[#1C2321]'
                }`}
              >
                <Icon size={18} className={isActive ? 'text-[#B85338]' : 'text-[#A39B8F]'} />
                <span className="text-[10px] tracking-tight font-medium">{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
