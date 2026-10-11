import { useState, useEffect, useCallback, useRef } from 'react';
import { Paper, QuestionJSON, ExamSession, AttemptQuestion } from '../types';
import { saveExamSession, getExamSession, clearExamSession, saveAttempt, addOrUpdateMistake, addBookmark, removeBookmark, getBookmarks } from '../services/database';
import { gradeQuestions, formatTime } from '../utils/grader';
import { Clock, ChevronLeft, ChevronRight, Flag, FlagOff, Eraser, Send, AlertTriangle, CheckCircle, XCircle, MinusCircle, Bookmark, BookmarkCheck, Menu, X, ArrowLeft } from 'lucide-react';

interface ExamInterfaceProps {
  paper: Paper;
  userId?: string;
  mode?: 'exam' | 'practice';
  onComplete: (attemptId: string) => void;
  onExit: () => void;
}

export default function ExamInterface({ paper, userId, mode = 'exam', onComplete, onExit }: ExamInterfaceProps) {
  const effectiveUserId = userId || 'guest';
  const questions = paper.raw_json.questions;
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number | null>>({});
  const [marked, setMarked] = useState<Record<number, boolean>>({});
  const [bookmarkedMap, setBookmarkedMap] = useState<Record<string, string>>({});
  const [qTimes, setQTimes] = useState<Record<number, number>>({});
  const [timeLeft, setTimeLeft] = useState(paper.duration_minutes * 60);
  const [startTime] = useState(Date.now());
  const [showSubmit, setShowSubmit] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showPalette, setShowPalette] = useState(false);
  const [showLearning, setShowLearning] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const startTimeRef = useRef(startTime);
  const lastQRef = useRef(0);
  const handleSubmitRef = useRef<(auto?: boolean) => void>(() => {});
  const deadlineRef = useRef<number>(0); // Absolute deadline timestamp

  // Resume from saved session
  useEffect(() => {
    const saved = getExamSession() as ExamSession | null;
    if (saved && saved.paperId === paper.id) {
      setAnswers(saved.answers || {});
      setMarked(saved.markedForReview || {});
      setQTimes(saved.questionTimes || {});
      setCurrentQ(saved.currentQuestion || 0);
      startTimeRef.current = saved.startTime;
      // Use saved deadline if available, otherwise calculate from start time
      deadlineRef.current = saved.deadline || (saved.startTime + (saved.durationSeconds * 1000));
      const elapsed = Math.floor((Date.now() - saved.startTime) / 1000);
      setTimeLeft(Math.max(0, saved.durationSeconds - elapsed));
    } else {
      // New exam - set deadline
      deadlineRef.current = Date.now() + (paper.duration_minutes * 60 * 1000);
    }
  }, [paper.id, paper.duration_minutes]);

  // Save session periodically
  useEffect(() => {
    const interval = setInterval(() => {
      saveExamSession({
        paperId: paper.id,
        paperTitle: paper.title,
        questions,
        startTime: startTimeRef.current,
        durationSeconds: paper.duration_minutes * 60,
        deadline: deadlineRef.current,
        answers,
        markedForReview: marked,
        questionTimes: qTimes,
        currentQuestion: currentQ,
        mode,
      } as ExamSession);
    }, 5000);
    return () => clearInterval(interval);
  }, [answers, marked, qTimes, currentQ, paper, questions, mode]);

  // Track time per question
  useEffect(() => {
    const interval = setInterval(() => {
      setQTimes(prev => ({
        ...prev,
        [lastQRef.current]: (prev[lastQRef.current] || 0) + 1,
      }));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Update last question ref
  useEffect(() => { lastQRef.current = currentQ; }, [currentQ]);

  // Timer countdown - calculate from deadline for reliability
  useEffect(() => {
    if (isSubmitting || deadlineRef.current === 0) return;
    
    const updateTimer = () => {
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((deadlineRef.current - now) / 1000));
      setTimeLeft(remaining);
      
      if (remaining <= 0) {
        // Auto-submit when time runs out
        handleSubmitRef.current(true);
      }
    };
    
    // Update immediately
    updateTimer();
    
    // Then update every second
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [isSubmitting]);

  // Warn before leaving
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  // Load existing bookmarks for this paper
  useEffect(() => {
    async function loadBookmarks() {
      try {
        const list = await getBookmarks(effectiveUserId);
        const map: Record<string, string> = {};
        list.filter(b => b.paper_id === paper.id).forEach(b => {
          map[String(b.question_id)] = b.id;
        });
        setBookmarkedMap(map);
      } catch (e) {
        console.error('Failed to load bookmarks:', e);
      }
    }
    loadBookmarks();
  }, [paper.id, effectiveUserId]);

  const selectAnswer = (optionIdx: number) => {
    setAnswers(prev => ({ ...prev, [currentQ]: optionIdx }));
  };

  const clearAnswer = () => {
    setAnswers(prev => ({ ...prev, [currentQ]: null }));
  };

  const toggleReview = () => {
    setMarked(prev => ({ ...prev, [currentQ]: !prev[currentQ] }));
  };

  const toggleBookmark = async () => {
    const currentQObj = questions[currentQ];
    if (!currentQObj) return;
    const qId = String(currentQObj.id);
    const existingBookmarkId = bookmarkedMap[qId];

    if (existingBookmarkId) {
      await removeBookmark(existingBookmarkId);
      setBookmarkedMap(prev => {
        const next = { ...prev };
        delete next[qId];
        return next;
      });
    } else {
      const created = await addBookmark({
        user_id: effectiveUserId,
        paper_id: paper.id,
        question_id: currentQObj.id,
        question_text: currentQObj.question,
        category: 'important',
      });
      setBookmarkedMap(prev => ({ ...prev, [qId]: created.id }));
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't trigger if typing in an input
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') return;

      if (e.key === 'ArrowRight' || e.key === 'n' || e.key === 'N') setCurrentQ(prev => Math.min(questions.length - 1, prev + 1));
      if (e.key === 'ArrowLeft' || e.key === 'p' || e.key === 'P') setCurrentQ(prev => Math.max(0, prev - 1));
      if (e.key === 'b' || e.key === 'B') toggleBookmark();
      if (e.key === 'r' || e.key === 'R') toggleReview();
      if (e.key === 'c' || e.key === 'C') clearAnswer();
      if (e.key >= '1' && e.key <= '4') {
        const idx = parseInt(e.key) - 1;
        if (idx < questions[currentQ].options.length) {
          selectAnswer(idx);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [currentQ, questions, bookmarkedMap, paper.id, effectiveUserId]);

  const navigateTo = (idx: number) => {
    setCurrentQ(idx);
    setShowPalette(false);
  };

  const handleSubmit = useCallback(async (autoSubmit = false) => {
    if (isSubmitting) return;
    if (!autoSubmit && !showSubmit) {
      setShowSubmit(true);
      return;
    }
    setIsSubmitting(true);

    // Calculate elapsed time from deadline for accuracy
    const elapsed = deadlineRef.current > 0 
      ? Math.floor((Date.now() - startTimeRef.current) / 1000)
      : Math.floor((Date.now() - startTimeRef.current) / 1000);
    
    const { questions: gradedQs, score, correct, incorrect, unanswered } = gradeQuestions(questions, answers, paper.negative_marking);

    // Add time spent
    const finalQs: AttemptQuestion[] = gradedQs.map((q, idx) => ({
      ...q,
      time_spent_seconds: qTimes[idx] || 0,
      marked_for_review: marked[idx] || false,
    }));

    const attempt = await saveAttempt({
      user_id: userId || 'guest',
      paper_id: paper.id,
      paper_title: paper.title,
      started_at: new Date(startTimeRef.current).toISOString(),
      completed_at: new Date().toISOString(),
      score,
      total_marks: paper.total_marks,
      accuracy: (correct + incorrect) > 0 ? Math.round((correct / (correct + incorrect)) * 100) : 0,
      attempted_count: correct + incorrect,
      correct_count: correct,
      incorrect_count: incorrect,
      unanswered_count: unanswered,
      time_spent_seconds: elapsed,
      is_complete: true,
      mode,
    }, finalQs);

    // Record mistakes
    for (const q of finalQs) {
      if (q.is_correct === false && q.selected_answer !== null) {
        const question = questions[q.question_index];
        await addOrUpdateMistake({
          user_id: userId || 'guest',
          paper_id: paper.id,
          paper_title: paper.title,
          question_id: question.id,
          question_text: question.question,
          subject: question.subject || '',
          topic: question.topic || '',
          selected_answer: q.selected_answer,
          correct_answer: question.answerIndex,
          options: question.options,
          solution: question.solution,
          shortcut: question.shortcut,
          hint: question.hint,
          learning_suggestion: question.learningSuggestion,
          resolved: false,
        }, userId);
      }
    }

    clearExamSession();
    onComplete(attempt.id);
  }, [answers, qTimes, marked, questions, paper, userId, mode, onComplete, isSubmitting, showSubmit]);

  // Update the ref so the timer can call handleSubmit
  handleSubmitRef.current = handleSubmit;

  const q = questions[currentQ];
  const isTimerWarning = timeLeft < 300;
  const isTimerCritical = timeLeft < 60;

  const getStatusCounts = () => {
    let answered = 0, markedCount = 0, unanswered = 0, notVisited = 0;
    questions.forEach((_, idx) => {
      if (marked[idx]) { markedCount++; return; }
      if (answers[idx] !== undefined && answers[idx] !== null) { answered++; }
      else if (idx <= Math.max(currentQ, ...Object.keys(answers).map(Number))) { unanswered++; }
      else { notVisited++; }
    });
    return { answered, marked: markedCount, unanswered, notVisited };
  };

  const counts = getStatusCounts();

  // Group questions by subject for palette
  const subjectGroups = new Map<string, number[]>();
  questions.forEach((q, idx) => {
    const subj = q.subject || 'General';
    if (!subjectGroups.has(subj)) subjectGroups.set(subj, []);
    subjectGroups.get(subj)!.push(idx);
  });

  const getQStatus = (idx: number): 'answered' | 'marked' | 'unanswered' | 'not_visited' => {
    if (marked[idx]) return 'marked';
    if (answers[idx] !== undefined && answers[idx] !== null) return 'answered';
    const maxVisited = Math.max(currentQ, ...Object.keys(answers).map(Number), -1);
    if (idx <= maxVisited) return 'unanswered';
    return 'not_visited';
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Top Bar */}
      <div className="sticky top-0 z-30 bg-white/95 dark:bg-gray-800/95 backdrop-blur-md border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2 sm:py-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <button
                onClick={() => setShowExitConfirm(true)}
                className="p-1.5 sm:px-2.5 sm:py-1 rounded-lg text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-1 transition-colors"
                title="Exit exam"
              >
                <ArrowLeft size={16} />
                <span className="hidden sm:inline">Exit</span>
              </button>
              <button onClick={() => setShowPalette(!showPalette)} className="lg:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                <Menu size={20} />
              </button>
              <div className="min-w-0">
                <h1 className="text-sm sm:text-base font-bold text-gray-900 dark:text-white truncate">{paper.title}</h1>
                <p className="text-xs text-gray-500 dark:text-gray-400 hidden sm:block">
                  Q{currentQ + 1}/{questions.length} • {q.subject} • {q.topic}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-sm sm:text-base font-bold shadow-soft ${
                isTimerCritical ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 animate-pulse' :
                isTimerWarning ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400' :
                'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
              }`}>
                <Clock size={16} />
                <span>{formatTime(timeLeft)}</span>
              </div>
              <button onClick={() => setShowSubmit(true)} className="flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow-soft transition-all text-sm">
                <Send size={16} />
                <span className="hidden sm:inline">Submit Test</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
        <div className="flex gap-6">
          {/* Left: Question Palette (Desktop) */}
          <div className={`fixed inset-0 z-40 lg:static lg:z-auto lg:block ${showPalette ? 'block' : 'hidden'}`}>
            {showPalette && <div className="fixed inset-0 bg-black/30 lg:hidden" onClick={() => setShowPalette(false)} />}
            <div className={`relative z-50 w-72 h-full bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 overflow-y-auto p-4 lg:w-64 lg:shrink-0 lg:rounded-xl lg:border lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] shadow-sm`}>
              <div className="flex items-center justify-between mb-4 lg:hidden">
                <h3 className="font-bold text-gray-900 dark:text-white">Question Palette</h3>
                <button onClick={() => setShowPalette(false)}><X size={20} /></button>
              </div>
              <h3 className="font-bold text-gray-900 dark:text-white mb-3 hidden lg:block">Question Palette</h3>

              {/* Legend */}
              <div className="grid grid-cols-2 gap-1.5 mb-4 text-xs">
                <div className="flex items-center gap-1.5"><span className="w-4 h-4 rounded bg-green-500 shrink-0"></span><span className="text-gray-600 dark:text-gray-400">Answered ({counts.answered})</span></div>
                <div className="flex items-center gap-1.5"><span className="w-4 h-4 rounded bg-purple-500 shrink-0"></span><span className="text-gray-600 dark:text-gray-400">Review ({counts.marked})</span></div>
                <div className="flex items-center gap-1.5"><span className="w-4 h-4 rounded bg-red-500 shrink-0"></span><span className="text-gray-600 dark:text-gray-400">Visited ({counts.unanswered})</span></div>
                <div className="flex items-center gap-1.5"><span className="w-4 h-4 rounded bg-gray-300 dark:bg-gray-600 shrink-0"></span><span className="text-gray-600 dark:text-gray-400">Not visited ({counts.notVisited})</span></div>
              </div>

              {/* Subject Groups */}
              {Array.from(subjectGroups.entries()).map(([subject, indices]) => (
                <div key={subject} className="mb-3">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 truncate">{subject}</p>
                  <div className="grid grid-cols-5 gap-1.5">
                    {indices.map(idx => {
                      const status = getQStatus(idx);
                      const isCurrent = idx === currentQ;
                      let bg = 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300';
                      if (status === 'answered') bg = 'bg-green-500 text-white';
                      else if (status === 'marked') bg = 'bg-purple-500 text-white';
                      else if (status === 'unanswered') bg = 'bg-red-500 text-white';
                      return (
                        <button key={idx} onClick={() => navigateTo(idx)}
                          className={`w-8 h-8 rounded text-xs font-medium flex items-center justify-center transition-all ${bg} ${isCurrent ? 'ring-2 ring-indigo-500 ring-offset-1 dark:ring-offset-gray-800 scale-110 font-bold' : 'hover:scale-105'}`}>
                          {idx + 1}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Center: Question Content */}
          <div className="flex-1 min-w-0">
            {/* Question Card */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 sm:p-6 mb-4 shadow-sm">
              {/* Question Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <span className="flex items-center justify-center w-8 h-8 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 rounded-full text-sm font-bold shrink-0">
                    {currentQ + 1}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    <span className="px-2.5 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg text-xs font-semibold">{q.subject}</span>
                    <span className="px-2.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-lg text-xs">{q.topic}</span>
                    {q.difficulty && <span className={`px-2.5 py-0.5 rounded-lg text-xs font-semibold ${q.difficulty === 'easy' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : q.difficulty === 'hard' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'}`}>{q.difficulty}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <button
                    onClick={toggleBookmark}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      bookmarkedMap[String(q.id)]
                        ? 'bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-700'
                        : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                    }`}
                    title="Bookmark Question [B]"
                  >
                    {bookmarkedMap[String(q.id)] ? (
                      <BookmarkCheck size={14} className="text-amber-600 dark:text-amber-400 fill-amber-500" />
                    ) : (
                      <Bookmark size={14} />
                    )}
                    <span>{bookmarkedMap[String(q.id)] ? 'Saved' : 'Bookmark'}</span>
                  </button>
                  <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 font-semibold px-2 py-1 bg-gray-50 dark:bg-gray-900/40 rounded-lg">
                    <span className="text-emerald-600 dark:text-emerald-400">+{q.marks}</span>
                    {q.negativeMarks !== undefined && <span className="text-rose-500">-{q.negativeMarks}</span>}
                  </div>
                </div>
              </div>

              {/* Passage (if any) */}
              {q.passage && (
                <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border-l-4 border-indigo-500">
                  <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{q.passage}</p>
                </div>
              )}

              {/* Question Text */}
              <p className="text-base sm:text-lg text-gray-900 dark:text-white mb-6 leading-relaxed whitespace-pre-wrap">{q.question}</p>

              {/* Image */}
              {q.image && (
                <div className="mb-4">
                  <img src={q.image} alt="Question" className="max-w-full h-auto rounded-lg border border-gray-200 dark:border-gray-700" />
                </div>
              )}

              {/* Formula */}
              {q.formula && (
                <div className="mb-4 p-2 bg-yellow-50 dark:bg-yellow-900/10 rounded-lg text-sm font-mono text-yellow-800 dark:text-yellow-300">
                  📐 {q.formula}
                </div>
              )}

              {/* Options */}
              <div className="space-y-2.5">
                {q.options.map((opt, idx) => {
                  const isSelected = answers[currentQ] === idx;
                  return (
                    <button key={idx} onClick={() => selectAnswer(idx)}
                      className={`w-full text-left p-3 sm:p-4 rounded-xl border-2 transition-all ${
                        isSelected
                          ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 shadow-sm'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                      }`}>
                      <div className="flex items-center gap-3">
                        <span className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold shrink-0 ${
                          isSelected ? 'bg-indigo-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                        }`}>
                          {String.fromCharCode(65 + idx)}
                        </span>
                        <span className="text-gray-900 dark:text-white text-sm sm:text-base">{opt}</span>
                        {isSelected && <CheckCircle size={18} className="ml-auto text-indigo-500 shrink-0" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Practice Mode: Learning Section */}
            {mode === 'practice' && answers[currentQ] !== undefined && answers[currentQ] !== null && (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 sm:p-6 mb-4">
                <button onClick={() => setShowLearning(showLearning === currentQ ? null : currentQ)} className="w-full flex items-center justify-between">
                  <span className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    {answers[currentQ] === q.answerIndex ? <CheckCircle size={18} className="text-green-500" /> : <XCircle size={18} className="text-red-500" />}
                    {answers[currentQ] === q.answerIndex ? 'Correct!' : 'Incorrect — Learn from this'}
                  </span>
                  <span className="text-xs text-gray-500">{showLearning === currentQ ? 'Hide' : 'Show'} explanation</span>
                </button>
                {showLearning === currentQ && (
                  <div className="mt-4 space-y-3 text-sm">
                    {q.hint && (
                      <div className="p-3 bg-blue-50 dark:bg-blue-900/10 rounded-lg border-l-4 border-blue-500">
                        <p className="font-medium text-blue-800 dark:text-blue-300 mb-1">💡 Hint</p>
                        <p className="text-blue-700 dark:text-blue-400">{q.hint}</p>
                      </div>
                    )}
                    {q.solution && (
                      <div className="p-3 bg-green-50 dark:bg-green-900/10 rounded-lg border-l-4 border-green-500">
                        <p className="font-medium text-green-800 dark:text-green-300 mb-1">📖 Solution</p>
                        <p className="text-green-700 dark:text-green-400 whitespace-pre-wrap">{q.solution}</p>
                      </div>
                    )}
                    {q.shortcut && (
                      <div className="p-3 bg-purple-50 dark:bg-purple-900/10 rounded-lg border-l-4 border-purple-500">
                        <p className="font-medium text-purple-800 dark:text-purple-300 mb-1">⚡ Shortcut</p>
                        <p className="text-purple-700 dark:text-purple-400">{q.shortcut}</p>
                      </div>
                    )}
                    {q.learningSuggestion && (
                      <div className="p-3 bg-orange-50 dark:bg-orange-900/10 rounded-lg border-l-4 border-orange-500">
                        <p className="font-medium text-orange-800 dark:text-orange-300 mb-1">🎯 Learning Suggestion</p>
                        <p className="text-orange-700 dark:text-orange-400">{q.learningSuggestion}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex gap-2">
                <button onClick={() => setCurrentQ(prev => Math.max(0, prev - 1))} disabled={currentQ === 0}
                  className="flex items-center gap-1 px-3 sm:px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm">
                  <ChevronLeft size={16} /> Previous
                </button>
                <button onClick={() => setCurrentQ(prev => Math.min(questions.length - 1, prev + 1))} disabled={currentQ === questions.length - 1}
                  className="flex items-center gap-1 px-3 sm:px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm">
                  Next <ChevronRight size={16} />
                </button>
              </div>
              <div className="flex gap-2">
                <button onClick={toggleReview}
                  className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm transition-colors ${
                    marked[currentQ] ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400' : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}>
                  {marked[currentQ] ? <FlagOff size={14} /> : <Flag size={14} />}
                  {marked[currentQ] ? 'Unmark' : 'Review'}
                </button>
                <button onClick={clearAnswer}
                  className="flex items-center gap-1 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm">
                  <Eraser size={14} /> Clear
                </button>
              </div>
            </div>

            {/* Keyboard Shortcuts Helper */}
            <div className="mt-4 pt-3 border-t border-gray-200/60 dark:border-gray-700/60 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500 dark:text-gray-400">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-gray-700 dark:text-gray-300">Shortcuts:</span>
                <span><kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded font-mono text-[10px] text-gray-800 dark:text-gray-200">1-4</kbd> Option</span>
                <span><kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded font-mono text-[10px] text-gray-800 dark:text-gray-200">N / P</kbd> Next/Prev</span>
                <span><kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded font-mono text-[10px] text-gray-800 dark:text-gray-200">B</kbd> Bookmark</span>
                <span><kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded font-mono text-[10px] text-gray-800 dark:text-gray-200">R</kbd> Flag</span>
                <span><kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded font-mono text-[10px] text-gray-800 dark:text-gray-200">C</kbd> Clear</span>
              </div>
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">● Auto-saving</span>
            </div>
          </div>
        </div>
      </div>

      {/* Exit Confirmation Modal */}
      {showExitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-md w-full shadow-2xl border border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-3 mb-3">
              <AlertTriangle size={24} className="text-amber-500" />
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">Exit Exam?</h3>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-6 leading-relaxed">
              Are you sure you want to exit? Your progress is saved locally and can be resumed later from the dashboard.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowExitConfirm(false)} className="flex-1 px-4 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium">
                Keep Practicing
              </button>
              <button onClick={onExit} className="flex-1 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl transition-colors font-semibold">
                Exit to Dashboard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Submit Confirmation Modal */}
      {showSubmit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle size={24} className="text-yellow-500" />
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">Submit Test?</h3>
            </div>
            <div className="mb-6 space-y-2 text-sm">
              <div className="flex justify-between py-1.5 border-b border-gray-100 dark:border-gray-700">
                <span className="text-gray-600 dark:text-gray-400">Answered</span>
                <span className="font-medium text-green-600">{counts.answered}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-gray-100 dark:border-gray-700">
                <span className="text-gray-600 dark:text-gray-400">Marked for Review</span>
                <span className="font-medium text-purple-600">{counts.marked}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-gray-100 dark:border-gray-700">
                <span className="text-gray-600 dark:text-gray-400">Not Answered</span>
                <span className="font-medium text-red-600">{counts.unanswered}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-gray-100 dark:border-gray-700">
                <span className="text-gray-600 dark:text-gray-400">Not Visited</span>
                <span className="font-medium text-gray-500">{counts.notVisited}</span>
              </div>
              <div className="flex justify-between py-1.5 font-semibold">
                <span className="text-gray-900 dark:text-white">Total Questions</span>
                <span className="text-gray-900 dark:text-white">{questions.length}</span>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowSubmit(false)} className="flex-1 px-4 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium">
                Continue Exam
              </button>
              <button onClick={() => handleSubmit(false)} className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors font-semibold">
                Submit Test
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
