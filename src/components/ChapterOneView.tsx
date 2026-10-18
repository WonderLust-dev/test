import React, { useState, useMemo } from 'react';
import { StudyNote } from '../types';
import { NoteCoverArtwork } from './ChapterOneArtworks';
import { formatMathText } from '../utils/mathFormatter';
import {
  Search,
  ChevronRight,
  BookOpen,
  Plus,
  X,
  Pin,
  Edit3,
  Download,
  Trash2,
  Clock,
  LayoutGrid,
  FileText,
  Sparkles,
} from 'lucide-react';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pinned' | 'quick' | 'deep'>('all');

  // Extract unique subjects from user's actual notes
  const availableSubjects = useMemo(() => {
    const subs = new Set<string>();
    notes.forEach(n => {
      if (n.subject && n.subject.trim()) {
        subs.add(n.subject.trim());
      }
    });
    return Array.from(subs);
  }, [notes]);

  // Transform user notes with computed reading stats & snippets (ZERO dummy data!)
  const userNotesWithMeta = useMemo(() => {
    return notes.map((n, idx) => {
      const words = n.content.trim().split(/\s+/).filter(Boolean).length;
      const mins = Math.max(1, Math.ceil(words / 200));
      const cleanSnippet = n.content
        .replace(/^#+.*$/gm, '')
        .replace(/[-*]\s+/g, '')
        .replace(/`{1,3}[^`]*`{1,3}/g, '')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .trim();

      const formula = n.content.split('\n').find(l => l.includes('\\(') || l.includes('$$') || l.includes('📐'))?.trim();
      const quote = n.content.split('\n').find(l => l.startsWith('>'))?.replace(/^>\s*/, '').trim();

      return {
        note: n,
        index: idx,
        words,
        readTimeMins: mins,
        snippet: cleanSnippet.slice(0, 130) + (cleanSnippet.length > 130 ? '...' : ''),
        formula,
        quote,
        updatedDate: new Date(n.updated_at || n.created_at || Date.now()).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        }),
      };
    });
  }, [notes]);

  // Featured Note for "Continue Reading" Hero (Pinned note, or most recently updated note)
  const featured = useMemo(() => {
    if (userNotesWithMeta.length === 0) return null;
    return userNotesWithMeta.find(item => item.note.is_pinned) || userNotesWithMeta[0];
  }, [userNotesWithMeta]);

  // Filtered Notes List
  const filteredNotes = useMemo(() => {
    return userNotesWithMeta.filter(({ note, readTimeMins }) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = note.title.toLowerCase().includes(q);
        const matchesSubject = note.subject && note.subject.toLowerCase().includes(q);
        const matchesContent = note.content.toLowerCase().includes(q);
        if (!matchesTitle && !matchesSubject && !matchesContent) return false;
      }

      if (selectedSubject !== 'all' && note.subject !== selectedSubject) {
        return false;
      }

      if (statusFilter === 'pinned' && !note.is_pinned) return false;
      if (statusFilter === 'quick' && readTimeMins > 5) return false;
      if (statusFilter === 'deep' && readTimeMins <= 5) return false;

      return true;
    });
  }, [userNotesWithMeta, searchQuery, selectedSubject, statusFilter]);

  // Real formulas extracted from actual user notes (if any)
  const extractedFormulas = useMemo(() => {
    const list: Array<{ formula: string; note: StudyNote }> = [];
    userNotesWithMeta.forEach(item => {
      if (item.formula && list.length < 3) {
        list.push({ formula: item.formula, note: item.note });
      }
    });
    return list;
  }, [userNotesWithMeta]);

  // Real quotes extracted from actual user notes (if any)
  const extractedQuotes = useMemo(() => {
    const list: Array<{ quote: string; note: StudyNote }> = [];
    userNotesWithMeta.forEach(item => {
      if (item.quote && list.length < 3) {
        list.push({ quote: item.quote, note: item.note });
      }
    });
    return list;
  }, [userNotesWithMeta]);

  return (
    <div className="w-full space-y-6 animate-fadeIn font-sans text-[#1C2321]">
      {/* ============================================================ */}
      {/* TOP EDITORIAL APP BAR (Full-width responsive, no fake phone) */}
      {/* ============================================================ */}
      <div className="p-4 sm:p-6 rounded-3xl bg-[#FAF7F2] border border-[#E8DFD1] shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Brand Logo & Subtitle */}
        <div className="space-y-1">
          <div className="flex items-center gap-2 select-none">
            <span className="font-mono tracking-[0.25em] text-xs uppercase font-extrabold text-[#1C2321]">
              CHAPTER
            </span>
            <span className="text-[#B85338] font-black text-sm">/</span>
            <span className="font-mono tracking-[0.25em] text-xs uppercase font-extrabold text-[#1C2321]">
              ONE
            </span>
            <span className="px-2 py-0.5 rounded-full bg-[#FFFFFF] border border-[#E8DFD1] text-[10px] font-mono font-bold text-[#7A7268] ml-1.5 shadow-2xs">
              {notes.length} Revision Note{notes.length !== 1 ? 's' : ''}
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-[#1C2321] tracking-tight font-serif">
            Curated Study & Revision Library
          </h2>
        </div>

        {/* Right Controls: Search, View Mode, New Note */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Quick Search Input */}
          <div className="relative min-w-[200px] sm:min-w-[260px] flex-1 sm:flex-initial">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#7A7268]" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search notes, formulas..."
              className="w-full pl-9 pr-8 py-2 rounded-full bg-[#FFFFFF] border border-[#E8DFD1] text-xs text-[#1C2321] placeholder-[#A39B8F] focus:outline-none focus:border-[#B85338] transition-colors shadow-2xs"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7A7268] hover:text-[#1C2321]"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* New Note Button (Terracotta) */}
          <button
            onClick={onNewNote}
            className="px-4 py-2 rounded-full bg-[#B85338] hover:bg-[#A3452D] text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer active:scale-95 shrink-0"
          >
            <Plus size={14} />
            <span>New Note</span>
          </button>

          {/* Exit / Switch to Standard Grid View */}
          {onExitEditorial && (
            <button
              onClick={onExitEditorial}
              className="px-3.5 py-2 rounded-full bg-[#FFFFFF] hover:bg-[#F5EFEB] border border-[#E8DFD1] text-xs font-bold text-[#7A7268] hover:text-[#1C2321] flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer shrink-0"
              title="Switch back to Standard Grid view"
            >
              <LayoutGrid size={13} />
              <span>Grid View</span>
            </button>
          )}
        </div>
      </div>

      {/* ============================================================ */}
      {/* EMPTY STATE (If user has zero notes) */}
      {/* ============================================================ */}
      {notes.length === 0 && (
        <div className="p-12 sm:p-16 rounded-3xl bg-[#FAF7F2] border border-[#E8DFD1] text-center space-y-4 max-w-2xl mx-auto shadow-2xs">
          <div className="w-16 h-16 rounded-full bg-[#FFFFFF] border border-[#E8DFD1] flex items-center justify-center mx-auto text-[#B85338] shadow-xs">
            <BookOpen size={28} />
          </div>
          <div className="space-y-1">
            <h3 className="text-xl font-black text-[#1C2321] font-serif">
              Your revision library is waiting to begin
            </h3>
            <p className="text-xs sm:text-sm text-[#7A7268] max-w-md mx-auto leading-relaxed">
              Create your first revision note or upload <code className="px-1.5 py-0.5 bg-[#FFFFFF] rounded border border-[#E8DFD1] font-mono font-bold text-[#B85338]">.md</code> / <code className="px-1.5 py-0.5 bg-[#FFFFFF] rounded border border-[#E8DFD1] font-mono font-bold text-[#B85338]">.txt</code> notes to enjoy distraction-free reading.
            </p>
          </div>
          <button
            onClick={onNewNote}
            className="px-5 py-2.5 rounded-full bg-[#B85338] hover:bg-[#A3452D] text-white text-xs font-bold inline-flex items-center gap-2 shadow-xs transition-all cursor-pointer active:scale-95"
          >
            <Plus size={15} />
            <span>Create Your First Note</span>
          </button>
        </div>
      )}

      {/* ============================================================ */}
      {/* FEATURED NOTE HERO BANNER ("Continue Reading" - Real Note!) */}
      {/* ============================================================ */}
      {featured && (
        <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-[#FAF7F2] via-[#FFFFFF] to-[#F5EFEB] border border-[#E8DFD1] shadow-xs">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
            {/* Left: Book Cover Artwork for the Real Note */}
            <div className="md:col-span-3 lg:col-span-3 flex justify-center md:justify-start">
              <div
                onClick={() => onOpenNote(featured.note)}
                className="w-40 sm:w-48 aspect-[3/4] rounded-2xl overflow-hidden shadow-md border border-[#E8DFD1] cursor-pointer hover:scale-102 transition-transform duration-300"
              >
                <NoteCoverArtwork title={featured.note.title} index={featured.index} />
              </div>
            </div>

            {/* Right: Real Note Details */}
            <div className="md:col-span-9 lg:col-span-9 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-[10px] uppercase tracking-[0.25em] font-extrabold text-[#B85338]">
                  {featured.note.is_pinned ? '★ PINNED CHAPTER' : 'RECENT CHAPTER'}
                </span>
                <span className="text-[#E8DFD1]">•</span>
                <span className="px-2.5 py-0.5 rounded-full bg-[#FFFFFF] border border-[#E8DFD1] text-[11px] font-bold text-[#7A7268]">
                  {featured.note.subject || 'General Studies'}
                </span>
                <span className="text-xs text-[#7A7268] flex items-center gap-1">
                  <Clock size={12} />
                  <span>{featured.readTimeMins} min read · {featured.words} words</span>
                </span>
              </div>

              {/* Real Note Title */}
              <h3
                onClick={() => onOpenNote(featured.note)}
                className="text-2xl sm:text-3xl font-black text-[#1C2321] font-serif leading-tight cursor-pointer hover:text-[#B85338] transition-colors"
              >
                {featured.note.title}
              </h3>

              {/* Real Excerpt Snippet or Formula */}
              {featured.formula ? (
                <div className="p-3 rounded-2xl bg-[#FAF7F2] border border-[#E8DFD1] text-xs font-mono text-[#1C2321] max-w-xl">
                  {formatMathText(featured.formula)}
                </div>
              ) : (
                <p className="text-xs sm:text-sm text-[#7A7268] font-serif leading-relaxed max-w-2xl">
                  {featured.snippet}
                </p>
              )}

              {/* Action Buttons */}
              <div className="pt-2 flex flex-wrap items-center gap-3">
                <button
                  onClick={() => onOpenNote(featured.note)}
                  className="px-5 py-2.5 rounded-full bg-[#B85338] hover:bg-[#A3452D] text-white text-xs font-bold shadow-xs flex items-center gap-2 transition-all cursor-pointer active:scale-95"
                >
                  <span>Continue reading</span>
                  <ChevronRight size={14} />
                </button>

                {onEditNote && (
                  <button
                    onClick={() => onEditNote(featured.note)}
                    className="px-4 py-2.5 rounded-full bg-[#FFFFFF] hover:bg-[#F5EFEB] border border-[#E8DFD1] text-xs font-bold text-[#1C2321] flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Edit3 size={13} />
                    <span>Edit Note</span>
                  </button>
                )}

                {onTogglePin && (
                  <button
                    onClick={() => onTogglePin(featured.note.id)}
                    className={`p-2.5 rounded-full border transition-all cursor-pointer ${
                      featured.note.is_pinned
                        ? 'bg-[#B85338]/10 border-[#B85338]/30 text-[#B85338]'
                        : 'bg-[#FFFFFF] border-[#E8DFD1] text-[#7A7268] hover:text-[#1C2321]'
                    }`}
                    title={featured.note.is_pinned ? 'Unpin' : 'Pin to top'}
                  >
                    <Pin size={14} className={featured.note.is_pinned ? 'fill-[#B85338]' : ''} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* FILTER BAR: Status Pills & Real Subject Pills */}
      {/* ============================================================ */}
      {notes.length > 0 && (
        <div className="space-y-3">
          {/* Status Tabs: All, Pinned, Quick Reads, Deep Revision */}
          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: 'all' as const, label: `All Notes (${notes.length})` },
              { id: 'pinned' as const, label: `Pinned (${notes.filter(n => n.is_pinned).length})` },
              { id: 'quick' as const, label: 'Quick Reads (≤ 5 min)' },
              { id: 'deep' as const, label: 'Deep Studies (> 5 min)' },
            ].map(tab => {
              const isActive = statusFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setStatusFilter(tab.id)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#B85338] text-white shadow-xs'
                      : 'bg-[#FAF7F2] border border-[#E8DFD1] text-[#7A7268] hover:text-[#1C2321] hover:bg-[#F5EFEB]'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Real Subject Pills (e.g. Quantitative Aptitude, General Awareness) */}
          {availableSubjects.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto hide-scrollbar pb-1 text-xs">
              <span className="font-mono text-[10px] uppercase tracking-wider text-[#7A7268] font-bold mr-1 shrink-0">
                Subject:
              </span>
              <button
                onClick={() => setSelectedSubject('all')}
                className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  selectedSubject === 'all'
                    ? 'bg-[#1C2321] text-white shadow-2xs'
                    : 'bg-[#FFFFFF] border border-[#E8DFD1] text-[#7A7268] hover:text-[#1C2321]'
                }`}
              >
                All Subjects
              </button>
              {availableSubjects.map(sub => (
                <button
                  key={sub}
                  onClick={() => setSelectedSubject(sub)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    selectedSubject === sub
                      ? 'bg-[#1C2321] text-white shadow-2xs'
                      : 'bg-[#FFFFFF] border border-[#E8DFD1] text-[#7A7268] hover:text-[#1C2321]'
                  }`}
                >
                  {sub}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* REAL USER NOTES LIBRARY GRID */}
      {/* ============================================================ */}
      {notes.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-black text-[#1C2321] font-serif tracking-tight">
              Your Library Shelf
            </h3>
            <span className="text-xs text-[#7A7268] font-mono">
              Showing {filteredNotes.length} of {notes.length}
            </span>
          </div>

          {filteredNotes.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {filteredNotes.map(({ note, index, words, readTimeMins, snippet, updatedDate }) => (
                <div
                  key={note.id}
                  onClick={() => onOpenNote(note)}
                  className="rounded-3xl bg-[#FFFFFF] border border-[#E8DFD1] hover:border-[#B85338]/40 shadow-2xs hover:shadow-md transition-all duration-300 flex flex-col overflow-hidden group cursor-pointer"
                >
                  {/* Book Cover Artwork with Aspect Ratio */}
                  <div className="w-full aspect-[16/10] overflow-hidden bg-[#FAF7F2] border-b border-[#E8DFD1] relative">
                    <NoteCoverArtwork title={note.title} index={index} className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-500" />
                    {note.is_pinned && (
                      <span className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full bg-[#B85338] text-white font-mono text-[9px] font-bold uppercase tracking-wider shadow-xs">
                        ★ Pinned
                      </span>
                    )}
                  </div>

                  {/* Card Content */}
                  <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                    <div className="space-y-1.5">
                      {/* Subject & Read Time Meta */}
                      <div className="flex items-center justify-between text-[11px] text-[#7A7268]">
                        <span className="font-bold text-[#B85338] truncate max-w-[130px]">
                          {note.subject || 'General'}
                        </span>
                        <span className="font-mono text-[10px]">
                          {readTimeMins}m read · {words}w
                        </span>
                      </div>

                      {/* Title */}
                      <h4 className="text-base font-bold text-[#1C2321] font-serif leading-snug line-clamp-2 group-hover:text-[#B85338] transition-colors">
                        {note.title}
                      </h4>

                      {/* Excerpt Snippet */}
                      <p className="text-xs text-[#7A7268] font-serif leading-relaxed line-clamp-2">
                        {snippet}
                      </p>
                    </div>

                    {/* Bottom Action Toolbar */}
                    <div
                      className="pt-2 border-t border-[#FAF5EE] flex items-center justify-between"
                      onClick={e => e.stopPropagation()}
                    >
                      <span className="text-[10px] text-[#A39B8F] font-mono">
                        {updatedDate}
                      </span>

                      <div className="flex items-center gap-1">
                        {onTogglePin && (
                          <button
                            onClick={() => onTogglePin(note.id)}
                            className={`p-1.5 rounded-lg hover:bg-[#FAF7F2] transition-colors ${
                              note.is_pinned ? 'text-[#B85338]' : 'text-[#A39B8F] hover:text-[#1C2321]'
                            }`}
                            title={note.is_pinned ? 'Unpin Note' : 'Pin Note'}
                          >
                            <Pin size={13} className={note.is_pinned ? 'fill-[#B85338]' : ''} />
                          </button>
                        )}
                        {onEditNote && (
                          <button
                            onClick={() => onEditNote(note)}
                            className="p-1.5 rounded-lg hover:bg-[#FAF7F2] text-[#A39B8F] hover:text-[#1C2321] transition-colors"
                            title="Edit Note"
                          >
                            <Edit3 size={13} />
                          </button>
                        )}
                        {onDownloadNote && (
                          <button
                            onClick={() => onDownloadNote(note)}
                            className="p-1.5 rounded-lg hover:bg-[#FAF7F2] text-[#A39B8F] hover:text-[#1C2321] transition-colors"
                            title="Download Note"
                          >
                            <Download size={13} />
                          </button>
                        )}
                        {onDeleteNote && (
                          <button
                            onClick={() => onDeleteNote(note)}
                            className="p-1.5 rounded-lg hover:bg-rose-50 text-[#A39B8F] hover:text-rose-600 transition-colors"
                            title="Delete Note"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 rounded-3xl bg-[#FAF7F2] border border-[#E8DFD1] text-center space-y-2">
              <FileText size={24} className="mx-auto text-[#A39B8F]" />
              <p className="text-xs text-[#7A7268] font-medium">
                No notes match your active filter or search query.
              </p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedSubject('all');
                  setStatusFilter('all');
                }}
                className="text-xs font-bold text-[#B85338] hover:underline"
              >
                Clear all filters
              </button>
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* REAL REVISION FORMULAS & QUOTES (Only if found in user notes) */}
      {/* ============================================================ */}
      {(extractedFormulas.length > 0 || extractedQuotes.length > 0) && (
        <div className="pt-4 border-t border-[#E8DFD1] space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-[#B85338]" />
            <h3 className="text-base font-black text-[#1C2321] font-serif">
              Revision Formulas & Key Takeaways
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {extractedFormulas.map(({ formula, note }, idx) => (
              <div
                key={idx}
                onClick={() => onOpenNote(note)}
                className="p-4 rounded-2xl bg-[#FFFFFF] border border-[#E8DFD1] hover:border-[#B85338]/40 shadow-2xs space-y-2 cursor-pointer transition-all"
              >
                <div className="text-xs font-mono text-[#1C2321]">
                  {formatMathText(formula)}
                </div>
                <div className="flex items-center justify-between text-[11px] text-[#7A7268] pt-1 border-t border-[#FAF5EE]">
                  <span className="font-bold text-[#1C2321] truncate max-w-[200px]">{note.title}</span>
                  <span className="text-[#B85338] font-semibold flex items-center gap-1">
                    Open Note <ChevronRight size={12} />
                  </span>
                </div>
              </div>
            ))}

            {extractedQuotes.map(({ quote, note }, idx) => (
              <div
                key={idx}
                onClick={() => onOpenNote(note)}
                className="p-4 rounded-2xl bg-[#FFFFFF] border border-[#E8DFD1] hover:border-[#B85338]/40 shadow-2xs space-y-2 cursor-pointer transition-all"
              >
                <p className="text-xs font-serif italic text-[#1C2321] leading-relaxed">
                  “ {quote} ”
                </p>
                <div className="flex items-center justify-between text-[11px] text-[#7A7268] pt-1 border-t border-[#FAF5EE]">
                  <span className="font-bold text-[#1C2321] truncate max-w-[200px]">{note.title}</span>
                  <span className="text-[#B85338] font-semibold flex items-center gap-1">
                    Open Note <ChevronRight size={12} />
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
