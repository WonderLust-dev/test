import React, { useState, useEffect, useMemo, useRef } from 'react';
import { StudyNote } from '../types';
import MarkdownViewer, { extractHeadings, slugify } from './MarkdownViewer';
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  BookmarkCheck,
  BookOpen,
  Volume2,
  VolumeX,
  Play,
  Pause,
  RotateCcw,
  Sun,
  Moon,
  AlignLeft,
  Maximize2,
  Minimize2,
  Copy,
  Check,
  Download,
  Edit3,
  List,
  X,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Sliders,
  Type,
  Share2,
} from 'lucide-react';

export type ReaderPaperTheme = 'paper' | 'cream' | 'slate' | 'midnight';
export type ReaderFontFamily = 'serif' | 'sans' | 'mono';
export type ReaderFontSize = 'sm' | 'base' | 'lg' | 'xl';
export type ReaderWidth = 'book' | 'comfortable' | 'wide';

interface EReaderViewProps {
  note: StudyNote;
  readNumber?: number;
  totalNotesCount?: number;
  onBack: () => void;
  onTogglePin?: (id: string) => void;
  onEditNote?: (note: StudyNote) => void;
  onNextNote?: () => void;
  onPrevNote?: () => void;
  onToggleTask?: (taskIndex: number, newChecked: boolean) => void;
}

// ============================================================
// Signature E-Reader Geometric Art Motif (Matches Image 2)
// ============================================================
export function ReaderGeometricMotif({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 160 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`select-none pointer-events-none ${className}`}
      aria-hidden="true"
    >
      <defs>
        <pattern id="hatch-pattern" width="6" height="6" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
          <line x1="0" y1="0" x2="0" y2="6" stroke="currentColor" strokeWidth="1.5" className="text-[#E0564C]/35" />
        </pattern>
      </defs>
      {/* Background Coral Solid Circle */}
      <circle cx="110" cy="50" r="46" fill="#E0564C" className="opacity-90" />
      {/* Concentric Arc Lines */}
      <circle cx="110" cy="50" r="58" stroke="currentColor" strokeWidth="1.2" className="text-[#E0564C]/40" />
      <circle cx="110" cy="50" r="70" stroke="currentColor" strokeWidth="1" strokeDasharray="3 3" className="text-[#E0564C]/30" />
      {/* Hatch-textured Accent Circle */}
      <circle cx="60" cy="100" r="38" fill="url(#hatch-pattern)" stroke="#E0564C" strokeWidth="1" strokeOpacity="0.4" />
      {/* Decorative center pill */}
      <line x1="20" y1="80" x2="60" y2="80" stroke="currentColor" strokeWidth="1.5" className="text-[#E0564C]/60" />
    </svg>
  );
}

