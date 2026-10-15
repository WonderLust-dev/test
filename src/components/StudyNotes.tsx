import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { StudyNote, NoteFilters } from '../types';
import { getNotes, saveNote, saveNotesBatch, updateNote, deleteNote, togglePinNote, downloadNote } from '../services/database';
import MarkdownViewer, { extractHeadings, slugify } from './MarkdownViewer';
import EReaderView, { ReaderGeometricMotif } from './EReaderView';
import { convertNotionHtmlToMarkdown } from '../utils/notionParser';
import {
  FileText,
  Upload,
  Plus,
  Search,
  Filter,
  Pin,
  Trash2,
  Download,
  Edit3,
  BookOpen,
  X,
  Check,
  Eye,
  Clock,
  Sparkles,
  Maximize2,
  Minimize2,
  List,
  Grid,
  FileCode,
  FileCheck,
  ChevronRight,
  Menu,
  Copy,
  Hash,
  Columns,
  CheckSquare,
  Code2,
  Quote,
  Heading1,
  Heading2,
  Table,
  Type,
  AlignLeft,
} from 'lucide-react';

interface StudyNotesProps {
  userId?: string;
  onSelectSubject?: (subject: string) => void;
}

const SUBJECT_OPTIONS = [
  'Quantitative Aptitude',
  'General Awareness',
  'English Comprehension',
  'General Intelligence & Reasoning',
  'Computer Knowledge',
  'General Studies',
];

const NOTION_EMOJIS = [
  '📐', '🏛️', '📖', '💡', '⚡', '🎯', '🧠', '📝',
  '📊', '🔍', '🏆', '🌟', '⏱️', '📌', '🔬', '🧮',
  '⚖️', '🌍', '💻', '🔖',
];

