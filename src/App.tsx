import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Routes,
  Route,
  Navigate,
  useNavigate,
  useLocation,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import { getPaperById, savePaper, getPapers, getAttempts, saveCustomPaper } from './services/database';
import { DEMO_PAPER } from './utils/demoData';
import { Paper, QuestionJSON } from './types';
import AuthGate, { useAuthModal } from './components/AuthGate';
import Dashboard, { DashboardTab } from './components/Dashboard';
import AdminTestStudio from './components/AdminTestStudio';
import ExamInterface from './components/ExamInterface';
import ResultsPage from './components/ResultsPage';
import ReviewSession from './components/ReviewSession';
import PWAInstallPrompt from './components/PWAInstallPrompt';
import OfflineIndicator from './components/OfflineIndicator';
import UpdateAvailable from './components/UpdateAvailable';
import ThemeSwitcher from './components/ThemeSwitcher';
import { useTheme } from './hooks/useTheme';
import {
  BookOpen,
  PlusCircle,
  ArrowLeft,
  LogIn,
  LogOut,
  LayoutDashboard,
  Target,
  AlertTriangle,
  Bookmark,
  BarChart3,
  X,
  FileText,
  Menu,
  Download,
} from 'lucide-react';
import { usePWA } from './hooks/usePWA';

// Nav item configuration with direct URL paths
const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/library', label: 'Exam Library', icon: BookOpen },
  { path: '/practice', label: 'Practice Hub', icon: Target },
  { path: '/notes', label: 'Study Notes', icon: FileText, badge: 'New' },
  { path: '/mistakes', label: 'Mistakes', icon: AlertTriangle },
  { path: '/bookmarks', label: 'Bookmarks', icon: Bookmark },
  { path: '/analytics', label: 'Analytics', icon: BarChart3 },
];

const MOBILE_BOTTOM_ITEMS = [
  { path: '/', label: 'Home', icon: LayoutDashboard },
  { path: '/library', label: 'Library', icon: BookOpen },
  { path: '/notes', label: 'Notes', icon: FileText },
  { path: '/practice', label: 'Drills', icon: Target },
];

/**
 * Wrapper for CBT Exam view that resolves paper by ID from URL params
 * Supports direct links (e.g. /exam/demo-paper-001) and page reloads
 */
function ExamRouteWrapper({
  activePaper,
  setActivePaper,
  userId,
  onComplete,
  onExit,
}: {
  activePaper: Paper | null;
  setActivePaper: (paper: Paper) => void;
  userId: string;
  onComplete: (attemptId: string) => void;
  onExit: () => void;
}) {
  const { paperId } = useParams<{ paperId: string }>();
  const [searchParams] = useSearchParams();
  const mode = searchParams.get('mode') === 'practice' ? 'practice' : 'exam';
  const [loading, setLoading] = useState(!activePaper || activePaper.id !== paperId);
  const [paper, setPaper] = useState<Paper | null>(
    activePaper && activePaper.id === paperId ? activePaper : null
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!paperId) {
      setError('No test paper specified.');
      setLoading(false);
      return;
    }
    if (activePaper && activePaper.id === paperId) {
      setPaper(activePaper);
      setLoading(false);
      return;
    }

    let isMounted = true;
    setLoading(true);
    getPaperById(paperId)
      .then((p) => {
        if (!isMounted) return;
        if (p) {
          setPaper(p);
          setActivePaper(p);
        } else {
          setError(`Examination paper "${paperId}" was not found.`);
        }
      })
      .catch((err) => {
        if (isMounted) setError(err.message || 'Failed to load examination paper.');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [paperId, activePaper, setActivePaper]);

  if (loading) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center p-6 bg-[var(--bg-app)] text-[var(--text-main)]">
        <div className="w-12 h-12 rounded-2xl bg-gray-900 text-emerald-400 flex items-center justify-center animate-pulse mb-3 shadow-md">
          <BookOpen size={24} />
        </div>
        <div className="text-sm font-bold">Loading examination paper...</div>
        <div className="text-xs text-[var(--text-muted)] mt-1">Preparing question booklet and timer</div>
      </div>
    );
  }

  if (error || !paper) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center p-6 bg-[var(--bg-app)] text-[var(--text-main)]">
        <div className="max-w-md w-full p-6 rounded-3xl bg-[var(--bg-surface)] border border-[var(--border-color)] text-center shadow-md">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto mb-3">
            <AlertTriangle size={24} />
          </div>
          <h2 className="text-base font-bold text-[var(--text-main)]">Paper Not Found</h2>
          <p className="text-xs text-[var(--text-muted)] mt-1 mb-4">
            {error || 'The requested test could not be found or may have been deleted.'}
          </p>
          <button
            onClick={onExit}
            className="btn btn-primary text-xs py-2 px-5 rounded-full font-bold cursor-pointer"
          >
            Return to Exam Library
          </button>
        </div>
      </div>
    );
  }

  return (
    <ExamInterface
      paper={paper}
      userId={userId}
      mode={mode}
      onComplete={onComplete}
      onExit={onExit}
    />
  );
}

