import { useState, useEffect } from 'react';
import { getPaperById, savePaper, getPapers, getAttempts } from './services/database';
import { DEMO_PAPER } from './utils/demoData';
import { Paper, QuestionJSON } from './types';
import AuthGate, { useAuthModal } from './components/AuthGate';
import Dashboard, { DashboardTab } from './components/Dashboard';
import JsonImporter from './components/JsonImporter';
import ExamInterface from './components/ExamInterface';
import ResultsPage from './components/ResultsPage';
import ReviewSession from './components/ReviewSession';
import PWAInstallPrompt from './components/PWAInstallPrompt';
import OfflineIndicator from './components/OfflineIndicator';
import UpdateAvailable from './components/UpdateAvailable';
import ThemeSwitcher from './components/ThemeSwitcher';
import { BookOpen, PlusCircle, ArrowLeft, Home, LogIn, UserPlus, LogOut, Sparkles, Brain, CheckCircle2, LayoutDashboard, Target, AlertTriangle, Bookmark, BarChart3, Search, User as UserIcon, X, FileText } from 'lucide-react';
import { usePWA } from './hooks/usePWA';

type View = 'dashboard' | 'import' | 'exam' | 'results' | 'review';

function AppContent() {
  const { user, openLogin, openSignup, signOut, isGuest, loading } = useAuthModal();
  const effectiveUserId = user?.id || 'guest';
  const { isInstallable, isOffline, wasOffline, pendingSyncCount, syncNow, install, dismissInstall, updateAvailable, update } = usePWA();

  const [view, setView] = useState<View>('dashboard');
  const [dashboardTab, setDashboardTab] = useState<DashboardTab>('overview');
  const [activePaper, setActivePaper] = useState<Paper | null>(null);
  const [examMode, setExamMode] = useState<'exam' | 'practice'>('exam');
  const [lastAttemptId, setLastAttemptId] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [demoLoaded, setDemoLoaded] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);

  // Load demo paper on first visit if library is empty (only after auth has resolved)
  useEffect(() => {
    async function loadDemo() {
      if (loading || demoLoaded) return;
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
  }, [loading, demoLoaded, effectiveUserId]);

  // Deep-link support for 1-click shared exam links: ?exam=<paperId> or ?paper=<paperId>
  useEffect(() => {
    if (loading) return;
    const params = new URLSearchParams(window.location.search);
    const sharedPaperId = params.get('exam') || params.get('paper');
    if (sharedPaperId) {
      getPaperById(sharedPaperId).then(paper => {
        if (paper) {
          setActivePaper(paper);
          setExamMode('exam');
          setView('exam');
        } else {
          console.warn('[DeepLink] Shared test not found:', sharedPaperId);
        }
      }).catch(err => {
        console.error('[DeepLink] Failed to load shared test:', err);
      });
    }
  }, [loading]);

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
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.has('exam') || url.searchParams.has('paper')) {
        url.searchParams.delete('exam');
        url.searchParams.delete('paper');
        window.history.replaceState({}, '', url.pathname + (url.search ? url.search : ''));
      }
    } catch {}
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

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F4F5F7] flex items-center justify-center p-6 font-sans">
        <div className="bento-card p-8 flex flex-col items-center gap-4 text-center max-w-sm w-full shadow-soft animate-fade-in">
          <div className="w-12 h-12 rounded-2xl bg-gray-900 text-white flex items-center justify-center animate-pulse">
            <BookOpen size={22} className="text-emerald-400" />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900">SSC CGL Prep</h2>
            <p className="text-xs text-gray-500 mt-1">Preparing your workspace...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F5F7] flex flex-col md:flex-row font-sans text-gray-900">
      {/* Desktop Left Sidebar (Matching Image 2) */}
      {view !== 'exam' && view !== 'review' && (
        <aside className="hidden md:flex flex-col w-64 shrink-0 bg-[#F4F5F7] p-5 border-r border-gray-200/80 sticky top-0 h-screen justify-between z-30 select-none">
          <div>
            {/* Brand Logo & Title */}
            <button
              onClick={() => { setView('dashboard'); setDashboardTab('overview'); }}
              className="flex items-center gap-3 px-2 py-3 mb-6 w-full text-left group"
            >
              <div className="w-10 h-10 rounded-2xl bg-gray-900 text-white flex items-center justify-center font-black shadow-xs group-hover:scale-105 transition-transform">
                <BookOpen size={20} className="text-emerald-400" />
              </div>
              <div>
                <div className="text-sm font-extrabold tracking-tight text-gray-900 leading-tight">
                  SSC CGL Prep
                </div>
                <div className="text-[11px] font-semibold text-gray-400">
                  Tier 1 & 2 Platform
                </div>
              </div>
            </button>

            {/* Nav Items (Matching Image 2 left navigation) */}
            <nav className="space-y-1.5">
              {[
                { id: 'overview' as const, label: 'Dashboard', icon: LayoutDashboard },
                { id: 'library' as const, label: 'Exam Library', icon: BookOpen },
                { id: 'practice' as const, label: 'Practice Hub', icon: Target },
                { id: 'notes' as const, label: 'Study Notes', icon: FileText },
                { id: 'mistakes' as const, label: 'Mistakes', icon: AlertTriangle },
                { id: 'bookmarks' as const, label: 'Bookmarks', icon: Bookmark },
                { id: 'analytics' as const, label: 'Analytics', icon: BarChart3 },
              ].map(item => {
                const isActive = view === 'dashboard' && dashboardTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => { setView('dashboard'); setDashboardTab(item.id); }}
                    className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl text-xs font-semibold transition-all ${
                      isActive
                        ? 'bg-white text-gray-900 shadow-xs'
                        : 'text-gray-500 hover:text-gray-900 hover:bg-white/50'
                    }`}
                  >
                    <item.icon size={18} className={isActive ? 'text-gray-900' : 'text-gray-400'} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Bottom of Sidebar: Theme Switcher & Profile / Status */}
          <div className="pt-4 border-t border-gray-200/80 space-y-3">
            <ThemeSwitcher variant="full" />

            {user ? (
              <div className="flex items-center justify-between p-2.5 rounded-2xl bg-white border border-gray-100 shadow-2xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-gray-900 text-white font-bold text-xs flex items-center justify-center shrink-0">
                    {(user.user_metadata?.display_name || 'A')[0].toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-gray-900 truncate">
                      {user.user_metadata?.display_name || 'SSC Aspirant'}
                    </div>
                    <div className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Synced
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => signOut()}
                  className="p-1.5 text-gray-400 hover:text-rose-600 rounded-lg transition-colors"
                  title="Logout"
                >
                  <LogOut size={15} />
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="p-2.5 rounded-2xl bg-white border border-gray-100 text-center">
                  <div className="text-[11px] font-bold text-amber-600 flex items-center justify-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span> Guest Mode
                  </div>
                  <div className="text-[10px] text-gray-400 mt-0.5">Local Storage Active</div>
                </div>
                <button
                  onClick={openLogin}
                  className="w-full btn btn-outline text-xs py-2 rounded-full font-bold"
                >
                  Sign In
                </button>
              </div>
            )}
          </div>
        </aside>
      )}

      {/* Main Workspace Area */}
      <div className="flex-1 flex flex-col min-w-0 pb-[calc(env(safe-area-inset-bottom,0px)+5.5rem)] md:pb-8">
        {/* Top Header Bar */}
        {view !== 'exam' && view !== 'review' && (
          <header className="sticky top-0 z-20 bg-[var(--bg-app)]/90 backdrop-blur-md px-3 sm:px-8 py-2.5 sm:py-4 flex items-center justify-between gap-2 sm:gap-4 border-b border-[var(--border-color)]">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <h1 className="text-lg sm:text-2xl md:text-3xl font-extrabold tracking-tight text-[var(--text-main)] truncate max-w-[120px] xs:max-w-[180px] sm:max-w-none">
                {view === 'dashboard'
                  ? (dashboardTab === 'overview' ? 'Dashboard' : dashboardTab.charAt(0).toUpperCase() + dashboardTab.slice(1))
                  : view === 'import' ? 'Import Paper' : 'Exam Results'}
              </h1>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
              {/* Theme Switcher Compact Pill */}
              <ThemeSwitcher variant="compact" />

              {view === 'import' ? (
                <button onClick={handleBackToDashboard} className="btn btn-outline text-xs py-1.5 sm:py-2 px-3 sm:px-4 rounded-full flex items-center gap-1.5">
                  <ArrowLeft size={14} /> <span className="hidden xs:inline">Back</span>
                </button>
              ) : (
                <button
                  onClick={() => setView('import')}
                  className="btn btn-outline text-xs p-2 sm:px-3.5 sm:py-2 rounded-full shadow-2xs flex items-center gap-1.5 shrink-0"
                  title="Import Paper"
                >
                  <PlusCircle size={15} />
                  <span className="hidden sm:inline">Import Paper</span>
                </button>
              )}

              {/* Login / Profile Button — Always Visible & Accessible on Mobile & Desktop */}
              {user ? (
                <button
                  onClick={() => setShowAccountModal(true)}
                  className="relative group p-0.5 rounded-full focus:outline-none focus:ring-2 focus:ring-emerald-500 shrink-0"
                  title={`${user.user_metadata?.display_name || user.email} (Manage Account)`}
                  aria-label="Manage Account"
                >
                  <div className="w-8 sm:w-9 h-8 sm:h-9 rounded-full bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] flex items-center justify-center font-bold text-xs shadow-xs border-2 border-[var(--border-color)] group-hover:scale-105 transition-transform">
                    {(user.user_metadata?.display_name || 'A')[0].toUpperCase()}
                  </div>
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-[var(--bg-surface)]"></span>
                </button>
              ) : (
                <button
                  onClick={openLogin}
                  className="btn btn-primary text-xs py-1.5 px-3 sm:px-4 rounded-full shadow-xs flex items-center gap-1.5 shrink-0"
                  title="Sign In to sync tests"
                >
                  <LogIn size={13} />
                  <span>Sign In</span>
                </button>
              )}
            </div>
          </header>
        )}

        {/* Content Viewport */}
        <main className={`flex-1 ${view === 'exam' || view === 'review' ? 'p-0' : 'px-3 sm:px-8 py-4 sm:py-6'}`}>
          {view === 'dashboard' && (
            <Dashboard
              userId={effectiveUserId}
              onStartExam={handleStartExam}
              onPractice={handleStartPractice}
              onStartCustomPractice={handleStartCustomPractice}
              onImport={() => setView('import')}
              onStartReview={handleStartReview}
              refreshKey={refreshKey}
              activeTab={dashboardTab}
              onTabChange={setDashboardTab}
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
              userId={effectiveUserId}
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
      </div>

      {/* Mobile Bottom Navigation Bar (< 768px) with Safe Area Support */}
      {view !== 'exam' && view !== 'review' && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[var(--bg-surface)]/95 backdrop-blur-md border-t border-[var(--border-color)] px-1 py-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] flex items-center justify-around shadow-lg">
          {[
            { id: 'overview' as const, label: 'Home', icon: LayoutDashboard },
            { id: 'library' as const, label: 'Library', icon: BookOpen },
            { id: 'practice' as const, label: 'Drills', icon: Target },
            { id: 'mistakes' as const, label: 'Mistakes', icon: AlertTriangle },
            { id: 'analytics' as const, label: 'Stats', icon: BarChart3 },
          ].map(item => {
            const isActive = view === 'dashboard' && dashboardTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => { setView('dashboard'); setDashboardTab(item.id); }}
                className={`flex flex-col items-center gap-1 py-1 px-2 rounded-xl transition-all ${
                  isActive ? 'text-[var(--text-main)] font-bold' : 'text-[var(--text-subtle)] font-medium'
                }`}
              >
                <item.icon size={18} className={isActive ? 'text-[var(--text-main)]' : 'text-[var(--text-subtle)]'} />
                <span className="text-[10px] leading-none">{item.label}</span>
                {isActive && (
                  <span className="w-1 h-1 rounded-full bg-[var(--text-main)]"></span>
                )}
              </button>
            );
          })}

          {/* Account / Sign In Tab on Mobile */}
          <button
            onClick={() => {
              if (user) {
                setShowAccountModal(true);
              } else {
                openLogin();
              }
            }}
            className={`flex flex-col items-center gap-1 py-1 px-2 rounded-xl transition-all ${
              showAccountModal ? 'text-[var(--text-main)] font-bold' : 'text-[var(--text-subtle)] font-medium'
            }`}
          >
            {user ? (
              <div className="w-4.5 h-4.5 rounded-full bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] font-black text-[9px] flex items-center justify-center">
                {(user.user_metadata?.display_name || 'A')[0].toUpperCase()}
              </div>
            ) : (
              <LogIn size={18} className="text-[var(--text-subtle)]" />
            )}
            <span className="text-[10px] leading-none">{user ? 'Account' : 'Sign In'}</span>
          </button>
        </nav>
      )}

      {/* Mobile & Desktop Account Modal */}
      {showAccountModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white text-gray-900 rounded-3xl p-6 sm:p-7 max-w-sm w-full shadow-2xl border border-gray-200/80 relative">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-gray-900 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                  {user ? (user.user_metadata?.display_name || 'A')[0].toUpperCase() : 'G'}
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-gray-900">
                    {user ? (user.user_metadata?.display_name || 'SSC Aspirant') : 'Guest User'}
                  </h3>
                  <div className="text-[11px] font-semibold text-gray-400 truncate max-w-[180px]">
                    {user ? user.email : 'Local Storage Mode'}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowAccountModal(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                aria-label="Close"
              >
                <X size={17} />
              </button>
            </div>

            {user ? (
              <div className="space-y-4">
                <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span className="text-xs font-bold text-emerald-800">Cloud Sync Active</span>
                  </div>
                  <span className="text-[10px] font-semibold text-emerald-600">Cross-device</span>
                </div>

                {/* Theme Selector inside Modal */}
                <ThemeSwitcher variant="full" />

                <button
                  onClick={async () => {
                    await signOut();
                    setShowAccountModal(false);
                  }}
                  className="w-full btn btn-outline text-xs py-2.5 rounded-full flex items-center justify-center gap-2 text-rose-600 hover:bg-rose-50 hover:border-rose-200 font-bold"
                >
                  <LogOut size={15} /> Sign Out
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-3 rounded-2xl bg-amber-50 border border-amber-100">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                    <span className="text-xs font-bold text-amber-800">Local Storage Active</span>
                  </div>
                  <p className="text-[11px] text-amber-700 leading-relaxed">
                    You're currently taking tests locally. Sign in or create a free account to sync tests and bookmarks between your phone and laptop!
                  </p>
                </div>

                <button
                  onClick={() => {
                    setShowAccountModal(false);
                    openLogin();
                  }}
                  className="w-full btn btn-primary text-xs py-2.5 rounded-full flex items-center justify-center gap-2 font-bold shadow-xs"
                >
                  <LogIn size={15} /> Sign In / Create Account
                </button>

                <ThemeSwitcher variant="full" />
              </div>
            )}
          </div>
        </div>
      )}

      {/* PWA Components */}
      <OfflineIndicator
        isOffline={isOffline}
        wasOffline={wasOffline}
        pendingSyncCount={pendingSyncCount}
        onSyncNow={syncNow}
      />
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