export default function StudyNotes({ userId }: StudyNotesProps) {
  const effectiveUserId = userId || 'guest';
  const [notes, setNotes] = useState<StudyNote[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Views
  const [search, setSearch] = useState('');
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<'all' | 'md' | 'txt'>('all');
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Reader Mode
  const [activeNote, setActiveNote] = useState<StudyNote | null>(null);
  const [readerFontSize, setReaderFontSize] = useState<'sm' | 'base' | 'lg' | 'xl'>('base');
  const [readerFontStyle, setReaderFontStyle] = useState<'sans' | 'serif' | 'mono'>('sans');
  const [readerWidth, setReaderWidth] = useState<'normal' | 'full'>('normal');
  const [readerSearch, setReaderSearch] = useState('');
  const [showToc, setShowToc] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [copiedNoteId, setCopiedNoteId] = useState<string | null>(null);

  // Upload Modal
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadSubject, setUploadSubject] = useState(SUBJECT_OPTIONS[0]);
  const [pendingFiles, setPendingFiles] = useState<Array<{ name: string; content: string; size: number; type: 'md' | 'txt' }>>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Editor Modal (Create / Edit)
  const [editingNote, setEditingNote] = useState<Partial<StudyNote> | null>(null);
  const [editorTab, setEditorTab] = useState<'write' | 'split' | 'preview'>('write');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [pasteNotification, setPasteNotification] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load notes
  const loadNotes = async () => {
    setLoading(true);
    try {
      const data = await getNotes(effectiveUserId);
      setNotes(data);
    } catch (e) {
      console.error('Failed to load notes:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotes();
  }, [effectiveUserId]);

  // Filtered & Sorted Notes
  const filteredNotes = useMemo(() => {
    let result = [...notes];

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        n =>
          n.title.toLowerCase().includes(q) ||
          n.content.toLowerCase().includes(q) ||
          (n.subject && n.subject.toLowerCase().includes(q)) ||
          (n.tags && n.tags.some(t => t.toLowerCase().includes(q)))
      );
    }

    if (selectedSubject !== 'all') {
      result = result.filter(n => n.subject === selectedSubject);
    }

    if (selectedType !== 'all') {
      result = result.filter(n => n.file_type === selectedType);
    }

    if (pinnedOnly) {
      result = result.filter(n => n.is_pinned);
    }

    // Sort: Pinned first, then newest updated
    return result.sort((a, b) => {
      if (a.is_pinned && !b.is_pinned) return -1;
      if (!a.is_pinned && b.is_pinned) return 1;
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });
  }, [notes, search, selectedSubject, selectedType, pinnedOnly]);

  // Extract unique subjects from notes
  const availableSubjects = useMemo(() => {
    const set = new Set<string>();
    notes.forEach(n => {
      if (n.subject) set.add(n.subject);
    });
    return Array.from(set);
  }, [notes]);

  // Estimated reading time helper (200 wpm)
  const getReadTime = (content: string): string => {
    const words = content.trim().split(/\s+/).length;
    const mins = Math.max(1, Math.round(words / 200));
    return `${mins} min read`;
  };

  // Format file size
  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return '1 KB';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Handle Pin Toggle
  const handleTogglePin = async (e: React.MouseEvent, noteId: string) => {
    e.stopPropagation();
    const nextState = await togglePinNote(noteId);
    setNotes(prev =>
      prev.map(n => (n.id === noteId ? { ...n, is_pinned: nextState } : n))
    );
    if (activeNote && activeNote.id === noteId) {
      setActiveNote(prev => prev ? { ...prev, is_pinned: nextState } : null);
    }
  };

  // Handle Delete
  const handleDelete = async (e: React.MouseEvent, note: StudyNote) => {
    e.stopPropagation();
    if (confirm(`Delete note "${note.title}"? This cannot be undone.`)) {
      await deleteNote(note.id);
      setNotes(prev => prev.filter(n => n.id !== note.id));
      if (activeNote?.id === note.id) {
        setActiveNote(null);
      }
    }
  };

  // Handle Download
  const handleDownload = (e: React.MouseEvent, note: StudyNote) => {
    e.stopPropagation();
    downloadNote(note);
  };

  // Handle Copy Note Content
  const handleCopyNote = async (note: StudyNote) => {
    try {
      await navigator.clipboard.writeText(note.content);
      setCopiedNoteId(note.id);
      setTimeout(() => setCopiedNoteId(null), 2000);
    } catch {}
  };

  // File Upload Handlers
  const processUploadedFiles = async (files: FileList | File[]) => {
    const validExtensions = ['.md', '.markdown', '.txt'];
    const parsedFiles: typeof pendingFiles = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const name = file.name;
      const ext = name.slice(name.lastIndexOf('.')).toLowerCase();

      if (validExtensions.includes(ext)) {
        try {
          const text = await file.text();
          const type: 'md' | 'txt' = ext === '.txt' ? 'txt' : 'md';
          parsedFiles.push({
            name,
            content: text,
            size: file.size,
            type,
          });
        } catch (err) {
          console.error('Failed to read file:', name, err);
        }
      }
    }

    if (parsedFiles.length > 0) {
      setPendingFiles(prev => [...prev, ...parsedFiles]);
      setShowUploadModal(true);
    } else {
      alert('Please upload valid markdown (.md) or text (.txt) files.');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processUploadedFiles(e.dataTransfer.files);
    }
  };

  const handleConfirmUpload = async () => {
    if (pendingFiles.length === 0) return;

    const toSave = pendingFiles.map(f => {
      // Auto-extract title from first heading or filename
      let title = f.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      const firstHeading = f.content.match(/^#\s+(.+)$/m);
      if (firstHeading && firstHeading[1].trim()) {
        title = firstHeading[1].trim();
      }

      return {
        user_id: effectiveUserId,
        title,
        content: f.content,
        file_name: f.name,
        file_type: f.type,
        file_size: f.size,
        subject: uploadSubject,
        tags: [uploadSubject, f.type.toUpperCase()],
        is_pinned: false,
      };
    });

    const saved = await saveNotesBatch(toSave);
    setNotes(prev => [...saved, ...prev]);
    setPendingFiles([]);
    setShowUploadModal(false);
  };

  useEffect(() => {
    if (activeNote) {
      setReaderFontStyle(activeNote.font_style || 'sans');
    }
  }, [activeNote?.id]);

  // Smart paste: transforms Notion / rich text HTML from clipboard into clean Markdown
  const handleSmartPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const html = e.clipboardData.getData('text/html');
    if (!html) return;

    const markdown = convertNotionHtmlToMarkdown(html);
    if (!markdown || !markdown.trim()) return;

    e.preventDefault();
    const textarea = e.currentTarget;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentContent = editingNote?.content || '';
    const newContent = currentContent.slice(0, start) + markdown + currentContent.slice(end);

    setEditingNote(prev => prev ? { ...prev, content: newContent } : null);
    setPasteNotification('✨ Formatted from Notion / Rich Text');
    setTimeout(() => setPasteNotification(null), 3500);

    setTimeout(() => {
      textarea.focus();
      const pos = start + markdown.length;
      textarea.setSelectionRange(pos, pos);
    }, 0);
  };

  // Quick-insert snippet into editor textarea
  const insertSnippet = (snippet: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setEditingNote(prev => prev ? { ...prev, content: (prev.content || '') + snippet } : null);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const newText = text.substring(0, start) + snippet + text.substring(end);
    setEditingNote(prev => prev ? { ...prev, content: newText } : null);
    setTimeout(() => {
      textarea.focus();
      const newPos = start + snippet.length;
      textarea.setSelectionRange(newPos, newPos);
    }, 0);
  };

  // Interactive Checklist checkbox toggle in reader view (persists to DB)
  const handleToggleTask = async (taskIndex: number, newChecked: boolean) => {
    if (!activeNote) return;
    let currentTask = 0;
    const updatedContent = activeNote.content.replace(/([-*]\s+\[)([ xX])(\]\s+)/g, (match, prefix, check, suffix) => {
      if (currentTask === taskIndex) {
        currentTask++;
        return `${prefix}${newChecked ? 'x' : ' '}${suffix}`;
      }
      currentTask++;
      return match;
    });

    const updatedNote: StudyNote = {
      ...activeNote,
      content: updatedContent,
      updated_at: new Date().toISOString(),
    };

    setActiveNote(updatedNote);
    setNotes(prev => prev.map(n => n.id === updatedNote.id ? updatedNote : n));
    await updateNote(activeNote.id, { content: updatedContent });
  };

  // Checklist toggle in editor split/preview view
  const handleEditorToggleTask = (taskIndex: number, newChecked: boolean) => {
    if (!editingNote || !editingNote.content) return;
    let currentTask = 0;
    const updatedContent = editingNote.content.replace(/([-*]\s+\[)([ xX])(\]\s+)/g, (match, prefix, check, suffix) => {
      if (currentTask === taskIndex) {
        currentTask++;
        return `${prefix}${newChecked ? 'x' : ' '}${suffix}`;
      }
      currentTask++;
      return match;
    });
    setEditingNote(prev => prev ? { ...prev, content: updatedContent } : null);
  };

  // Handle Save from Editor (Create or Update)
  const handleSaveEditor = async () => {
    if (!editingNote || !editingNote.title?.trim() || !editingNote.content?.trim()) {
      alert('Please provide both a title and content for your note.');
      return;
    }

    if (editingNote.id) {
      // Update existing
      await updateNote(editingNote.id, {
        title: editingNote.title.trim(),
        content: editingNote.content,
        subject: editingNote.subject || 'General Studies',
        file_type: editingNote.file_type || 'md',
        tags: editingNote.tags || [],
        emoji: editingNote.emoji || '📝',
        font_style: editingNote.font_style || 'sans',
      });
      setNotes(prev =>
        prev.map(n =>
          n.id === editingNote.id
            ? {
                ...n,
                ...editingNote,
                title: editingNote.title!.trim(),
                content: editingNote.content!,
                emoji: editingNote.emoji || '📝',
                font_style: editingNote.font_style || 'sans',
                updated_at: new Date().toISOString(),
              } as StudyNote
            : n
        )
      );
      if (activeNote?.id === editingNote.id) {
        setActiveNote(prev => prev ? ({
          ...prev,
          ...editingNote,
          title: editingNote.title!.trim(),
          content: editingNote.content!,
          emoji: editingNote.emoji || '📝',
          font_style: editingNote.font_style || 'sans',
        } as StudyNote) : null);
      }
    } else {
      // Create new
      const saved = await saveNote({
        user_id: effectiveUserId,
        title: editingNote.title.trim(),
        content: editingNote.content,
        file_type: editingNote.file_type || 'md',
        subject: editingNote.subject || 'General Studies',
        tags: editingNote.tags || [editingNote.subject || 'General Studies'],
        file_name: `${editingNote.title.trim().replace(/\s+/g, '_')}.${editingNote.file_type || 'md'}`,
        file_size: new Blob([editingNote.content]).size,
        is_pinned: false,
        emoji: editingNote.emoji || '📝',
        font_style: editingNote.font_style || 'sans',
      });
      setNotes(prev => [saved, ...prev]);
    }

    setEditingNote(null);
  };

  // Headings for TOC in active note
  const activeTocHeadings = useMemo(() => {
    if (!activeNote || activeNote.file_type !== 'md') return [];
    return extractHeadings(activeNote.content);
  }, [activeNote]);

  return (
    <div className="space-y-5 animate-fadeIn max-w-7xl mx-auto">
      {/* Top Banner / Actions Bar */}
      <div className="bento-card p-5 sm:p-6 bg-gradient-to-br from-indigo-900/10 via-[var(--bg-surface)] to-[var(--bg-surface)] border border-[var(--border-color)] rounded-3xl shadow-soft">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center w-8 h-8 rounded-xl bg-indigo-600 text-white shadow-xs">
                <FileText size={18} />
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-[var(--text-main)] tracking-tight">
                Study & Revision Notes
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                {notes.length} Note{notes.length !== 1 ? 's' : ''}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-[var(--text-muted)] font-medium">
              Upload <code className="px-1.5 py-0.5 bg-[var(--bg-subcard)] rounded text-[11px] font-mono font-bold text-indigo-400 border border-[var(--border-color)]">.md</code> and <code className="px-1.5 py-0.5 bg-[var(--bg-subcard)] rounded text-[11px] font-mono font-bold text-amber-400 border border-[var(--border-color)]">.txt</code> notes. Read with beautiful tables, formulas, and speed shortcuts.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* Hidden File Input */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={e => {
                if (e.target.files) processUploadedFiles(e.target.files);
                e.target.value = '';
              }}
              multiple
              accept=".md,.markdown,.txt"
              className="hidden"
            />

            <button
              onClick={() => fileInputRef.current?.click()}
              className="btn btn-outline text-xs py-2 px-3.5 sm:px-4 rounded-xl flex items-center gap-1.5 shadow-2xs font-bold"
              title="Upload .md or .txt notes from device"
            >
              <Upload size={14} className="text-indigo-400" />
              <span>Upload Notes</span>
            </button>

            <button
              onClick={() => {
                setEditingNote({
                  title: '',
                  content: '# Note Title\n\nWrite your revision points here...',
                  file_type: 'md',
                  subject: SUBJECT_OPTIONS[0],
                  tags: [],
                });
                setEditorTab('write');
              }}
              className="btn btn-primary text-xs py-2 px-4 rounded-xl flex items-center gap-1.5 shadow-xs font-bold"
              title="Create a new note"
            >
              <Plus size={15} />
              <span>New Note</span>
            </button>
          </div>
        </div>
      </div>

      {/* Drag & Drop Quick Upload Zone */}
      <div
        onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`p-4 sm:p-5 rounded-2xl border-2 border-dashed transition-all cursor-pointer flex items-center justify-center gap-3 text-center ${
          isDragging
            ? 'border-indigo-500 bg-indigo-500/10 scale-[1.01]'
            : 'border-[var(--border-color)] bg-[var(--bg-subcard)]/50 hover:bg-[var(--bg-subcard)] hover:border-indigo-500/40'
        }`}
      >
        <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/20">
          <Upload size={18} />
        </div>
        <div className="text-xs text-[var(--text-muted)] text-left">
          <span className="font-bold text-[var(--text-main)] block sm:inline">
            Drop your Markdown (.md) or Text (.txt) notes here,
          </span>{' '}
          or click to browse from your computer.
        </div>
      </div>

      {/* Search, Filter Bar & View Toggle */}
      <div className="flex flex-col md:flex-row gap-3">
        {/* Search input */}
        <div className="relative flex-1">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search notes by title, formulas, keywords, or topics..."
            className="w-full pl-11 pr-4 py-2.5 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl text-xs sm:text-sm text-[var(--text-main)] placeholder-[var(--text-muted)] shadow-2xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-main)]"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Format filter */}
          <div className="flex items-center p-1 bg-[var(--bg-subcard)] border border-[var(--border-color)] rounded-xl text-xs font-bold">
            {(['all', 'md', 'txt'] as const).map(type => (
              <button
                key={type}
                onClick={() => setSelectedType(type)}
                className={`px-2.5 py-1 rounded-lg uppercase text-[11px] transition-all ${
                  selectedType === type
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                }`}
              >
                {type === 'all' ? 'All' : `.${type}`}
              </button>
            ))}
          </div>

          {/* Pinned filter */}
          <button
            onClick={() => setPinnedOnly(!pinnedOnly)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all ${
              pinnedOnly
                ? 'bg-amber-500/15 border-amber-500/40 text-amber-400'
                : 'bg-[var(--bg-surface)] border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            <Pin size={13} className={pinnedOnly ? 'fill-amber-400' : ''} />
            <span>Pinned</span>
          </button>

          {/* View mode toggle */}
          <div className="flex items-center p-1 bg-[var(--bg-subcard)] border border-[var(--border-color)] rounded-xl">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition-all ${
                viewMode === 'grid'
                  ? 'bg-[var(--bg-surface)] text-[var(--text-main)] shadow-2xs'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
              }`}
              title="Grid view"
            >
              <Grid size={15} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg transition-all ${
                viewMode === 'list'
                  ? 'bg-[var(--bg-surface)] text-[var(--text-main)] shadow-2xs'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
              }`}
              title="List view"
            >
              <List size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* Subject Filter Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 hide-scrollbar">
        <button
          onClick={() => setSelectedSubject('all')}
          className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition-all border ${
            selectedSubject === 'all'
              ? 'bg-indigo-600 text-white border-indigo-700 shadow-2xs'
              : 'bg-[var(--bg-surface)] border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
          }`}
        >
          All Subjects ({notes.length})
        </button>
        {Array.from(new Set([...SUBJECT_OPTIONS, ...availableSubjects])).map(subj => {
          const count = notes.filter(n => n.subject === subj).length;
          if (count === 0 && !SUBJECT_OPTIONS.includes(subj)) return null;
          return (
            <button
              key={subj}
              onClick={() => setSelectedSubject(subj)}
              className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition-all border ${
                selectedSubject === subj
                  ? 'bg-indigo-600 text-white border-indigo-700 shadow-2xs'
                  : 'bg-[var(--bg-surface)] border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
              }`}
            >
              {subj} ({count})
            </button>
          );
        })}
      </div>

      {/* Notes Display Grid / List */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(n => (
            <div key={n} className="bento-card p-5 animate-pulse space-y-3 h-48 rounded-3xl" />
          ))}
        </div>
      ) : filteredNotes.length === 0 ? (
        <div className="bento-card p-10 text-center rounded-3xl border border-[var(--border-color)] space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mx-auto">
            <FileText size={24} />
          </div>
          <h3 className="text-base font-extrabold text-[var(--text-main)]">No notes found</h3>
          <p className="text-xs text-[var(--text-muted)] max-w-sm mx-auto">
            {search || selectedSubject !== 'all' || selectedType !== 'all' || pinnedOnly
              ? 'No notes match your current filter settings. Try adjusting your search query.'
              : 'You haven’t added any notes yet. Upload a .md or .txt file to start studying!'}
          </p>
          {(search || selectedSubject !== 'all' || selectedType !== 'all' || pinnedOnly) && (
            <button
              onClick={() => {
                setSearch('');
                setSelectedSubject('all');
                setSelectedType('all');
                setPinnedOnly(false);
              }}
              className="btn btn-outline text-xs py-1.5 px-4 rounded-xl"
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredNotes.map((note, idx) => {
            const isMd = note.file_type === 'md';
            const readNr = String(idx + 1).padStart(2, '0');
            return (
              <div
                key={note.id}
                onClick={() => setActiveNote(note)}
                className={`bento-card p-5 rounded-3xl border transition-all duration-200 cursor-pointer flex flex-col justify-between hover:shadow-soft group relative overflow-hidden ${
                  note.is_pinned
                    ? 'border-amber-500/30 bg-[var(--bg-surface)] ring-1 ring-amber-500/20'
                    : 'border-[var(--border-color)] bg-[var(--bg-surface)] hover:border-[#E0564C]/50'
                }`}
              >
                {/* Decorative Geometric Art in Top Right */}
                <div className="absolute -right-6 -top-6 w-28 h-28 opacity-15 pointer-events-none group-hover:scale-105 transition-transform">
                  <ReaderGeometricMotif className="w-full h-full" />
                </div>

                <div className="relative z-10">
                  {/* Top Row: Badges & Pin */}
                  <div className="flex items-start justify-between gap-2 mb-2.5">
                    <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                      <span className="px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold border border-[#E0564C]/30 bg-[#E0564C]/10 text-[#E0564C]">
                        Read nr. {readNr}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider border ${
                          isMd
                            ? 'bg-indigo-500/15 border-indigo-500/30 text-indigo-400'
                            : 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                        }`}
                      >
                        {note.file_type}
                      </span>
                      {note.subject && (
                        <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-[var(--bg-subcard)] border border-[var(--border-color)] text-[var(--text-muted)] truncate max-w-[130px]">
                          {note.subject}
                        </span>
                      )}
                    </div>

                    <button
                      onClick={e => handleTogglePin(e, note.id)}
                      className={`p-1.5 rounded-lg transition-all ${
                        note.is_pinned
                          ? 'text-amber-400 bg-amber-500/10 hover:bg-amber-500/20'
                          : 'text-[var(--text-muted)] hover:text-amber-400 opacity-60 group-hover:opacity-100'
                      }`}
                      title={note.is_pinned ? 'Unpin note' : 'Pin note to top'}
                    >
                      <Pin size={14} className={note.is_pinned ? 'fill-amber-400' : ''} />
                    </button>
                  </div>

                  {/* Title with Notion Page Icon */}
                  <div className="flex items-start gap-2 mb-2">
                    <span className="text-xl shrink-0 select-none leading-none pt-0.5">
                      {note.emoji || (isMd ? '📝' : '📄')}
                    </span>
                    <h3 className="font-extrabold text-[var(--text-main)] text-sm sm:text-base leading-snug line-clamp-2 group-hover:text-[#E0564C] transition-colors">
                      {note.title}
                    </h3>
                  </div>

                  {/* Excerpt */}
                  <p className="text-xs text-[var(--text-muted)] line-clamp-3 leading-relaxed mb-4 font-normal">
                    {note.content.replace(/^[#\s\-*`>]+/gm, '').slice(0, 180)}
                  </p>
                </div>

                {/* Footer Row: Reading stats & Action buttons */}
                <div className="pt-3 border-t border-[var(--border-color)] flex items-center justify-between gap-2 text-[11px] text-[var(--text-muted)] font-medium relative z-10">
                  <div className="flex items-center gap-1 font-mono">
                    <Clock size={12} />
                    <span>{getReadTime(note.content)}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-[#E0564C] group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                      Begin Reading →
                    </span>
                    <div className="flex items-center gap-0.5 border-l border-[var(--border-color)] pl-1.5 ml-0.5">
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          setEditingNote(note);
                          setEditorTab('write');
                        }}
                        className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-subcard)] transition-colors"
                        title="Edit note"
                      >
                        <Edit3 size={12} />
                      </button>
                      <button
                        onClick={e => handleDownload(e, note)}
                        className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-subcard)] transition-colors"
                        title="Download file"
                      >
                        <Download size={12} />
                      </button>
                      <button
                        onClick={e => handleDelete(e, note)}
                        className="p-1 rounded-md text-[var(--text-muted)] hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                        title="Delete note"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* List View */
        <div className="bento-card rounded-3xl border border-[var(--border-color)] bg-[var(--bg-surface)] divide-y divide-[var(--border-color)] overflow-hidden shadow-soft">
          {filteredNotes.map((note, idx) => {
            const isMd = note.file_type === 'md';
            const readNr = String(idx + 1).padStart(2, '0');
            return (
              <div
                key={note.id}
                onClick={() => setActiveNote(note)}
                className="p-4 sm:p-4.5 hover:bg-[var(--bg-subcard)]/60 transition-colors cursor-pointer flex items-center justify-between gap-3 group"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <span className="px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold border border-[#E0564C]/30 bg-[#E0564C]/10 text-[#E0564C] shrink-0 hidden xs:inline">
                    Read nr. {readNr}
                  </span>
                  <span
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-lg border ${
                      isMd
                        ? 'bg-indigo-500/10 border-indigo-500/20'
                        : 'bg-amber-500/10 border-amber-500/20'
                    }`}
                  >
                    {note.emoji || (isMd ? '📝' : '📄')}
                  </span>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-extrabold text-sm sm:text-base text-[var(--text-main)] truncate group-hover:text-[#E0564C] transition-colors">
                        {note.title}
                      </h4>
                      {note.is_pinned && (
                        <Pin size={12} className="text-amber-400 fill-amber-400 shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] mt-0.5">
                      <span>{note.subject || 'General'}</span>
                      <span>•</span>
                      <span>{getReadTime(note.content)}</span>
                      <span>•</span>
                      <span>{formatFileSize(note.file_size)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-black text-[#E0564C] group-hover:translate-x-0.5 transition-transform hidden sm:inline">
                    Begin Reading →
                  </span>
                  <button
                    onClick={e => handleTogglePin(e, note.id)}
                    className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-amber-400"
                    title={note.is_pinned ? 'Unpin' : 'Pin'}
                  >
                    <Pin size={14} className={note.is_pinned ? 'fill-amber-400' : ''} />
                  </button>
                  <button
                    onClick={e => handleDownload(e, note)}
                    className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-main)]"
                    title="Download"
                  >
                    <Download size={14} />
                  </button>
                  <button
                    onClick={e => handleDelete(e, note)}
                    className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-rose-400"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                  <ChevronRight size={16} className="text-[var(--text-muted)] group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ============================================================ */}
      {/* IMMERSIVE E-READER MODE (MATCHES IMAGE 2 REFERENCE) */}
      {/* ============================================================ */}
      {activeNote && createPortal(
        <EReaderView
          note={activeNote}
          readNumber={Math.max(1, filteredNotes.findIndex(n => n.id === activeNote.id) + 1)}
          totalNotesCount={filteredNotes.length || notes.length}
          onBack={() => {
            setActiveNote(null);
            setIsFullScreen(false);
            setShowToc(false);
          }}
          onTogglePin={id => handleTogglePin({ stopPropagation: () => {} } as any, id)}
          onEditNote={noteToEdit => {
            setActiveNote(null);
            setEditingNote(noteToEdit);
            setEditorTab('write');
          }}
          onNextNote={() => {
            const currentIdx = filteredNotes.findIndex(n => n.id === activeNote.id);
            if (currentIdx >= 0 && currentIdx < filteredNotes.length - 1) {
              setActiveNote(filteredNotes[currentIdx + 1]);
            }
          }}
          onPrevNote={() => {
            const currentIdx = filteredNotes.findIndex(n => n.id === activeNote.id);
            if (currentIdx > 0) {
              setActiveNote(filteredNotes[currentIdx - 1]);
            }
          }}
          onToggleTask={handleToggleTask}
        />,
        document.body
      )}

      {/* ============================================================ */}
      {/* UPLOAD NOTES MODAL */}
      {/* ============================================================ */}
      {showUploadModal && createPortal(
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-[var(--bg-surface)] text-[var(--text-main)] rounded-3xl p-5 sm:p-7 max-w-lg w-full shadow-2xl border border-[var(--border-color)] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-color)]">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-indigo-500/15 text-indigo-400 flex items-center justify-center font-bold">
                  <Upload size={16} />
                </span>
                <div>
                  <h3 className="text-base font-extrabold text-[var(--text-main)]">
                    Upload Study Notes
                  </h3>
                  <p className="text-xs text-[var(--text-muted)]">
                    {pendingFiles.length} file{pendingFiles.length > 1 ? 's' : ''} ready for import
                  </p>
                </div>
              </div>

              <button
                onClick={() => {
                  setShowUploadModal(false);
                  setPendingFiles([]);
                }}
                className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Subject Selector for uploaded notes */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[var(--text-main)]">
                Assign Subject Category:
              </label>
              <select
                value={uploadSubject}
                onChange={e => setUploadSubject(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[var(--bg-subcard)] border border-[var(--border-color)] rounded-xl text-xs sm:text-sm text-[var(--text-main)] font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                {SUBJECT_OPTIONS.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            {/* File List preview */}
            <div className="space-y-2 max-h-56 overflow-y-auto custom-scrollbar p-1">
              {pendingFiles.map((f, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--bg-subcard)] border border-[var(--border-color)] text-xs font-medium"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="uppercase text-[10px] font-black px-1.5 py-0.5 rounded bg-indigo-600 text-white shrink-0">
                      {f.type}
                    </span>
                    <span className="truncate text-[var(--text-main)] font-bold">{f.name}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[var(--text-muted)] font-mono">{formatFileSize(f.size)}</span>
                    <button
                      onClick={() => setPendingFiles(prev => prev.filter((_, i) => i !== idx))}
                      className="p-1 text-[var(--text-muted)] hover:text-rose-400 cursor-pointer"
                      title="Remove file"
                    >
                      <X size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Modal Actions */}
            <div className="flex gap-2.5 pt-2">
              <button
                onClick={() => {
                  setShowUploadModal(false);
                  setPendingFiles([]);
                }}
                className="flex-1 btn btn-outline text-xs py-2.5 rounded-xl font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmUpload}
                className="flex-1 btn btn-primary text-xs py-2.5 rounded-xl font-bold shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Check size={14} />
                <span>Save to Notes Library</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ============================================================ */}
      {/* CREATE / EDIT NOTE MODAL (Notion-Powered) */}
      {/* ============================================================ */}
      {editingNote && createPortal(
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 backdrop-blur-sm p-3 sm:p-4 animate-fadeIn">
          <div className="bg-[var(--bg-surface)] text-[var(--text-main)] rounded-3xl p-4 sm:p-6 max-w-5xl w-full h-[90vh] shadow-2xl border border-[var(--border-color)] flex flex-col justify-between">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-color)] shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-8 h-8 rounded-xl bg-indigo-500/15 text-indigo-400 flex items-center justify-center font-bold shrink-0">
                  <Edit3 size={16} />
                </span>
                <h3 className="text-sm sm:text-base font-extrabold text-[var(--text-main)] truncate">
                  {editingNote.id ? 'Edit Study Note' : 'Create Notion-Style Note'}
                </h3>

                {pasteNotification && (
                  <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold animate-fadeIn">
                    <Sparkles size={13} />
                    <span>{pasteNotification}</span>
                  </span>
                )}
              </div>

              {/* Write vs Split vs Preview Tabs */}
              <div className="flex items-center gap-2">
                <div className="flex items-center p-0.5 bg-[var(--bg-subcard)] border border-[var(--border-color)] rounded-xl text-xs font-bold">
                  {(['write', 'split', 'preview'] as const).map(tab => (
                    <button
                      key={tab}
                      onClick={() => setEditorTab(tab)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold capitalize transition-all ${
                        editorTab === tab
                          ? 'bg-indigo-600 text-white shadow-2xs'
                          : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => {
                    setEditingNote(null);
                    setShowEmojiPicker(false);
                  }}
                  className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-main)]"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Form Inputs (Emoji, Title, Subject, Font Style) */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 py-3 shrink-0">
              <div className="sm:col-span-6 relative">
                <label className="text-xs font-bold text-[var(--text-main)] block mb-1">
                  Note Title
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                      className="w-10 h-10 rounded-xl bg-[var(--bg-subcard)] border border-[var(--border-color)] hover:border-indigo-500 text-xl flex items-center justify-center transition-all select-none shadow-2xs cursor-pointer"
                      title="Choose Notion page icon"
                    >
                      {editingNote.emoji || '📝'}
                    </button>

                    {showEmojiPicker && (
                      <div className="absolute top-12 left-0 z-50 p-2.5 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] shadow-xl grid grid-cols-5 gap-1.5 w-60 animate-fadeIn">
                        {NOTION_EMOJIS.map(em => (
                          <button
                            key={em}
                            type="button"
                            onClick={() => {
                              setEditingNote({ ...editingNote, emoji: em });
                              setShowEmojiPicker(false);
                            }}
                            className="p-1.5 rounded-xl hover:bg-[var(--bg-subcard)] text-xl flex items-center justify-center transition-all cursor-pointer"
                          >
                            {em}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <input
                    value={editingNote.title || ''}
                    onChange={e => setEditingNote({ ...editingNote, title: e.target.value })}
                    placeholder="e.g. Geometry Circle Theorems & Inradius Shortcuts"
                    className="flex-1 px-3.5 py-2.5 bg-[var(--bg-subcard)] border border-[var(--border-color)] rounded-xl text-xs sm:text-sm text-[var(--text-main)] font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="sm:col-span-3">
                <label className="text-xs font-bold text-[var(--text-main)] block mb-1">
                  Subject
                </label>
                <select
                  value={editingNote.subject || SUBJECT_OPTIONS[0]}
                  onChange={e => setEditingNote({ ...editingNote, subject: e.target.value })}
                  className="w-full px-3 py-2.5 bg-[var(--bg-subcard)] border border-[var(--border-color)] rounded-xl text-xs sm:text-sm text-[var(--text-main)] font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {SUBJECT_OPTIONS.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-3">
                <label className="text-xs font-bold text-[var(--text-main)] block mb-1">
                  Font Style
                </label>
                <select
                  value={editingNote.font_style || 'sans'}
                  onChange={e => setEditingNote({ ...editingNote, font_style: e.target.value as 'sans' | 'serif' | 'mono' })}
                  className="w-full px-3 py-2.5 bg-[var(--bg-subcard)] border border-[var(--border-color)] rounded-xl text-xs sm:text-sm text-[var(--text-main)] font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="sans">Default Sans-Serif</option>
                  <option value="serif">Elegant Serif</option>
                  <option value="mono">Technical Mono</option>
                </select>
              </div>
            </div>

            {/* Main Textarea / Live Preview Body */}
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col border border-[var(--border-color)] rounded-2xl bg-[var(--bg-subcard)]/40 p-2.5">
              {/* Quick Insert Toolbar (shown for 'write' and 'split') */}
              {editorTab !== 'preview' && (
                <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-[var(--border-color)]/60 overflow-x-auto custom-scrollbar shrink-0 text-xs">
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => insertSnippet('\n# ')}
                      className="px-2 py-1 rounded-lg bg-[var(--bg-surface)] hover:bg-indigo-600 hover:text-white border border-[var(--border-color)] text-[var(--text-muted)] font-bold text-[11px] transition-all flex items-center gap-1 cursor-pointer"
                      title="Heading 1"
                    >
                      <Heading1 size={13} /> H1
                    </button>
                    <button
                      type="button"
                      onClick={() => insertSnippet('\n## ')}
                      className="px-2 py-1 rounded-lg bg-[var(--bg-surface)] hover:bg-indigo-600 hover:text-white border border-[var(--border-color)] text-[var(--text-muted)] font-bold text-[11px] transition-all flex items-center gap-1 cursor-pointer"
                      title="Heading 2"
                    >
                      <Heading2 size={13} /> H2
                    </button>
                    <button
                      type="button"
                      onClick={() => insertSnippet('\n- ')}
                      className="px-2 py-1 rounded-lg bg-[var(--bg-surface)] hover:bg-indigo-600 hover:text-white border border-[var(--border-color)] text-[var(--text-muted)] font-bold text-[11px] transition-all flex items-center gap-1 cursor-pointer"
                      title="Bulleted List"
                    >
                      <List size={13} /> Bullet
                    </button>
                    <button
                      type="button"
                      onClick={() => insertSnippet('\n- [ ] ')}
                      className="px-2 py-1 rounded-lg bg-[var(--bg-surface)] hover:bg-indigo-600 hover:text-white border border-[var(--border-color)] text-[var(--text-muted)] font-bold text-[11px] transition-all flex items-center gap-1 cursor-pointer"
                      title="To-Do Task Checkbox"
                    >
                      <CheckSquare size={13} /> To-Do
                    </button>
                    <button
                      type="button"
                      onClick={() => insertSnippet('\n> 💡 **Tip**: ')}
                      className="px-2 py-1 rounded-lg bg-indigo-500/10 hover:bg-indigo-600 hover:text-white border border-indigo-500/30 text-indigo-400 font-bold text-[11px] transition-all flex items-center gap-1 cursor-pointer"
                      title="Notion Callout Card"
                    >
                      💡 Callout
                    </button>
                    <button
                      type="button"
                      onClick={() => insertSnippet('\n▶ Toggle Title\nToggle content goes here...\n')}
                      className="px-2 py-1 rounded-lg bg-[var(--bg-surface)] hover:bg-indigo-600 hover:text-white border border-[var(--border-color)] text-[var(--text-muted)] font-bold text-[11px] transition-all flex items-center gap-1 cursor-pointer"
                      title="Notion Toggle Accordion"
                    >
                      ▶ Toggle
                    </button>
                    <button
                      type="button"
                      onClick={() => insertSnippet('\n$$\n\\frac{a}{b} = c\n$$\n')}
                      className="px-2 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-600 hover:text-white border border-amber-500/30 text-amber-400 font-bold text-[11px] transition-all flex items-center gap-1 cursor-pointer"
                      title="Math Block"
                    >
                      $$ Math
                    </button>
                    <button
                      type="button"
                      onClick={() => insertSnippet('\n| Header 1 | Header 2 |\n| :--- | :--- |\n| Row 1 | Data 1 |\n')}
                      className="px-2 py-1 rounded-lg bg-[var(--bg-surface)] hover:bg-indigo-600 hover:text-white border border-[var(--border-color)] text-[var(--text-muted)] font-bold text-[11px] transition-all flex items-center gap-1 cursor-pointer"
                      title="Markdown Table"
                    >
                      <Table size={13} /> Table
                    </button>
                    <button
                      type="button"
                      onClick={() => insertSnippet('\n```\n// code snippet\n```\n')}
                      className="px-2 py-1 rounded-lg bg-[var(--bg-surface)] hover:bg-indigo-600 hover:text-white border border-[var(--border-color)] text-[var(--text-muted)] font-bold text-[11px] transition-all flex items-center gap-1 cursor-pointer"
                      title="Code Block"
                    >
                      <Code2 size={13} /> Code
                    </button>
                    <button
                      type="button"
                      onClick={() => insertSnippet('\n> ')}
                      className="px-2 py-1 rounded-lg bg-[var(--bg-surface)] hover:bg-indigo-600 hover:text-white border border-[var(--border-color)] text-[var(--text-muted)] font-bold text-[11px] transition-all flex items-center gap-1 cursor-pointer"
                      title="Quote"
                    >
                      <Quote size={13} /> Quote
                    </button>
                  </div>

                  <span className="hidden lg:inline text-[10px] text-[var(--text-muted)] italic shrink-0">
                    Paste from Notion to auto-convert
                  </span>
                </div>
              )}

              {/* Content Workspace */}
              <div className="flex-1 min-h-0 overflow-hidden">
                {editorTab === 'write' ? (
                  <textarea
                    ref={textareaRef}
                    value={editingNote.content || ''}
                    onChange={e => setEditingNote({ ...editingNote, content: e.target.value })}
                    onPaste={handleSmartPaste}
                    placeholder="Write or paste your study notes here. Pasting from Notion or web automatically converts to Markdown..."
                    className="w-full h-full p-3 bg-transparent text-[var(--text-main)] font-mono text-xs sm:text-sm leading-relaxed resize-none focus:outline-none custom-scrollbar"
                  />
                ) : editorTab === 'split' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 h-full overflow-hidden">
                    <div className="h-full flex flex-col border-r border-[var(--border-color)]/60 pr-2">
                      <div className="text-[10px] uppercase font-bold tracking-wider text-[var(--text-muted)] mb-1">
                        Markdown Source
                      </div>
                      <textarea
                        ref={textareaRef}
                        value={editingNote.content || ''}
                        onChange={e => setEditingNote({ ...editingNote, content: e.target.value })}
                        onPaste={handleSmartPaste}
                        placeholder="Write markdown here..."
                        className="flex-1 p-2.5 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl text-[var(--text-main)] font-mono text-xs leading-relaxed resize-none focus:outline-none custom-scrollbar"
                      />
                    </div>
                    <div className="h-full flex flex-col pl-1 overflow-hidden">
                      <div className="text-[10px] uppercase font-bold tracking-wider text-indigo-400 mb-1 flex items-center gap-1">
                        <Sparkles size={11} /> Live Notion Preview
                      </div>
                      <div className="flex-1 p-3 overflow-y-auto custom-scrollbar bg-[var(--bg-surface)] rounded-xl border border-[var(--border-color)]">
                        <MarkdownViewer
                          content={editingNote.content || ''}
                          fileType={editingNote.file_type || 'md'}
                          fontStyle={editingNote.font_style || 'sans'}
                          onToggleTask={handleEditorToggleTask}
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="w-full h-full p-4 sm:p-6 overflow-y-auto custom-scrollbar bg-[var(--bg-surface)] rounded-xl">
                    <div className="max-w-3xl mx-auto">
                      <MarkdownViewer
                        content={editingNote.content || ''}
                        fileType={editingNote.file_type || 'md'}
                        fontStyle={editingNote.font_style || 'sans'}
                        onToggleTask={handleEditorToggleTask}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-between pt-3 shrink-0">
              <div className="text-xs text-[var(--text-muted)] font-medium">
                {editingNote.content
                  ? `${editingNote.content.trim().split(/\s+/).filter(Boolean).length} words • ${editingNote.file_type || 'md'}`
                  : ''}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setEditingNote(null);
                    setShowEmojiPicker(false);
                  }}
                  className="btn btn-outline text-xs py-2 px-4 rounded-xl font-bold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEditor}
                  className="btn btn-primary text-xs py-2 px-5 rounded-xl font-bold shadow-xs flex items-center gap-1.5"
                >
                  <Check size={14} />
                  <span>Save Note</span>
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
