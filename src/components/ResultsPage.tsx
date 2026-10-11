import { useState, useEffect } from 'react';
import { Attempt, AttemptQuestion, Paper, QuestionJSON } from '../types';
import { getAttempts, getAttemptQuestions, getPaperById } from '../services/database';
import { calculateSubjectPerformance, calculateTopicPerformance, formatTime, getAccuracyColor } from '../utils/grader';
import { Trophy, Target, Clock, CheckCircle, XCircle, MinusCircle, BarChart3, TrendingUp, Lightbulb, Zap, BookOpen, ArrowLeft, RotateCcw } from 'lucide-react';

interface ResultsPageProps {
  attemptId: string;
  onRetake: () => void;
  onBack: () => void;
  onPractice: (subject: string, topic: string) => void;
}

export default function ResultsPage({ attemptId, onRetake, onBack, onPractice }: ResultsPageProps) {
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [attemptQs, setAttemptQs] = useState<AttemptQuestion[]>([]);
  const [paper, setPaper] = useState<Paper | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [expandedQ, setExpandedQ] = useState<number | null>(null);

  useEffect(() => {
    async function load() {
      const attempts = await getAttempts();
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
        <p className="text-gray-500 dark:text-gray-400">Loading results...</p>
      </div>
    );
  }

  const questions = paper.raw_json.questions;
  const subjectPerf = calculateSubjectPerformance(questions, attemptQs);
  const topicPerf = calculateTopicPerformance(questions, attemptQs);
  const pct = Math.round((attempt.score / attempt.total_marks) * 100);

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in pb-12">
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="btn btn-ghost text-xs gap-1.5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
        >
          <ArrowLeft size={15} /> Back to Library
        </button>
        <span className="badge badge-accent text-xs">
          SSC CGL Grader 2.0
        </span>
      </div>

      {/* Header */}
      <div className="text-center py-4">
        <div
          className="inline-flex items-center justify-center w-16 h-16 rounded-2xl shadow-medium mb-3 transform hover:scale-105 transition-transform"
          style={{ background: 'var(--gradient-brand)' }}
        >
          <Trophy size={32} className="text-white drop-shadow" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-1">
          Exam Completed!
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
          {attempt.paper_title}
        </p>
      </div>

      {/* Score Card */}
      <div className="card card-elevated p-6 sm:p-8">
        <div className="text-center mb-6">
          <div className={`text-5xl sm:text-6xl font-black tracking-tight mb-1 ${getAccuracyColor(pct)}`}>
            {attempt.score} <span className="text-2xl sm:text-3xl font-semibold text-slate-400">/ {attempt.total_marks}</span>
          </div>
          <div className="flex items-center justify-center gap-2 mt-2">
            <span className={`text-xl font-bold px-3 py-0.5 rounded-full ${
              pct >= 70 ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' :
              pct >= 40 ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' :
              'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300'
            }`}>
              {pct}% Score
            </span>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full">
              Accuracy: {attempt.accuracy}%
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <div className="text-center p-3.5 bg-emerald-50/80 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40 rounded-xl">
            <CheckCircle size={20} className="mx-auto text-emerald-600 dark:text-emerald-400 mb-1.5" />
            <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{attempt.correct_count}</div>
            <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Correct</div>
          </div>
          <div className="text-center p-3.5 bg-rose-50/80 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-900/40 rounded-xl">
            <XCircle size={20} className="mx-auto text-rose-600 dark:text-rose-400 mb-1.5" />
            <div className="text-2xl font-bold text-rose-700 dark:text-rose-300">{attempt.incorrect_count}</div>
            <div className="text-xs font-semibold text-rose-600 dark:text-rose-400">Incorrect</div>
          </div>
          <div className="text-center p-3.5 bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60 rounded-xl">
            <MinusCircle size={20} className="mx-auto text-slate-500 mb-1.5" />
            <div className="text-2xl font-bold text-slate-700 dark:text-slate-300">{attempt.unanswered_count}</div>
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">Unanswered</div>
          </div>
          <div className="text-center p-3.5 bg-blue-50/80 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-900/40 rounded-xl">
            <Clock size={20} className="mx-auto text-blue-600 dark:text-blue-400 mb-1.5" />
            <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">{formatTime(attempt.time_spent_seconds)}</div>
            <div className="text-xs font-semibold text-blue-600 dark:text-blue-400">Time Spent</div>
          </div>
        </div>
      </div>

      {/* Subject Performance */}
      {subjectPerf.length > 1 && (
        <div className="card p-6">
          <h2 className="text-base font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <BarChart3 size={18} className="text-indigo-600 dark:text-indigo-400" /> Performance by Subject
          </h2>
          <div className="space-y-4">
            {subjectPerf.map(sp => (
              <div key={sp.subject} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs sm:text-sm font-semibold">
                  <span className="text-slate-700 dark:text-slate-300">{sp.subject}</span>
                  <span className={getAccuracyColor(sp.accuracy)}>{sp.accuracy}% ({sp.correct}/{sp.total})</span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
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
        <div className="card p-6">
          <h2 className="text-base font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <TrendingUp size={18} className="text-indigo-600 dark:text-indigo-400" /> Performance by Topic
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {topicPerf.sort((a, b) => a.accuracy - b.accuracy).map(tp => (
              <div
                key={tp.topic}
                className="p-3.5 bg-slate-50/80 dark:bg-slate-850/60 border border-slate-200/70 dark:border-slate-800 rounded-xl flex flex-col justify-between gap-2"
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 truncate">{tp.topic}</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      tp.accuracy >= 70 ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' :
                      tp.accuracy >= 40 ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' :
                      'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                    }`}>
                      {tp.accuracy}%
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                    {tp.subject} • {tp.correct}/{tp.total} correct • Avg {tp.avgTime}s
                  </p>
                </div>
                {tp.accuracy < 60 && (
                  <button
                    onClick={() => onPractice(tp.subject, tp.topic)}
                    className="self-start text-[11px] font-semibold px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors border border-indigo-200/50 dark:border-indigo-800/50"
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
      <div className="card p-6">
        <button
          onClick={() => setShowDetail(!showDetail)}
          className="w-full flex items-center justify-between text-left group"
        >
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <BookOpen size={18} className="text-indigo-600 dark:text-indigo-400" /> Question-by-Question Analysis
          </h2>
          <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 group-hover:underline">
            {showDetail ? 'Hide details' : 'Show details'}
          </span>
        </button>

        {showDetail && (
          <div className="space-y-3 mt-4">
            {attemptQs.map((aq, idx) => {
              const q = questions[aq.question_index];
              if (!q) return null;
              const isExpanded = expandedQ === idx;

              return (
                <div
                  key={idx}
                  className={`p-4 rounded-xl border transition-all ${
                    aq.is_correct === true
                      ? 'border-emerald-200/80 dark:border-emerald-900/60 bg-emerald-50/40 dark:bg-emerald-950/15'
                      : aq.is_correct === false
                      ? 'border-rose-200/80 dark:border-rose-900/60 bg-rose-50/40 dark:bg-rose-950/15'
                      : 'border-slate-200/80 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40'
                  }`}
                >
                  <button onClick={() => setExpandedQ(isExpanded ? null : idx)} className="w-full text-left">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5 min-w-0">
                        <span className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold shrink-0 ${
                          aq.is_correct === true ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300' :
                          aq.is_correct === false ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-300' :
                          'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                        }`}>
                          {idx + 1}
                        </span>
                        <p className="text-sm text-slate-900 dark:text-white font-medium line-clamp-1">{q.question}</p>
                      </div>
                      <div className="flex items-center gap-2.5 shrink-0">
                        <span className="text-xs font-mono text-slate-400">{formatTime(aq.time_spent_seconds)}</span>
                        {aq.is_correct === true && <CheckCircle size={16} className="text-emerald-600 dark:text-emerald-400" />}
                        {aq.is_correct === false && <XCircle size={16} className="text-rose-600 dark:text-rose-400" />}
                        {aq.is_correct === null && <MinusCircle size={16} className="text-slate-400" />}
                      </div>
                    </div>
                    <div className="flex gap-2 mt-1.5 ml-8.5">
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">{q.subject} • {q.topic}</span>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="mt-4 ml-8.5 space-y-3 text-xs sm:text-sm pt-3 border-t border-slate-200/60 dark:border-slate-800">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <div className="p-2.5 rounded-lg bg-slate-100/70 dark:bg-slate-800/60">
                          <span className="text-slate-500 dark:text-slate-400 block mb-0.5">Your answer:</span>
                          <span className={aq.is_correct ? 'text-emerald-700 dark:text-emerald-400 font-semibold' : 'text-rose-700 dark:text-rose-400 font-semibold'}>
                            {aq.selected_answer !== null ? `${String.fromCharCode(65 + aq.selected_answer)}) ${q.options[aq.selected_answer]}` : 'Not attempted'}
                          </span>
                        </div>
                        {aq.is_correct !== true && (
                          <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/50 dark:border-emerald-900/40">
                            <span className="text-emerald-700 dark:text-emerald-400 block mb-0.5 font-medium">Correct answer:</span>
                            <span className="text-emerald-800 dark:text-emerald-300 font-semibold">
                              {String.fromCharCode(65 + q.answerIndex)}) {q.options[q.answerIndex]}
                            </span>
                          </div>
                        )}
                      </div>

                      {q.hint && (
                        <div className="p-2.5 bg-blue-50/80 dark:bg-blue-950/20 border border-blue-200/50 dark:border-blue-900/30 rounded-lg">
                          <p className="text-xs font-medium text-blue-800 dark:text-blue-300 flex items-center gap-1.5">
                            <Lightbulb size={13} /> Hint: {q.hint}
                          </p>
                        </div>
                      )}
                      {q.solution && (
                        <div className="p-3 bg-slate-100/80 dark:bg-slate-800/60 rounded-lg border border-slate-200/60 dark:border-slate-700/60">
                          <p className="text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                            <strong className="text-slate-900 dark:text-white block mb-1">Solution Explanation:</strong> {q.solution}
                          </p>
                        </div>
                      )}
                      {q.shortcut && (
                        <div className="p-2.5 bg-purple-50/80 dark:bg-purple-950/20 border border-purple-200/50 dark:border-purple-900/30 rounded-lg">
                          <p className="text-xs text-purple-800 dark:text-purple-300 flex items-start gap-1.5">
                            <Zap size={13} className="shrink-0 mt-0.5 text-purple-600 dark:text-purple-400" />
                            <span><strong>Exam Shortcut:</strong> {q.shortcut}</span>
                          </p>
                        </div>
                      )}
                      {q.learningSuggestion && (
                        <div className="p-2.5 bg-amber-50/80 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/30 rounded-lg">
                          <p className="text-xs text-amber-800 dark:text-amber-300">
                            <strong>📌 Revision Note:</strong> {q.learningSuggestion}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
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
          className="btn btn-primary px-8 py-3.5 shadow-medium font-semibold text-sm flex items-center gap-2"
        >
          <RotateCcw size={16} /> Retake Test
        </button>
        <button
          onClick={onBack}
          className="btn btn-secondary px-8 py-3.5 font-semibold text-sm"
        >
          Back to Library
        </button>
      </div>
    </div>
  );
}
