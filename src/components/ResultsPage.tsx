import { useState, useEffect, useMemo } from 'react';
import { Attempt, AttemptQuestion, Paper, QuestionJSON } from '../types';
import { getAttempts, getAttemptQuestions, getPaperById, saveNote } from '../services/database';
import { calculateSubjectPerformance, calculateTopicPerformance, formatTime, getAccuracyColor } from '../utils/grader';
import {
  Trophy,
  Target,
  Clock,
  CheckCircle,
  XCircle,
  MinusCircle,
  BarChart3,
  TrendingUp,
  Lightbulb,
  Zap,
  BookOpen,
  ArrowLeft,
  RotateCcw,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileText,
  Check,
  Sparkles,
  Filter,
} from 'lucide-react';

interface ResultsPageProps {
  attemptId: string;
  paper?: Paper | null;
  userId?: string;
  onRetake: () => void;
  onBack: () => void;
  onPractice: (subject: string, topic: string) => void;
}

export default function ResultsPage({
  attemptId,
  paper: initialPaper,
  userId,
  onRetake,
  onBack,
  onPractice,
}: ResultsPageProps) {
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [attemptQs, setAttemptQs] = useState<AttemptQuestion[]>([]);
  const [paper, setPaper] = useState<Paper | null>(initialPaper || null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // View Mode: 'sheet' = vertical list, 'preview' = interactive question walkthrough
  const [viewMode, setViewMode] = useState<'sheet' | 'preview'>('sheet');
  const [previewIdx, setPreviewIdx] = useState<number>(0);
  const [previewFilter, setPreviewFilter] = useState<'all' | 'incorrect'>('all');

  // Sheet filters & toggles
  const [showDetail, setShowDetail] = useState(true);
  const [filter, setFilter] = useState<'all' | 'correct' | 'incorrect' | 'unattempted'>('all');
  const [expandedQs, setExpandedQs] = useState<Record<number, boolean>>({});
  const [expandAll, setExpandAll] = useState(false);

  // Note saving feedback
  const [savedNoteIds, setSavedNoteIds] = useState<Record<string | number, boolean>>({});
  const [savingNoteId, setSavingNoteId] = useState<string | number | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      setIsLoading(true);
      setLoadError(null);

      try {
        let attempts = await getAttempts(userId);
        let a = attempts.find(at => at.id === attemptId);

        // Fallback search in guest/local attempts if user session shifted
        if (!a && userId && userId !== 'guest') {
          const guestAttempts = await getAttempts('guest');
          a = guestAttempts.find(at => at.id === attemptId);
        }

        if (!a) {
          if (isMounted) {
            setLoadError('Test attempt could not be located in your local session.');
            setIsLoading(false);
          }
          return;
        }

        if (isMounted) setAttempt(a);

        // Resolve paper details
        let p = (initialPaper && initialPaper.id === a.paper_id) ? initialPaper : null;
        if (!p) p = await getPaperById(a.paper_id);
        if (!p && initialPaper) p = initialPaper;

        if (p && isMounted) {
          setPaper(p);
        } else if (!p) {
          if (isMounted) {
            setLoadError('Paper details could not be found for this attempt.');
            setIsLoading(false);
          }
          return;
        }

        let qs = await getAttemptQuestions(a.id);
        const questionsList = p.raw_json?.questions || [];

        // Synthesize fallback attempt questions if database return was empty
        if ((!qs || qs.length === 0) && questionsList.length > 0) {
          qs = questionsList.map((q, idx) => ({
            id: `fallback_${idx}`,
            attempt_id: a.id,
            question_id: q.id,
            question_index: idx,
            selected_answer: null,
            is_correct: null,
            time_spent_seconds: 0,
            marked_for_review: false,
            is_answered: false,
          }));
        }

        if (isMounted) {
          setAttemptQs(qs);

          // Auto-expand all incorrect questions so user immediately sees why they were wrong!
          const autoExpanded: Record<number, boolean> = {};
          qs.forEach((aq, idx) => {
            if (aq.is_correct === false) {
              autoExpanded[idx] = true;
            }
          });
          setExpandedQs(autoExpanded);
          setIsLoading(false);
        }
      } catch (err) {
        console.error('[ResultsPage] Error loading results:', err);
        if (isMounted) {
          setLoadError('An unexpected error occurred while loading exam results.');
          setIsLoading(false);
        }
      }
    }

    load();
    return () => {
      isMounted = false;
    };
  }, [attemptId, initialPaper, userId]);

  // Handler to export a question & solution directly into Study Notes
  const handleSaveToStudyNotes = async (q: QuestionJSON, aq: AttemptQuestion) => {
    try {
      setSavingNoteId(q.id);
      const isCorrect = aq.is_correct === true;
      const isIncorrect = aq.is_correct === false;
      const userSelectedText = aq.selected_answer !== null && aq.selected_answer !== undefined && q.options[aq.selected_answer]
        ? `${String.fromCharCode(65 + aq.selected_answer)}. ${q.options[aq.selected_answer]}`
        : 'Not Attempted';
      const correctText = `${String.fromCharCode(65 + q.answerIndex)}. ${q.options[q.answerIndex] || q.correctAnswer}`;

      const noteMarkdown = `# ${q.subject} — ${q.topic} (Q.${q.id})

> 📌 **Exam Review Note**: ${isIncorrect ? '⚠️ Revision Required (Answered Incorrectly)' : isCorrect ? '✅ Solved correctly' : '⚪ Skipped during test'}
> **Your Marked Choice**: ${userSelectedText}
> **Correct Answer**: ${correctText}

---

### Question
${q.question}

### Options
${q.options.map((opt, i) => `${String.fromCharCode(65 + i)}. ${opt} ${i === q.answerIndex ? '**(Correct Answer)**' : ''}${i === aq.selected_answer && isIncorrect ? '*(Your Selection — Incorrect)*' : ''}`).join('\n')}

---

## 📖 Step-by-Step Solution & Concept
${q.solution || 'No detailed solution provided in paper.'}

${q.hint ? `### 💡 Helpful Hint\n${q.hint}\n` : ''}
${q.shortcut ? `### ⚡ Speed Technique / Shortcut\n${q.shortcut}\n` : ''}
${q.learningSuggestion ? `### 🎯 Concept Takeaway & Key Rule\n${q.learningSuggestion}\n` : ''}
`;

      await saveNote({
        user_id: userId || 'guest',
        title: `${isIncorrect ? 'Mistake Review' : 'Key Question'}: ${q.topic || q.subject} (Q.${q.id})`,
        content: noteMarkdown,
        file_type: 'md',
        subject: q.subject,
        topic: q.topic,
        tags: ['Exam Review', q.subject || 'General', isIncorrect ? 'Mistake' : 'Formula'],
        is_pinned: isIncorrect,
        emoji: isIncorrect ? '📕' : '📗',
        font_style: 'serif',
      });

      setSavedNoteIds(prev => ({ ...prev, [q.id]: true }));
    } catch (err) {
      console.error('Failed to save to study notes:', err);
      alert('Could not save note to Study Notes.');
    } finally {
      setSavingNoteId(null);
    }
  };

  // Questions from paper
  const questions = useMemo(() => paper?.raw_json?.questions || [], [paper]);
  const subjectPerf = useMemo(() => calculateSubjectPerformance(questions, attemptQs), [questions, attemptQs]);
  const topicPerf = useMemo(() => calculateTopicPerformance(questions, attemptQs), [questions, attemptQs]);

  // Preview Mode List (supports 'all' vs 'incorrect')
  const previewList = useMemo(() => {
    return attemptQs
      .map((aq, idx) => ({ aq, originalIdx: idx, q: questions[idx] }))
      .filter(item => {
        if (!item.q) return false;
        if (previewFilter === 'incorrect') return item.aq.is_correct === false;
        return true;
      });
  }, [attemptQs, questions, previewFilter]);

  // Loading Skeleton State
  if (isLoading && (!attempt || !paper)) {
    return (
      <div className="max-w-md mx-auto text-center py-20 px-4 space-y-4 animate-fadeIn">
        <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mx-auto animate-pulse">
          <Trophy size={28} />
        </div>
        <h3 className="text-base font-extrabold text-[var(--text-main)]">Calculating Score & Analysis...</h3>
        <p className="text-xs text-[var(--text-muted)]">Grading your responses and preparing performance breakdown</p>
        <button
          onClick={onBack}
          className="btn btn-outline text-xs py-2 px-4 rounded-xl mt-4"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  // Error / Not Found State
  if (loadError || !attempt || !paper) {
    return (
      <div className="max-w-md mx-auto text-center py-20 px-4 space-y-4 animate-fadeIn">
        <div className="w-14 h-14 rounded-2xl bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto">
          <AlertTriangle size={28} />
        </div>
        <h3 className="text-base font-extrabold text-[var(--text-main)]">Unable to Load Exam Results</h3>
        <p className="text-xs text-[var(--text-muted)]">
          {loadError || 'The test results could not be found.'}
        </p>
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            onClick={onRetake}
            className="btn btn-primary text-xs py-2 px-4 rounded-xl font-bold shadow-xs flex items-center gap-1.5"
          >
            <RotateCcw size={14} /> Retake Test
          </button>
          <button
            onClick={onBack}
            className="btn btn-outline text-xs py-2 px-4 rounded-xl font-bold"
          >
            Back to Library
          </button>
        </div>
      </div>
    );
  }

  const pct = Math.round((attempt.score / (attempt.total_marks || 1)) * 100);

  // ============================================================
  // RENDER: INTERACTIVE QUESTION WALKTHROUGH PREVIEW
  // ============================================================
  if (viewMode === 'preview') {
    const activeItem = previewList[previewIdx] || previewList[0];
    const totalPreview = previewList.length;

    return (
      <div className="max-w-4xl mx-auto space-y-5 animate-fadeIn pb-16 font-sans text-[var(--text-main)]">
        {/* Top Walkthrough Navigation Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-3xl shadow-soft">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('sheet')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-subcard)] hover:bg-[var(--bg-subcard-hover)] text-xs font-bold transition-all cursor-pointer"
            >
              <ArrowLeft size={14} /> Back to Score Sheet
            </button>
            <span className="text-xs font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-3 py-1 rounded-full">
              Test Walkthrough & Review
            </span>
          </div>

          {/* Filter in Walkthrough */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--text-muted)] font-semibold">Filter:</span>
            <button
              onClick={() => { setPreviewFilter('all'); setPreviewIdx(0); }}
              className={`text-xs px-3 py-1 rounded-full font-bold transition-all ${
                previewFilter === 'all'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-[var(--bg-subcard)] text-[var(--text-muted)] border border-[var(--border-color)]'
              }`}
            >
              All ({attemptQs.length})
            </button>
            <button
              onClick={() => { setPreviewFilter('incorrect'); setPreviewIdx(0); }}
              className={`text-xs px-3 py-1 rounded-full font-bold transition-all flex items-center gap-1 ${
                previewFilter === 'incorrect'
                  ? 'bg-rose-600 text-white'
                  : 'bg-[var(--bg-subcard)] text-[var(--text-muted)] border border-[var(--border-color)]'
              }`}
            >
              <XCircle size={12} /> Mistakes Only ({attempt.incorrect_count})
            </button>
          </div>
        </div>

        {/* Question Palette Carousel */}
        <div className="p-4 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-3xl shadow-soft space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-[var(--text-muted)] px-1">
            <span>Question Palette ({previewFilter === 'incorrect' ? 'Mistakes Only' : 'All'})</span>
            <span>
              {previewIdx + 1} of {totalPreview}
            </span>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto py-2 px-1 hide-scrollbar">
            {previewList.map((item, pIndex) => {
              const isSelected = pIndex === previewIdx;
              const isCorrect = item.aq.is_correct === true;
              const isIncorrect = item.aq.is_correct === false;

              let btnStyle = 'bg-[var(--bg-subcard)] text-[var(--text-muted)] border-[var(--border-color)]';
              if (isCorrect) {
                btnStyle = 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40';
              } else if (isIncorrect) {
                btnStyle = 'bg-rose-500/15 text-rose-400 border-rose-500/40';
              }

              return (
                <button
                  key={item.originalIdx}
                  onClick={() => setPreviewIdx(pIndex)}
                  className={`w-9 h-9 rounded-xl font-black text-xs shrink-0 flex items-center justify-center border transition-all cursor-pointer ${btnStyle} ${
                    isSelected ? 'ring-2 ring-indigo-500 ring-offset-2 scale-105 shadow-md' : 'hover:opacity-80'
                  }`}
                  title={`Question ${item.originalIdx + 1}: ${isCorrect ? 'Correct' : isIncorrect ? 'Incorrect' : 'Skipped'}`}
                >
                  {item.originalIdx + 1}
                </button>
              );
            })}
          </div>
        </div>

        {/* Active Question Display Card */}
        {activeItem && activeItem.q ? (
          <div className="bento-card p-6 sm:p-8 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-3xl shadow-soft space-y-6">
            {/* Header: Number, Subject, Topic, Marks & Time */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[var(--border-color)]">
              <div className="flex items-center gap-3">
                <span className="w-9 h-9 rounded-2xl bg-[var(--bg-subcard)] border border-[var(--border-color)] text-sm font-black flex items-center justify-center shrink-0">
                  {activeItem.originalIdx + 1}
                </span>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-0.5 rounded-full">
                      {activeItem.q.subject}
                    </span>
                    {activeItem.q.topic && (
                      <span className="text-xs font-semibold text-[var(--text-muted)]">
                        • {activeItem.q.topic}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] font-mono text-[var(--text-muted)] mt-1 flex items-center gap-1.5 font-semibold">
                    <Clock size={12} /> Time spent: {formatTime(activeItem.aq.time_spent_seconds)}
                  </div>
                </div>
              </div>

              {/* Status Badge */}
              <div className="flex items-center gap-2">
                {activeItem.aq.is_correct === true && (
                  <span className="flex items-center gap-1.5 text-xs font-black text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-3.5 py-1.5 rounded-full">
                    <CheckCircle size={15} /> Correct (+{activeItem.q.marks || 2} Marks)
                  </span>
                )}
                {activeItem.aq.is_correct === false && (
                  <span className="flex items-center gap-1.5 text-xs font-black text-rose-400 bg-rose-500/15 border border-rose-500/30 px-3.5 py-1.5 rounded-full">
                    <XCircle size={15} /> Incorrect (-{activeItem.q.negativeMarks || 0.5} Marks)
                  </span>
                )}
                {activeItem.aq.is_correct === null && (
                  <span className="flex items-center gap-1.5 text-xs font-black text-[var(--text-muted)] bg-[var(--bg-subcard)] border border-[var(--border-color)] px-3.5 py-1.5 rounded-full">
                    <MinusCircle size={15} /> Unattempted / Skipped (0 Marks)
                  </span>
                )}
              </div>
            </div>

            {/* Question Text */}
            <div className="text-base sm:text-lg font-extrabold text-[var(--text-main)] leading-relaxed">
              {activeItem.q.question}
            </div>

            {/* Options Breakdown */}
            <div className="space-y-3">
              <div className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                Options Breakdown & Your Selection:
              </div>
              <div className="grid grid-cols-1 gap-2.5">
                {activeItem.q.options.map((opt, optIdx) => {
                  const isUserAnswer = activeItem.aq.selected_answer === optIdx;
                  const isCorrect = optIdx === activeItem.q.answerIndex;

                  let cardClasses = 'bg-[var(--bg-subcard)] border-[var(--border-color)] text-[var(--text-main)]';
                  let badgeClasses = 'bg-[var(--bg-surface)] text-[var(--text-muted)]';

                  if (isCorrect) {
                    cardClasses = 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300 font-bold shadow-xs';
                    badgeClasses = 'bg-emerald-600 text-white font-black';
                  } else if (isUserAnswer && !isCorrect) {
                    cardClasses = 'bg-rose-500/15 border-rose-500/50 text-rose-300 font-bold shadow-xs';
                    badgeClasses = 'bg-rose-600 text-white font-black';
                  }

                  return (
                    <div
                      key={optIdx}
                      className={`p-4 rounded-2xl border flex items-center justify-between gap-3 text-sm transition-all ${cardClasses}`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={`w-7 h-7 rounded-xl text-xs flex items-center justify-center shrink-0 ${badgeClasses}`}>
                          {String.fromCharCode(65 + optIdx)}
                        </span>
                        <span className="font-medium leading-snug">{opt}</span>
                      </div>

                      <div className="shrink-0 flex items-center gap-2">
                        {isCorrect && (
                          <span className="text-[11px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-500/20 px-3 py-1 rounded-full flex items-center gap-1 border border-emerald-500/30">
                            <CheckCircle size={12} /> Correct Answer
                          </span>
                        )}
                        {isUserAnswer && !isCorrect && (
                          <span className="text-[11px] font-black uppercase tracking-wider text-rose-400 bg-rose-500/20 px-3 py-1 rounded-full flex items-center gap-1 border border-rose-500/30">
                            <XCircle size={12} /> Your Choice (Wrong)
                          </span>
                        )}
                        {isUserAnswer && isCorrect && (
                          <span className="text-[11px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-500/20 px-3 py-1 rounded-full flex items-center gap-1 border border-emerald-500/30">
                            <CheckCircle size={12} /> Your Answer
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Step-by-Step Solution & Revision Notes */}
            <div className="space-y-4 pt-4 border-t border-[var(--border-color)]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-indigo-400">
                  <BookOpen size={16} />
                  <span>Comprehensive Solution & Revision Notes</span>
                </div>

                {/* Save to Study Notes Button */}
                <button
                  onClick={() => handleSaveToStudyNotes(activeItem.q, activeItem.aq)}
                  disabled={savingNoteId === activeItem.q.id || savedNoteIds[activeItem.q.id]}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    savedNoteIds[activeItem.q.id]
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs active:scale-95'
                  }`}
                >
                  {savedNoteIds[activeItem.q.id] ? (
                    <>
                      <Check size={13} />
                      <span>Saved to Study Notes!</span>
                    </>
                  ) : (
                    <>
                      <FileText size={13} />
                      <span>{savingNoteId === activeItem.q.id ? 'Saving...' : 'Save to Study Notes'}</span>
                    </>
                  )}
                </button>
              </div>

              {/* Solution Card */}
              {activeItem.q.solution && (
                <div className="p-4 sm:p-5 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 text-[var(--text-main)] space-y-1.5">
                  <p className="font-black text-xs uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle size={14} className="text-emerald-400" /> Step-by-Step Explanation
                  </p>
                  <p className="text-xs sm:text-sm font-medium whitespace-pre-wrap leading-relaxed">
                    {activeItem.q.solution}
                  </p>
                </div>
              )}

              {/* Concept Takeaway / Note */}
              {activeItem.q.learningSuggestion && (
                <div className="p-4 bg-amber-500/10 rounded-2xl border border-amber-500/20 text-[var(--text-main)] space-y-1">
                  <p className="font-black text-xs uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                    <Target size={14} /> Core Concept & Revision Takeaway
                  </p>
                  <p className="text-xs sm:text-sm font-medium leading-relaxed">
                    {activeItem.q.learningSuggestion}
                  </p>
                </div>
              )}

              {/* Hint & Shortcut */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {activeItem.q.shortcut && (
                  <div className="p-3.5 bg-purple-500/10 rounded-2xl border border-purple-500/20 text-[var(--text-main)] space-y-1">
                    <p className="font-black text-xs uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
                      <Zap size={14} className="text-purple-400" /> Exam Speed Shortcut
                    </p>
                    <p className="text-xs font-medium leading-relaxed">{activeItem.q.shortcut}</p>
                  </div>
                )}
                {activeItem.q.hint && (
                  <div className="p-3.5 bg-blue-500/10 rounded-2xl border border-blue-500/20 text-[var(--text-main)] space-y-1">
                    <p className="font-black text-xs uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                      <Lightbulb size={14} /> Key Rule Hint
                    </p>
                    <p className="text-xs font-medium leading-relaxed">{activeItem.q.hint}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Walkthrough Nav Buttons */}
            <div className="flex items-center justify-between pt-6 border-t border-[var(--border-color)]">
              <button
                disabled={previewIdx <= 0}
                onClick={() => setPreviewIdx(prev => Math.max(0, prev - 1))}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-subcard)] hover:bg-[var(--bg-subcard-hover)] text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
              >
                <ChevronLeft size={16} /> Previous Question
              </button>

              <button
                onClick={() => setViewMode('sheet')}
                className="text-xs font-bold text-indigo-400 hover:underline"
              >
                View Full Score Sheet
              </button>

              <button
                disabled={previewIdx >= totalPreview - 1}
                onClick={() => setPreviewIdx(prev => Math.min(totalPreview - 1, prev + 1))}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
              >
                Next Question <ChevronRight size={16} />
              </button>
            </div>
          </div>
        ) : (
          <div className="p-10 text-center bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-3xl">
            <p className="text-sm text-[var(--text-muted)] font-medium">No questions matched the filter.</p>
          </div>
        )}
      </div>
    );
  }

  // ============================================================
  // RENDER: FULL SCORE & SOLUTION SHEET (DEFAULT VIEW)
  // ============================================================
  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fadeIn pb-12 font-sans text-[var(--text-main)]">
      {/* Top Bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] hover:bg-[var(--bg-subcard)] text-[var(--text-main)] text-xs font-bold shadow-xs transition-all cursor-pointer"
        >
          <ArrowLeft size={15} /> Back to Library
        </button>
        <span className="text-xs font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-3 py-1 rounded-full">
          SSC CGL Grader 2.0
        </span>
      </div>

      {/* Header Banner */}
      <div className="text-center py-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-[var(--bg-surface)] border border-[var(--border-color)] text-white shadow-soft mb-3 transform hover:scale-105 transition-transform">
          <Trophy size={30} className="text-amber-400" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--text-main)] tracking-tight mb-1">
          Exam Completed!
        </h1>
        <p className="text-sm text-[var(--text-muted)] font-medium">
          {attempt.paper_title}
        </p>
      </div>

      {/* View Switcher / Quick Action Banner */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl shadow-xs">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setViewMode('sheet')}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'sheet'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-subcard)]'
            }`}
          >
            <BookOpen size={15} />
            <span>Complete Solution Sheet</span>
          </button>
          <button
            onClick={() => {
              setViewMode('preview');
              const firstMistake = attemptQs.findIndex(aq => aq.is_correct === false);
              if (firstMistake >= 0) setPreviewIdx(firstMistake);
            }}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-subcard)] transition-all cursor-pointer"
          >
            <Eye size={15} />
            <span>Interactive Test Walkthrough</span>
            <span className="text-[10px] bg-indigo-500/15 text-indigo-400 border border-indigo-500/20 px-1.5 py-0.2 rounded-full font-black">
              1-by-1
            </span>
          </button>
        </div>

        {attempt.incorrect_count > 0 && (
          <button
            onClick={() => {
              setFilter('incorrect');
              setShowDetail(true);
              const allInc: Record<number, boolean> = {};
              attemptQs.forEach((aq, idx) => {
                if (aq.is_correct === false) allInc[idx] = true;
              });
              setExpandedQs(allInc);
            }}
            className="flex items-center justify-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-xl bg-rose-500/15 text-rose-400 border border-rose-500/30 hover:bg-rose-500/25 transition-colors cursor-pointer"
          >
            <XCircle size={14} />
            <span>Review {attempt.incorrect_count} Mistakes with Solutions</span>
          </button>
        )}
      </div>

      {/* Primary Score Bento Card */}
      <div className="bento-card p-6 sm:p-8 shadow-soft border border-[var(--border-color)] bg-[var(--bg-surface)] rounded-3xl">
        <div className="text-center mb-6">
          <div className={`text-5xl sm:text-6xl font-black tracking-tight mb-1 ${getAccuracyColor(pct)}`}>
            {attempt.score} <span className="text-2xl sm:text-3xl font-semibold text-[var(--text-muted)] opacity-60">/ {attempt.total_marks}</span>
          </div>
          <div className="flex items-center justify-center gap-2 mt-2">
            <span className={`text-xs font-bold px-3 py-1 rounded-full border ${
              pct >= 70
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : pct >= 40
                ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
            }`}>
              {pct}% Score
            </span>
            <span className="text-xs font-bold text-[var(--text-main)] bg-[var(--bg-subcard)] px-3 py-1 rounded-full border border-[var(--border-color)]">
              Accuracy: {attempt.accuracy}%
            </span>
          </div>
        </div>

        {/* 4 Quick Stat Tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <div className="text-center p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl">
            <CheckCircle size={20} className="mx-auto text-emerald-400 mb-1.5" />
            <div className="text-2xl font-black text-emerald-400">{attempt.correct_count}</div>
            <div className="text-xs font-bold text-emerald-300">Correct</div>
          </div>
          <div className="text-center p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl">
            <XCircle size={20} className="mx-auto text-rose-400 mb-1.5" />
            <div className="text-2xl font-black text-rose-400">{attempt.incorrect_count}</div>
            <div className="text-xs font-bold text-rose-300">Incorrect</div>
          </div>
          <div className="text-center p-4 bg-[var(--bg-subcard)] border border-[var(--border-color)] rounded-2xl">
            <MinusCircle size={20} className="mx-auto text-[var(--text-muted)] mb-1.5" />
            <div className="text-2xl font-black text-[var(--text-main)]">{attempt.unanswered_count}</div>
            <div className="text-xs font-bold text-[var(--text-muted)]">Unanswered</div>
          </div>
          <div className="text-center p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl">
            <Clock size={20} className="mx-auto text-indigo-400 mb-1.5" />
            <div className="text-2xl font-black text-indigo-400">{formatTime(attempt.time_spent_seconds)}</div>
            <div className="text-xs font-bold text-indigo-300">Time Spent</div>
          </div>
        </div>
      </div>

      {/* Interactive Walkthrough Banner Card */}
      <div className="p-5 sm:p-6 bg-gradient-to-r from-indigo-900/30 via-purple-900/20 to-indigo-900/30 border border-indigo-500/30 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-indigo-300 font-extrabold text-sm sm:text-base">
            <Sparkles size={18} className="text-indigo-400" />
            <span>Interactive Test & Answer Walkthrough</span>
          </div>
          <p className="text-xs text-[var(--text-muted)] font-medium max-w-xl">
            Step through your test question-by-question with the color-coded question palette. Compare your choices against correct answers, view step-by-step proofs, and save notes in 1-click.
          </p>
        </div>
        <button
          onClick={() => {
            setViewMode('preview');
            setPreviewFilter('all');
            setPreviewIdx(0);
          }}
          className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl text-xs flex items-center justify-center gap-2 shadow-xs shrink-0 active:scale-95 transition-all cursor-pointer"
        >
          <Eye size={15} /> Launch Walkthrough
        </button>
      </div>

      {/* Performance by Subject */}
      {subjectPerf.length > 1 && (
        <div className="bento-card p-6 shadow-soft border border-[var(--border-color)] bg-[var(--bg-surface)] rounded-3xl">
          <h2 className="text-base font-extrabold text-[var(--text-main)] mb-4 flex items-center gap-2">
            <BarChart3 size={18} className="text-indigo-400" /> Performance by Subject
          </h2>
          <div className="space-y-4">
            {subjectPerf.map(sp => (
              <div key={sp.subject} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs sm:text-sm font-bold">
                  <span className="text-[var(--text-main)]">{sp.subject}</span>
                  <span className={getAccuracyColor(sp.accuracy)}>{sp.accuracy}% ({sp.correct}/{sp.total})</span>
                </div>
                <div className="w-full h-2.5 bg-[var(--bg-subcard)] rounded-full overflow-hidden border border-[var(--border-color)]">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      sp.accuracy >= 70 ? 'bg-emerald-500' : sp.accuracy >= 40 ? 'bg-amber-500' : 'bg-rose-500'
                    }`}
                    style={{ width: `${sp.accuracy}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Performance by Topic */}
      {topicPerf.length > 0 && (
        <div className="bento-card p-6 shadow-soft border border-[var(--border-color)] bg-[var(--bg-surface)] rounded-3xl">
          <h2 className="text-base font-extrabold text-[var(--text-main)] mb-4 flex items-center gap-2">
            <TrendingUp size={18} className="text-indigo-400" /> Performance by Topic
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {topicPerf.sort((a, b) => a.accuracy - b.accuracy).map(tp => (
              <div
                key={tp.topic}
                className="p-4 bg-[var(--bg-subcard)] border border-[var(--border-color)] rounded-2xl flex flex-col justify-between gap-3 shadow-xs"
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs sm:text-sm font-extrabold text-[var(--text-main)] truncate">{tp.topic}</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
                      tp.accuracy >= 70
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : tp.accuracy >= 40
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                    }`}>
                      {tp.accuracy}%
                    </span>
                  </div>
                  <p className="text-[11px] text-[var(--text-muted)] font-medium">
                    {tp.subject} • {tp.correct}/{tp.total} correct • Avg {tp.avgTime}s
                  </p>
                </div>
                {tp.accuracy < 60 && (
                  <button
                    onClick={() => onPractice(tp.subject, tp.topic)}
                    className="self-start text-[11px] font-bold px-3 py-1.5 bg-indigo-500/15 text-indigo-400 rounded-xl hover:bg-indigo-500/25 transition-colors border border-indigo-500/30 cursor-pointer"
                  >
                    Practice this topic →
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Question-by-Question Detailed Review */}
      <div className="bento-card p-6 sm:p-7 shadow-soft border border-[var(--border-color)] bg-[var(--bg-surface)] rounded-3xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-4 border-b border-[var(--border-color)]">
          <div>
            <h2 className="text-lg font-extrabold text-[var(--text-main)] flex items-center gap-2">
              <BookOpen size={20} className="text-indigo-400" /> Question-by-Question Review & Solutions
            </h2>
            <p className="text-xs text-[var(--text-muted)] font-semibold mt-0.5">
              Review all questions with correct answers, your marked options, and full step-by-step solutions
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const next = !expandAll;
                setExpandAll(next);
                if (next) {
                  const all: Record<number, boolean> = {};
                  attemptQs.forEach((_, idx) => {
                    all[idx] = true;
                  });
                  setExpandedQs(all);
                } else {
                  setExpandedQs({});
                }
              }}
              className="btn btn-outline text-xs py-1.5 px-3 rounded-full cursor-pointer"
            >
              {expandAll ? 'Collapse All Solutions' : 'Expand All Solutions'}
            </button>
            <button
              onClick={() => setShowDetail(!showDetail)}
              className="text-xs font-bold text-indigo-400 hover:underline px-2 py-1 cursor-pointer"
            >
              {showDetail ? 'Hide Section' : 'Show Section'}
            </button>
          </div>
        </div>

        {/* Filter Tabs */}
        {showDetail && (
          <div className="flex flex-wrap items-center gap-2 mb-5">
            {[
              { id: 'all' as const, label: 'All Questions', count: attemptQs.length },
              { id: 'correct' as const, label: 'Correct', count: attempt.correct_count },
              { id: 'incorrect' as const, label: 'Incorrect (Mistakes)', count: attempt.incorrect_count },
              { id: 'unattempted' as const, label: 'Unattempted', count: attempt.unanswered_count },
            ].map(tab => {
              const isActive = filter === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setFilter(tab.id)}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold border transition-all cursor-pointer ${
                    isActive
                      ? tab.id === 'incorrect'
                        ? 'bg-rose-600 text-white border-rose-700 shadow-2xs'
                        : 'bg-indigo-600 text-white border-indigo-700 shadow-2xs'
                      : 'bg-[var(--bg-subcard)] text-[var(--text-muted)] border-[var(--border-color)] hover:text-[var(--text-main)]'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className={`px-2 py-0.2 rounded-full text-[10px] font-black ${
                    isActive ? 'bg-white/20 text-white' : 'bg-[var(--bg-surface)] text-[var(--text-muted)]'
                  }`}>
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Questions List */}
        {showDetail && (
          <div className="space-y-4">
            {attemptQs
              .map((aq, idx) => ({ aq, originalIdx: idx }))
              .filter(({ aq }) => {
                if (filter === 'correct') return aq.is_correct === true;
                if (filter === 'incorrect') return aq.is_correct === false;
                if (filter === 'unattempted') return aq.is_correct === null || !aq.is_answered;
                return true;
              })
              .map(({ aq, originalIdx }) => {
                const q = questions[originalIdx];
                if (!q) return null;
                const isExpanded = expandedQs[originalIdx] ?? (aq.is_correct === false);

                return (
                  <div
                    key={originalIdx}
                    className={`rounded-2xl border bg-[var(--bg-surface)] overflow-hidden shadow-xs transition-colors ${
                      aq.is_correct === false
                        ? 'border-rose-500/30 hover:border-rose-500/50'
                        : 'border-[var(--border-color)] hover:border-indigo-500/30'
                    }`}
                  >
                    {/* Question Header Card */}
                    <div className="p-4 sm:p-5">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-3">
                        <div className="flex items-start gap-3 min-w-0">
                          <span className={`flex items-center justify-center w-7 h-7 rounded-xl text-xs font-black shrink-0 border ${
                            aq.is_correct === false
                              ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                              : aq.is_correct === true
                              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                              : 'bg-[var(--bg-subcard)] text-[var(--text-muted)] border-[var(--border-color)]'
                          }`}>
                            {originalIdx + 1}
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm sm:text-base text-[var(--text-main)] font-extrabold leading-snug">
                              {q.question}
                            </p>
                            <div className="flex flex-wrap items-center gap-2 mt-1.5">
                              <span className="text-[11px] font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-0.5 rounded-full">
                                {q.subject}
                              </span>
                              {q.topic && (
                                <span className="text-[11px] font-medium text-[var(--text-muted)]">
                                  • {q.topic}
                                </span>
                              )}
                              <span className="text-[11px] font-mono text-[var(--text-muted)] font-semibold flex items-center gap-1">
                                <Clock size={11} /> {formatTime(aq.time_spent_seconds)}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Marks & Status Tag */}
                        <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
                          {aq.is_correct === true && (
                            <span className="flex items-center gap-1 text-xs font-extrabold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-1 rounded-full">
                              <CheckCircle size={14} className="text-emerald-400" /> +{q.marks || 2} Marks
                            </span>
                          )}
                          {aq.is_correct === false && (
                            <span className="flex items-center gap-1 text-xs font-extrabold text-rose-400 bg-rose-500/15 border border-rose-500/30 px-2.5 py-1 rounded-full">
                              <XCircle size={14} className="text-rose-400" /> -{q.negativeMarks || 0.5} Marks
                            </span>
                          )}
                          {(aq.is_correct === null || !aq.is_answered) && (
                            <span className="flex items-center gap-1 text-xs font-extrabold text-[var(--text-muted)] bg-[var(--bg-subcard)] border border-[var(--border-color)] px-2.5 py-1 rounded-full">
                              <MinusCircle size={14} /> Skipped (0 Marks)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* All Options Breakdown */}
                    <div className="px-4 sm:px-5 pb-4 space-y-2">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-[var(--border-color)]">
                        {q.options.map((opt, optIdx) => {
                          const isUserAnswer = aq.selected_answer === optIdx;
                          const isCorrect = optIdx === q.answerIndex;

                          let cardClasses = 'bg-[var(--bg-subcard)] border-[var(--border-color)] text-[var(--text-main)]';
                          let badgeClasses = 'bg-[var(--bg-surface)] text-[var(--text-muted)]';

                          if (isCorrect) {
                            cardClasses = 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 font-bold shadow-xs';
                            badgeClasses = 'bg-emerald-600 text-white font-black';
                          } else if (isUserAnswer && !isCorrect) {
                            cardClasses = 'bg-rose-500/15 border-rose-500/40 text-rose-300 font-bold shadow-xs';
                            badgeClasses = 'bg-rose-600 text-white font-black';
                          }

                          return (
                            <div
                              key={optIdx}
                              className={`p-3 rounded-xl border flex items-center justify-between gap-2.5 text-xs sm:text-sm ${cardClasses}`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span className={`w-6 h-6 rounded-lg text-xs flex items-center justify-center shrink-0 ${badgeClasses}`}>
                                  {String.fromCharCode(65 + optIdx)}
                                </span>
                                <span className="leading-snug">{opt}</span>
                              </div>

                              <div className="shrink-0">
                                {isCorrect && (
                                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                                    <CheckCircle size={11} /> Correct
                                  </span>
                                )}
                                {isUserAnswer && !isCorrect && (
                                  <span className="text-[10px] font-black uppercase tracking-wider text-rose-400 bg-rose-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                                    <XCircle size={11} /> Your Choice
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Toggle Solution details and Save to Notes */}
                      <div className="pt-2 flex flex-wrap items-center justify-between gap-2">
                        {/* Save to Study Notes Button */}
                        <button
                          onClick={() => handleSaveToStudyNotes(q, aq)}
                          disabled={savingNoteId === q.id || savedNoteIds[q.id]}
                          className={`text-xs font-bold flex items-center gap-1 px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                            savedNoteIds[q.id]
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                              : 'bg-[var(--bg-subcard)] text-[var(--text-muted)] border-[var(--border-color)] hover:text-indigo-400'
                          }`}
                        >
                          {savedNoteIds[q.id] ? (
                            <>
                              <Check size={12} className="text-emerald-400" />
                              <span>Saved to Notes</span>
                            </>
                          ) : (
                            <>
                              <FileText size={12} />
                              <span>Save to Study Notes</span>
                            </>
                          )}
                        </button>

                        <button
                          onClick={() => setExpandedQs(prev => ({ ...prev, [originalIdx]: !prev[originalIdx] }))}
                          className="text-xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
                        >
                          <BookOpen size={13} />
                          <span>{isExpanded ? 'Hide Solution' : 'View Full Solution & Explanation'}</span>
                          {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                        </button>
                      </div>

                      {/* Expanded Solution Details */}
                      {isExpanded && (
                        <div className="mt-3 space-y-3 pt-3 border-t border-[var(--border-color)] text-xs sm:text-sm animate-fadeIn">
                          {q.solution && (
                            <div className="p-4 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 text-[var(--text-main)]">
                              <p className="font-extrabold text-xs uppercase tracking-wider text-emerald-400 mb-1 flex items-center gap-1.5">
                                <BookOpen size={13} className="text-emerald-400" /> Step-by-Step Solution
                              </p>
                              <p className="whitespace-pre-wrap leading-relaxed font-medium">{q.solution}</p>
                            </div>
                          )}
                          {q.learningSuggestion && (
                            <div className="p-3.5 bg-amber-500/10 rounded-2xl border border-amber-500/20 text-[var(--text-main)]">
                              <p className="font-extrabold text-xs uppercase tracking-wider text-amber-400 mb-1 flex items-center gap-1.5">
                                <Target size={13} /> Concept Takeaway & Revision Rule
                              </p>
                              <p className="font-medium">{q.learningSuggestion}</p>
                            </div>
                          )}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            {q.shortcut && (
                              <div className="p-3.5 bg-purple-500/10 rounded-2xl border border-purple-500/20 text-[var(--text-main)]">
                                <p className="font-extrabold text-xs uppercase tracking-wider text-purple-400 mb-1 flex items-center gap-1.5">
                                  <Zap size={13} className="text-purple-400" /> Exam Speed Shortcut
                                </p>
                                <p className="font-medium">{q.shortcut}</p>
                              </div>
                            )}
                            {q.hint && (
                              <div className="p-3.5 bg-blue-500/10 rounded-2xl border border-blue-500/20 text-[var(--text-main)]">
                                <p className="font-extrabold text-xs uppercase tracking-wider text-blue-400 mb-1 flex items-center gap-1.5">
                                  <Lightbulb size={13} /> Helpful Hint
                                </p>
                                <p className="font-medium">{q.hint}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* Bottom Actions */}
      <div className="flex flex-wrap items-center gap-3 justify-center pt-2">
        <button
          onClick={onRetake}
          className="flex items-center gap-2 px-7 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md transition-all text-sm active:scale-95 cursor-pointer"
        >
          <RotateCcw size={16} /> Retake Test
        </button>
        <button
          onClick={onBack}
          className="px-7 py-3 bg-[var(--bg-surface)] border border-[var(--border-color)] hover:bg-[var(--bg-subcard)] text-[var(--text-main)] font-bold rounded-xl shadow-xs transition-all text-sm cursor-pointer"
        >
          Back to Library
        </button>
      </div>
    </div>
  );
}