/**
 * Wrapper for Results view that resolves attempt and paper by ID from URL params
 * Supports direct links (e.g. /results/att_12345) and page reloads
 */
function ResultsRouteWrapper({
  activePaper,
  setActivePaper,
  userId,
  onRetake,
  onBack,
  onPractice,
}: {
  activePaper: Paper | null;
  setActivePaper: (paper: Paper) => void;
  userId: string;
  onRetake: (paper: Paper) => void;
  onBack: () => void;
  onPractice: (subject: string, topic: string) => void;
}) {
  const { attemptId } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();
  const [resolvedAttemptId, setResolvedAttemptId] = useState<string | null>(attemptId || null);
  const [resolvedPaper, setResolvedPaper] = useState<Paper | null>(activePaper);
  const [loading, setLoading] = useState(!attemptId);

  useEffect(() => {
    let isMounted = true;
    if (!attemptId) {
      getAttempts(userId)
        .then(async (attempts) => {
          if (!isMounted) return;
          if (attempts.length > 0) {
            const latest = attempts[0];
            setResolvedAttemptId(latest.id);
            const p = await getPaperById(latest.paper_id);
            if (p && isMounted) {
              setResolvedPaper(p);
              setActivePaper(p);
            }
          }
          setLoading(false);
        })
        .catch(() => {
          if (isMounted) setLoading(false);
        });
    } else {
      setResolvedAttemptId(attemptId);
      getAttempts(userId)
        .then(async (attempts) => {
          if (!isMounted) return;
          const att = attempts.find((a) => a.id === attemptId);
          if (att) {
            const p = await getPaperById(att.paper_id);
            if (p && isMounted) {
              setResolvedPaper(p);
              setActivePaper(p);
            }
          }
          setLoading(false);
        })
        .catch(() => {
          if (isMounted) setLoading(false);
        });
    }
    return () => {
      isMounted = false;
    };
  }, [attemptId, userId, setActivePaper]);

  if (loading) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center p-6 text-[var(--text-main)]">
        <div className="w-10 h-10 rounded-2xl bg-gray-900 text-emerald-400 flex items-center justify-center animate-pulse mb-3 shadow-md">
          <BookOpen size={20} />
        </div>
        <div className="text-sm font-bold animate-pulse">Loading score report...</div>
      </div>
    );
  }

  if (!resolvedAttemptId) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center p-6 text-[var(--text-main)]">
        <div className="max-w-md w-full p-6 rounded-3xl bg-[var(--bg-surface)] border border-[var(--border-color)] text-center shadow-md">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto mb-3">
            <AlertTriangle size={24} />
          </div>
          <h2 className="text-base font-bold text-[var(--text-main)]">No Test Results Found</h2>
          <p className="text-xs text-[var(--text-muted)] mt-1 mb-4">
            You haven't completed any test attempts yet or the link is invalid.
          </p>
          <button
            onClick={onBack}
            className="btn btn-primary text-xs py-2 px-5 rounded-full font-bold cursor-pointer"
          >
            Go to Exam Library
          </button>
        </div>
      </div>
    );
  }

  return (
    <ResultsPage
      attemptId={resolvedAttemptId}
      paper={resolvedPaper}
      userId={userId}
      onRetake={() => {
        if (resolvedPaper) {
          onRetake(resolvedPaper);
        } else {
          navigate('/library');
        }
      }}
      onBack={onBack}
      onPractice={onPractice}
    />
  );
}

