import { useState, useEffect } from 'react';
import { getPaperById, savePaper, getPapers, getAttempts } from './services/database';
import { DEMO_PAPER } from './utils/demoData';
import { Paper, QuestionJSON } from './types';
import AuthGate, { useAuthModal } from './components/AuthGate';
import Dashboard from './components/Dashboard';
import JsonImporter from './components/JsonImporter';
import ExamInterface from './components/ExamInterface';
import ResultsPage from './components/ResultsPage';
import ReviewSession from './components/ReviewSession';
import PWAInstallPrompt from './components/PWAInstallPrompt';
import OfflineIndicator from './components/OfflineIndicator';
import UpdateAvailable from './components/UpdateAvailable';
import { BookOpen, PlusCircle, ArrowLeft, Home, LogIn, UserPlus, LogOut, Sparkles, Brain, CheckCircle2 } from 'lucide-react';
import { usePWA } from './hooks/usePWA';

type View = 'dashboard' | 'import' | 'exam' | 'results' | 'review';

function AppContent() {
  const { user, openLogin, openSignup, signOut, isGuest } = useAuthModal();
  const effectiveUserId = user?.id || 'guest';
  const { isInstallable, isOffline, install, dismissInstall, updateAvailable, update } = usePWA();

  const [view, setView] = useState<View>('dashboard');
  const [activePaper, setActivePaper] = useState<Paper | null>(null);
  const [examMode, setExamMode] = useState<'exam' | 'practice'>('exam');
  const [lastAttemptId, setLastAttemptId] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [demoLoaded, setDemoLoaded] = useState(false);

  // Load demo paper on first visit if library is empty
  useEffect(() => {
    async function loadDemo() {
      if (demoLoaded) return;
      try {
        const papers = await getPapers(effectiveUserId);
        if (papers.length === 0) {
          await savePaper({
            user_id: effectiveUserId,
            exam: DEMO_PAPER.exam,
            title: DEMO_PAPER.paperTitle,
            description: DEMO_PAPER.description || '',
            difficulty: DEMO_PAPER.difficulty || 'medium',
            duration_minutes: DEMO_PAPER.durationMinutes,
            total_marks: DEMO_PAPER.totalMarks,
            negative_marking: DEMO_PAPER.negativeMarking || 0,
            question_count: DEMO_PAPER.questions.length,
            subjects: DEMO_PAPER.subjects || [],
            raw_json: DEMO_PAPER,
            is_demo: true,
            visibility: 'private',
          });
          setRefreshKey(k => k + 1);
        }
      } catch (e) {
        console.error('Failed to load demo:', e);
      }
      setDemoLoaded(true);
    }
    loadDemo();
  }, [demoLoaded, effectiveUserId]);

  const handleStartExam = async (paperId: string) => {
    try {
      const paper = await getPaperById(paperId);
      if (paper) {
        setActivePaper(paper);
        setExamMode('exam');
        setView('exam');
      }
    } catch (e) {
      console.error('Failed to start exam:', e);
    }
  };

  const handleStartPractice = async (paperId: string) => {
    try {
      const paper = await getPaperById(paperId);
      if (paper) {
        setActivePaper(paper);
        setExamMode('practice');
        setView('exam');
      }
    } catch (e) {
      console.error('Failed to start practice:', e);
    }
  };

  const handleStartCustomPractice = (customPaper: Paper) => {
    setActivePaper(customPaper);
    setExamMode('practice');
    setView('exam');
  };

  const handlePracticeTopic = async (subject: string, topic: string) => {
    try {
      const papers = await getPapers(effectiveUserId);
      const matchedQuestions: QuestionJSON[] = [];
      papers.forEach(p => {
        if (p.raw_json?.questions) {
          p.raw_json.questions.forEach(q => {
            const subjectMatch = !subject || q.subject.toLowerCase() === subject.toLowerCase();
            const topicMatch = !topic || q.topic.toLowerCase() === topic.toLowerCase();
            if (subjectMatch && topicMatch) {
              matchedQuestions.push(q);
            }
          });
        }
      });

      if (matchedQuestions.length > 0) {
        const customPaper: Paper = {
          id: `custom_topic_${Date.now()}`,
          user_id: effectiveUserId,
          exam: 'SSC CGL',
          title: `${topic || subject} — Targeted Drill`,
          description: `Focused practice session covering ${topic || subject} (${matchedQuestions.length} questions)`,
          difficulty: 'medium',
          duration_minutes: Math.max(5, Math.ceil(matchedQuestions.length * 1.5)),
          total_marks: matchedQuestions.length * 2,
          negative_marking: 0.5,
          question_count: matchedQuestions.length,
          subjects: subject ? [subject] : Array.from(new Set(matchedQuestions.map(q => q.subject))),
          raw_json: {
            exam: 'SSC CGL',
            paperTitle: `${topic || subject} — Targeted Drill`,
            durationMinutes: Math.max(5, Math.ceil(matchedQuestions.length * 1.5)),
            totalMarks: matchedQuestions.length * 2,
            negativeMarking: 0.5,
            subjects: subject ? [subject] : Array.from(new Set(matchedQuestions.map(q => q.subject))),
            questions: matchedQuestions,
          },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          visibility: 'private',
        };
        handleStartCustomPractice(customPaper);
      } else {
        alert(`No questions found matching topic "${topic || subject}". Try another topic or import more papers.`);
      }
    } catch (err) {
      console.error('Failed to generate topic practice:', err);
    }
  };

  const handleExamComplete = (attemptId: string) => {
    setLastAttemptId(attemptId);
    setView('results');
    setRefreshKey(k => k + 1);
  };

  const handleBackToDashboard = () => {
    setView('dashboard');
    setActivePaper(null);
    setRefreshKey(k => k + 1);
  };

  const handleRetake = async () => {
    if (activePaper) {
      setView('exam');
    } else if (lastAttemptId) {
      const attempts = await getAttempts(effectiveUserId);
      const att = attempts.find(a => a.id === lastAttemptId);
      if (att) {
        const p = await getPaperById(att.paper_id);
        if (p) {
          setActivePaper(p);
          setExamMode('exam');
          setView('exam');
        }
      }
    }
  };

  const handleStartReview = () => {
    setView('review');
  };

  const handleReviewComplete = () => {
    setView('dashboard');
    setRefreshKey(k => k + 1);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col font-sans">
      {/* Unified Modern Navigation Bar */}
      {view !== 'exam' && view !== 'review' && (
        <header className="glass sticky top-0 z-40 border-b border-slate-200/80 dark:border-slate-800/80 shadow-sm transition-all">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16 gap-3">
              {/* Brand Logo & Title */}
              <button onClick={handleBackToDashboard} className="flex items-center gap-3 group text-left">
                <div
                  className="flex items-center justify-center w-10 h-10 rounded-xl shadow-medium group-hover:scale-105 transition-all"
                  style={{ background: 'var(--gradient-brand)' }}
                >
                  <BookOpen size={20} className="text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-gradient leading-none">SSC CGL Prep</span>
                    <span className="badge badge-accent hidden sm:inline-flex">Tier 1 & 2</span>
                  </div>
                  <span className="block text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                    AI-Powered Mock Platform
                  </span>
                </div>
              </button>

              {/* Actions & Auth Controls */}
              <div className="flex items-center gap-2 sm:gap-3">
                {view === 'import' && (
                  <button onClick={handleBackToDashboard} className="btn btn-ghost text-xs">
                    <ArrowLeft size={15} /> Dashboard
                  </button>
                )}
                {view === 'results' && (
                  <button onClick={handleBackToDashboard} className="btn btn-ghost text-xs">
                    <Home size={15} /> Dashboard
                  </button>
                )}
                {view === 'dashboard' && (
                  <button onClick={() => setView('import')} className="btn btn-primary text-xs py-2 px-3.5 shadow-soft">
                    <PlusCircle size={15} /> <span className="hidden sm:inline">Import Paper</span>
                  </button>
                )}

                {/* Account / Sync Status Pill */}
                <div className="border-l border-slate-200 dark:border-slate-800 pl-2 sm:pl-3 flex items-center gap-2">
                  {user ? (
                    <div className="flex items-center gap-2">
                      <div className="hidden md:flex flex-col text-right">
                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[140px]">
                          {user.user_metadata?.display_name || user.email?.split('@')[0]}
                        </span>
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1 justify-end">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Synced
                        </span>
                      </div>
                      <button
                        onClick={() => signOut()}
                        className="p-2 sm:px-3 sm:py-1.5 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1"
                        title="Sign Out"
                      >
                        <LogOut size={14} />
                        <span className="hidden sm:inline">Logout</span>
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <span className="hidden lg:inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/80 px-2.5 py-1 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                        Guest Mode (Offline)
                      </span>
                      <button
                        onClick={openLogin}
                        className="px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center gap-1"
                      >
                        <LogIn size={13} /> Sign In
                      </button>
                      <button
                        onClick={openSignup}
                        className="px-2.5 sm:px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors shadow-soft hidden sm:flex items-center gap-1"
                      >
                        <UserPlus size={13} /> Sign Up
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </header>
      )}

      {/* Main Content Viewport */}
      <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 sm:py-8" style={{ background: 'var(--gradient-soft)' }}>
        {view === 'dashboard' && (
          <Dashboard
            userId={effectiveUserId}
            onStartExam={handleStartExam}
            onPractice={handleStartPractice}
            onStartCustomPractice={handleStartCustomPractice}
            onImport={() => setView('import')}
            onStartReview={handleStartReview}
            refreshKey={refreshKey}
          />
        )}
        {view === 'import' && (
          <JsonImporter
            userId={effectiveUserId}
            onImported={() => { setView('dashboard'); setRefreshKey(k => k + 1); }}
          />
        )}
        {view === 'exam' && activePaper && (
          <ExamInterface
            paper={activePaper}
            userId={effectiveUserId}
            mode={examMode}
            onComplete={handleExamComplete}
            onExit={handleBackToDashboard}
          />
        )}
        {view === 'results' && (
          <ResultsPage
            attemptId={lastAttemptId}
            onRetake={handleRetake}
            onBack={handleBackToDashboard}
            onPractice={handlePracticeTopic}
          />
        )}
        {view === 'review' && (
          <ReviewSession
            userId={effectiveUserId}
            onComplete={handleReviewComplete}
            onExit={handleBackToDashboard}
          />
        )}
      </main>

      {/* Unified Modern Footer */}
      {view !== 'exam' && view !== 'review' && (
        <footer className="glass-panel border-t border-slate-200/60 dark:border-slate-800/60 py-6 mt-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-lg flex items-center justify-center text-white" style={{ background: 'var(--gradient-brand)' }}>
                  <BookOpen size={12} />
                </div>
                <span className="font-semibold text-slate-700 dark:text-slate-300">SSC CGL Prep 2026</span>
                <span>•</span>
                <span>Spaced Repetition & Adaptive Practice</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  Local Storage Active
                </span>
                <span>•</span>
                <span>Tier-1 & Tier-2 Syllabus Ready</span>
              </div>
            </div>
          </div>
        </footer>
      )}

      {/* PWA Components */}
      <OfflineIndicator isOffline={isOffline} />
      {isInstallable && <PWAInstallPrompt onInstall={install} onDismiss={dismissInstall} />}
      {updateAvailable && <UpdateAvailable onUpdate={update} />}
    </div>
  );
}

export default function App() {
  return (
    <AuthGate>
      <AppContent />
    </AuthGate>
  );
}

