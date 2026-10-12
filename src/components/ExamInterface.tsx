import { useState, useEffect, useCallback, useRef } from 'react';
import { Paper, QuestionJSON, ExamSession, AttemptQuestion } from '../types';
import { saveExamSession, getExamSession, clearExamSession, saveAttempt, addOrUpdateMistake, addBookmark, removeBookmark, getBookmarks } from '../services/database';
import { gradeQuestions, formatTime } from '../utils/grader';
import { Clock, ChevronLeft, ChevronRight, Flag, FlagOff, Eraser, Send, AlertTriangle, CheckCircle, XCircle, MinusCircle, Bookmark, BookmarkCheck, Menu, X, ArrowLeft, Zap, Lightbulb, Target, BookOpen } from 'lucide-react';
import ThemeSwitcher from './ThemeSwitcher';

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

  // Group questions by subject for palette
  const subjectGroups = new Map<string, number[]>();
  questions.forEach((q, idx) => {
    const subj = q.subject || 'General';
    if (!subjectGroups.has(subj)) subjectGroups.set(subj, []);
    subjectGroups.get(subj)!.push(idx);
  });

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

  return (
    <div className="min-h-screen bg-[var(--bg-app)] font-sans text-[var(--text-main)] antialiased selection:bg-indigo-500/20">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 bg-[var(--bg-surface)]/95 backdrop-blur-md border-b border-[var(--border-color)] shadow-xs">
        <div className="max-w-7xl mx-auto px-2.5 sm:px-6 py-2.5 sm:py-3">
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

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6 pb-[calc(env(safe-area-inset-bottom,0px)+4rem)] sm:pb-8">
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
                        if (status === 'correct') bgClasses = 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs ring-1 ring-emerald-400';
                        else if (status === 'incorrect') bgClasses = 'bg-rose-600 text-white hover:bg-rose-700 shadow-xs ring-1 ring-rose-400';
                        else if (status === 'answered') bgClasses = 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs';
                        else if (status === 'marked') bgClasses = 'bg-purple-600 text-white hover:bg-purple-700 shadow-xs';
                        else if (status === 'unanswered') bgClasses = 'bg-amber-500 text-white hover:bg-amber-600 shadow-xs';

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
                  className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
                  onClick={() => setShowPalette(false)}
                />
                <div className="relative w-80 max-w-[85vw] h-full bg-[var(--bg-surface)] text-[var(--text-main)] p-5 flex flex-col shadow-2xl z-50 border-r border-[var(--border-color)]">
                  <div className="flex items-center justify-between pb-3 mb-3 border-b border-[var(--border-color)]">
                    <div>
                      <h3 className="text-base font-extrabold text-[var(--text-main)]">Question Palette</h3>
                      <p className="text-xs font-semibold text-[var(--text-subtle)]">Total {questions.length} questions</p>
                    </div>
                    <button
                      onClick={() => setShowPalette(false)}
                      className="p-1.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-subcard)] text-[var(--text-main)] hover:bg-[var(--bg-subcard-hover)] shadow-xs"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  {/* Mobile Legend */}
                  <div className="grid grid-cols-2 gap-2 pb-3 mb-3 border-b border-[var(--border-color)] text-xs">
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
                            if (status === 'correct') bgClasses = 'bg-emerald-600 text-white shadow-xs ring-1 ring-emerald-400';
                            else if (status === 'incorrect') bgClasses = 'bg-rose-600 text-white shadow-xs ring-1 ring-rose-400';
                            else if (status === 'answered') bgClasses = 'bg-indigo-600 text-white shadow-xs';
                            else if (status === 'marked') bgClasses = 'bg-purple-600 text-white shadow-xs';
                            else if (status === 'unanswered') bgClasses = 'bg-amber-500 text-white shadow-xs';

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
            <div className="bento-card p-4 sm:p-7 mb-5 shadow-soft border border-[var(--border-color)]">
              {/* Question Header */}
              <div className="flex flex-col gap-3 mb-5 pb-4 border-b border-[var(--border-color)]">
                {/* Top Row: Q Counter + Bookmark + Marks */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] rounded-xl sm:rounded-2xl text-xs sm:text-sm font-black shadow-xs shrink-0">
                      {currentQ + 1}
                    </span>
                    <span className="text-xs font-bold text-[var(--text-muted)]">
                      Question {currentQ + 1} of {questions.length}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={toggleBookmark}
                      className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                        bookmarkedMap[String(q.id)]
                          ? 'bg-amber-500/15 border-amber-500/30 text-amber-500 shadow-xs'
                          : 'bg-[var(--bg-subcard)] border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
                      }`}
                      title="Bookmark Question [B]"
                    >
                      {bookmarkedMap[String(q.id)] ? (
                        <BookmarkCheck size={14} className="text-amber-500 fill-amber-500" />
                      ) : (
                        <Bookmark size={14} />
                      )}
                      <span className="hidden xs:inline">{bookmarkedMap[String(q.id)] ? 'Saved' : 'Bookmark'}</span>
                    </button>
                    <div className="flex items-center gap-1.5 text-xs font-bold px-2 sm:px-2.5 py-1.5 bg-[var(--bg-subcard)] rounded-xl text-[var(--text-main)] border border-[var(--border-color)]">
                      <span className="text-emerald-500">+{q.marks}</span>
                      {q.negativeMarks !== undefined && (
                        <span className="text-rose-500">-{q.negativeMarks}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Second Row: Subject, Topic, Difficulty Pills */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="px-2.5 py-1 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-full text-[11px] font-bold">
                    {q.subject}
                  </span>
                  {q.topic && (
                    <span className="px-2.5 py-1 bg-[var(--bg-subcard)] border border-[var(--border-color)] text-[var(--text-muted)] rounded-full text-[11px] font-medium">
                      {q.topic}
                    </span>
                  )}
                  {q.difficulty && (
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold capitalize border ${
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

              {/* Passage (if any) */}
              {q.passage && (
                <div className="mb-5 p-4 bg-[var(--bg-subcard)] rounded-2xl border-l-4 border-indigo-500 text-sm text-[var(--text-main)] leading-relaxed whitespace-pre-wrap border border-[var(--border-color)]">
                  {q.passage}
                </div>
              )}

              {/* Question Text */}
              <p className="text-base sm:text-lg font-bold text-[var(--text-main)] mb-6 leading-relaxed whitespace-pre-wrap">
                {q.question}
              </p>

              {/* Image */}
              {q.image && (
                <div className="mb-6 rounded-2xl border border-[var(--border-color)] overflow-hidden shadow-xs">
                  <img src={q.image} alt="Question Diagram" className="max-w-full h-auto" />
                </div>
              )}

              {/* Formula */}
              {q.formula && (
                <div className="mb-5 p-3.5 bg-amber-500/10 rounded-2xl text-sm font-mono text-amber-400 border border-amber-500/20">
                  📐 {q.formula}
                </div>
              )}

              {/* Options */}
              <div className="space-y-3">
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
                      className={`w-full text-left p-3.5 sm:p-4 rounded-2xl transition-all shadow-xs group flex items-center gap-3.5 ${optionStyle}`}
                    >
                      <span className={`w-8 h-8 rounded-xl text-xs flex items-center justify-center shrink-0 transition-colors ${badgeStyle}`}>
                        {String.fromCharCode(65 + idx)}
                      </span>
                      <span className="text-sm sm:text-base leading-relaxed flex-1">
                        {opt}
                      </span>
                      {hasAnswered && isRevealed && isCorrect && (
                        <span className="flex items-center gap-1 text-xs font-extrabold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-1 rounded-full shrink-0">
                          <CheckCircle size={14} className="text-emerald-400" />
                          <span>Correct</span>
                        </span>
                      )}
                      {hasAnswered && isRevealed && isSelected && !isCorrect && (
                        <span className="flex items-center gap-1 text-xs font-extrabold text-rose-400 bg-rose-500/15 border border-rose-500/30 px-2.5 py-1 rounded-full shrink-0">
                          <XCircle size={14} className="text-rose-400" />
                          <span>Your Choice</span>
                        </span>
                      )}
                      {isSelected && !(hasAnswered && isRevealed) && (
                        <CheckCircle size={20} className="text-indigo-400 shrink-0 ml-auto" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Instant Answer Check Trigger (when answer is selected but not yet revealed) */}
              {answers[currentQ] !== undefined && answers[currentQ] !== null && !(instantFeedback || revealedQuestions[currentQ]) && (
                <div className="mt-5 p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-100 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-indigo-900 text-xs font-semibold">
                    <Zap size={16} className="text-indigo-600 shrink-0" />
                    <span>Answer selected. Want to check if it's correct right away?</span>
                  </div>
                  <button
                    onClick={() => {
                      setRevealedQuestions(prev => ({ ...prev, [currentQ]: true }));
                      setShowLearning(currentQ);
                    }}
                    className="w-full sm:w-auto btn btn-primary text-xs py-2 px-4 rounded-full flex items-center justify-center gap-1.5 shadow-xs"
                  >
                    <Zap size={13} className="text-amber-300 fill-amber-300" />
                    <span>Check Answer Now</span>
                  </button>
                </div>
              )}
            </div>

            {/* Instant Feedback & Solution Section (revealed in practice mode OR when Instant Check is toggled/revealed) */}
            {answers[currentQ] !== undefined && answers[currentQ] !== null && (instantFeedback || revealedQuestions[currentQ]) && (
              <div className="bento-card p-5 sm:p-6 mb-5 shadow-soft border border-gray-200/80 transition-all">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-2xl flex items-center justify-center font-bold text-white shadow-xs shrink-0 ${
                      answers[currentQ] === q.answerIndex ? 'bg-emerald-600' : 'bg-rose-600'
                    }`}>
                      {answers[currentQ] === q.answerIndex ? <CheckCircle size={20} /> : <XCircle size={20} />}
                    </div>
                    <div>
                      <div className="text-sm sm:text-base font-extrabold text-gray-900 flex items-center gap-2">
                        {answers[currentQ] === q.answerIndex ? (
                          <span className="text-emerald-700">Correct! (+{q.marks} Marks)</span>
                        ) : (
                          <span className="text-rose-700">Incorrect ({q.negativeMarks ? `-${q.negativeMarks}` : '-0.5'} Marks)</span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 font-semibold mt-0.5">
                        Correct Answer is <strong className="text-emerald-700">Option {String.fromCharCode(65 + q.answerIndex)}: {q.options[q.answerIndex]}</strong>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => setShowLearning(showLearning === currentQ ? null : currentQ)}
                    className="btn btn-outline text-xs py-1.5 px-3.5 rounded-full flex items-center gap-1.5 self-start sm:self-auto"
                  >
                    <BookOpen size={13} className="text-indigo-600" />
                    <span>{showLearning === currentQ ? 'Hide Explanation' : 'View Full Solution'}</span>
                  </button>
                </div>

                {/* Detailed Solution / Hints / Notes */}
                {(showLearning === currentQ || instantFeedback) && (
                  <div className="mt-4 space-y-3 text-sm animate-fadeIn">
                    {q.solution && (
                      <div className="p-4 bg-emerald-50/80 rounded-2xl border border-emerald-100 text-emerald-950">
                        <p className="font-extrabold text-xs uppercase tracking-wider text-emerald-800 mb-1.5 flex items-center gap-1.5">
                          <BookOpen size={14} className="text-emerald-600" /> Step-by-Step Solution
                        </p>
                        <p className="text-emerald-900 whitespace-pre-wrap leading-relaxed text-xs sm:text-sm font-medium">{q.solution}</p>
                      </div>
                    )}
                    {q.hint && (
                      <div className="p-3.5 bg-blue-50/80 rounded-2xl border border-blue-100 text-blue-900">
                        <p className="font-extrabold text-xs uppercase tracking-wider text-blue-700 mb-1 flex items-center gap-1.5">
                          <Lightbulb size={13} /> Key Hint
                        </p>
                        <p className="text-blue-800 text-xs sm:text-sm font-medium">{q.hint}</p>
                      </div>
                    )}
                    {q.shortcut && (
                      <div className="p-3.5 bg-purple-50/80 rounded-2xl border border-purple-100 text-purple-900">
                        <p className="font-extrabold text-xs uppercase tracking-wider text-purple-700 mb-1 flex items-center gap-1.5">
                          <Zap size={13} className="text-purple-600" /> Exam Speed Shortcut
                        </p>
                        <p className="text-purple-800 text-xs sm:text-sm font-medium">{q.shortcut}</p>
                      </div>
                    )}
                    {q.learningSuggestion && (
                      <div className="p-3.5 bg-amber-50/80 rounded-2xl border border-amber-100 text-amber-900">
                        <p className="font-extrabold text-xs uppercase tracking-wider text-amber-700 mb-1 flex items-center gap-1.5">
                          <Target size={13} /> Concept Takeaway
                        </p>
                        <p className="text-amber-800 text-xs sm:text-sm font-medium">{q.learningSuggestion}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Navigation Bottom Controls */}
            <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center sm:justify-between gap-2.5 sm:gap-3">
              <div className="contents sm:flex sm:items-center sm:gap-2">
                <button
                  onClick={() => setCurrentQ(prev => Math.max(0, prev - 1))}
                  disabled={currentQ === 0}
                  className="w-full sm:w-auto justify-center flex items-center gap-1.5 px-3.5 sm:px-4 py-2.5 bg-[var(--bg-subcard)] border border-[var(--border-color)] text-[var(--text-main)] font-bold rounded-xl hover:bg-[var(--bg-subcard-hover)] disabled:opacity-30 disabled:cursor-not-allowed transition-all text-xs sm:text-sm shadow-xs"
                >
                  <ChevronLeft size={16} /> Previous
                </button>
                <button
                  onClick={() => setCurrentQ(prev => Math.min(questions.length - 1, prev + 1))}
                  disabled={currentQ === questions.length - 1}
                  className="w-full sm:w-auto justify-center flex items-center gap-1.5 px-4 sm:px-5 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all text-xs sm:text-sm shadow-md active:scale-95"
                >
                  Next <ChevronRight size={16} />
                </button>
              </div>

              <div className="contents sm:flex sm:items-center sm:gap-2">
                <button
                  onClick={toggleReview}
                  className={`w-full sm:w-auto justify-center flex items-center gap-1.5 px-3 sm:px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-xs ${
                    marked[currentQ]
                      ? 'bg-purple-500/15 border border-purple-500/40 text-purple-400 font-bold'
                      : 'bg-[var(--bg-subcard)] border border-[var(--border-color)] text-[var(--text-main)] hover:bg-[var(--bg-subcard-hover)]'
                  }`}
                >
                  {marked[currentQ] ? <FlagOff size={15} /> : <Flag size={15} />}
                  <span className="truncate">{marked[currentQ] ? 'Unmark Review' : 'Mark Review'}</span>
                </button>
                <button
                  onClick={clearAnswer}
                  className="w-full sm:w-auto justify-center flex items-center gap-1.5 px-3 sm:px-4 py-2.5 bg-[var(--bg-subcard)] border border-[var(--border-color)] text-[var(--text-muted)] hover:text-rose-400 hover:border-rose-500/30 rounded-xl transition-all text-xs sm:text-sm font-semibold shadow-xs"
                >
                  <Eraser size={15} /> Clear
                </button>
              </div>
            </div>

            {/* Keyboard Shortcuts Helper Bar */}
            <div className="mt-5 p-3 bento-card border border-[var(--border-color)] hidden sm:flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--text-subtle)] shadow-xs">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <span className="font-bold text-[var(--text-main)]">Shortcuts:</span>
                <span><kbd className="px-1.5 py-0.5 bg-[var(--bg-subcard)] rounded font-mono text-[10px] text-[var(--text-main)] font-bold border border-[var(--border-color)]">1-4</kbd> Select</span>
                <span><kbd className="px-1.5 py-0.5 bg-[var(--bg-subcard)] rounded font-mono text-[10px] text-[var(--text-main)] font-bold border border-[var(--border-color)]">N / P</kbd> Next/Prev</span>
                <span><kbd className="px-1.5 py-0.5 bg-[var(--bg-subcard)] rounded font-mono text-[10px] text-[var(--text-main)] font-bold border border-[var(--border-color)]">B</kbd> Bookmark</span>
                <span><kbd className="px-1.5 py-0.5 bg-[var(--bg-subcard)] rounded font-mono text-[10px] text-[var(--text-main)] font-bold border border-[var(--border-color)]">R</kbd> Review</span>
                <span><kbd className="px-1.5 py-0.5 bg-[var(--bg-subcard)] rounded font-mono text-[10px] text-[var(--text-main)] font-bold border border-[var(--border-color)]">C</kbd> Clear</span>
              </div>
              <span className="text-[11px] text-emerald-500 font-bold flex items-center gap-1">
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
