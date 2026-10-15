import { useState, useEffect, useCallback, useRef } from 'react';
import { Paper, QuestionJSON, ExamSession, AttemptQuestion } from '../types';
import { saveExamSession, getExamSession, clearExamSession, saveAttempt, addOrUpdateMistake, addBookmark, removeBookmark, getBookmarks } from '../services/database';
import { gradeQuestions, formatTime } from '../utils/grader';
import { Clock, ChevronLeft, ChevronRight, Flag, FlagOff, Eraser, Send, AlertTriangle, CheckCircle, XCircle, MinusCircle, Bookmark, BookmarkCheck, Menu, X, ArrowLeft, Zap, Lightbulb, Target, BookOpen, WifiOff } from 'lucide-react';
import ThemeSwitcher from './ThemeSwitcher';
import QuestionPalette from './QuestionPalette';

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
  const [instantFeedback, setInstantFeedback] = useState<boolean>(mode === 'practice');
  const [revealedQuestions, setRevealedQuestions] = useState<Record<number, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const startTimeRef = useRef(startTime);
  const lastQRef = useRef(0);

  // Monitor network connectivity for peace of mind
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
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
    let answered = 0, markedCount = 0, unanswered = 0, notVisited = 0, correctCount = 0, incorrectCount = 0;
    questions.forEach((_, idx) => {
      if (marked[idx]) { markedCount++; return; }
      if (answers[idx] !== undefined && answers[idx] !== null) {
        answered++;
        if (answers[idx] === questions[idx].answerIndex) {
          correctCount++;
        } else {
          incorrectCount++;
        }
      }
      else if (idx <= Math.max(currentQ, ...Object.keys(answers).map(Number))) { unanswered++; }
      else { notVisited++; }
    });
    return { answered, marked: markedCount, unanswered, notVisited, correct: correctCount, incorrect: incorrectCount };
  };

  const counts = getStatusCounts();


  return (
    <div className="h-screen h-[100dvh] max-h-[100dvh] w-full flex flex-col bg-[var(--bg-app)] font-sans text-[var(--text-main)] antialiased overflow-hidden selection:bg-indigo-500/20">
      {/* Top Navigation Bar */}
      <header className="shrink-0 z-30 bg-[var(--bg-surface)]/95 backdrop-blur-md border-b border-[var(--border-color)] shadow-xs">
        <div className="max-w-[1600px] w-full mx-auto px-2.5 sm:px-4 py-2 sm:py-2.5">
          <div className="flex items-center justify-between gap-1.5 sm:gap-3">
            <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
              <button
                onClick={() => setShowExitConfirm(true)}
                className="flex items-center gap-1 p-2 sm:px-3 sm:py-1.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-subcard)] hover:bg-[var(--bg-subcard-hover)] text-[var(--text-main)] text-xs font-bold shadow-xs transition-all shrink-0"
                title="Exit exam"
              >
                <ArrowLeft size={15} />
                <span className="hidden sm:inline">Exit Exam</span>
              </button>
              <button
                onClick={() => setShowPalette(!showPalette)}
                className="lg:hidden p-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-subcard)] text-[var(--text-main)] hover:bg-[var(--bg-subcard-hover)] shadow-xs shrink-0"
                title="Toggle question palette"
              >
                <Menu size={15} />
              </button>
              <div className="min-w-0">
                <h1 className="text-xs sm:text-base font-extrabold text-[var(--text-main)] truncate tracking-tight max-w-[90px] xs:max-w-[140px] sm:max-w-xs">{paper.title}</h1>
                <p className="text-[11px] font-medium text-[var(--text-muted)] hidden sm:block truncate">
                  Question {currentQ + 1} of {questions.length} • {q.subject} {q.topic ? `• ${q.topic}` : ''}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
              {/* Instant Check Toggle Button */}
              <button
                onClick={() => {
                  const nextVal = !instantFeedback;
                  setInstantFeedback(nextVal);
                  if (nextVal) {
                    setRevealedQuestions(prev => ({ ...prev, [currentQ]: true }));
                  }
                }}
                className={`flex items-center gap-1 px-2 sm:px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-bold border transition-all ${
                  instantFeedback
                    ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs ring-1 ring-emerald-400/40'
                    : 'bg-[var(--bg-subcard)] text-[var(--text-main)] border-[var(--border-color)] hover:bg-[var(--bg-subcard-hover)]'
                }`}
                title={instantFeedback ? 'Instant answer checking is ON' : 'Turn ON instant answer check'}
                aria-pressed={instantFeedback}
              >
                <Zap size={13} className={instantFeedback ? 'text-amber-300 fill-amber-300' : 'text-amber-500'} />
                <span className="hidden xs:inline">Check:</span>
                <span className={instantFeedback ? 'text-amber-200 font-extrabold' : 'text-[var(--text-muted)]'}>
                  {instantFeedback ? 'ON' : 'OFF'}
                </span>
              </button>

              {/* Theme Switcher Compact Pill */}
              <ThemeSwitcher variant="compact" />

              {/* Timer Pill */}
              <div className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl font-mono text-xs sm:text-base font-bold shadow-xs transition-all border ${
                isTimerCritical
                  ? 'bg-rose-500/15 border-rose-500/30 text-rose-500 animate-pulse'
                  : isTimerWarning
                  ? 'bg-amber-500/15 border-amber-500/30 text-amber-500'
                  : 'bg-[var(--bg-subcard)] border-[var(--border-color)] text-[var(--text-main)]'
              }`}>
                <Clock size={14} className={isTimerCritical ? 'text-rose-500' : isTimerWarning ? 'text-amber-500' : 'text-[var(--text-muted)]'} />
                <span>{formatTime(timeLeft)}</span>
              </div>

              {/* Offline Peace-of-Mind Pill */}
              {!isOnline && (
                <div
                  className="flex items-center gap-1 px-2 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-500 text-[11px] font-bold shrink-0 animate-fadeIn"
                  title="Offline mode: All answers, time, and test progress are saved locally on this device"
                >
                  <WifiOff size={13} className="text-amber-500" />
                  <span className="hidden sm:inline">Offline (Saved)</span>
                </div>
              )}

              {/* Submit Test Button */}
              <button
                onClick={() => setShowSubmit(true)}
                className="flex items-center gap-1 sm:gap-2 px-2.5 sm:px-4 py-1.5 sm:py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs transition-all text-xs sm:text-sm active:scale-95 shrink-0"
              >
                <Send size={13} />
                <span className="hidden xs:inline">Submit</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container - Strict 1-Screen CBT Layout */}
      <main className="flex-1 min-h-0 overflow-hidden max-w-[1600px] w-full mx-auto p-2 sm:p-3 flex flex-col lg:flex-row gap-2.5 sm:gap-3.5">
        {/* Left Column: Question Palette (Desktop Fixed Container & Mobile Drawer) */}
        <div className="hidden lg:flex lg:w-76 xl:w-80 h-full flex-col shrink-0 min-h-0">
          <div className="bento-card p-3 sm:p-3.5 h-full flex flex-col overflow-hidden shadow-soft border border-[var(--border-color)] bg-[var(--bg-surface)] rounded-2xl">
            <QuestionPalette
              questions={questions}
              currentQ={currentQ}
              answers={answers}
              marked={marked}
              instantFeedback={instantFeedback}
              revealedQuestions={revealedQuestions}
              counts={counts}
              onSelectQuestion={navigateTo}
            />
          </div>
        </div>

        {/* Mobile Drawer Question Palette */}
        {showPalette && (
          <div className="fixed inset-0 z-50 flex lg:hidden">
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
              onClick={() => setShowPalette(false)}
            />
            <div className="relative w-84 max-w-[88vw] h-full bg-[var(--bg-surface)] text-[var(--text-main)] p-3 sm:p-4 flex flex-col shadow-2xl z-50 border-r border-[var(--border-color)]">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-[var(--border-color)] shrink-0">
                <div>
                  <h3 className="text-sm font-extrabold text-[var(--text-main)]">Question Palette</h3>
                  <p className="text-[11px] font-semibold text-[var(--text-muted)]">Total {questions.length} questions</p>
                </div>
                <button
                  onClick={() => setShowPalette(false)}
                  className="p-1 rounded-lg border border-[var(--border-color)] bg-[var(--bg-subcard)] text-[var(--text-main)] hover:bg-[var(--bg-subcard-hover)] shadow-xs"
                  title="Close question palette"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="flex-1 overflow-hidden min-h-0">
                <QuestionPalette
                  questions={questions}
                  currentQ={currentQ}
                  answers={answers}
                  marked={marked}
                  instantFeedback={instantFeedback}
                  revealedQuestions={revealedQuestions}
                  counts={counts}
                  onSelectQuestion={(idx) => {
                    navigateTo(idx);
                    setShowPalette(false);
                  }}
                  isMobileDrawer={true}
                />
              </div>
            </div>
          </div>
        )}

        {/* Right Column: Question Content & Action Area */}
        <div className="flex-1 min-w-0 h-full flex flex-col overflow-hidden min-h-0">
          <div className="flex-1 min-h-0 flex flex-col bento-card p-3 sm:p-4.5 shadow-soft border border-[var(--border-color)] bg-[var(--bg-surface)] rounded-2xl overflow-hidden">
            {/* 1. Question Header (Fixed / shrink-0) */}
            <div className="shrink-0 flex flex-col gap-2 pb-2.5 mb-2.5 border-b border-[var(--border-color)]">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] rounded-lg sm:rounded-xl text-xs sm:text-sm font-black shadow-xs shrink-0">
                    {currentQ + 1}
                  </span>
                  <span className="text-xs font-bold text-[var(--text-muted)]">
                    Question {currentQ + 1} of {questions.length}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                  <button
                    onClick={toggleBookmark}
                    className={`flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-lg text-xs font-bold border transition-all ${
                      bookmarkedMap[String(q.id)]
                        ? 'bg-amber-500/15 border-amber-500/30 text-amber-500 shadow-xs'
                        : 'bg-[var(--bg-subcard)] border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
                    }`}
                    title="Bookmark Question [B]"
                  >
                    {bookmarkedMap[String(q.id)] ? (
                      <BookmarkCheck size={13} className="text-amber-500 fill-amber-500" />
                    ) : (
                      <Bookmark size={13} />
                    )}
                    <span className="hidden xs:inline">{bookmarkedMap[String(q.id)] ? 'Saved' : 'Bookmark'}</span>
                  </button>
                  <div className="flex items-center gap-1.5 text-xs font-bold px-2 py-1 bg-[var(--bg-subcard)] rounded-lg text-[var(--text-main)] border border-[var(--border-color)]">
                    <span className="text-emerald-500 font-mono">+{q.marks}</span>
                    {q.negativeMarks !== undefined && (
                      <span className="text-rose-500 font-mono">-{q.negativeMarks}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Subject, Topic, Difficulty Pills */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-full text-[10px] sm:text-[11px] font-bold">
                  {q.subject}
                </span>
                {q.topic && (
                  <span className="px-2 py-0.5 bg-[var(--bg-subcard)] border border-[var(--border-color)] text-[var(--text-muted)] rounded-full text-[10px] sm:text-[11px] font-medium truncate max-w-[200px]">
                    {q.topic}
                  </span>
                )}
                {q.difficulty && (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold capitalize border ${
                    q.difficulty === 'easy'
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                      : q.difficulty === 'hard'
                      ? 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                      : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                  }`}>
                    {q.difficulty}
                  </span>
                )}
              </div>
            </div>

            {/* 2. Scrollable Question Content (Question text, passage, image, options, instant solutions) */}
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain pr-1 sm:pr-2 custom-scrollbar space-y-3 sm:space-y-4 pb-20 sm:pb-4">
              {/* Passage (if any) */}
              {q.passage && (
                <div className="p-3 sm:p-3.5 bg-[var(--bg-subcard)] rounded-xl border-l-4 border-indigo-500 text-xs sm:text-sm text-[var(--text-main)] leading-relaxed whitespace-pre-wrap border border-[var(--border-color)]">
                  {q.passage}
                </div>
              )}

              {/* Question Text */}
              <p className="text-sm sm:text-base font-bold text-[var(--text-main)] leading-relaxed whitespace-pre-wrap">
                {q.question}
              </p>

              {/* Image */}
              {q.image && (
                <div className="rounded-xl border border-[var(--border-color)] overflow-hidden shadow-xs max-w-lg">
                  <img src={q.image} alt="Question Diagram" className="max-w-full h-auto" />
                </div>
              )}

              {/* Formula */}
              {q.formula && (
                <div className="p-2.5 bg-amber-500/10 rounded-xl text-xs sm:text-sm font-mono text-amber-400 border border-amber-500/20">
                  📐 {q.formula}
                </div>
              )}

              {/* Options */}
              <div className="space-y-2 sm:space-y-2.5">
                {q.options.map((opt, idx) => {
                  const isSelected = answers[currentQ] === idx;
                  const hasAnswered = answers[currentQ] !== undefined && answers[currentQ] !== null;
                  const isRevealed = instantFeedback || !!revealedQuestions[currentQ];
                  const isCorrect = idx === q.answerIndex;

                  let optionStyle = 'border border-[var(--border-color)] bg-[var(--bg-subcard)] hover:border-indigo-500/50 hover:bg-[var(--bg-subcard-hover)] text-[var(--text-main)]';
                  let badgeStyle = 'bg-[var(--bg-surface)] text-[var(--text-main)] border border-[var(--border-color)] font-bold';

                  if (hasAnswered && isRevealed) {
                    if (isCorrect) {
                      optionStyle = 'border-2 border-emerald-500 bg-emerald-500/15 text-emerald-400 font-bold shadow-xs ring-1 ring-emerald-500/20';
                      badgeStyle = 'bg-emerald-600 text-white font-black shadow-xs';
                    } else if (isSelected && !isCorrect) {
                      optionStyle = 'border-2 border-rose-500 bg-rose-500/15 text-rose-400 font-bold shadow-xs ring-1 ring-rose-500/20';
                      badgeStyle = 'bg-rose-600 text-white font-black shadow-xs';
                    } else {
                      optionStyle = 'border border-[var(--border-color)]/60 bg-[var(--bg-subcard)]/40 text-[var(--text-subtle)] opacity-50';
                      badgeStyle = 'bg-[var(--bg-surface)] text-[var(--text-subtle)] border border-[var(--border-color)]/60';
                    }
                  } else if (isSelected) {
                    optionStyle = 'border-2 border-indigo-500 bg-indigo-500/15 ring-1 ring-indigo-500/30 text-[var(--text-main)] font-bold';
                    badgeStyle = 'bg-indigo-600 text-white font-black shadow-xs';
                  }

                  return (
                    <button
                      key={idx}
                      onClick={() => {
                        selectAnswer(idx);
                        if (instantFeedback) {
                          setRevealedQuestions(prev => ({ ...prev, [currentQ]: true }));
                        }
                      }}
                      className={`w-full text-left p-2.5 sm:p-3 rounded-xl transition-all shadow-xs group flex items-center gap-2.5 sm:gap-3 ${optionStyle}`}
                    >
                      <span className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg text-xs flex items-center justify-center shrink-0 transition-colors ${badgeStyle}`}>
                        {String.fromCharCode(65 + idx)}
                      </span>
                      <span className="text-xs sm:text-sm leading-relaxed flex-1">
                        {opt}
                      </span>
                      {hasAnswered && isRevealed && isCorrect && (
                        <span className="flex items-center gap-1 text-[11px] font-extrabold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-full shrink-0">
                          <CheckCircle size={13} className="text-emerald-400" />
                          <span>Correct</span>
                        </span>
                      )}
                      {hasAnswered && isRevealed && isSelected && !isCorrect && (
                        <span className="flex items-center gap-1 text-[11px] font-extrabold text-rose-400 bg-rose-500/15 border border-rose-500/30 px-2 py-0.5 rounded-full shrink-0">
                          <XCircle size={13} className="text-rose-400" />
                          <span>Your Choice</span>
                        </span>
                      )}
                      {isSelected && !(hasAnswered && isRevealed) && (
                        <CheckCircle size={18} className="text-indigo-400 shrink-0 ml-auto" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Instant Answer Check Trigger (when answer is selected but not yet revealed) */}
              {answers[currentQ] !== undefined && answers[currentQ] !== null && !(instantFeedback || revealedQuestions[currentQ]) && (
                <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex flex-col sm:flex-row items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2 text-[var(--text-main)] text-xs font-semibold">
                    <Zap size={15} className="text-amber-400 shrink-0" />
                    <span>Answer selected. Want to check if it's correct right away?</span>
                  </div>
                  <button
                    onClick={() => {
                      setRevealedQuestions(prev => ({ ...prev, [currentQ]: true }));
                      setShowLearning(currentQ);
                    }}
                    className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white text-xs py-1.5 px-3 rounded-lg font-bold flex items-center justify-center gap-1.5 shadow-xs transition-all"
                  >
                    <Zap size={13} className="text-amber-300 fill-amber-300" />
                    <span>Check Answer Now</span>
                  </button>
                </div>
              )}

              {/* Instant Feedback & Solution Section (revealed in practice mode OR when Instant Check is toggled/revealed) */}
              {answers[currentQ] !== undefined && answers[currentQ] !== null && (instantFeedback || revealedQuestions[currentQ]) && (
                <div className="p-3.5 sm:p-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-subcard)] transition-all space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-[var(--border-color)]">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-white shadow-xs shrink-0 ${
                        answers[currentQ] === q.answerIndex ? 'bg-emerald-600' : 'bg-rose-600'
                      }`}>
                        {answers[currentQ] === q.answerIndex ? <CheckCircle size={18} /> : <XCircle size={18} />}
                      </div>
                      <div>
                        <div className="text-xs sm:text-sm font-extrabold flex items-center gap-2">
                          {answers[currentQ] === q.answerIndex ? (
                            <span className="text-emerald-500">Correct! (+{q.marks} Marks)</span>
                          ) : (
                            <span className="text-rose-500">Incorrect ({q.negativeMarks ? `-${q.negativeMarks}` : '-0.5'} Marks)</span>
                          )}
                        </div>
                        <div className="text-[11px] text-[var(--text-muted)] font-medium mt-0.5">
                          Correct Answer: <strong className="text-emerald-500 font-bold">Option {String.fromCharCode(65 + q.answerIndex)}: {q.options[q.answerIndex]}</strong>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => setShowLearning(showLearning === currentQ ? null : currentQ)}
                      className="px-2.5 py-1 rounded-lg text-xs font-bold border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-main)] hover:bg-[var(--bg-subcard-hover)] flex items-center gap-1.5 self-start sm:self-auto transition-all"
                    >
                      <BookOpen size={13} className="text-indigo-400" />
                      <span>{showLearning === currentQ ? 'Hide Explanation' : 'View Full Solution'}</span>
                    </button>
                  </div>

                  {/* Detailed Solution / Hints / Notes */}
                  {(showLearning === currentQ || instantFeedback) && (
                    <div className="space-y-2.5 text-xs sm:text-sm animate-fadeIn">
                      {q.solution && (
                        <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20 text-[var(--text-main)]">
                          <p className="font-extrabold text-[11px] uppercase tracking-wider text-emerald-400 mb-1 flex items-center gap-1.5">
                            <BookOpen size={13} className="text-emerald-400" /> Step-by-Step Solution
                          </p>
                          <p className="text-[var(--text-main)] whitespace-pre-wrap leading-relaxed text-xs sm:text-sm font-medium">{q.solution}</p>
                        </div>
                      )}
                      {q.hint && (
                        <div className="p-2.5 bg-blue-500/10 rounded-xl border border-blue-500/20 text-[var(--text-main)]">
                          <p className="font-extrabold text-[11px] uppercase tracking-wider text-blue-400 mb-0.5 flex items-center gap-1.5">
                            <Lightbulb size={12} /> Key Hint
                          </p>
                          <p className="text-[var(--text-main)] text-xs sm:text-sm font-medium">{q.hint}</p>
                        </div>
                      )}
                      {q.shortcut && (
                        <div className="p-2.5 bg-purple-500/10 rounded-xl border border-purple-500/20 text-[var(--text-main)]">
                          <p className="font-extrabold text-[11px] uppercase tracking-wider text-purple-400 mb-0.5 flex items-center gap-1.5">
                            <Zap size={12} className="text-purple-400" /> Exam Speed Shortcut
                          </p>
                          <p className="text-[var(--text-main)] text-xs sm:text-sm font-medium">{q.shortcut}</p>
                        </div>
                      )}
                      {q.learningSuggestion && (
                        <div className="p-2.5 bg-amber-500/10 rounded-xl border border-amber-500/20 text-[var(--text-main)]">
                          <p className="font-extrabold text-[11px] uppercase tracking-wider text-amber-400 mb-0.5 flex items-center gap-1.5">
                            <Target size={12} /> Concept Takeaway
                          </p>
                          <p className="text-[var(--text-main)] text-xs sm:text-sm font-medium">{q.learningSuggestion}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 3. Docked Bottom Action Bar (Fixed / shrink-0 at bottom of question card) */}
            <div className="shrink-0 pt-2 sm:pt-3 border-t border-[var(--border-color)] mt-1 z-20 bg-[var(--bg-surface)]">
              {/* Mobile Single-Row Ergonomic Action Bar */}
              <div className="flex sm:hidden items-center justify-between gap-1.5 w-full pb-[max(0.25rem,env(safe-area-inset-bottom,0px))]">
                <button
                  onClick={() => setCurrentQ(prev => Math.max(0, prev - 1))}
                  disabled={currentQ === 0}
                  className="flex items-center justify-center gap-1 px-2.5 py-2 bg-[var(--bg-subcard)] border border-[var(--border-color)] text-[var(--text-main)] font-bold rounded-xl hover:bg-[var(--bg-subcard-hover)] disabled:opacity-25 disabled:cursor-not-allowed transition-all text-xs shadow-xs shrink-0 active:scale-95"
                  title="Previous Question"
                >
                  <ChevronLeft size={16} />
                  <span>Prev</span>
                </button>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={toggleReview}
                    className={`flex items-center justify-center gap-1 px-2.5 py-2 rounded-xl text-xs font-bold transition-all shadow-xs active:scale-95 ${
                      marked[currentQ]
                        ? 'bg-purple-500/15 border border-purple-500/40 text-purple-400'
                        : 'bg-[var(--bg-subcard)] border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
                    }`}
                    title={marked[currentQ] ? 'Unmark Review' : 'Mark for Review'}
                  >
                    {marked[currentQ] ? <FlagOff size={14} /> : <Flag size={14} />}
                    <span className="text-[11px] font-semibold">{marked[currentQ] ? 'Marked' : 'Review'}</span>
                  </button>

                  <button
                    onClick={clearAnswer}
                    disabled={answers[currentQ] === undefined || answers[currentQ] === null}
                    className="flex items-center justify-center gap-1 px-2.5 py-2 bg-[var(--bg-subcard)] border border-[var(--border-color)] text-[var(--text-muted)] hover:text-rose-400 hover:border-rose-500/30 rounded-xl transition-all text-xs font-semibold shadow-xs disabled:opacity-30 disabled:cursor-not-allowed active:scale-95"
                    title="Clear Answer"
                  >
                    <Eraser size={14} />
                    <span className="text-[11px]">Clear</span>
                  </button>
                </div>

                {currentQ < questions.length - 1 ? (
                  <button
                    onClick={() => setCurrentQ(prev => Math.min(questions.length - 1, prev + 1))}
                    className="flex-1 max-w-[130px] flex items-center justify-center gap-1 px-3.5 py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all text-xs shadow-md active:scale-95 shrink-0"
                  >
                    <span>Next</span>
                    <ChevronRight size={16} />
                  </button>
                ) : (
                  <button
                    onClick={() => setShowSubmit(true)}
                    className="flex-1 max-w-[130px] flex items-center justify-center gap-1 px-3.5 py-2 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-all text-xs shadow-md active:scale-95 shrink-0"
                  >
                    <Send size={14} />
                    <span>Submit</span>
                  </button>
                )}
              </div>

              {/* Desktop / Tablet Multi-column Action Bar */}
              <div className="hidden sm:flex sm:items-center justify-between gap-2 w-full">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentQ(prev => Math.max(0, prev - 1))}
                    disabled={currentQ === 0}
                    className="flex items-center justify-center gap-1 px-4 py-2 bg-[var(--bg-subcard)] border border-[var(--border-color)] text-[var(--text-main)] font-bold rounded-xl hover:bg-[var(--bg-subcard-hover)] disabled:opacity-30 disabled:cursor-not-allowed transition-all text-sm shadow-xs"
                  >
                    <ChevronLeft size={16} /> Previous
                  </button>
                  {currentQ < questions.length - 1 ? (
                    <button
                      onClick={() => setCurrentQ(prev => Math.min(questions.length - 1, prev + 1))}
                      className="flex items-center justify-center gap-1 px-5 py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all text-sm shadow-md active:scale-95"
                    >
                      Next <ChevronRight size={16} />
                    </button>
                  ) : (
                    <button
                      onClick={() => setShowSubmit(true)}
                      className="flex items-center justify-center gap-1 px-5 py-2 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-all text-sm shadow-md active:scale-95"
                    >
                      <Send size={15} /> Submit Test
                    </button>
                  )}
                </div>

                {/* Center keyboard hints - visible on desktop/tablets */}
                <div className="hidden xl:flex items-center gap-2 text-[11px] text-[var(--text-muted)] font-medium">
                  <span><kbd className="px-1 py-0.2 bg-[var(--bg-subcard)] rounded font-mono text-[10px] text-[var(--text-main)] border border-[var(--border-color)]">1-4</kbd> Ans</span>
                  <span><kbd className="px-1 py-0.2 bg-[var(--bg-subcard)] rounded font-mono text-[10px] text-[var(--text-main)] border border-[var(--border-color)]">N/P</kbd> Nav</span>
                  <span><kbd className="px-1 py-0.2 bg-[var(--bg-subcard)] rounded font-mono text-[10px] text-[var(--text-main)] border border-[var(--border-color)]">B</kbd> Bookmark</span>
                  <span><kbd className="px-1 py-0.2 bg-[var(--bg-subcard)] rounded font-mono text-[10px] text-[var(--text-main)] border border-[var(--border-color)]">R</kbd> Review</span>
                  <span><kbd className="px-1 py-0.2 bg-[var(--bg-subcard)] rounded font-mono text-[10px] text-[var(--text-main)] border border-[var(--border-color)]">C</kbd> Clear</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={toggleReview}
                    className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold transition-all shadow-xs ${
                      marked[currentQ]
                        ? 'bg-purple-500/15 border border-purple-500/40 text-purple-400 font-bold'
                        : 'bg-[var(--bg-subcard)] border border-[var(--border-color)] text-[var(--text-main)] hover:bg-[var(--bg-subcard-hover)]'
                    }`}
                  >
                    {marked[currentQ] ? <FlagOff size={15} /> : <Flag size={15} />}
                    <span>{marked[currentQ] ? 'Unmark Review' : 'Mark Review'}</span>
                  </button>
                  <button
                    onClick={clearAnswer}
                    disabled={answers[currentQ] === undefined || answers[currentQ] === null}
                    className="flex items-center justify-center gap-1 px-3 py-2 bg-[var(--bg-subcard)] border border-[var(--border-color)] text-[var(--text-muted)] hover:text-rose-400 hover:border-rose-500/30 rounded-xl transition-all text-sm font-semibold shadow-xs disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <Eraser size={15} /> Clear
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Exit Confirmation Modal */}
      {showExitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-[var(--bg-surface)] text-[var(--text-main)] rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl border border-[var(--border-color)]">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-500 flex items-center justify-center shrink-0">
                <AlertTriangle size={22} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[var(--text-main)]">Exit Examination?</h3>
                <p className="text-xs text-[var(--text-muted)]">Your test progress is saved</p>
              </div>
            </div>
            <p className="text-sm text-[var(--text-muted)] mb-6 leading-relaxed">
              Your answered questions and elapsed time are safely saved locally. You can resume this paper at any time from your dashboard.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowExitConfirm(false)}
                className="flex-1 px-4 py-2.5 bg-[var(--bg-subcard)] text-[var(--text-main)] border border-[var(--border-color)] rounded-xl hover:bg-[var(--bg-subcard-hover)] transition-colors font-bold text-sm"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-[var(--bg-surface)] text-[var(--text-main)] rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl border border-[var(--border-color)]">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center shrink-0">
                <Send size={20} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[var(--text-main)]">Submit Test?</h3>
                <p className="text-xs text-[var(--text-muted)]">Review your attempt summary</p>
              </div>
            </div>
            <div className="mb-6 space-y-2 text-sm bg-[var(--bg-subcard)] p-4 rounded-2xl border border-[var(--border-color)]">
              <div className="flex justify-between py-1 border-b border-[var(--border-color)]">
                <span className="text-[var(--text-muted)] font-medium">Answered</span>
                <span className="font-bold text-emerald-500 font-mono">{counts.answered}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[var(--border-color)]">
                <span className="text-[var(--text-muted)] font-medium">Marked for Review</span>
                <span className="font-bold text-purple-500 font-mono">{counts.marked}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[var(--border-color)]">
                <span className="text-[var(--text-muted)] font-medium">Not Answered</span>
                <span className="font-bold text-rose-500 font-mono">{counts.unanswered}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[var(--border-color)]">
                <span className="text-[var(--text-muted)] font-medium">Not Visited</span>
                <span className="font-bold text-[var(--text-muted)] font-mono">{counts.notVisited}</span>
              </div>
              <div className="flex justify-between pt-1 font-extrabold text-[var(--text-main)]">
                <span>Total Questions</span>
                <span className="font-mono">{questions.length}</span>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowSubmit(false)}
                className="flex-1 px-4 py-2.5 bg-[var(--bg-subcard)] text-[var(--text-main)] border border-[var(--border-color)] rounded-xl hover:bg-[var(--bg-subcard-hover)] transition-colors font-bold text-sm"
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
