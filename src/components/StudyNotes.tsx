import React, { useState, useEffect, useMemo, useRef } from 'react';
import { StudyNote, NoteFilters } from '../types';
import { getNotes, saveNote, saveNotesBatch, updateNote, deleteNote, togglePinNote, downloadNote } from '../services/database';
import MarkdownViewer, { extractHeadings, slugify } from './MarkdownViewer';
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
  const [editorTab, setEditorTab] = useState<'write' | 'preview'>('write');

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
      });
      setNotes(prev =>
        prev.map(n =>
          n.id === editingNote.id
            ? {
                ...n,
                ...editingNote,
                title: editingNote.title!.trim(),
                content: editingNote.content!,
                updated_at: new Date().toISOString(),
              } as StudyNote
            : n
        )
      );
      if (activeNote?.id === editingNote.id) {
        setActiveNote(prev => prev ? ({ ...prev, ...editingNote } as StudyNote) : null);
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
          {filteredNotes.map(note => {
            const isMd = note.file_type === 'md';
            return (
              <div
                key={note.id}
                onClick={() => setActiveNote(note)}
                className={`bento-card p-5 rounded-3xl border transition-all duration-200 cursor-pointer flex flex-col justify-between hover:shadow-soft group relative ${
                  note.is_pinned
                    ? 'border-amber-500/30 bg-[var(--bg-surface)] ring-1 ring-amber-500/20'
                    : 'border-[var(--border-color)] bg-[var(--bg-surface)] hover:border-indigo-500/40'
                }`}
              >
                <div>
                  {/* Top Row: Badges & Pin */}
                  <div className="flex items-start justify-between gap-2 mb-2.5">
                    <div className="flex flex-wrap items-center gap-1.5 min-w-0">
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
                        <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-[var(--bg-subcard)] border border-[var(--border-color)] text-[var(--text-muted)] truncate max-w-[150px]">
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

                  {/* Title */}
                  <h3 className="font-extrabold text-[var(--text-main)] text-sm sm:text-base leading-snug line-clamp-2 mb-2 group-hover:text-indigo-400 transition-colors">
                    {note.title}
                  </h3>

                  {/* Excerpt */}
                  <p className="text-xs text-[var(--text-muted)] line-clamp-3 leading-relaxed mb-4 font-normal">
                    {note.content.replace(/^[#\s\-*`>]+/gm, '').slice(0, 180)}
                  </p>
                </div>

                {/* Footer Row: Reading stats & Action buttons */}
                <div className="pt-3 border-t border-[var(--border-color)] flex items-center justify-between gap-2 text-[11px] text-[var(--text-muted)] font-medium">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1 font-mono">
                      <Clock size={12} /> {getReadTime(note.content)}
                    </span>
                    <span>•</span>
                    <span className="font-mono">{formatFileSize(note.file_size)}</span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        setEditingNote(note);
                        setEditorTab('write');
                      }}
                      className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-subcard)] transition-colors"
                      title="Edit note"
                    >
                      <Edit3 size={13} />
                    </button>
                    <button
                      onClick={e => handleDownload(e, note)}
                      className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-subcard)] transition-colors"
                      title="Download file"
                    >
                      <Download size={13} />
                    </button>
                    <button
                      onClick={e => handleDelete(e, note)}
                      className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                      title="Delete note"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* List View */
        <div className="bento-card rounded-3xl border border-[var(--border-color)] bg-[var(--bg-surface)] divide-y divide-[var(--border-color)] overflow-hidden shadow-soft">
          {filteredNotes.map(note => {
            const isMd = note.file_type === 'md';
            return (
              <div
                key={note.id}
                onClick={() => setActiveNote(note)}
                className="p-4 sm:p-4.5 hover:bg-[var(--bg-subcard)]/60 transition-colors cursor-pointer flex items-center justify-between gap-3 group"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <span
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 font-bold text-xs uppercase border ${
                      isMd
                        ? 'bg-indigo-500/15 border-indigo-500/30 text-indigo-400'
                        : 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                    }`}
                  >
                    {note.file_type}
                  </span>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-extrabold text-sm sm:text-base text-[var(--text-main)] truncate group-hover:text-indigo-400 transition-colors">
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

                <div className="flex items-center gap-1.5 shrink-0">
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
      {/* FULL READER MODE (MODAL / FULL-SCREEN FOCUS) */}
      {/* ============================================================ */}
      {activeNote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4 animate-fadeIn">
          <div
            className={`bg-[var(--bg-surface)] text-[var(--text-main)] border border-[var(--border-color)] flex flex-col shadow-2xl transition-all duration-200 overflow-hidden ${
              isFullScreen
                ? 'fixed inset-0 rounded-none'
                : 'w-full max-w-5xl h-full sm:h-[92vh] sm:rounded-3xl'
            }`}
          >
            {/* Reader Header */}
            <header className="shrink-0 p-3.5 sm:p-4.5 border-b border-[var(--border-color)] bg-[var(--bg-surface)] flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase border shrink-0 ${
                    activeNote.file_type === 'md'
                      ? 'bg-indigo-500/15 border-indigo-500/30 text-indigo-400'
                      : 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                  }`}
                >
                  {activeNote.file_type}
                </span>

                <div className="min-w-0">
                  <h2 className="text-sm sm:text-lg font-extrabold text-[var(--text-main)] truncate tracking-tight">
                    {activeNote.title}
                  </h2>
                  <div className="flex items-center gap-2 text-[11px] text-[var(--text-muted)] font-medium">
                    <span>{activeNote.subject}</span>
                    <span>•</span>
                    <span>{getReadTime(activeNote.content)}</span>
                  </div>
                </div>
              </div>

              {/* Reader Controls */}
              <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                {/* Font Size Selector */}
                <div className="hidden sm:flex items-center p-0.5 bg-[var(--bg-subcard)] border border-[var(--border-color)] rounded-xl text-xs font-bold">
                  {(['sm', 'base', 'lg', 'xl'] as const).map(size => (
                    <button
                      key={size}
                      onClick={() => setReaderFontSize(size)}
                      className={`px-2 py-1 rounded-lg text-[10px] uppercase font-bold transition-all ${
                        readerFontSize === size
                          ? 'bg-indigo-600 text-white shadow-2xs'
                          : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                      }`}
                      title={`Font size ${size}`}
                    >
                      {size}
                    </button>
                  ))}
                </div>

                {/* TOC Toggle for Markdown */}
                {activeNote.file_type === 'md' && activeTocHeadings.length > 0 && (
                  <button
                    onClick={() => setShowToc(!showToc)}
                    className={`p-2 rounded-xl border text-xs font-bold transition-all ${
                      showToc
                        ? 'bg-indigo-500/15 border-indigo-500/30 text-indigo-400'
                        : 'bg-[var(--bg-subcard)] border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
                    }`}
                    title="Toggle Table of Contents"
                  >
                    <Hash size={15} />
                  </button>
                )}

                {/* Copy full text */}
                <button
                  onClick={() => handleCopyNote(activeNote)}
                  className="p-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-subcard)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-all"
                  title="Copy full note content"
                >
                  {copiedNoteId === activeNote.id ? <Check size={15} className="text-emerald-400" /> : <Copy size={15} />}
                </button>

                {/* Edit Note */}
                <button
                  onClick={() => {
                    setEditingNote(activeNote);
                    setEditorTab('write');
                  }}
                  className="p-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-subcard)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-all"
                  title="Edit note"
                >
                  <Edit3 size={15} />
                </button>

                {/* Download */}
                <button
                  onClick={() => downloadNote(activeNote)}
                  className="p-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-subcard)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-all"
                  title="Download note"
                >
                  <Download size={15} />
                </button>

                {/* Fullscreen Toggle */}
                <button
                  onClick={() => setIsFullScreen(!isFullScreen)}
                  className="hidden sm:block p-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-subcard)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-all"
                  title={isFullScreen ? 'Exit fullscreen' : 'Fullscreen reader'}
                >
                  {isFullScreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                </button>

                {/* Close Reader */}
                <button
                  onClick={() => {
                    setActiveNote(null);
                    setIsFullScreen(false);
                    setShowToc(false);
                  }}
                  className="p-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-subcard)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-all"
                  title="Close reader"
                >
                  <X size={16} />
                </button>
              </div>
            </header>

            {/* Reader Content Body (with optional TOC side panel) */}
            <div className="flex-1 min-h-0 flex overflow-hidden">
              {/* Table of Contents Side Panel */}
              {showToc && activeNote.file_type === 'md' && activeTocHeadings.length > 0 && (
                <aside className="w-64 shrink-0 border-r border-[var(--border-color)] p-4 overflow-y-auto custom-scrollbar bg-[var(--bg-subcard)]/40 hidden md:block">
                  <div className="text-xs font-black uppercase text-[var(--text-muted)] mb-3 tracking-wider flex items-center gap-1.5">
                    <Hash size={13} />
                    <span>Table of Contents</span>
                  </div>
                  <nav className="space-y-1">
                    {activeTocHeadings.map(h => (
                      <a
                        key={h.id}
                        href={`#${h.id}`}
                        onClick={e => {
                          e.preventDefault();
                          const el = document.getElementById(h.id);
                          if (el) el.scrollIntoView({ behavior: 'smooth' });
                        }}
                        style={{ paddingLeft: `${(h.level - 1) * 10 + 6}px` }}
                        className="block text-xs py-1 text-[var(--text-muted)] hover:text-indigo-400 hover:bg-[var(--bg-subcard)] rounded-lg truncate transition-colors font-medium"
                      >
                        {h.text}
                      </a>
                    ))}
                  </nav>
                </aside>
              )}

              {/* Main Reading Area */}
              <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-8 custom-scrollbar">
                <div className="max-w-3xl mx-auto">
                  <MarkdownViewer
                    content={activeNote.content}
                    fileType={activeNote.file_type}
                    fontSize={readerFontSize}
                    searchQuery={readerSearch}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* UPLOAD NOTES MODAL */}
      {/* ============================================================ */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fadeIn">
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
                className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-main)]"
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
                className="w-full px-3.5 py-2.5 bg-[var(--bg-subcard)] border border-[var(--border-color)] rounded-xl text-xs sm:text-sm text-[var(--text-main)] font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                      className="p-1 text-[var(--text-muted)] hover:text-rose-400"
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
                className="flex-1 btn btn-outline text-xs py-2.5 rounded-xl font-bold"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmUpload}
                className="flex-1 btn btn-primary text-xs py-2.5 rounded-xl font-bold shadow-xs flex items-center justify-center gap-1.5"
              >
                <Check size={14} />
                <span>Save to Notes Library</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* CREATE / EDIT NOTE MODAL */}
      {/* ============================================================ */}
      {editingNote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-[var(--bg-surface)] text-[var(--text-main)] rounded-3xl p-5 sm:p-7 max-w-4xl w-full h-[88vh] shadow-2xl border border-[var(--border-color)] flex flex-col justify-between">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-color)] shrink-0">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-indigo-500/15 text-indigo-400 flex items-center justify-center font-bold">
                  <Edit3 size={16} />
                </span>
                <h3 className="text-base font-extrabold text-[var(--text-main)]">
                  {editingNote.id ? 'Edit Study Note' : 'Create New Study Note'}
                </h3>
              </div>

              {/* Write vs Preview Tabs */}
              <div className="flex items-center gap-2">
                <div className="flex items-center p-0.5 bg-[var(--bg-subcard)] border border-[var(--border-color)] rounded-xl text-xs font-bold">
                  <button
                    onClick={() => setEditorTab('write')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      editorTab === 'write'
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                    }`}
                  >
                    Write
                  </button>
                  <button
                    onClick={() => setEditorTab('preview')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      editorTab === 'preview'
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                    }`}
                  >
                    Preview
                  </button>
                </div>

                <button
                  onClick={() => setEditingNote(null)}
                  className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-main)]"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Form Inputs (Title, Subject, Format) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 py-3 shrink-0">
              <div className="sm:col-span-2">
                <label className="text-xs font-bold text-[var(--text-main)] block mb-1">
                  Note Title
                </label>
                <input
                  value={editingNote.title || ''}
                  onChange={e => setEditingNote({ ...editingNote, title: e.target.value })}
                  placeholder="e.g. Geometry Circle Theorems & Inradius Shortcuts"
                  className="w-full px-3.5 py-2 bg-[var(--bg-subcard)] border border-[var(--border-color)] rounded-xl text-xs sm:text-sm text-[var(--text-main)] font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[var(--text-main)] block mb-1">
                  Subject
                </label>
                <select
                  value={editingNote.subject || SUBJECT_OPTIONS[0]}
                  onChange={e => setEditingNote({ ...editingNote, subject: e.target.value })}
                  className="w-full px-3 py-2 bg-[var(--bg-subcard)] border border-[var(--border-color)] rounded-xl text-xs sm:text-sm text-[var(--text-main)] font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {SUBJECT_OPTIONS.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Main Textarea / Live Preview Body */}
            <div className="flex-1 min-h-0 overflow-hidden border border-[var(--border-color)] rounded-2xl bg-[var(--bg-subcard)]/40 p-2">
              {editorTab === 'write' ? (
                <textarea
                  value={editingNote.content || ''}
                  onChange={e => setEditingNote({ ...editingNote, content: e.target.value })}
                  placeholder="Write your study notes here using Markdown (# Headings, - lists, tables, > callouts)..."
                  className="w-full h-full p-3 bg-transparent text-[var(--text-main)] font-mono text-xs sm:text-sm leading-relaxed resize-none focus:outline-none custom-scrollbar"
                />
              ) : (
                <div className="w-full h-full p-4 overflow-y-auto custom-scrollbar bg-[var(--bg-surface)] rounded-xl">
                  <MarkdownViewer
                    content={editingNote.content || ''}
                    fileType={editingNote.file_type || 'md'}
                  />
                </div>
              )}
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-2 pt-3 shrink-0">
              <button
                onClick={() => setEditingNote(null)}
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
      )}
    </div>
  );
}