export default function EReaderView({
  note,
  readNumber = 1,
  totalNotesCount = 1,
  onBack,
  onTogglePin,
  onEditNote,
  onNextNote,
  onPrevNote,
  onToggleTask,
}: EReaderViewProps) {
  // Mode: 'cover' (editorial book cover) or 'read' (immersive reader)
  const [mode, setMode] = useState<'cover' | 'read'>('read');

  // Reader Settings with intelligent default and localStorage persistence
  const [paperTheme, setPaperTheme] = useState<ReaderPaperTheme>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sscp_ereader_theme') as ReaderPaperTheme | null;
      if (saved && (saved === 'paper' || saved === 'cream' || saved === 'slate' || saved === 'midnight')) {
        return saved;
      }
      const isDark =
        document.documentElement.getAttribute('data-theme') === 'dark' ||
        document.documentElement.getAttribute('data-theme') === 'high-contrast' ||
        document.documentElement.classList.contains('dark');
      return isDark ? 'slate' : 'paper';
    }
    return 'paper';
  });

  const handlePaperThemeChange = (newTheme: ReaderPaperTheme) => {
    setPaperTheme(newTheme);
    try {
      localStorage.setItem('sscp_ereader_theme', newTheme);
    } catch {}
  };

  const [fontFamily, setFontFamily] = useState<ReaderFontFamily>(note.font_style || 'serif');
  const [fontSize, setFontSize] = useState<ReaderFontSize>('base');
  const [readerWidth, setReaderWidth] = useState<ReaderWidth>('comfortable');
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [showTypographyMenu, setShowTypographyMenu] = useState(false);
  const [showToc, setShowToc] = useState(false);
  const [copied, setCopied] = useState(false);

  // Audio / Speech Synthesis State (Image 2 Audio Feature)
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [speechRate, setSpeechRate] = useState<number>(1);
  const [speechSupported, setSpeechSupported] = useState(false);

  // Scroll Progress
  const [scrollProgress, setScrollProgress] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Table of Contents Headings
  const headings = useMemo(() => {
    return extractHeadings(note.content);
  }, [note.content]);

  // Estimated Read Time & Word Count
  const stats = useMemo(() => {
    const words = note.content.trim().split(/\s+/).filter(Boolean).length;
    const mins = Math.max(1, Math.ceil(words / 200));
    return { words, mins };
  }, [note.content]);

  // Check speech synthesis support
  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      setSpeechSupported(true);
    }
  }, []);

  // Stop speech when component unmounts
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Lock body scroll when E-reader is active
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  // Handle Scroll Progress
  const handleScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const total = el.scrollHeight - el.clientHeight;
    if (total <= 0) {
      setScrollProgress(100);
      return;
    }
    const current = (el.scrollTop / total) * 100;
    setScrollProgress(Math.min(100, Math.max(0, Math.round(current))));
  };

  // Toggle Read Aloud (Web Speech API)
  const toggleSpeech = () => {
    if (!speechSupported || typeof window === 'undefined') return;

    if (isPlayingAudio) {
      window.speechSynthesis.cancel();
      setIsPlayingAudio(false);
      return;
    }

    window.speechSynthesis.cancel();
    // Clean text for speech
    const cleanText = note.content
      .replace(/^[#\s\-*`>]+/gm, '')
      .replace(/\$\$.*?\$\$/gs, 'Formula omitted')
      .replace(/\|.*?\|/g, '')
      .replace(/```.*?```/gs, 'Code block omitted')
      .slice(0, 8000); // comfortable chunk

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = speechRate;
    utterance.pitch = 1.0;

    // Pick best available voice if possible
    const voices = window.speechSynthesis.getVoices();
    const englishVoice = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha')));
    if (englishVoice) utterance.voice = englishVoice;

    utterance.onend = () => setIsPlayingAudio(false);
    utterance.onerror = () => setIsPlayingAudio(false);

    window.speechSynthesis.speak(utterance);
    setIsPlayingAudio(true);
  };

  // Copy Note Text
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(note.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  // Download Note
  const handleDownload = () => {
    const ext = note.file_type || 'md';
    const blob = new Blob([note.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${note.title.replace(/[^\w\s-]/g, '').trim()}.${ext}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Format read number with 2 digits (e.g. 07, 23)
  const formattedReadNr = String(readNumber).padStart(2, '0');

  // Reader Width Max Class
  const widthClasses = {
    book: 'max-w-2xl', // ~672px
    comfortable: 'max-w-3xl', // ~768px
    wide: 'max-w-5xl', // ~1024px
  }[readerWidth];

  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col transition-colors duration-200 overflow-hidden font-sans reader-theme-${paperTheme}`}
      style={{
        backgroundColor: 'var(--reader-bg)',
        color: 'var(--reader-text)',
      }}
    >
      {/* ============================================================ */}
      {/* 1. TOP HEADER (Matches Image 2: "E.reader", Back, Read nr, Bookmark) */}
      {/* ============================================================ */}
      <header className="shrink-0 z-30 px-3 sm:px-6 py-2.5 sm:py-3 border-b flex items-center justify-between gap-2 border-[var(--reader-border,#DFD7CF)] bg-inherit/90 backdrop-blur-md">
        {/* Left: Back & Brand */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            onClick={onBack}
            className="p-1.5 sm:p-2 rounded-xl border border-[var(--reader-border,#DFD7CF)] hover:bg-black/5 dark:hover:bg-white/5 transition-all text-inherit cursor-pointer active:scale-95"
            title="Return to Notes Library"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="flex items-baseline gap-1.5 select-none">
            <span className="font-extrabold tracking-tight text-xs sm:text-sm uppercase font-mono">
              E.reader
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-[#E0564C]" />
          </div>
        </div>

        {/* Center: Read Number & Title preview */}
        <div className="flex items-center gap-2 min-w-0 truncate text-center">
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold border border-[#E0564C]/30 bg-[#E0564C]/15 text-[#E0564C] shrink-0">
            Read nr. {formattedReadNr}
          </span>
          <span className="hidden md:inline text-xs font-bold truncate opacity-80 max-w-xs">
            {note.title}
          </span>
        </div>

        {/* Right: Floating Controls Pill (Read Aloud 🎙️, Paper Theme 🌓, Typography Aa ▾) */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {/* Read Aloud Button (Image 2 Audio Feature) */}
          {speechSupported && (
            <button
              onClick={toggleSpeech}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                isPlayingAudio
                  ? 'bg-[#E0564C] text-white border-[#E0564C] shadow-sm animate-pulse'
                  : 'border-[var(--reader-border,#DFD7CF)] hover:bg-black/5 dark:hover:bg-white/5 opacity-80 hover:opacity-100'
              }`}
              title={isPlayingAudio ? 'Pause Voice Reading' : 'Listen with Audio (Read Aloud)'}
            >
              {isPlayingAudio ? <Pause size={13} /> : <Volume2 size={13} />}
              <span className="hidden sm:inline">{isPlayingAudio ? 'Listening...' : 'Listen'}</span>
            </button>
          )}

          {/* Theme Quick Switcher Pill */}
          <div className="flex items-center p-0.5 rounded-xl border border-[var(--reader-border,#DFD7CF)] bg-black/5 dark:bg-white/5 text-xs">
            <button
              onClick={() => handlePaperThemeChange('paper')}
              className={`p-1.5 rounded-lg transition-all ${paperTheme === 'paper' ? 'bg-[#F5EFEB] text-[#2C2623] shadow-xs ring-1 ring-[#DFD7CF]' : 'opacity-60 hover:opacity-100'}`}
              title="Warm Paper Theme (Image 2 Aesthetic)"
            >
              📜
            </button>
            <button
              onClick={() => handlePaperThemeChange('cream')}
              className={`p-1.5 rounded-lg transition-all ${paperTheme === 'cream' ? 'bg-[#FAF8F5] text-[#1C1E21] shadow-xs ring-1 ring-[#E8E0D5]' : 'opacity-60 hover:opacity-100'}`}
              title="Editorial Cream Theme"
            >
              🥛
            </button>
            <button
              onClick={() => handlePaperThemeChange('slate')}
              className={`p-1.5 rounded-lg transition-all ${paperTheme === 'slate' ? 'bg-[#21262D] text-[#E6EDF3] shadow-xs ring-1 ring-[#30363D]' : 'opacity-60 hover:opacity-100'}`}
              title="Dark Slate Theme (Image 2 Bottom Panels)"
            >
              🌑
            </button>
            <button
              onClick={() => handlePaperThemeChange('midnight')}
              className={`p-1.5 rounded-lg transition-all ${paperTheme === 'midnight' ? 'bg-[#0D1117] text-[#C9D1D9] shadow-xs ring-1 ring-[#21262D]' : 'opacity-60 hover:opacity-100'}`}
              title="Midnight OLED Theme"
            >
              🖤
            </button>
          </div>

          {/* Typography Settings (Aa ▾) */}
          <div className="relative">
            <button
              onClick={() => setShowTypographyMenu(!showTypographyMenu)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                showTypographyMenu
                  ? 'bg-black/10 dark:bg-white/10 border-indigo-500'
                  : 'border-[var(--reader-border,#DFD7CF)] hover:bg-black/5 dark:hover:bg-white/5'
              }`}
              title="Typography & Reading Layout Settings"
            >
              <Type size={13} />
              <span>Aa</span>
            </button>

            {/* Typography Popover */}
            {showTypographyMenu && (
              <div className="absolute right-0 top-full mt-2 w-72 p-4 rounded-2xl border shadow-2xl z-50 animate-fadeIn backdrop-blur-xl border-[var(--reader-border,#DFD7CF)] bg-[var(--reader-surface,#FAF7F2)] text-[var(--reader-text,#2C2623)]">
                <div className="flex items-center justify-between pb-2 mb-3 border-b border-[var(--reader-border,#DFD7CF)]">
                  <span className="text-xs font-black uppercase tracking-wider opacity-70">
                    Reading Typography
                  </span>
                  <button
                    onClick={() => setShowTypographyMenu(false)}
                    className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5"
                  >
                    <X size={13} />
                  </button>
                </div>

                {/* Font Family Selector */}
                <div className="space-y-1.5 mb-3.5">
                  <label className="text-[11px] font-bold opacity-70">Typeface</label>
                  <div className="grid grid-cols-3 gap-1">
                    {(['serif', 'sans', 'mono'] as const).map(style => (
                      <button
                        key={style}
                        onClick={() => setFontFamily(style)}
                        className={`py-1.5 px-2 rounded-xl text-xs font-bold capitalize border transition-all ${
                          fontFamily === style
                            ? 'bg-[#E0564C] text-white border-[#E0564C] shadow-xs'
                            : 'border-[var(--reader-border,#DFD7CF)] hover:bg-black/5 dark:hover:bg-white/5'
                        }`}
                      >
                        {style}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Font Size Selector */}
                <div className="space-y-1.5 mb-3.5">
                  <label className="text-[11px] font-bold opacity-70">Font Size</label>
                  <div className="grid grid-cols-4 gap-1">
                    {(['sm', 'base', 'lg', 'xl'] as const).map(sz => (
                      <button
                        key={sz}
                        onClick={() => setFontSize(sz)}
                        className={`py-1 rounded-xl text-xs font-bold uppercase border transition-all ${
                          fontSize === sz
                            ? 'bg-[#E0564C] text-white border-[#E0564C] shadow-xs'
                            : 'border-[var(--reader-border,#DFD7CF)] hover:bg-black/5 dark:hover:bg-white/5'
                        }`}
                      >
                        {sz}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Reading Column Width */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold opacity-70">Page Width</label>
                  <div className="grid grid-cols-3 gap-1">
                    {[
                      { id: 'book' as const, label: 'Book' },
                      { id: 'comfortable' as const, label: 'Standard' },
                      { id: 'wide' as const, label: 'Full' },
                    ].map(w => (
                      <button
                        key={w.id}
                        onClick={() => setReaderWidth(w.id)}
                        className={`py-1 px-2 rounded-xl text-xs font-bold border transition-all ${
                          readerWidth === w.id
                            ? 'bg-[#E0564C] text-white border-[#E0564C] shadow-xs'
                            : 'border-[var(--reader-border,#DFD7CF)] hover:bg-black/5 dark:hover:bg-white/5'
                        }`}
                      >
                        {w.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Table of Contents Drawer Toggle */}
          {headings.length > 0 && (
            <button
              onClick={() => setShowToc(!showToc)}
              className={`p-2 rounded-xl border transition-all cursor-pointer ${
                showToc
                  ? 'bg-[#E0564C] text-white border-[#E0564C]'
                  : 'border-[var(--reader-border,#DFD7CF)] hover:bg-black/5 dark:hover:bg-white/5 opacity-80 hover:opacity-100'
              }`}
              title="Table of Contents / Chapters"
            >
              <List size={14} />
            </button>
          )}

          {/* Bookmark Button */}
          {onTogglePin && (
            <button
              onClick={() => onTogglePin(note.id)}
              className={`p-2 rounded-xl border transition-all cursor-pointer ${
                note.is_pinned
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-500'
                  : 'border-[var(--reader-border,#DFD7CF)] hover:bg-black/5 dark:hover:bg-white/5 opacity-80 hover:opacity-100'
              }`}
              title={note.is_pinned ? 'Bookmarked' : 'Add to Bookmarks'}
            >
              {note.is_pinned ? <BookmarkCheck size={14} className="fill-amber-500" /> : <Bookmark size={14} />}
            </button>
          )}

          {/* Copy Full Text */}
          <button
            onClick={handleCopy}
            className="p-2 rounded-xl border border-[var(--reader-border,#DFD7CF)] hover:bg-black/5 dark:hover:bg-white/5 transition-all opacity-80 hover:opacity-100 cursor-pointer"
            title="Copy Note Text"
          >
            {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
          </button>

          {/* Download */}
          <button
            onClick={handleDownload}
            className="hidden sm:block p-2 rounded-xl border border-[var(--reader-border,#DFD7CF)] hover:bg-black/5 dark:hover:bg-white/5 transition-all opacity-80 hover:opacity-100 cursor-pointer"
            title="Download Note File"
          >
            <Download size={14} />
          </button>

          {/* Edit Note */}
          {onEditNote && (
            <button
              onClick={() => onEditNote(note)}
              className="p-2 rounded-xl border border-[var(--reader-border,#DFD7CF)] hover:bg-black/5 dark:hover:bg-white/5 transition-all opacity-80 hover:opacity-100 cursor-pointer"
              title="Edit Note"
            >
              <Edit3 size={14} />
            </button>
          )}
        </div>
      </header>

      {/* Reading Progress Line */}
      <div className="w-full h-1 bg-black/5 dark:bg-white/5 shrink-0">
        <div
          className="h-full bg-[#E0564C] transition-all duration-150"
          style={{ width: `${scrollProgress}%` }}
        />
      </div>

      {/* ============================================================ */}
      {/* 2. MAIN READING CONTAINER (WITH OPTIONAL TOC DRAWER) */}
      {/* ============================================================ */}
      <div className="flex-1 min-h-0 flex overflow-hidden relative">
        {/* Table of Contents Drawer */}
        {showToc && headings.length > 0 && (
          <aside className="w-72 sm:w-80 shrink-0 border-r border-[var(--reader-border,#DFD7CF)] p-4 sm:p-5 overflow-y-auto custom-scrollbar bg-black/3 dark:bg-white/3 z-20 animate-fadeIn">
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-[var(--reader-border,#DFD7CF)]">
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider font-mono">Table of Contents</h4>
                <p className="text-[11px] opacity-60">{headings.length} chapters & sections</p>
              </div>
              <button
                onClick={() => setShowToc(false)}
                className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5"
              >
                <X size={14} />
              </button>
            </div>
            <nav className="space-y-1">
              {headings.map(h => (
                <a
                  key={h.id}
                  href={`#${h.id}`}
                  onClick={e => {
                    e.preventDefault();
                    setShowToc(false);
                    const el = document.getElementById(h.id);
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                  style={{ paddingLeft: `${Math.max(6, (h.level - 1) * 12 + 6)}px` }}
                  className="block text-xs py-1.5 px-2 rounded-xl text-inherit/80 hover:text-inherit hover:bg-black/5 dark:hover:bg-white/5 truncate font-medium transition-colors"
                >
                  {h.text}
                </a>
              ))}
            </nav>
          </aside>
        )}

        {/* Scrollable Book Reading Body */}
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain px-4 sm:px-8 py-6 sm:py-10 custom-scrollbar selection:bg-[#E0564C]/25"
        >
          <div className={`mx-auto ${widthClasses} space-y-6 transition-all duration-200`}>
            {/* ============================================================ */}
            {/* Editorial Book Title Header (Matches Image 2) */}
            {/* ============================================================ */}
            <div className="relative pt-2 pb-6 border-b border-[var(--reader-border,#DFD7CF)] mb-6">
              {/* Decorative Geometric Art in Top Right */}
              <div className="absolute right-0 top-0 w-28 sm:w-36 h-28 sm:h-36 opacity-70">
                <ReaderGeometricMotif className="w-full h-full" />
              </div>

              {/* Subject & Category Pills */}
              <div className="flex flex-wrap items-center gap-2 mb-3 relative z-10">
                <span className="px-3 py-1 rounded-full text-xs font-bold border border-[#E0564C]/30 bg-[#E0564C]/15 text-[#E0564C]">
                  {note.subject || 'SSC CGL Revision'}
                </span>
                {note.topic && (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold border border-[var(--reader-border,#DFD7CF)] opacity-70">
                    {note.topic}
                  </span>
                )}
                <span className="text-[11px] font-mono opacity-60">
                  ⏱️ {stats.mins} min read • {stats.words} words
                </span>
              </div>

              {/* Big Editorial Title */}
              <h1 className="text-2xl sm:text-4xl font-black tracking-tight leading-tight mb-2 relative z-10">
                {note.title}
              </h1>

              {/* Subtitle / Excerpt */}
              <p className="text-xs sm:text-sm opacity-70 font-medium leading-relaxed max-w-xl relative z-10">
                SSC Examination High-Yield Notes & Speed Revision Guide. Formatted for distraction-free comprehension.
              </p>
            </div>

            {/* ============================================================ */}
            {/* Formatted Book Content */}
            {/* ============================================================ */}
            <MarkdownViewer
              content={note.content}
              fileType={note.file_type}
              fontSize={fontSize}
              fontStyle={fontFamily}
              onToggleTask={onToggleTask}
            />

            {/* End of Note Editorial Badge */}
            <div className="pt-10 pb-6 text-center border-t border-[var(--reader-border,#DFD7CF)] mt-12 space-y-3">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-[#E0564C]/15 text-[#E0564C] font-mono text-sm font-black">
                ✓
              </div>
              <h4 className="text-sm font-extrabold tracking-tight">You have reached the end of Read nr. {formattedReadNr}</h4>
              <p className="text-xs opacity-60">All concepts, vocabulary, and formulas in this chapter are saved in your offline database.</p>
              
              <div className="flex items-center justify-center gap-3 pt-2">
                {onPrevNote && (
                  <button
                    onClick={onPrevNote}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[var(--reader-border,#DFD7CF)] hover:bg-black/5 dark:hover:bg-white/5 text-xs font-bold transition-all cursor-pointer"
                  >
                    <ChevronLeft size={14} /> Previous Note
                  </button>
                )}
                <button
                  onClick={onBack}
                  className="px-5 py-2 rounded-xl bg-[#E0564C] text-white text-xs font-bold shadow-md hover:bg-[#d04940] transition-all cursor-pointer active:scale-95"
                >
                  Return to Shelf
                </button>
                {onNextNote && (
                  <button
                    onClick={onNextNote}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[var(--reader-border,#DFD7CF)] hover:bg-black/5 dark:hover:bg-white/5 text-xs font-bold transition-all cursor-pointer"
                  >
                    Next Note <ChevronRight size={14} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 3. DOCKED BOTTOM PROGRESS BAR (Matches Image 2) */}
      {/* ============================================================ */}
      <footer className="shrink-0 px-4 sm:px-6 py-2.5 border-t border-[var(--reader-border,#DFD7CF)] bg-inherit/90 backdrop-blur-md flex items-center justify-between text-xs font-medium z-30">
        <div className="flex items-center gap-2">
          <span className="font-mono font-bold text-[#E0564C]">Read nr. {formattedReadNr}</span>
          <span className="opacity-40">•</span>
          <span className="opacity-70 font-mono">{scrollProgress}% read</span>
        </div>

        {/* Audio Player mini bar if active */}
        {isPlayingAudio && (
          <div className="flex items-center gap-2 text-xs font-semibold px-3 py-1 rounded-full bg-[#E0564C]/15 text-[#E0564C] border border-[#E0564C]/30 animate-pulse">
            <Volume2 size={13} />
            <span>Audio reading active</span>
            <button
              onClick={toggleSpeech}
              className="text-[10px] uppercase font-black underline ml-1 cursor-pointer"
            >
              Stop
            </button>
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="opacity-70 hover:opacity-100 transition-opacity font-bold cursor-pointer"
          >
            Top ↑
          </button>
        </div>
      </footer>
    </div>
  );
}
