import React, { useState, useEffect, useMemo } from 'react';
import { QuestionJSON } from '../types';
import { Filter } from 'lucide-react';

export type PaletteStatus = 'all' | 'answered' | 'marked' | 'unanswered' | 'not_visited';

interface QuestionPaletteProps {
  questions: QuestionJSON[];
  currentQ: number;
  answers: Record<number, number | null>;
  marked: Record<number, boolean>;
  instantFeedback: boolean;
  revealedQuestions: Record<number, boolean>;
  counts: {
    answered: number;
    marked: number;
    unanswered: number;
    notVisited: number;
    correct?: number;
    incorrect?: number;
  };
  onSelectQuestion: (index: number) => void;
  className?: string;
  isMobileDrawer?: boolean;
}

const CHUNK_SIZE = 50;

export default function QuestionPalette({
  questions,
  currentQ,
  answers,
  marked,
  instantFeedback,
  revealedQuestions,
  counts,
  onSelectQuestion,
  className = '',
  isMobileDrawer = false,
}: QuestionPaletteProps) {
  // Group questions by subject
  const subjects = useMemo(() => {
    const list: string[] = [];
    questions.forEach(q => {
      const s = q.subject || 'General';
      if (!list.includes(s)) list.push(s);
    });
    return list;
  }, [questions]);

  const hasMultipleSubjects = subjects.length > 1;

  // Active Subject tab
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  // Active Status Filter
  const [statusFilter, setStatusFilter] = useState<PaletteStatus>('all');
  // Jump to question input
  const [jumpInput, setJumpInput] = useState('');
  const [jumpError, setJumpError] = useState('');

  // Active Chunk page (0 = 1-50, 1 = 51-100, etc.)
  const [activeChunk, setActiveChunk] = useState<number>(() => Math.floor(currentQ / CHUNK_SIZE));

  // Keep active chunk in sync when user navigates next/prev outside palette
  useEffect(() => {
    const chunkOfCurrent = Math.floor(currentQ / CHUNK_SIZE);
    setActiveChunk(chunkOfCurrent);
  }, [currentQ]);

  // Determine question status
  const getQStatus = (idx: number): 'answered' | 'marked' | 'unanswered' | 'not_visited' | 'correct' | 'incorrect' => {
    if (marked[idx]) return 'marked';
    if (answers[idx] !== undefined && answers[idx] !== null) {
      if (instantFeedback || revealedQuestions[idx]) {
        return answers[idx] === questions[idx].answerIndex ? 'correct' : 'incorrect';
      }
      return 'answered';
    }
    const maxVisited = Math.max(currentQ, ...Object.keys(answers).map(Number), -1);
    if (idx <= maxVisited) return 'unanswered';
    return 'not_visited';
  };

  const attemptedCount = useMemo(() => {
    return Object.values(answers).filter(v => v !== null && v !== undefined).length;
  }, [answers]);

  // Filter questions based on subject & status filter
  const filteredIndices = useMemo(() => {
    return questions
      .map((_, idx) => idx)
      .filter(idx => {
        // Subject filter
        if (selectedSubject !== 'all') {
          const qSubj = questions[idx].subject || 'General';
          if (qSubj !== selectedSubject) return false;
        }

        // Status filter
        if (statusFilter !== 'all') {
          const isAttempted = answers[idx] !== undefined && answers[idx] !== null;
          if (statusFilter === 'answered') {
            if (!isAttempted) return false;
          } else if (statusFilter === 'marked') {
            if (!marked[idx]) return false;
          } else if (statusFilter === 'unanswered') {
            const status = getQStatus(idx);
            if (status !== 'unanswered') return false;
          } else if (statusFilter === 'not_visited') {
            const status = getQStatus(idx);
            if (status !== 'not_visited') return false;
          }
        }

        return true;
      });
  }, [questions, selectedSubject, statusFilter, marked, answers, instantFeedback, revealedQuestions, currentQ]);

  // Calculate chunks when question list is large and not filtered by specific status
  const isChunkingNeeded = filteredIndices.length > CHUNK_SIZE && statusFilter === 'all';
  const totalChunks = isChunkingNeeded ? Math.ceil(filteredIndices.length / CHUNK_SIZE) : 1;

  // Safe chunk slice
  const displayIndices = useMemo(() => {
    if (!isChunkingNeeded) return filteredIndices;
    const start = activeChunk * CHUNK_SIZE;
    const end = start + CHUNK_SIZE;
    return filteredIndices.slice(start, end);
  }, [filteredIndices, isChunkingNeeded, activeChunk]);

  // Jump to Question handler
  const handleJump = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setJumpError('');
    const targetQNum = parseInt(jumpInput.trim(), 10);
    if (isNaN(targetQNum) || targetQNum < 1 || targetQNum > questions.length) {
      setJumpError(`Enter 1–${questions.length}`);
      return;
    }
    const targetIdx = targetQNum - 1;
    // Switch chunk to contain target
    setActiveChunk(Math.floor(targetIdx / CHUNK_SIZE));
    setStatusFilter('all');
    onSelectQuestion(targetIdx);
    setJumpInput('');
  };

  return (
    <div className={`flex flex-col h-full space-y-3.5 ${className}`}>
      {/* Header Info + Jump To Box */}
      <div className="space-y-2.5 pb-2.5 border-b border-[var(--border-color)]">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-sm sm:text-base font-extrabold text-[var(--text-main)] tracking-tight">
              Question Palette
            </h3>
            <p className="text-[11px] font-semibold text-[var(--text-muted)]">
              {questions.length} questions • Current: <span className="text-indigo-500 font-extrabold">Q{currentQ + 1}</span>
            </p>
          </div>

          {/* Jump to Question Direct Form */}
          <form onSubmit={handleJump} className="flex items-center gap-1.5 shrink-0">
            <div className="relative">
              <input
                type="number"
                min={1}
                max={questions.length}
                value={jumpInput}
                onChange={e => { setJumpInput(e.target.value); setJumpError(''); }}
                placeholder="Q#"
                className="w-14 sm:w-16 px-2 py-1 text-xs font-mono font-bold bg-[var(--bg-subcard)] border border-[var(--border-color)] rounded-xl text-[var(--text-main)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-indigo-500 text-center"
              />
            </div>
            <button
              type="submit"
              className="p-1 px-2 text-xs font-bold bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] hover:opacity-90 rounded-xl transition-all shadow-2xs"
              title="Jump to question"
            >
              Go
            </button>
          </form>
        </div>

        {jumpError && (
          <p className="text-[10px] font-bold text-rose-500">{jumpError}</p>
        )}
      </div>

      {/* Interactive Status Filter Chips */}
      <div className="space-y-1.5 pb-2.5 border-b border-[var(--border-color)]">
        <div className="flex items-center justify-between text-[11px] font-bold text-[var(--text-muted)]">
          <span className="flex items-center gap-1"><Filter size={11} /> Filter by Status</span>
          {statusFilter !== 'all' && (
            <button
              onClick={() => setStatusFilter('all')}
              className="text-[10px] text-indigo-500 font-bold hover:underline"
            >
              Reset
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5 text-xs">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-2.5 py-1 rounded-xl font-bold text-[11px] transition-all flex items-center gap-1.5 ${
              statusFilter === 'all'
                ? 'bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] shadow-xs'
                : 'bg-[var(--bg-subcard)] text-[var(--text-main)] border border-[var(--border-color)] hover:bg-[var(--bg-subcard-hover)]'
            }`}
          >
            <span>All</span>
            <span className="text-[10px] opacity-75 font-mono">({questions.length})</span>
          </button>

          <button
            onClick={() => setStatusFilter('answered')}
            className={`px-2.5 py-1 rounded-xl font-bold text-[11px] transition-all flex items-center gap-1.5 ${
              statusFilter === 'answered'
                ? 'bg-emerald-600 text-white shadow-xs ring-1 ring-emerald-400'
                : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500/20'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
            <span>Attempted</span>
            <span className="text-[10px] font-mono">({attemptedCount})</span>
          </button>

          <button
            onClick={() => setStatusFilter('marked')}
            className={`px-2.5 py-1 rounded-xl font-bold text-[11px] transition-all flex items-center gap-1.5 ${
              statusFilter === 'marked'
                ? 'bg-purple-600 text-white shadow-xs ring-1 ring-purple-400'
                : 'bg-purple-500/10 text-purple-400 border border-purple-500/20 hover:bg-purple-500/20'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-purple-500 shrink-0" />
            <span>Review</span>
            <span className="text-[10px] font-mono">({counts.marked})</span>
          </button>

          <button
            onClick={() => setStatusFilter('unanswered')}
            className={`px-2.5 py-1 rounded-xl font-bold text-[11px] transition-all flex items-center gap-1.5 ${
              statusFilter === 'unanswered'
                ? 'bg-amber-500 text-white shadow-xs ring-1 ring-amber-400'
                : 'bg-amber-500/10 text-amber-500 border border-amber-500/20 hover:bg-amber-500/20'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
            <span>Visited</span>
            <span className="text-[10px] font-mono">({counts.unanswered})</span>
          </button>

          <button
            onClick={() => setStatusFilter('not_visited')}
            className={`px-2.5 py-1 rounded-xl font-bold text-[11px] transition-all flex items-center gap-1.5 ${
              statusFilter === 'not_visited'
                ? 'bg-gray-600 text-white shadow-xs'
                : 'bg-[var(--bg-subcard)] text-[var(--text-muted)] border border-[var(--border-color)] hover:bg-[var(--bg-subcard-hover)]'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-gray-400 shrink-0" />
            <span>Unseen</span>
            <span className="text-[10px] font-mono">({counts.notVisited})</span>
          </button>
        </div>
      </div>

      {/* Subject Tabs (if multi-subject) */}
      {hasMultipleSubjects && (
        <div className="space-y-1">
          <div className="flex gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
            <button
              onClick={() => { setSelectedSubject('all'); setActiveChunk(0); }}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-colors ${
                selectedSubject === 'all'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'bg-[var(--bg-subcard)] text-[var(--text-muted)] hover:text-[var(--text-main)] border border-[var(--border-color)]'
              }`}
            >
              All Sections
            </button>
            {subjects.map(s => {
              const subjCount = questions.filter(q => (q.subject || 'General') === s).length;
              return (
                <button
                  key={s}
                  onClick={() => { setSelectedSubject(s); setActiveChunk(0); }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-colors ${
                    selectedSubject === s
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'bg-[var(--bg-subcard)] text-[var(--text-muted)] hover:text-[var(--text-main)] border border-[var(--border-color)]'
                  }`}
                >
                  {s} ({subjCount})
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Pagination Chunks (Q1-50, Q51-100, etc.) for large question sets */}
      {isChunkingNeeded && (
        <div className="space-y-1.5 pb-2 border-b border-[var(--border-color)]">
          <div className="flex items-center justify-between text-[11px] font-bold text-[var(--text-muted)]">
            <span>Blocks of 50 Questions:</span>
            <span className="text-[10px] font-mono">
              Showing Q{activeChunk * CHUNK_SIZE + 1}–{Math.min((activeChunk + 1) * CHUNK_SIZE, filteredIndices.length)}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {Array.from({ length: totalChunks }).map((_, cIdx) => {
              const startNum = cIdx * CHUNK_SIZE + 1;
              const endNum = Math.min((cIdx + 1) * CHUNK_SIZE, filteredIndices.length);
              const isActive = activeChunk === cIdx;
              const isCurrentQInChunk = currentQ >= (startNum - 1) && currentQ <= (endNum - 1);

              return (
                <button
                  key={cIdx}
                  onClick={() => setActiveChunk(cIdx)}
                  className={`px-2 py-1 rounded-xl text-[11px] font-extrabold transition-all border ${
                    isActive
                      ? 'bg-indigo-500/15 border-indigo-500 text-indigo-400 shadow-2xs ring-1 ring-indigo-500/50'
                      : 'bg-[var(--bg-subcard)] border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
                  } ${isCurrentQInChunk && !isActive ? 'border-amber-400/60 text-amber-400' : ''}`}
                >
                  Q{startNum}–{endNum}
                  {isCurrentQInChunk && <span className="ml-1 w-1.5 h-1.5 rounded-full bg-amber-400 inline-block align-middle" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Questions Grid */}
      <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar min-h-[180px] max-h-[50vh] lg:max-h-[calc(100vh-22rem)]">
        {displayIndices.length === 0 ? (
          <div className="py-8 px-3 text-center text-xs text-[var(--text-muted)] space-y-2">
            <p className="font-semibold">
              {statusFilter === 'answered'
                ? 'No questions attempted yet in this section.'
                : statusFilter === 'marked'
                ? 'No questions marked for review.'
                : 'No questions match the current filter.'}
            </p>
            {statusFilter !== 'all' && (
              <button
                onClick={() => setStatusFilter('all')}
                className="px-3 py-1.5 rounded-xl text-xs font-bold text-indigo-500 hover:text-indigo-400 border border-[var(--border-color)] bg-[var(--bg-subcard)] transition-colors"
              >
                Show All Questions ({questions.length})
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-5 gap-2 sm:gap-2.5">
            {displayIndices.map(idx => {
              const status = getQStatus(idx);
              const isCurrent = idx === currentQ;
              const hasBookmark = false; // Could be extended

              let bgClasses = 'bg-[var(--bg-subcard)] text-[var(--text-main)] border border-[var(--border-color)] hover:bg-[var(--bg-subcard-hover)]';
              if (status === 'correct') {
                bgClasses = 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs ring-1 ring-emerald-400 font-extrabold';
              } else if (status === 'incorrect') {
                bgClasses = 'bg-rose-600 text-white hover:bg-rose-700 shadow-xs ring-1 ring-rose-400 font-extrabold';
              } else if (status === 'answered') {
                bgClasses = 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs font-bold';
              } else if (status === 'marked') {
                bgClasses = 'bg-purple-600 text-white hover:bg-purple-700 shadow-xs font-bold';
              } else if (status === 'unanswered') {
                bgClasses = 'bg-amber-500 text-white hover:bg-amber-600 shadow-xs font-bold';
              }

              return (
                <button
                  key={idx}
                  onClick={() => onSelectQuestion(idx)}
                  className={`relative w-full aspect-square max-w-[46px] mx-auto rounded-xl text-xs flex items-center justify-center transition-all ${bgClasses} ${
                    isCurrent
                      ? 'ring-2 ring-indigo-500 ring-offset-2 ring-offset-[var(--bg-surface)] scale-105 font-black shadow-md z-10'
                      : ''
                  }`}
                  title={`Question ${idx + 1}: ${status.replace('_', ' ')}`}
                >
                  <span>{idx + 1}</span>

                  {/* Micro indicator badge for marked for review when answered */}
                  {marked[idx] && answers[idx] !== undefined && answers[idx] !== null && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-1 ring-white" />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Summary Footer */}
      <div className="pt-2 border-t border-[var(--border-color)] flex items-center justify-between text-[11px] font-bold text-[var(--text-muted)]">
        <span>Showing {displayIndices.length} of {filteredIndices.length}</span>
        <span className="text-emerald-500 font-mono font-extrabold">{counts.answered} done</span>
      </div>
    </div>
  );
}
