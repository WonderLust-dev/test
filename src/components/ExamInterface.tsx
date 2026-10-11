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
    <div className="min-h-screen bg-[#F4F5F7] font-sans text-gray-900 antialiased selection:bg-indigo-100">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-gray-200/80 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <button
                onClick={() => setShowExitConfirm(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-xs font-bold shadow-xs transition-all shrink-0"
                title="Exit exam"
              >
                <ArrowLeft size={15} />
                <span className="hidden sm:inline">Exit Exam</span>
              </button>
              <button
                onClick={() => setShowPalette(!showPalette)}
                className="lg:hidden p-2 rounded-xl border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 shadow-xs"
                title="Toggle question palette"
              >
                <Menu size={18} />
              </button>
              <div className="min-w-0">
                <h1 className="text-sm sm:text-base font-extrabold text-gray-900 truncate tracking-tight">{paper.title}</h1>
                <p className="text-xs font-medium text-gray-500 hidden sm:block truncate">
                  Question {currentQ + 1} of {questions.length} • {q.subject} {q.topic ? `• ${q.topic}` : ''}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 sm:gap-4 shrink-0">
              {/* Timer Pill */}
              <div className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl font-mono text-sm sm:text-base font-bold shadow-xs transition-all ${
                isTimerCritical
                  ? 'bg-rose-50 border border-rose-200 text-rose-600 animate-pulse'
                  : isTimerWarning
                  ? 'bg-amber-50 border border-amber-200 text-amber-700'
                  : 'bg-gray-100 border border-gray-200 text-gray-900'
              }`}>
                <Clock size={16} className={isTimerCritical ? 'text-rose-600' : isTimerWarning ? 'text-amber-600' : 'text-gray-600'} />
                <span>{formatTime(timeLeft)}</span>
              </div>

              {/* Submit Test Button */}
              <button
                onClick={() => setShowSubmit(true)}
                className="flex items-center gap-2 px-4 sm:px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs transition-all text-xs sm:text-sm active:scale-95"
              >
                <Send size={15} />
                <span>Submit Test</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-5 sm:py-6">
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {/* Left Column: Question Palette (Desktop Sticky & Mobile Drawer) */}
          <div className="shrink-0 lg:w-72 w-full">
            {/* Desktop Palette */}
            <div className="hidden lg:flex bento-card p-4 sm:p-5 flex-col sticky top-20 max-h-[calc(100vh-6.5rem)] shadow-soft border border-gray-200/80">
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-gray-100">
                <div>
                  <h3 className="text-sm font-extrabold text-gray-900">Question Palette</h3>
                  <p className="text-[11px] font-semibold text-gray-400">Total {questions.length} questions</p>
                </div>
                <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full">
                  Q{currentQ + 1}
                </span>
              </div>

              {/* Status Legend */}
              <div className="grid grid-cols-2 gap-2 pb-3 mb-3 border-b border-gray-100 text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 rounded-lg bg-emerald-500 shrink-0 shadow-xs" />
                  <span className="text-gray-600 font-medium text-[11px]">Ans ({counts.answered})</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 rounded-lg bg-purple-600 shrink-0 shadow-xs" />
                  <span className="text-gray-600 font-medium text-[11px]">Review ({counts.marked})</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 rounded-lg bg-rose-500 shrink-0 shadow-xs" />
                  <span className="text-gray-600 font-medium text-[11px]">Visited ({counts.unanswered})</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 rounded-lg bg-gray-200 shrink-0" />
                  <span className="text-gray-600 font-medium text-[11px]">Unseen ({counts.notVisited})</span>
                </div>
              </div>

              {/* Scrollable Questions Grid for Desktop */}
              <div className="flex-1 overflow-y-auto space-y-4 pr-1.5 custom-scrollbar min-h-0">
                {Array.from(subjectGroups.entries()).map(([subject, indices]) => (
                  <div key={subject} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-gray-800 tracking-tight truncate max-w-[170px]">
                        {subject}
                      </span>
                      <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                        {indices.length} Qs
                      </span>
                    </div>
                    <div className="grid grid-cols-5 gap-1.5">
                      {indices.map(idx => {
                        const status = getQStatus(idx);
                        const isCurrent = idx === currentQ;
                        let bgClasses = 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200/50';
                        if (status === 'answered') bgClasses = 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-xs';
                        else if (status === 'marked') bgClasses = 'bg-purple-600 text-white hover:bg-purple-700 shadow-xs';
                        else if (status === 'unanswered') bgClasses = 'bg-rose-500 text-white hover:bg-rose-600 shadow-xs';

                        return (
                          <button
                            key={idx}
                            onClick={() => navigateTo(idx)}
                            className={`w-9 h-9 rounded-xl text-xs font-bold flex items-center justify-center transition-all ${bgClasses} ${
                              isCurrent ? 'ring-2 ring-indigo-600 ring-offset-2 scale-105 shadow-sm font-black' : ''
                            }`}
                          >
                            {idx + 1}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Mobile Drawer Question Palette */}
            {showPalette && (
              <div className="fixed inset-0 z-50 flex lg:hidden">
                <div
                  className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
                  onClick={() => setShowPalette(false)}
                />
                <div className="relative w-80 max-w-[85vw] h-full bg-[#F4F5F7] p-5 flex flex-col shadow-2xl z-50">
                  <div className="flex items-center justify-between pb-3 mb-3 border-b border-gray-200">
                    <div>
                      <h3 className="text-base font-extrabold text-gray-900">Question Palette</h3>
                      <p className="text-xs font-semibold text-gray-400">Total {questions.length} questions</p>
                    </div>
                    <button
                      onClick={() => setShowPalette(false)}
                      className="p-1.5 rounded-xl border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 shadow-xs"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  {/* Mobile Legend */}
                  <div className="grid grid-cols-2 gap-2 pb-3 mb-3 border-b border-gray-200 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-3.5 h-3.5 rounded-lg bg-emerald-500 shrink-0" />
                      <span className="text-gray-700 font-medium text-[11px]">Ans ({counts.answered})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3.5 h-3.5 rounded-lg bg-purple-600 shrink-0" />
                      <span className="text-gray-700 font-medium text-[11px]">Review ({counts.marked})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3.5 h-3.5 rounded-lg bg-rose-500 shrink-0" />
                      <span className="text-gray-700 font-medium text-[11px]">Visited ({counts.unanswered})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3.5 h-3.5 rounded-lg bg-gray-200 shrink-0" />
                      <span className="text-gray-700 font-medium text-[11px]">Unseen ({counts.notVisited})</span>
                    </div>
                  </div>

                  {/* Scrollable Questions Grid for Mobile Drawer */}
                  <div className="flex-1 overflow-y-auto space-y-4 pr-1 custom-scrollbar min-h-0">
                    {Array.from(subjectGroups.entries()).map(([subject, indices]) => (
                      <div key={subject} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-extrabold text-gray-800 tracking-tight truncate max-w-[180px]">
                            {subject}
                          </span>
                          <span className="text-[10px] font-bold text-gray-500 bg-white border border-gray-200 px-2 py-0.5 rounded-full">
                            {indices.length} Qs
                          </span>
                        </div>
                        <div className="grid grid-cols-5 gap-2">
                          {indices.map(idx => {
                            const status = getQStatus(idx);
                            const isCurrent = idx === currentQ;
                            let bgClasses = 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200';
                            if (status === 'answered') bgClasses = 'bg-emerald-500 text-white shadow-xs';
                            else if (status === 'marked') bgClasses = 'bg-purple-600 text-white shadow-xs';
                            else if (status === 'unanswered') bgClasses = 'bg-rose-500 text-white shadow-xs';

                            return (
                              <button
                                key={idx}
                                onClick={() => { navigateTo(idx); setShowPalette(false); }}
                                className={`w-9 h-9 rounded-xl text-xs font-bold flex items-center justify-center transition-all ${bgClasses} ${
                                  isCurrent ? 'ring-2 ring-indigo-600 ring-offset-2 scale-105 font-black' : ''
                                }`}
                              >
                                {idx + 1}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Question Content */}
          <div className="flex-1 min-w-0 w-full">
            {/* Question Card */}
            <div className="bento-card p-5 sm:p-7 mb-5 shadow-soft border border-gray-200/80">
              {/* Question Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 mb-5 pb-4 border-b border-gray-100">
                <div className="flex items-center gap-2.5">
                  <span className="flex items-center justify-center w-9 h-9 bg-gray-900 text-white rounded-2xl text-sm font-black shadow-xs shrink-0">
                    {currentQ + 1}
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="px-3 py-1 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-full text-xs font-bold">
                      {q.subject}
                    </span>
                    {q.topic && (
                      <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-semibold">
                        {q.topic}
                      </span>
                    )}
                    {q.difficulty && (
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold capitalize ${
                        q.difficulty === 'easy'
                          ? 'bg-emerald-50 border border-emerald-100 text-emerald-700'
                          : q.difficulty === 'hard'
                          ? 'bg-rose-50 border border-rose-100 text-rose-700'
                          : 'bg-amber-50 border border-amber-100 text-amber-700'
                      }`}>
                        {q.difficulty}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <button
                    onClick={toggleBookmark}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                      bookmarkedMap[String(q.id)]
                        ? 'bg-amber-50 border-amber-200 text-amber-800 shadow-xs'
                        : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                    }`}
                    title="Bookmark Question [B]"
                  >
                    {bookmarkedMap[String(q.id)] ? (
                      <BookmarkCheck size={14} className="text-amber-600 fill-amber-500" />
                    ) : (
                      <Bookmark size={14} />
                    )}
                    <span>{bookmarkedMap[String(q.id)] ? 'Saved' : 'Bookmark'}</span>
                  </button>
                  <div className="flex items-center gap-1.5 text-xs font-bold px-2.5 py-1.5 bg-gray-100 rounded-xl text-gray-700 border border-gray-200/60">
                    <span className="text-emerald-600">+{q.marks}</span>
                    {q.negativeMarks !== undefined && (
                      <span className="text-rose-500">-{q.negativeMarks}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Passage (if any) */}
              {q.passage && (
                <div className="mb-5 p-4 bg-gray-50 rounded-2xl border-l-4 border-indigo-600 text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
                  {q.passage}
                </div>
              )}

              {/* Question Text */}
              <p className="text-base sm:text-lg font-bold text-gray-900 mb-6 leading-relaxed whitespace-pre-wrap">
                {q.question}
              </p>

              {/* Image */}
              {q.image && (
                <div className="mb-6 rounded-2xl border border-gray-200 overflow-hidden shadow-xs">
                  <img src={q.image} alt="Question Diagram" className="max-w-full h-auto" />
                </div>
              )}

              {/* Formula */}
              {q.formula && (
                <div className="mb-5 p-3.5 bg-amber-50 rounded-2xl text-sm font-mono text-amber-900 border border-amber-200/60">
                  📐 {q.formula}
                </div>
              )}

              {/* Options */}
              <div className="space-y-3">
                {q.options.map((opt, idx) => {
                  const isSelected = answers[currentQ] === idx;
                  return (
                    <button
                      key={idx}
                      onClick={() => selectAnswer(idx)}
                      className={`w-full text-left p-3.5 sm:p-4 rounded-2xl transition-all shadow-xs group flex items-center gap-3.5 ${
                        isSelected
                          ? 'border-2 border-indigo-600 bg-indigo-50/60 ring-1 ring-indigo-600/20'
                          : 'border border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50/70'
                      }`}
                    >
                      <span className={`w-8 h-8 rounded-xl text-xs font-black flex items-center justify-center shrink-0 transition-colors ${
                        isSelected
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-gray-100 text-gray-700 group-hover:bg-gray-200'
                      }`}>
                        {String.fromCharCode(65 + idx)}
                      </span>
                      <span className={`text-sm sm:text-base leading-relaxed flex-1 ${
                        isSelected ? 'font-bold text-indigo-950' : 'font-medium text-gray-800'
                      }`}>
                        {opt}
                      </span>
                      {isSelected && (
                        <CheckCircle size={20} className="text-indigo-600 shrink-0 ml-auto" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Practice Mode: Learning Section */}
            {mode === 'practice' && answers[currentQ] !== undefined && answers[currentQ] !== null && (
              <div className="bento-card p-5 sm:p-6 mb-5 border-l-4 border-indigo-600 shadow-soft">
                <button
                  onClick={() => setShowLearning(showLearning === currentQ ? null : currentQ)}
                  className="w-full flex items-center justify-between"
                >
                  <span className="font-bold text-gray-900 flex items-center gap-2 text-sm sm:text-base">
                    {answers[currentQ] === q.answerIndex ? (
                      <CheckCircle size={18} className="text-emerald-500" />
                    ) : (
                      <XCircle size={18} className="text-rose-500" />
                    )}
                    {answers[currentQ] === q.answerIndex ? 'Correct! Well done.' : 'Incorrect — Learn from this concept'}
                  </span>
                  <span className="text-xs font-bold text-indigo-600 hover:underline">
                    {showLearning === currentQ ? 'Hide solution' : 'Show solution & notes'}
                  </span>
                </button>
                {showLearning === currentQ && (
                  <div className="mt-4 space-y-3 text-sm pt-3 border-t border-gray-100">
                    {q.hint && (
                      <div className="p-3.5 bg-blue-50/80 rounded-2xl border border-blue-100 text-blue-900">
                        <p className="font-bold text-xs uppercase tracking-wider text-blue-700 mb-1">💡 Hint</p>
                        <p className="text-blue-800">{q.hint}</p>
                      </div>
                    )}
                    {q.solution && (
                      <div className="p-3.5 bg-emerald-50/80 rounded-2xl border border-emerald-100 text-emerald-900">
                        <p className="font-bold text-xs uppercase tracking-wider text-emerald-700 mb-1">📖 Solution</p>
                        <p className="text-emerald-800 whitespace-pre-wrap">{q.solution}</p>
                      </div>
                    )}
                    {q.shortcut && (
                      <div className="p-3.5 bg-purple-50/80 rounded-2xl border border-purple-100 text-purple-900">
                        <p className="font-bold text-xs uppercase tracking-wider text-purple-700 mb-1">⚡ Shortcut</p>
                        <p className="text-purple-800">{q.shortcut}</p>
                      </div>
                    )}
                    {q.learningSuggestion && (
                      <div className="p-3.5 bg-amber-50/80 rounded-2xl border border-amber-100 text-amber-900">
                        <p className="font-bold text-xs uppercase tracking-wider text-amber-700 mb-1">🎯 Takeaway</p>
                        <p className="text-amber-800">{q.learningSuggestion}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Navigation Bottom Controls */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentQ(prev => Math.max(0, prev - 1))}
                  disabled={currentQ === 0}
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all text-xs sm:text-sm shadow-xs"
                >
                  <ChevronLeft size={16} /> Previous
                </button>
                <button
                  onClick={() => setCurrentQ(prev => Math.min(questions.length - 1, prev + 1))}
                  disabled={currentQ === questions.length - 1}
                  className="flex items-center gap-1.5 px-5 py-2.5 bg-gray-900 text-white font-bold rounded-xl hover:bg-black disabled:opacity-40 disabled:cursor-not-allowed transition-all text-xs sm:text-sm shadow-xs active:scale-95"
                >
                  Next <ChevronRight size={16} />
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={toggleReview}
                  className={`flex items-center gap-1.5 px-3.5 sm:px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-xs ${
                    marked[currentQ]
                      ? 'bg-purple-100 border border-purple-200 text-purple-700'
                      : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {marked[currentQ] ? <FlagOff size={15} /> : <Flag size={15} />}
                  <span>{marked[currentQ] ? 'Unmark Review' : 'Mark for Review'}</span>
                </button>
                <button
                  onClick={clearAnswer}
                  className="flex items-center gap-1.5 px-3.5 sm:px-4 py-2.5 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 rounded-xl transition-all text-xs sm:text-sm font-semibold shadow-xs"
                >
                  <Eraser size={15} /> Clear
                </button>
              </div>
            </div>

            {/* Keyboard Shortcuts Helper Bar */}
            <div className="mt-5 p-3 bento-card border border-gray-200/60 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500 shadow-xs">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <span className="font-bold text-gray-700">Shortcuts:</span>
                <span><kbd className="px-1.5 py-0.5 bg-gray-100 rounded font-mono text-[10px] text-gray-800 font-bold border border-gray-200">1-4</kbd> Select</span>
                <span><kbd className="px-1.5 py-0.5 bg-gray-100 rounded font-mono text-[10px] text-gray-800 font-bold border border-gray-200">N / P</kbd> Next/Prev</span>
                <span><kbd className="px-1.5 py-0.5 bg-gray-100 rounded font-mono text-[10px] text-gray-800 font-bold border border-gray-200">B</kbd> Bookmark</span>
                <span><kbd className="px-1.5 py-0.5 bg-gray-100 rounded font-mono text-[10px] text-gray-800 font-bold border border-gray-200">R</kbd> Review</span>
                <span><kbd className="px-1.5 py-0.5 bg-gray-100 rounded font-mono text-[10px] text-gray-800 font-bold border border-gray-200">C</kbd> Clear</span>
              </div>
              <span className="text-[11px] text-emerald-600 font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Auto-saving
              </span>
            </div>
          </div>
        </div>
      </main>

      {/* Exit Confirmation Modal */}
      {showExitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl border border-gray-100">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <AlertTriangle size={22} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Exit Examination?</h3>
                <p className="text-xs text-gray-500">Your test progress is saved</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-6 leading-relaxed">
              Your answered questions and elapsed time are safely saved locally. You can resume this paper at any time from your dashboard.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowExitConfirm(false)}
                className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors font-bold text-sm"
              >
                Keep Practicing
              </button>
              <button
                onClick={onExit}
                className="flex-1 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl transition-colors font-bold text-sm shadow-xs"
              >
                Exit to Dashboard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Submit Confirmation Modal */}
      {showSubmit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl border border-gray-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <Send size={20} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Submit Test?</h3>
                <p className="text-xs text-gray-500">Review your attempt summary</p>
              </div>
            </div>
            <div className="mb-6 space-y-2 text-sm bg-gray-50/80 p-4 rounded-2xl border border-gray-100">
              <div className="flex justify-between py-1 border-b border-gray-200/60">
                <span className="text-gray-600 font-medium">Answered</span>
                <span className="font-bold text-emerald-600">{counts.answered}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-200/60">
                <span className="text-gray-600 font-medium">Marked for Review</span>
                <span className="font-bold text-purple-600">{counts.marked}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-200/60">
                <span className="text-gray-600 font-medium">Not Answered</span>
                <span className="font-bold text-rose-600">{counts.unanswered}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-200/60">
                <span className="text-gray-600 font-medium">Not Visited</span>
                <span className="font-bold text-gray-500">{counts.notVisited}</span>
              </div>
              <div className="flex justify-between pt-1 font-extrabold text-gray-900">
                <span>Total Questions</span>
                <span>{questions.length}</span>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowSubmit(false)}
                className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors font-bold text-sm"
              >
                Continue Exam
              </button>
              <button
                onClick={() => handleSubmit(false)}
                className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-colors font-bold text-sm shadow-xs"
              >
                Confirm Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
