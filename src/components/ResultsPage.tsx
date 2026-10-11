import { useState, useEffect } from 'react';
import { Attempt, AttemptQuestion, Paper, QuestionJSON } from '../types';
import { getAttempts, getAttemptQuestions, getPaperById } from '../services/database';
import { calculateSubjectPerformance, calculateTopicPerformance, formatTime, getAccuracyColor } from '../utils/grader';
import { Trophy, Target, Clock, CheckCircle, XCircle, MinusCircle, BarChart3, TrendingUp, Lightbulb, Zap, BookOpen, ArrowLeft, RotateCcw } from 'lucide-react';

interface ResultsPageProps {
  attemptId: string;
  userId?: string;
  onRetake: () => void;
  onBack: () => void;
  onPractice: (subject: string, topic: string) => void;
}

export default function ResultsPage({ attemptId, userId, onRetake, onBack, onPractice }: ResultsPageProps) {
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [attemptQs, setAttemptQs] = useState<AttemptQuestion[]>([]);
  const [paper, setPaper] = useState<Paper | null>(null);
  const [showDetail, setShowDetail] = useState(true);
  const [filter, setFilter] = useState<'all' | 'correct' | 'incorrect' | 'unattempted'>('all');
  const [expandedQs, setExpandedQs] = useState<Record<number, boolean>>({});
  const [expandAll, setExpandAll] = useState(false);

  useEffect(() => {
    async function load() {
      const attempts = await getAttempts(userId);
      const a = attempts.find(at => at.id === attemptId);
      if (a) {
        setAttempt(a);
        const qs = await getAttemptQuestions(a.id);
        setAttemptQs(qs);
        const p = await getPaperById(a.paper_id);
        setPaper(p);
      }
    }
    load();
  }, [attemptId]);

  if (!attempt || !paper) {
    return (
      <div className="max-w-4xl mx-auto text-center py-16">
        <p className="text-gray-500">Loading results...</p>
      </div>
    );
  }

  const questions = paper.raw_json.questions;
  const subjectPerf = calculateSubjectPerformance(questions, attemptQs);
  const topicPerf = calculateTopicPerformance(questions, attemptQs);
  const pct = Math.round((attempt.score / attempt.total_marks) * 100);

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fadeIn pb-12 font-sans text-gray-900">
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-xs font-bold shadow-xs transition-all"
        >
          <ArrowLeft size={15} /> Back to Library
        </button>
        <span className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-3 py-1 rounded-full">
          SSC CGL Grader 2.0
        </span>
      </div>

      {/* Header */}
      <div className="text-center py-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-gray-900 text-white shadow-soft mb-3 transform hover:scale-105 transition-transform">
          <Trophy size={30} className="text-emerald-400" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight mb-1">
          Exam Completed!
        </h1>
        <p className="text-sm text-gray-500 font-medium">
          {attempt.paper_title}
        </p>
      </div>

      {/* Score Card */}
      <div className="bento-card p-6 sm:p-8 shadow-soft border border-gray-200/80">
        <div className="text-center mb-6">
          <div className={`text-5xl sm:text-6xl font-black tracking-tight mb-1 ${getAccuracyColor(pct)}`}>
            {attempt.score} <span className="text-2xl sm:text-3xl font-semibold text-gray-400">/ {attempt.total_marks}</span>
          </div>
          <div className="flex items-center justify-center gap-2 mt-2">
            <span className={`text-xs font-bold px-3 py-1 rounded-full ${
              pct >= 70 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60' :
              pct >= 40 ? 'bg-amber-50 text-amber-700 border border-amber-200/60' :
              'bg-rose-50 text-rose-700 border border-rose-200/60'
            }`}>
              {pct}% Score
            </span>
            <span className="text-xs font-bold text-gray-600 bg-gray-100 px-3 py-1 rounded-full border border-gray-200/60">
              Accuracy: {attempt.accuracy}%
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <div className="text-center p-4 bg-emerald-50/70 border border-emerald-100 rounded-2xl">
            <CheckCircle size={20} className="mx-auto text-emerald-600 mb-1.5" />
            <div className="text-2xl font-black text-emerald-800">{attempt.correct_count}</div>
            <div className="text-xs font-bold text-emerald-700">Correct</div>
          </div>
          <div className="text-center p-4 bg-rose-50/70 border border-rose-100 rounded-2xl">
            <XCircle size={20} className="mx-auto text-rose-600 mb-1.5" />
            <div className="text-2xl font-black text-rose-800">{attempt.incorrect_count}</div>
            <div className="text-xs font-bold text-rose-700">Incorrect</div>
          </div>
          <div className="text-center p-4 bg-gray-50 border border-gray-100 rounded-2xl">
            <MinusCircle size={20} className="mx-auto text-gray-500 mb-1.5" />
            <div className="text-2xl font-black text-gray-800">{attempt.unanswered_count}</div>
            <div className="text-xs font-bold text-gray-600">Unanswered</div>
          </div>
          <div className="text-center p-4 bg-blue-50/70 border border-blue-100 rounded-2xl">
            <Clock size={20} className="mx-auto text-blue-600 mb-1.5" />
            <div className="text-2xl font-black text-blue-800">{formatTime(attempt.time_spent_seconds)}</div>
            <div className="text-xs font-bold text-blue-700">Time Spent</div>
          </div>
        </div>
      </div>

      {/* Subject Performance */}
      {subjectPerf.length > 1 && (
        <div className="bento-card p-6 shadow-soft border border-gray-200/80">
          <h2 className="text-base font-extrabold text-gray-900 mb-4 flex items-center gap-2">
            <BarChart3 size={18} className="text-indigo-600" /> Performance by Subject
          </h2>
          <div className="space-y-4">
            {subjectPerf.map(sp => (
              <div key={sp.subject} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs sm:text-sm font-bold">
                  <span className="text-gray-800">{sp.subject}</span>
                  <span className={getAccuracyColor(sp.accuracy)}>{sp.accuracy}% ({sp.correct}/{sp.total})</span>
                </div>
                <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
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

      {/* Topic Performance */}
      {topicPerf.length > 0 && (
        <div className="bento-card p-6 shadow-soft border border-gray-200/80">
          <h2 className="text-base font-extrabold text-gray-900 mb-4 flex items-center gap-2">
            <TrendingUp size={18} className="text-indigo-600" /> Performance by Topic
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {topicPerf.sort((a, b) => a.accuracy - b.accuracy).map(tp => (
              <div
                key={tp.topic}
                className="p-4 bg-gray-50 border border-gray-100 rounded-2xl flex flex-col justify-between gap-3 shadow-xs"
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs sm:text-sm font-extrabold text-gray-900 truncate">{tp.topic}</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      tp.accuracy >= 70 ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                      tp.accuracy >= 40 ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                      'bg-rose-50 text-rose-700 border border-rose-100'
                    }`}>
                      {tp.accuracy}%
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-500 font-medium">
                    {tp.subject} • {tp.correct}/{tp.total} correct • Avg {tp.avgTime}s
                  </p>
                </div>
                {tp.accuracy < 60 && (
                  <button
                    onClick={() => onPractice(tp.subject, tp.topic)}
                    className="self-start text-[11px] font-bold px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-xl hover:bg-indigo-100 transition-colors border border-indigo-200/60"
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
      <div className="bento-card p-6 sm:p-7 shadow-soft border border-gray-200/80">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-extrabold text-gray-900 flex items-center gap-2">
              <BookOpen size={20} className="text-indigo-600" /> Question-by-Question Detailed Review
            </h2>
            <p className="text-xs text-gray-500 font-semibold mt-0.5">
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
                  attemptQs.forEach((_, idx) => { all[idx] = true; });
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
              className="text-xs font-bold text-indigo-600 hover:underline px-2 py-1"
            >
              {showDetail ? 'Hide Section' : 'Show Section'}
            </button>
          </div>
        </div>

        {/* Filter Tabs */}
        {showDetail && (
          <div className="flex flex-wrap items-center gap-2 mb-5">
            {[
              { id: 'all' as const, label: 'All Questions', count: attemptQs.length, color: 'text-gray-900' },
              { id: 'correct' as const, label: 'Correct', count: attempt.correct_count, color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
              { id: 'incorrect' as const, label: 'Incorrect', count: attempt.incorrect_count, color: 'text-rose-700 bg-rose-50 border-rose-200' },
              { id: 'unattempted' as const, label: 'Unattempted', count: attempt.unanswered_count, color: 'text-gray-700 bg-gray-100 border-gray-200' },
            ].map(tab => {
              const isActive = filter === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setFilter(tab.id)}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold border transition-all ${
                    isActive
                      ? 'bg-gray-900 text-white border-gray-900 shadow-xs'
                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className={`px-2 py-0.2 rounded-full text-[10px] font-black ${
                    isActive ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-700'
                  }`}>
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {showDetail && (
          <div className="space-y-4">
            {attemptQs
              .map((aq, originalIdx) => ({ aq, originalIdx }))
              .filter(({ aq }) => {
                if (filter === 'correct') return aq.is_correct === true;
                if (filter === 'incorrect') return aq.is_correct === false;
                if (filter === 'unattempted') return aq.is_correct === null || aq.selected_answer === null;
                return true;
              })
              .map(({ aq, originalIdx }) => {
                const q = questions[aq.question_index];
                if (!q) return null;
                const isExpanded = !!expandedQs[originalIdx];

                return (
                  <div
                    key={originalIdx}
                    className={`rounded-2xl border transition-all overflow-hidden ${
                      aq.is_correct === true
                        ? 'border-emerald-200 bg-emerald-50/20'
                        : aq.is_correct === false
                        ? 'border-rose-200 bg-rose-50/20'
                        : 'border-gray-200 bg-gray-50/30'
                    }`}
                  >
                    {/* Header Row */}
                    <div
                      onClick={() => setExpandedQs(prev => ({ ...prev, [originalIdx]: !prev[originalIdx] }))}
                      className="p-4 sm:p-5 cursor-pointer hover:bg-black/[0.01] transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          <span className={`flex items-center justify-center w-8 h-8 rounded-xl text-xs font-black shrink-0 ${
                            aq.is_correct === true ? 'bg-emerald-600 text-white shadow-xs' :
                            aq.is_correct === false ? 'bg-rose-600 text-white shadow-xs' :
                            'bg-gray-200 text-gray-700'
                          }`}>
                            Q{originalIdx + 1}
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm sm:text-base text-gray-900 font-extrabold leading-snug">
                              {q.question}
                            </p>
                            <div className="flex flex-wrap items-center gap-2 mt-1.5">
                              <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2.5 py-0.5 rounded-full">
                                {q.subject}
                              </span>
                              {q.topic && (
                                <span className="text-[11px] font-medium text-gray-500">
                                  • {q.topic}
                                </span>
                              )}
                              <span className="text-[11px] font-mono text-gray-400 font-semibold flex items-center gap-1">
                                <Clock size={11} /> {formatTime(aq.time_spent_seconds)}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {aq.is_correct === true && (
                            <span className="flex items-center gap-1 text-xs font-extrabold text-emerald-700 bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-full">
                              <CheckCircle size={14} className="text-emerald-600" /> +{q.marks} Marks
                            </span>
                          )}
                          {aq.is_correct === false && (
                            <span className="flex items-center gap-1 text-xs font-extrabold text-rose-700 bg-rose-100 border border-rose-200 px-2.5 py-1 rounded-full">
                              <XCircle size={14} className="text-rose-600" /> -{q.negativeMarks || 0.5} Marks
                            </span>
                          )}
                          {aq.is_correct === null && (
                            <span className="flex items-center gap-1 text-xs font-extrabold text-gray-600 bg-gray-100 border border-gray-200 px-2.5 py-1 rounded-full">
                              <MinusCircle size={14} className="text-gray-400" /> Skipped (0 Marks)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* All Options Breakdown */}
                    <div className="px-4 sm:px-5 pb-4 space-y-2">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-gray-100">
                        {q.options.map((opt, optIdx) => {
                          const isUserAnswer = aq.selected_answer === optIdx;
                          const isCorrect = optIdx === q.answerIndex;

                          let cardClasses = 'bg-white border-gray-200 text-gray-700';
                          let badgeClasses = 'bg-gray-100 text-gray-600';

                          if (isCorrect) {
                            cardClasses = 'bg-emerald-50/90 border-emerald-500 text-emerald-950 font-bold shadow-xs';
                            badgeClasses = 'bg-emerald-600 text-white font-black';
                          } else if (isUserAnswer && !isCorrect) {
                            cardClasses = 'bg-rose-50/90 border-rose-500 text-rose-950 font-bold shadow-xs';
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
                                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full shrink-0 flex items-center gap-1">
                                  <CheckCircle size={11} /> Correct
                                </span>
                              )}
                              {isUserAnswer && !isCorrect && (
                                <span className="text-[10px] font-black uppercase tracking-wider text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full shrink-0 flex items-center gap-1">
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
                          className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                        >
                          <BookOpen size={13} />
                          <span>{isExpanded ? 'Hide Solution' : 'View Full Solution & Explanation'}</span>
                        </button>
                      </div>

                      {/* Expanded Solution Details */}
                      {isExpanded && (
                        <div className="mt-3 space-y-3 pt-3 border-t border-gray-200/80 text-xs sm:text-sm animate-fadeIn">
                          {q.solution && (
                            <div className="p-4 bg-emerald-50/80 rounded-2xl border border-emerald-100 text-emerald-950">
                              <p className="font-extrabold text-xs uppercase tracking-wider text-emerald-800 mb-1 flex items-center gap-1.5">
                                <BookOpen size={13} className="text-emerald-600" /> Step-by-Step Solution
                              </p>
                              <p className="text-emerald-900 whitespace-pre-wrap leading-relaxed font-medium">{q.solution}</p>
                            </div>
                          )}
                          {q.hint && (
                            <div className="p-3.5 bg-blue-50/80 rounded-2xl border border-blue-100 text-blue-900">
                              <p className="font-extrabold text-xs uppercase tracking-wider text-blue-700 mb-1 flex items-center gap-1.5">
                                <Lightbulb size={13} /> Helpful Hint
                              </p>
                              <p className="text-blue-800 font-medium">{q.hint}</p>
                            </div>
                          )}
                          {q.shortcut && (
                            <div className="p-3.5 bg-purple-50/80 rounded-2xl border border-purple-100 text-purple-900">
                              <p className="font-extrabold text-xs uppercase tracking-wider text-purple-700 mb-1 flex items-center gap-1.5">
                                <Zap size={13} className="text-purple-600" /> Exam Speed Shortcut
                              </p>
                              <p className="text-purple-800 font-medium">{q.shortcut}</p>
                            </div>
                          )}
                          {q.learningSuggestion && (
                            <div className="p-3.5 bg-amber-50/80 rounded-2xl border border-amber-100 text-amber-900">
                              <p className="font-extrabold text-xs uppercase tracking-wider text-amber-700 mb-1 flex items-center gap-1.5">
                                <Target size={13} /> Concept Takeaway
                              </p>
                              <p className="text-amber-800 font-medium">{q.learningSuggestion}</p>
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
          className="flex items-center gap-2 px-7 py-3 bg-gray-900 hover:bg-black text-white font-bold rounded-xl shadow-xs transition-all text-sm active:scale-95"
        >
          <RotateCcw size={16} /> Retake Test
        </button>
        <button
          onClick={onBack}
          className="px-7 py-3 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-bold rounded-xl shadow-xs transition-all text-sm"
        >
          Back to Library
        </button>
      </div>
    </div>
  );
}
