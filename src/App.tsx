import { useState, useEffect } from 'react';
import { getPaperById, savePaper, getPapers } from './services/database';
import { DEMO_PAPER } from './utils/demoData';
import { Paper } from './types';
import AuthGate from './components/AuthGate';
import Dashboard from './components/Dashboard';
import JsonImporter from './components/JsonImporter';
import ExamInterface from './components/ExamInterface';
import ResultsPage from './components/ResultsPage';
import ReviewSession from './components/ReviewSession';
import PWAInstallPrompt from './components/PWAInstallPrompt';
import OfflineIndicator from './components/OfflineIndicator';
import UpdateAvailable from './components/UpdateAvailable';
import { BookOpen, PlusCircle, ArrowLeft, Home } from 'lucide-react';
import { useAuth } from './hooks/useAuth';
import { usePWA } from './hooks/usePWA';

type View = 'dashboard' | 'import' | 'exam' | 'results' | 'review';

function AppContent() {
  const { user } = useAuth();
  const userId = user?.id;
  const { isInstallable, isOffline, install, dismissInstall, updateAvailable, update } = usePWA();

  const [view, setView] = useState<View>('dashboard');
  const [activePaper, setActivePaper] = useState<Paper | null>(null);
  const [examMode, setExamMode] = useState<'exam' | 'practice'>('exam');
  const [lastAttemptId, setLastAttemptId] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [demoLoaded, setDemoLoaded] = useState(false);

  // Load demo paper on first visit
  useEffect(() => {
    async function loadDemo() {
      if (demoLoaded) return;
      try {
        const papers = await getPapers(userId);
        if (papers.length === 0) {
          await savePaper({
            user_id: userId || 'guest',
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
  }, [demoLoaded, userId]);

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

  const handleRetake = () => {
    if (activePaper) {
      setView('exam');
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Navigation */}
      {view !== 'exam' && view !== 'review' && (
        <nav className="glass sticky top-0 z-30 border-b border-white/20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <button onClick={handleBackToDashboard} className="flex items-center gap-3 group">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl shadow-medium group-hover:shadow-strong transition-all" style={{ background: 'var(--gradient-brand)' }}>
                  <BookOpen size={20} className="text-white" />
                </div>
                <div className="hidden sm:block">
                  <span className="text-lg font-bold text-gradient">SSC CGL Prep</span>
                  <span className="block text-xs text-slate-500 dark:text-slate-400 -mt-0.5">Exam Preparation Platform</span>
                </div>
              </button>
              <div className="flex items-center gap-3">
                {view === 'import' && (
                  <button onClick={handleBackToDashboard} className="btn btn-ghost">
                    <ArrowLeft size={16} /> Back to Dashboard
                  </button>
                )}
                {view === 'dashboard' && (
                  <button onClick={() => setView('import')} className="btn btn-primary">
                    <PlusCircle size={16} /> Import Paper
                  </button>
                )}
                {view === 'results' && (
                  <button onClick={handleBackToDashboard} className="btn btn-ghost">
                    <Home size={16} /> Dashboard
                  </button>
                )}
              </div>
            </div>
          </div>
        </nav>
      )}

      {/* Main Content */}
      <main className="px-4 sm:px-6 lg:px-8 py-8 min-h-[calc(100vh-16rem)]" style={{ background: 'var(--gradient-soft)' }}>
        {view === 'dashboard' && (
          <Dashboard
            userId={userId}
            onStartExam={handleStartExam}
            onPractice={handleStartPractice}
            onImport={() => setView('import')}
            onStartReview={handleStartReview}
            refreshKey={refreshKey}
          />
        )}
        {view === 'import' && (
          <JsonImporter
            userId={userId}
            onImported={() => { setView('dashboard'); setRefreshKey(k => k + 1); }}
          />
        )}
        {view === 'exam' && activePaper && (
          <ExamInterface
            paper={activePaper}
            userId={userId}
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
            onPractice={() => setView('dashboard')}
          />
        )}
        {view === 'review' && (
          <ReviewSession
            userId={userId}
            onComplete={handleReviewComplete}
            onExit={handleBackToDashboard}
          />
        )}
      </main>

      {/* Footer */}
      {view !== 'exam' && view !== 'review' && (
        <footer className="glass-panel mt-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg" style={{ background: 'var(--gradient-brand)' }}>
                  <BookOpen size={16} className="text-white" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gradient">SSC CGL Prep</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">AI-Powered Exam Preparation</p>
                </div>
              </div>
              <div className="flex items-center gap-6 text-xs text-slate-500 dark:text-slate-400">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                  All systems operational
                </span>
                <span>•</span>
                <span>AI → JSON → Exam → Learn → Improve</span>
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
