import { useState, useEffect } from 'react';
import { Attempt, AttemptQuestion, Paper } from '../types';
import { getAttempts, getAttemptQuestions, getPaperById, saveCustomPaper } from '../services/database';
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
  const [showDetail, setShowDetail] = useState(true);
  const [filter, setFilter] = useState<'all' | 'correct' | 'incorrect' | 'unattempted'>('all');
  const [expandedQs, setExpandedQs] = useState<Record<number, boolean>>({});
  const [expandAll, setExpandAll] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      setIsLoading(true);
      setLoadError(null);

      try {
        const attempts = await getAttempts(userId);
        const a = attempts.find(at => at.id === attemptId);

        if (!a) {
          if (isMounted) {
            setLoadError('Test attempt could not be located in your local session.');
            setIsLoading(false);
          }
          return;
        }

        if (isMounted) setAttempt(a);

        const qs = await getAttemptQuestions(a.id);
        if (isMounted) setAttemptQs(qs);

        // 1. If initialPaper is passed and matches this attempt's paper_id
        if (initialPaper && initialPaper.id === a.paper_id) {
          if (isMounted) {
            setPaper(initialPaper);
            setIsLoading(false);
          }
          return;
        }

        // 2. Lookup in database/localStorage
        let p = await getPaperById(a.paper_id);

        // 3. Fallback to initialPaper if database lookup fails
        if (!p && initialPaper) {
          p = initialPaper;
        }

        if (isMounted) {
          if (p) {
            setPaper(p);
          } else {
            setLoadError('Paper details could not be found for this attempt.');
          }
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

  const questions = paper.raw_json?.questions || [];
  const subjectPerf = calculateSubjectPerformance(questions, attemptQs);
  const topicPerf = calculateTopicPerformance(questions, attemptQs);
  const pct = Math.round((attempt.score / (attempt.total_marks || 1)) * 100);

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fadeIn pb-12 font-sans text-[var(--text-main)]">
      {/* Top Bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] hover:bg-[var(--bg-subcard)] text-[var(--text-main)] text-xs font-bold shadow-xs transition-all"
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
                    className="self-start text-[11px] font-bold px-3 py-1.5 bg-indigo-500/15 text-indigo-400 rounded-xl hover:bg-indigo-500/25 transition-colors border border-indigo-500/30"
                  >
                    Practice this topic →
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Question Analysis */}
      <div className="bento-card p-6 sm:p-7 shadow-soft border border-[var(--border-color)] bg-[var(--bg-surface)] rounded-3xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-4 border-b border-[var(--border-color)]">
          <div>
            <h2 className="text-lg font-extrabold text-[var(--text-main)] flex items-center gap-2">
              <BookOpen size={20} className="text-indigo-400" /> Question-by-Question Review
            </h2>
            <p className="text-xs text-[var(--text-muted)] font-semibold mt-0.5">
              Review all questions with correct answers, your choices, and step-by-step solutions
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
              className="btn btn-outline text-xs py-1.5 px-3 rounded-full"
            >
              {expandAll ? 'Collapse All Solutions' : 'Expand All Solutions'}
            </button>
            <button
              onClick={() => setShowDetail(!showDetail)}
              className="text-xs font-bold text-indigo-400 hover:underline px-2 py-1"
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
              { id: 'incorrect' as const, label: 'Incorrect', count: attempt.incorrect_count },
              { id: 'unattempted' as const, label: 'Unattempted', count: attempt.unanswered_count },
            ].map(tab => {
              const isActive = filter === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setFilter(tab.id)}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold border transition-all ${
                    isActive
                      ? 'bg-indigo-600 text-white border-indigo-700 shadow-2xs'
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
                if (filter === 'unattempted') return aq.is_correct === null;
                return true;
              })
              .map(({ aq, originalIdx }) => {
                const q = questions[originalIdx];
                if (!q) return null;
                const isExpanded = expandedQs[originalIdx] ?? false;

                return (
                  <div
                    key={originalIdx}
                    className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] overflow-hidden shadow-xs hover:border-indigo-500/30 transition-colors"
                  >
                    {/* Question Header Card */}
                    <div className="p-4 sm:p-5">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-3">
                        <div className="flex items-start gap-3 min-w-0">
                          <span className="flex items-center justify-center w-7 h-7 rounded-xl bg-[var(--bg-subcard)] border border-[var(--border-color)] text-xs font-black shrink-0">
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
                          {aq.is_correct === null && (
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
                              className={`p-3 rounded-xl border flex items-center gap-2.5 text-xs sm:text-sm ${cardClasses}`}
                            >
                              <span className={`w-6 h-6 rounded-lg text-xs flex items-center justify-center shrink-0 ${badgeClasses}`}>
                                {String.fromCharCode(65 + optIdx)}
                              </span>
                              <span className="flex-1 leading-snug">{opt}</span>
                              {isCorrect && (
                                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded-full shrink-0 flex items-center gap-1">
                                  <CheckCircle size={11} /> Correct
                                </span>
                              )}
                              {isUserAnswer && !isCorrect && (
                                <span className="text-[10px] font-black uppercase tracking-wider text-rose-400 bg-rose-500/20 px-2 py-0.5 rounded-full shrink-0 flex items-center gap-1">
                                  <XCircle size={11} /> Your Choice
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Toggle Solution details button */}
                      <div className="pt-2 flex justify-end">
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
                          {q.hint && (
                            <div className="p-3.5 bg-blue-500/10 rounded-2xl border border-blue-500/20 text-[var(--text-main)]">
                              <p className="font-extrabold text-xs uppercase tracking-wider text-blue-400 mb-1 flex items-center gap-1.5">
                                <Lightbulb size={13} /> Helpful Hint
                              </p>
                              <p className="font-medium">{q.hint}</p>
                            </div>
                          )}
                          {q.shortcut && (
                            <div className="p-3.5 bg-purple-500/10 rounded-2xl border border-purple-500/20 text-[var(--text-main)]">
                              <p className="font-extrabold text-xs uppercase tracking-wider text-purple-400 mb-1 flex items-center gap-1.5">
                                <Zap size={13} className="text-purple-400" /> Exam Speed Shortcut
                              </p>
                              <p className="font-medium">{q.shortcut}</p>
                            </div>
                          )}
                          {q.learningSuggestion && (
                            <div className="p-3.5 bg-amber-500/10 rounded-2xl border border-amber-500/20 text-[var(--text-main)]">
                              <p className="font-extrabold text-xs uppercase tracking-wider text-amber-400 mb-1 flex items-center gap-1.5">
                                <Target size={13} /> Concept Takeaway
                              </p>
                              <p className="font-medium">{q.learningSuggestion}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* Actions */}
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
