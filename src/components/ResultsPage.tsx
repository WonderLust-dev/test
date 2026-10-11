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
  const [showDetail, setShowDetail] = useState(false);
  const [expandedQ, setExpandedQ] = useState<number | null>(null);

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
        <p className="text-gray-500 dark:text-gray-400">Loading results...</p>
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
      <div className="bento-card p-6 shadow-soft border border-gray-200/80">
        <button
          onClick={() => setShowDetail(!showDetail)}
          className="w-full flex items-center justify-between text-left group"
        >
          <h2 className="text-base font-extrabold text-gray-900 flex items-center gap-2">
            <BookOpen size={18} className="text-indigo-600" /> Question-by-Question Analysis
          </h2>
          <span className="text-xs font-bold text-indigo-600 group-hover:underline">
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
                  className={`p-4 rounded-2xl border transition-all ${
                    aq.is_correct === true
                      ? 'border-emerald-200 bg-emerald-50/40'
                      : aq.is_correct === false
                      ? 'border-rose-200 bg-rose-50/40'
                      : 'border-gray-200 bg-gray-50/50'
                  }`}
                >
                  <button onClick={() => setExpandedQ(isExpanded ? null : idx)} className="w-full text-left">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5 min-w-0">
                        <span className={`flex items-center justify-center w-7 h-7 rounded-xl text-xs font-bold shrink-0 ${
                          aq.is_correct === true ? 'bg-emerald-600 text-white' :
                          aq.is_correct === false ? 'bg-rose-600 text-white' :
                          'bg-gray-200 text-gray-700'
                        }`}>
                          {idx + 1}
                        </span>
                        <p className="text-sm text-gray-900 font-bold line-clamp-1">{q.question}</p>
                      </div>
                      <div className="flex items-center gap-2.5 shrink-0">
                        <span className="text-xs font-mono text-gray-500 font-semibold">{formatTime(aq.time_spent_seconds)}</span>
                        {aq.is_correct === true && <CheckCircle size={17} className="text-emerald-600" />}
                        {aq.is_correct === false && <XCircle size={17} className="text-rose-600" />}
                        {aq.is_correct === null && <MinusCircle size={17} className="text-gray-400" />}
                      </div>
                    </div>
                    <div className="flex gap-2 mt-1.5 ml-9.5">
                      <span className="text-[11px] text-gray-500 font-semibold">{q.subject} • {q.topic}</span>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="mt-4 ml-9.5 space-y-3 text-xs sm:text-sm pt-3 border-t border-gray-200/70">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <div className="p-3 rounded-xl bg-white border border-gray-200">
                          <span className="text-gray-500 block mb-0.5 font-medium">Your answer:</span>
                          <span className={aq.is_correct ? 'text-emerald-700 font-bold' : 'text-rose-700 font-bold'}>
                            {aq.selected_answer !== null ? `${String.fromCharCode(65 + aq.selected_answer)}) ${q.options[aq.selected_answer]}` : 'Not attempted'}
                          </span>
                        </div>
                        {aq.is_correct !== true && (
                          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                            <span className="text-emerald-700 block mb-0.5 font-medium">Correct answer:</span>
                            <span className="text-emerald-800 font-bold">
                              {String.fromCharCode(65 + q.answerIndex)}) {q.options[q.answerIndex]}
                            </span>
                          </div>
                        )}
                      </div>

                      {q.hint && (
                        <div className="p-3 bg-blue-50/80 border border-blue-100 rounded-xl text-blue-900">
                          <p className="text-xs font-bold text-blue-700 flex items-center gap-1.5">
                            <Lightbulb size={13} /> Hint: {q.hint}
                          </p>
                        </div>
                      )}
                      {q.solution && (
                        <div className="p-3.5 bg-white rounded-xl border border-gray-200">
                          <p className="text-xs text-gray-800 whitespace-pre-wrap leading-relaxed">
                            <strong className="text-gray-900 block mb-1 font-bold">Solution Explanation:</strong> {q.solution}
                          </p>
                        </div>
                      )}
                      {q.shortcut && (
                        <div className="p-3 bg-purple-50/80 border border-purple-100 rounded-xl text-purple-900">
                          <p className="text-xs text-purple-800 flex items-start gap-1.5">
                            <Zap size={13} className="shrink-0 mt-0.5 text-purple-600" />
                            <span><strong>Exam Shortcut:</strong> {q.shortcut}</span>
                          </p>
                        </div>
                      )}
                      {q.learningSuggestion && (
                        <div className="p-3 bg-amber-50/80 border border-amber-100 rounded-xl text-amber-900">
                          <p className="text-xs text-amber-800">
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