function AppContent() {
  const { theme } = useTheme();
  const { user, openLogin, signOut, loading } = useAuthModal();
  const effectiveUserId = user?.id || 'guest';
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const {
    canInstall,
    isOffline,
    wasOffline,
    pendingSyncCount,
    showInstallModal,
    syncNow,
    install,
    dismissInstall,
    openInstallModal,
    closeInstallModal,
    updateAvailable,
    update,
    isIOS,
    isInstallable,
  } = usePWA();

  const [activePaper, setActivePaper] = useState<Paper | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [demoLoaded, setDemoLoaded] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Determine if full-screen mode (exam or review) should hide sidebar and headers
  const isExamRoute = location.pathname.startsWith('/exam');
  const isReviewRoute = location.pathname.startsWith('/review');
  const hideChrome = isExamRoute || isReviewRoute;

  // Active navigation helper
  const isItemActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/' || location.pathname === '/dashboard';
    }
    return location.pathname.startsWith(path);
  };

  // Dynamic header title based on current URL
  const getHeaderTitle = () => {
    const p = location.pathname;
    if (p === '/' || p === '/dashboard') return 'Dashboard';
    if (p.startsWith('/library')) return 'Exam Library';
    if (p.startsWith('/practice')) return 'Practice Hub';
    if (p.startsWith('/notes')) return 'Study Notes';
    if (p.startsWith('/mistakes')) return 'Mistakes Notebook';
    if (p.startsWith('/bookmarks')) return 'Saved Bookmarks';
    if (p.startsWith('/analytics')) return 'Analytics & Trends';
    if (p.startsWith('/studio') || p.startsWith('/import')) return 'Admin Test Studio';
    if (p.startsWith('/results')) return 'Exam Results';
    if (p.startsWith('/review')) return 'Daily Review';
    if (p.startsWith('/exam')) return 'Examination';
    return 'Dashboard';
  };

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
          setRefreshKey((k) => k + 1);
        }
      } catch (e) {
        console.error('Failed to load demo:', e);
      }
      setDemoLoaded(true);
    }
    loadDemo();
  }, [loading, demoLoaded, effectiveUserId]);

  // Backward compatibility: redirect legacy deep-links (?exam=<id> or ?paper=<id>) to /exam/:paperId
  useEffect(() => {
    if (loading) return;
    const sharedPaperId = searchParams.get('exam') || searchParams.get('paper');
    if (sharedPaperId) {
      navigate(`/exam/${sharedPaperId}`, { replace: true });
    }
  }, [loading, searchParams, navigate]);

  const handleStartExam = async (paperId: string) => {
    try {
      const paper = await getPaperById(paperId);
      if (paper) {
        setActivePaper(paper);
      }
      navigate(`/exam/${paperId}`);
    } catch (e) {
      console.error('Failed to start exam:', e);
    }
  };

  const handleStartPractice = async (paperId: string) => {
    try {
      const paper = await getPaperById(paperId);
      if (paper) {
        setActivePaper(paper);
      }
      navigate(`/exam/${paperId}?mode=practice`);
    } catch (e) {
      console.error('Failed to start practice:', e);
    }
  };

  const handleStartCustomPractice = (customPaper: Paper) => {
    saveCustomPaper(customPaper);
    setActivePaper(customPaper);
    navigate(`/exam/${customPaper.id}?mode=practice`);
  };

  const handlePracticeTopic = async (subject: string, topic: string) => {
    try {
      const papers = await getPapers(effectiveUserId);
      const matchedQuestions: QuestionJSON[] = [];
      papers.forEach((p) => {
        if (p.raw_json?.questions) {
          p.raw_json.questions.forEach((q) => {
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
          subjects: subject ? [subject] : Array.from(new Set(matchedQuestions.map((q) => q.subject))),
          raw_json: {
            exam: 'SSC CGL',
            paperTitle: `${topic || subject} — Targeted Drill`,
            durationMinutes: Math.max(5, Math.ceil(matchedQuestions.length * 1.5)),
            totalMarks: matchedQuestions.length * 2,
            negativeMarking: 0.5,
            subjects: subject ? [subject] : Array.from(new Set(matchedQuestions.map((q) => q.subject))),
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
    setRefreshKey((k) => k + 1);
    navigate(`/results/${attemptId}`);
  };

  const handleViewResults = (attemptId: string, paper?: Paper) => {
    if (paper) setActivePaper(paper);
    navigate(`/results/${attemptId}`);
  };

  const handleBackToDashboard = () => {
    setActivePaper(null);
    setRefreshKey((k) => k + 1);
    navigate('/');
  };

  const handleRetake = (paperToRetake: Paper) => {
    setActivePaper(paperToRetake);
    navigate(`/exam/${paperToRetake.id}`);
  };

  const handleStartReview = () => {
    navigate('/review');
  };

  const handleReviewComplete = () => {
    setRefreshKey((k) => k + 1);
    navigate('/');
  };

  // Helper to render Dashboard connected to React Router
  const renderDashboard = (tab: DashboardTab) => (
    <Dashboard
      userId={effectiveUserId}
      onStartExam={handleStartExam}
      onPractice={handleStartPractice}
      onStartCustomPractice={handleStartCustomPractice}
      onImport={() => navigate('/studio')}
      onStartReview={handleStartReview}
      onViewResults={handleViewResults}
      refreshKey={refreshKey}
      activeTab={tab}
      onTabChange={(newTab) => {
        navigate(newTab === 'overview' ? '/' : `/${newTab}`);
      }}
    />
  );

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
    <div className="h-screen h-[100dvh] max-h-[100dvh] w-full bg-[var(--bg-app)] flex flex-col md:flex-row font-sans text-[var(--text-main)] overflow-hidden">
      {/* Desktop Left Sidebar with URL Links */}
      {!hideChrome && (
        <aside className="hidden md:flex flex-col w-64 shrink-0 bg-[var(--bg-app)] p-5 border-r border-[var(--border-color)] h-full justify-between z-30 select-none overflow-y-auto custom-scrollbar">
          <div>
            {/* Brand Logo & Title */}
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-3 px-2 py-3 mb-6 w-full text-left group cursor-pointer"
            >
              {theme === 'editorial' ? (
                <>
                  <div className="w-10 h-10 rounded-2xl bg-[#B85338] text-white flex items-center justify-center font-black shadow-xs group-hover:scale-105 transition-transform">
                    <BookOpen size={20} className="text-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 font-mono tracking-widest text-xs uppercase font-extrabold text-[var(--text-main)]">
                      <span>CHAPTER</span>
                      <span className="text-[#B85338] font-black">/</span>
                      <span>ONE</span>
                    </div>
                    <div className="text-[10px] font-semibold text-[#7A7268] font-serif">
                      A little more wonder
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-10 h-10 rounded-2xl bg-gray-900 text-white flex items-center justify-center font-black shadow-xs group-hover:scale-105 transition-transform">
                    <BookOpen size={20} className="text-emerald-400" />
                  </div>
                  <div>
                    <div className="text-sm font-extrabold tracking-tight text-[var(--text-main)] leading-tight">
                      SSC CGL Prep
                    </div>
                    <div className="text-[11px] font-semibold text-[var(--text-muted)]">
                      Tier 1 & 2 Platform
                    </div>
                  </div>
                </>
              )}
            </button>

            {/* Nav Items with Active State & URL Routing */}
            <nav className="space-y-1.5">
              {NAV_ITEMS.map((item) => {
                const isActive = isItemActive(item.path);
                return (
                  <button
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl text-xs font-semibold transition-all cursor-pointer ${
                      isActive
                        ? 'bg-[var(--bg-surface)] text-[var(--text-main)] shadow-xs border border-[var(--border-color)] font-bold'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-subcard)]'
                    }`}
                  >
                    <div className="flex items-center gap-3.5">
                      <item.icon
                        size={18}
                        className={isActive ? 'text-[var(--text-main)]' : 'text-[var(--text-subtle)]'}
                      />
                      <span>{item.label}</span>
                    </div>
                    {item.badge && (
                      <span className="px-1.5 py-0.5 rounded-full text-[9px] font-extrabold bg-emerald-500/15 text-emerald-500 border border-emerald-500/20">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Bottom of Sidebar: Install App, Theme Switcher & Profile */}
          <div className="pt-4 border-t border-[var(--border-color)] space-y-3">
            {canInstall && (
              <button
                onClick={openInstallModal}
                className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold text-[var(--text-main)] bg-[var(--bg-surface)] hover:bg-[var(--bg-subcard)] border border-[var(--border-color)] shadow-2xs transition-all group cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <Download size={15} className="text-emerald-500 group-hover:scale-110 transition-transform" />
                  <span>Install App</span>
                </div>
                <span className="text-[10px] bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 px-1.5 py-0.2 rounded-md font-bold">
                  Offline
                </span>
              </button>
            )}

            <ThemeSwitcher variant="full" />

            {user ? (
              <div className="flex items-center justify-between p-2.5 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] shadow-2xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-gray-900 text-white font-bold text-xs flex items-center justify-center shrink-0">
                    {(user.user_metadata?.display_name || 'A')[0].toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-[var(--text-main)] truncate">
                      {user.user_metadata?.display_name || 'SSC Aspirant'}
                    </div>
                    <div className="text-[10px] text-emerald-500 font-semibold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Synced
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => signOut()}
                  className="p-1.5 text-[var(--text-muted)] hover:text-rose-500 rounded-lg transition-colors cursor-pointer"
                  title="Logout"
                >
                  <LogOut size={15} />
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="p-2.5 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] text-center">
                  <div className="text-[11px] font-bold text-amber-500 flex items-center justify-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span> Guest Mode
                  </div>
                  <div className="text-[10px] text-[var(--text-muted)] mt-0.5">Local Storage Active</div>
                </div>
                <button
                  onClick={openLogin}
                  className="w-full btn btn-outline text-xs py-2 rounded-full font-bold cursor-pointer"
                >
                  Sign In
                </button>
              </div>
            )}
          </div>
        </aside>
      )}

      {/* Main Workspace Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Top Header Bar */}
        {!hideChrome && (
          <header className="shrink-0 z-20 bg-[var(--bg-app)]/90 backdrop-blur-md px-3 sm:px-8 py-2.5 sm:py-3.5 flex items-center justify-between gap-2 sm:gap-4 border-b border-[var(--border-color)]">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              {/* Mobile Hamburger Drawer Trigger */}
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="md:hidden p-2 -ml-1 text-[var(--text-main)] hover:bg-[var(--bg-subcard)] rounded-xl border border-[var(--border-color)] transition-colors shrink-0 flex items-center justify-center shadow-2xs cursor-pointer"
                aria-label="Open navigation menu"
                title="Open menu"
              >
                <Menu size={18} />
              </button>

              <div className="min-w-0">
                <h1 className="text-sm sm:text-lg md:text-2xl font-bold tracking-tight text-[var(--text-main)] truncate max-w-[130px] xs:max-w-[200px] sm:max-w-none leading-tight">
                  {getHeaderTitle()}
                </h1>
                <div className="text-[10px] sm:text-xs font-semibold text-[var(--text-muted)] truncate hidden xs:block">
                  SSC CGL Tier 1 & 2 Platform
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
              {/* Theme Switcher Compact Pill */}
              <ThemeSwitcher variant="compact" />

              {/* Navigation Action Buttons */}
              {location.pathname.startsWith('/studio') || location.pathname.startsWith('/import') ? (
                <button
                  onClick={handleBackToDashboard}
                  className="btn btn-outline text-xs py-1.5 sm:py-2 px-3 sm:px-4 rounded-full flex items-center gap-1.5 cursor-pointer"
                >
                  <ArrowLeft size={14} /> <span className="hidden xs:inline">Back</span>
                </button>
              ) : location.pathname.startsWith('/results') ? (
                <button
                  onClick={() => navigate('/library')}
                  className="btn btn-outline text-xs py-1.5 sm:py-2 px-3 sm:px-4 rounded-full flex items-center gap-1.5 cursor-pointer"
                >
                  <ArrowLeft size={14} /> <span className="hidden xs:inline">Library</span>
                </button>
              ) : (
                <button
                  onClick={() => navigate('/studio')}
                  className="btn btn-outline text-xs p-2 sm:px-3.5 sm:py-2 rounded-full shadow-2xs flex items-center gap-1.5 shrink-0 cursor-pointer"
                  title="Import Paper"
                >
                  <PlusCircle size={15} />
                  <span className="hidden sm:inline">Import Paper</span>
                </button>
              )}

              {/* Login / Profile Button */}
              {user ? (
                <button
                  onClick={() => setShowAccountModal(true)}
                  className="relative group p-0.5 rounded-full focus:outline-none focus:ring-2 focus:ring-emerald-500 shrink-0 cursor-pointer"
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
                  className="btn btn-primary text-xs py-1.5 px-3 sm:px-4 rounded-full shadow-xs flex items-center gap-1.5 shrink-0 cursor-pointer"
                  title="Sign In to sync tests"
                >
                  <LogIn size={13} />
                  <span>Sign In</span>
                </button>
              )}
            </div>
          </header>
        )}

        {/* Content Viewport with Real URL Routing */}
        <main
          className={`flex-1 min-h-0 overflow-y-auto overscroll-contain custom-scrollbar ${
            hideChrome ? 'p-0' : 'px-3 sm:px-8 py-4 sm:py-6 pb-24 md:pb-8'
          }`}
        >
          <Routes>
            {/* Dashboard Overview */}
            <Route path="/" element={renderDashboard('overview')} />
            <Route path="/dashboard" element={<Navigate to="/" replace />} />

            {/* Dashboard Sub-tabs with Direct URL Access */}
            <Route path="/library" element={renderDashboard('library')} />
            <Route path="/practice" element={renderDashboard('practice')} />
            <Route path="/notes" element={renderDashboard('notes')} />
            <Route path="/mistakes" element={renderDashboard('mistakes')} />
            <Route path="/bookmarks" element={renderDashboard('bookmarks')} />
            <Route path="/analytics" element={renderDashboard('analytics')} />

            {/* Admin Test Studio */}
            <Route
              path="/studio"
              element={
                <AdminTestStudio
                  userId={effectiveUserId}
                  onPaperCreated={() => {
                    setRefreshKey((k) => k + 1);
                    navigate('/library');
                  }}
                  onCancel={handleBackToDashboard}
                />
              }
            />
            <Route path="/import" element={<Navigate to="/studio" replace />} />

            {/* CBT Exam Interface */}
            <Route
              path="/exam/:paperId"
              element={
                <ExamRouteWrapper
                  activePaper={activePaper}
                  setActivePaper={setActivePaper}
                  userId={effectiveUserId}
                  onComplete={handleExamComplete}
                  onExit={() => navigate('/library')}
                />
              }
            />

            {/* Results Page */}
            <Route
              path="/results/:attemptId"
              element={
                <ResultsRouteWrapper
                  activePaper={activePaper}
                  setActivePaper={setActivePaper}
                  userId={effectiveUserId}
                  onRetake={handleRetake}
                  onBack={() => navigate('/library')}
                  onPractice={handlePracticeTopic}
                />
              }
            />
            <Route
              path="/results"
              element={
                <ResultsRouteWrapper
                  activePaper={activePaper}
                  setActivePaper={setActivePaper}
                  userId={effectiveUserId}
                  onRetake={handleRetake}
                  onBack={() => navigate('/library')}
                  onPractice={handlePracticeTopic}
                />
              }
            />

            {/* SRS Review Session */}
            <Route
              path="/review"
              element={
                <ReviewSession
                  userId={effectiveUserId}
                  onComplete={handleReviewComplete}
                  onExit={handleBackToDashboard}
                />
              }
            />

            {/* Fallback to Home */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar (< 768px) with Safe Area Support */}
      {!hideChrome && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[var(--bg-surface)]/95 backdrop-blur-md border-t border-[var(--border-color)] px-1 py-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] flex items-center justify-around shadow-lg">
          {MOBILE_BOTTOM_ITEMS.map((item) => {
            const isActive = isItemActive(item.path);
            const activeColorClass =
              theme === 'editorial' ? 'text-[#B85338] font-bold' : 'text-[var(--text-main)] font-bold';
            const dotColorClass = theme === 'editorial' ? 'bg-[#B85338]' : 'bg-[var(--text-main)]';
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex flex-col items-center gap-1 py-1 px-2 rounded-xl transition-all cursor-pointer ${
                  isActive ? activeColorClass : 'text-[var(--text-subtle)] font-medium'
                }`}
              >
                <item.icon
                  size={18}
                  className={
                    isActive
                      ? theme === 'editorial'
                        ? 'text-[#B85338]'
                        : 'text-[var(--text-main)]'
                      : 'text-[var(--text-subtle)]'
                  }
                />
                <span className="text-[10px] leading-none">{item.label}</span>
                {isActive && <span className={`w-1 h-1 rounded-full ${dotColorClass}`}></span>}
              </button>
            );
          })}

          {/* Menu Drawer Button in Mobile Bottom Bar */}
          <button
            onClick={() => setMobileMenuOpen(true)}
            className={`flex flex-col items-center gap-1 py-1 px-2 rounded-xl transition-all cursor-pointer ${
              mobileMenuOpen ? 'text-[var(--text-main)] font-bold' : 'text-[var(--text-subtle)] font-medium'
            }`}
            aria-label="Open full menu"
          >
            <Menu size={18} className={mobileMenuOpen ? 'text-[var(--text-main)]' : 'text-[var(--text-subtle)]'} />
            <span className="text-[10px] leading-none">Menu</span>
          </button>
        </nav>
      )}

      {/* Mobile Slide-Out Sidebar Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex animate-fadeIn">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity duration-300"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />

          {/* Drawer Panel */}
          <div className="relative w-[290px] max-w-[85vw] bg-[var(--bg-app)] h-full flex flex-col justify-between p-4 shadow-2xl border-r border-[var(--border-color)] z-10 animate-slideInLeft overflow-y-auto">
            <div className="space-y-4">
              {/* Drawer Brand & Close Button */}
              <div className="flex items-center justify-between pb-3 border-b border-[var(--border-color)]">
                <button
                  onClick={() => {
                    navigate('/');
                    setMobileMenuOpen(false);
                  }}
                  className="flex items-center gap-2.5 text-left group cursor-pointer"
                >
                  {theme === 'editorial' ? (
                    <>
                      <div className="w-9 h-9 rounded-xl bg-[#B85338] text-white flex items-center justify-center font-black shadow-xs">
                        <BookOpen size={18} className="text-white" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1 font-mono tracking-widest text-[11px] uppercase font-extrabold text-[var(--text-main)]">
                          <span>CHAPTER</span>
                          <span className="text-[#B85338] font-black">/</span>
                          <span>ONE</span>
                        </div>
                        <div className="text-[10px] font-semibold text-[#7A7268] font-serif">
                          A little more wonder
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="w-9 h-9 rounded-xl bg-gray-900 text-white flex items-center justify-center font-black shadow-xs">
                        <BookOpen size={18} className="text-emerald-400" />
                      </div>
                      <div>
                        <div className="text-xs font-extrabold tracking-tight text-[var(--text-main)]">
                          SSC CGL Prep
                        </div>
                        <div className="text-[10px] font-semibold text-gray-400">
                          Tier 1 & 2 Platform
                        </div>
                      </div>
                    </>
                  )}
                </button>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1.5 text-gray-400 hover:text-[var(--text-main)] rounded-full hover:bg-[var(--bg-subcard)] transition-colors cursor-pointer"
                  aria-label="Close menu"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Navigation Links with Real URLs */}
              <nav className="space-y-1">
                {NAV_ITEMS.map((item) => {
                  const isActive = isItemActive(item.path);
                  return (
                    <button
                      key={item.path}
                      onClick={() => {
                        navigate(item.path);
                        setMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                        isActive
                          ? 'bg-[var(--bg-surface)] text-[var(--text-main)] shadow-xs font-bold border border-[var(--border-color)]'
                          : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-subcard)]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <item.icon
                          size={17}
                          className={isActive ? 'text-[var(--text-main)]' : 'text-[var(--text-subtle)]'}
                        />
                        <span>{item.label}</span>
                      </div>
                      {item.badge && (
                        <span className="px-1.5 py-0.5 rounded-full text-[9px] font-extrabold bg-emerald-500/15 text-emerald-500 border border-emerald-500/20">
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>

              {/* Quick Actions */}
              <div className="pt-2 border-t border-[var(--border-color)]">
                <button
                  onClick={() => {
                    navigate('/studio');
                    setMobileMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-bold text-[var(--text-main)] hover:bg-[var(--bg-surface)] transition-all border border-dashed border-[var(--border-color)] cursor-pointer"
                >
                  <PlusCircle size={16} className="text-[var(--text-muted)]" />
                  <span>Import JSON Papers</span>
                </button>

                {canInstall && (
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      openInstallModal();
                    }}
                    className="w-full mt-2 flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold text-emerald-800 bg-emerald-500/10 border border-emerald-500/25 transition-all shadow-2xs cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <Download size={16} className="text-emerald-600" />
                      <span>Install App (Offline Ready)</span>
                    </div>
                    <span className="text-[9px] bg-emerald-600 text-white px-2 py-0.5 rounded-full font-bold">
                      PWA
                    </span>
                  </button>
                )}
              </div>
            </div>

            {/* Drawer Footer: Theme & Account */}
            <div className="pt-4 border-t border-[var(--border-color)] space-y-3 mt-4">
              <ThemeSwitcher variant="full" />

              {user ? (
                <div className="flex items-center justify-between p-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)] shadow-2xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-gray-900 text-white font-bold text-xs flex items-center justify-center shrink-0">
                      {(user.user_metadata?.display_name || 'A')[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-[var(--text-main)] truncate">
                        {user.user_metadata?.display_name || 'SSC Aspirant'}
                      </div>
                      <div className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Synced
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      signOut();
                      setMobileMenuOpen(false);
                    }}
                    className="p-1.5 text-gray-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                    title="Sign Out"
                  >
                    <LogOut size={15} />
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      openLogin();
                    }}
                    className="w-full btn btn-primary text-xs py-2 rounded-full font-bold shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <LogIn size={14} />
                    <span>Sign In / Create Account</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Account Modal */}
      {showAccountModal &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-fadeIn">
            <div className="bg-[var(--bg-surface)] text-[var(--text-main)] rounded-3xl p-6 sm:p-7 max-w-sm w-full shadow-2xl border border-[var(--border-color)] relative">
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-[var(--border-color)]">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-2xl bg-gray-900 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                    {user ? (user.user_metadata?.display_name || 'A')[0].toUpperCase() : 'G'}
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-[var(--text-main)]">
                      {user ? user.user_metadata?.display_name || 'SSC Aspirant' : 'Guest User'}
                    </h3>
                    <div className="text-[11px] font-semibold text-[var(--text-muted)] truncate max-w-[180px]">
                      {user ? user.email : 'Local Storage Mode'}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setShowAccountModal(false)}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-subcard)] cursor-pointer"
                  aria-label="Close"
                >
                  <X size={17} />
                </button>
              </div>

              {user ? (
                <div className="space-y-4">
                  <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                      <span className="text-xs font-bold text-emerald-500">Cloud Sync Active</span>
                    </div>
                    <span className="text-[10px] font-semibold text-emerald-500/80">Cross-device</span>
                  </div>

                  <ThemeSwitcher variant="full" />

                  <button
                    onClick={async () => {
                      await signOut();
                      setShowAccountModal(false);
                    }}
                    className="w-full btn btn-outline text-xs py-2.5 rounded-full flex items-center justify-center gap-2 text-rose-500 hover:bg-rose-500/10 hover:border-rose-500/30 font-bold cursor-pointer"
                  >
                    <LogOut size={15} /> Sign Out
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                      <span className="text-xs font-bold text-amber-500">Local Storage Active</span>
                    </div>
                    <p className="text-[11px] text-amber-400/90 leading-relaxed">
                      You're currently taking tests locally. Sign in or create a free account to sync tests and
                      bookmarks between your phone and laptop!
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      setShowAccountModal(false);
                      openLogin();
                    }}
                    className="w-full btn btn-primary text-xs py-2.5 rounded-full flex items-center justify-center gap-2 font-bold shadow-xs cursor-pointer"
                  >
                    <LogIn size={15} /> Sign In / Create Account
                  </button>

                  <ThemeSwitcher variant="full" />
                </div>
              )}
            </div>
          </div>,
          document.body
        )}

      {/* PWA Components */}
      <OfflineIndicator
        isOffline={isOffline}
        wasOffline={wasOffline}
        pendingSyncCount={pendingSyncCount}
        onSyncNow={syncNow}
      />
      {(isInstallable || showInstallModal) && (
        <PWAInstallPrompt
          onInstall={install}
          onDismiss={dismissInstall}
          showModal={showInstallModal}
          onCloseModal={closeInstallModal}
          isIOS={isIOS}
        />
      )}
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
