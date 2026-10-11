import { useState, useEffect, useMemo } from 'react';
import { Paper, Attempt, Mistake, Bookmark, PaperFilters, BookmarkCategory } from '../types';
import { getPapers, getAttempts, getMistakes, getBookmarks, deletePaper, removeBookmark, resolveMistake, exportPaperAsJSON, downloadJSON, getAttemptsByPaper, updatePaperVisibility } from '../services/database';
import { getAccuracyColor, getDifficultyColor, formatTime } from '../utils/grader';
import { Search, Filter, Play, BookOpen, Trash2, Download, Copy, Eye, AlertTriangle, Bookmark as BookmarkIcon, BookmarkCheck, Target, TrendingUp, Award, Clock, BarChart3, X, CheckCircle, RotateCcw, Zap, Brain, FileText, PlusCircle, Globe, Lock } from 'lucide-react';

// ============================================================
// Dashboard (Home)
// ============================================================
import ReviewDashboard from './ReviewDashboard';

interface DashboardProps {
  userId?: string;
  onStartExam: (paperId: string) => void;
  onPractice: (paperId: string) => void;
  onImport: () => void;
  onStartReview: () => void;
  refreshKey: number;
}

export default function Dashboard({ userId, onStartExam, onPractice, onImport, onStartReview, refreshKey }: DashboardProps) {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [mistakes, setMistakes] = useState<Mistake[]>([]);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [activeTab, setActiveTab] = useState<'library' | 'mistakes' | 'bookmarks' | 'analytics' | 'practice'>('library');
  const [filters, setFilters] = useState<PaperFilters>({});
  const [search, setSearch] = useState('');

  useEffect(() => {
    async function load() {
      const [p, a, m, b] = await Promise.all([
        getPapers(userId),
        getAttempts(userId),
        getMistakes(userId),
        getBookmarks(userId),
      ]);
      setPapers(p);
      setAttempts(a);
      setMistakes(m);
      setBookmarks(b);
    }
    load();
  }, [userId, refreshKey]);

  const filteredPapers = useMemo(() => {
    let result = [...papers];
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(p =>
        p.title.toLowerCase().includes(s) ||
        p.description.toLowerCase().includes(s) ||
        p.subjects.some(sub => sub.toLowerCase().includes(s)) ||
        p.raw_json.questions.some(q => q.question.toLowerCase().includes(s))
      );
    }
    if (filters.exam) result = result.filter(p => p.exam === filters.exam);
    if (filters.subject) result = result.filter(p => p.subjects.includes(filters.subject!));
    if (filters.difficulty) result = result.filter(p => p.difficulty === filters.difficulty);
    if (filters.status === 'attempted') {
      const attemptedIds = new Set(attempts.map(a => a.paper_id));
      result = result.filter(p => attemptedIds.has(p.id));
    } else if (filters.status === 'not_attempted') {
      const attemptedIds = new Set(attempts.map(a => a.paper_id));
      result = result.filter(p => !attemptedIds.has(p.id));
    }
    return result;
  }, [papers, search, filters, attempts]);

  const allSubjects = useMemo(() => {
    const subs = new Set<string>();
    papers.forEach(p => p.subjects.forEach(s => subs.add(s)));
    return Array.from(subs);
  }, [papers]);

  const allExams = useMemo(() => {
    const exams = new Set<string>();
    papers.forEach(p => exams.add(p.exam));
    return Array.from(exams);
  }, [papers]);

  // Stats
  const totalAttempts = attempts.length;
  const totalQuestions = attempts.reduce((s, a) => s + a.attempted_count, 0);
  const overallAccuracy = totalAttempts > 0 ? Math.round(attempts.reduce((s, a) => s + a.accuracy, 0) / totalAttempts) : 0;
  const avgScore = totalAttempts > 0 ? Math.round(attempts.reduce((s, a) => s + (a.score / a.total_marks) * 100, 0) / totalAttempts) : 0;
  const highestScore = totalAttempts > 0 ? Math.max(...attempts.map(a => Math.round((a.score / a.total_marks) * 100))) : 0;

  // Weak areas
  const weakTopics = useMemo(() => {
    const topicMap = new Map<string, { correct: number; total: number }>();
    attempts.forEach(a => {
      const paper = papers.find(p => p.id === a.paper_id);
      if (!paper) return;
      paper.raw_json.questions.forEach((q, idx) => {
        const aq = { selected_answer: null, is_correct: null, question_index: idx }; // simplified
      });
    });
    // Simplified: use mistakes data
    const mistMap = new Map<string, number>();
    mistakes.forEach(m => {
      mistMap.set(m.topic, (mistMap.get(m.topic) || 0) + m.incorrect_count);
    });
    return Array.from(mistMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([topic, count]) => ({ topic, count }));
  }, [mistakes, attempts, papers]);

  const tabs = [
    { id: 'library' as const, label: 'Exam Library', icon: BookOpen },
    { id: 'practice' as const, label: 'Practice', icon: Target },
    { id: 'mistakes' as const, label: 'Mistakes', icon: AlertTriangle, count: mistakes.length },
    { id: 'bookmarks' as const, label: 'Bookmarks', icon: BookmarkIcon, count: bookmarks.length },
    { id: 'analytics' as const, label: 'Analytics', icon: BarChart3 },
  ];

  return (
    <div className="max-w-7xl mx-auto animate-fadeIn">
      {/* Welcome Header */}
      <div className="glass-card rounded-2xl p-8 mb-8">
        <h1 className="text-3xl font-bold text-gradient mb-2" style={{ fontFamily: 'var(--font-heading)' }}>
          Welcome to Your Exam Dashboard
        </h1>
        <p className="text-slate-600 dark:text-slate-400">
          Track your progress, practice weak areas, and ace your SSC CGL exam.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <StatCard icon={FileText} label="Papers" value={papers.length} color="primary" />
        <StatCard icon={Play} label="Attempts" value={totalAttempts} color="accent" />
        <StatCard icon={Target} label="Questions" value={totalQuestions} color="success" />
        <StatCard icon={TrendingUp} label="Accuracy" value={`${overallAccuracy}%`} color="warning" />
        <StatCard icon={Award} label="Best Score" value={`${highestScore}%`} color="info" />
        <StatCard icon={AlertTriangle} label="Mistakes" value={mistakes.length} color="danger" />
      </div>

      {/* Spaced Repetition Review Dashboard */}
      {userId && (
        <ReviewDashboard userId={userId} onStartReview={onStartReview} />
      )}

      {/* Weak Areas */}
      {weakTopics.length > 0 && (
        <div className="glass-card rounded-xl p-4 mb-6" style={{ borderColor: 'var(--color-warning)', borderWidth: '1px' }}>
          <h3 className="text-sm font-bold mb-2 flex items-center gap-2" style={{ color: 'var(--color-warning)' }}>
            <Brain size={16} /> Weak Areas — Focus Here
          </h3>
          <div className="flex flex-wrap gap-2">
            {weakTopics.map(wt => (
              <span key={wt.topic} className="badge badge-warning">
                {wt.topic} ({wt.count} mistakes)
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="glass-card rounded-2xl mb-8 overflow-hidden">
        <div className="flex overflow-x-auto border-b border-white/20">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-4 text-sm font-semibold whitespace-nowrap transition-all relative ${
                activeTab === tab.id
                  ? 'text-primary'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-white/10'
              }`}>
              <tab.icon size={18} />
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className="ml-1 badge badge-danger">{tab.count}</span>
              )}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: 'var(--gradient-brand)' }}></div>
              )}
            </button>
          ))}
        </div>
        <div className="p-6">

      {/* Tab Content */}
      {activeTab === 'library' && (
        <LibraryTab
          papers={filteredPapers}
          attempts={attempts}
          search={search}
          setSearch={setSearch}
          filters={filters}
          setFilters={setFilters}
          allSubjects={allSubjects}
          allExams={allExams}
          onStartExam={onStartExam}
          onPractice={onPractice}
          onImport={onImport}
          onRefresh={() => setPapers([...papers])}
          userId={userId}
        />
      )}
      {activeTab === 'practice' && (
        <PracticeTab papers={papers} mistakes={mistakes} onStartExam={onPractice} />
      )}
      {activeTab === 'mistakes' && (
        <MistakesTab mistakes={mistakes} onResolve={async (id) => { await resolveMistake(id); setMistakes(await getMistakes(userId)); }} />
      )}
      {activeTab === 'bookmarks' && (
        <BookmarksTab bookmarks={bookmarks} onRemove={async (id) => { await removeBookmark(id); setBookmarks(await getBookmarks(userId)); }} />
      )}
      {activeTab === 'analytics' && (
        <AnalyticsTab attempts={attempts} papers={papers} />
      )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Stat Card
// ============================================================
function StatCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string | number; color: string }) {
  const colorMap: Record<string, string> = {
    primary: 'var(--color-primary)',
    accent: 'var(--color-accent)',
    success: 'var(--color-success)',
    warning: 'var(--color-warning)',
    info: 'var(--color-info)',
    danger: 'var(--color-danger)',
  };
  
  const bgColor = colorMap[color] || colorMap.primary;
  
  return (
    <div className="glass-card rounded-xl p-5 hover:shadow-medium transition-all duration-200 group">
      <div 
        className="inline-flex items-center justify-center w-10 h-10 rounded-lg mb-3 shadow-soft"
        style={{ background: bgColor }}
      >
        <Icon size={20} className="text-white" />
      </div>
      <div className="text-2xl font-bold mb-1" style={{ color: 'var(--color-text)' }}>{value}</div>
      <div className="text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}>{label}</div>
    </div>
  );
}

// ============================================================
// Library Tab
// ============================================================
interface LibraryTabProps {
  papers: Paper[];
  attempts: Attempt[];
  search: string;
  setSearch: (s: string) => void;
  filters: PaperFilters;
  setFilters: (f: PaperFilters) => void;
  allSubjects: string[];
  allExams: string[];
  onStartExam: (id: string) => void;
  onPractice: (id: string) => void;
  onImport: () => void;
  onRefresh: () => void;
  userId?: string;
}

function LibraryTab({ papers, attempts, search, setSearch, filters, setFilters, allSubjects, allExams, onStartExam, onPractice, onImport, onRefresh, userId }: LibraryTabProps) {
  const [showFilters, setShowFilters] = useState(false);

  const getBestScore = (paperId: string) => {
    const paperAttempts = attempts.filter(a => a.paper_id === paperId);
    if (paperAttempts.length === 0) return null;
    return Math.max(...paperAttempts.map(a => Math.round((a.score / a.total_marks) * 100)));
  };

  const getAttemptCount = (paperId: string) => attempts.filter(a => a.paper_id === paperId).length;

  const handleDelete = async (paperId: string) => {
    if (confirm('Delete this paper? This cannot be undone.')) {
      await deletePaper(paperId);
      onRefresh();
    }
  };

  const handleExport = (paper: Paper) => {
    const json = exportPaperAsJSON(paper);
    downloadJSON(json, `${paper.title.replace(/\s+/g, '_')}.json`);
  };

  const handleCopyJSON = (paper: Paper) => {
    navigator.clipboard.writeText(exportPaperAsJSON(paper));
  };

  const handleToggleVisibility = async (paper: Paper) => {
    const newVisibility = paper.visibility === 'private' ? 'public' : 'private';
    const result = await updatePaperVisibility(paper.id, newVisibility);
    if (result.success) {
      onRefresh();
    } else {
      alert(`Failed to update visibility: ${result.error}`);
    }
  };

  if (papers.length === 0 && !search) {
    return (
      <div className="text-center py-16">
        <BookOpen size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
        <h3 className="text-lg font-medium text-gray-600 dark:text-gray-400 mb-2">No papers yet</h3>
        <p className="text-gray-500 dark:text-gray-500 mb-4">Import your first AI-generated question set to get started.</p>
        <button onClick={onImport} className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors mx-auto">
          <PlusCircle size={18} /> Import Paper
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search papers, topics, or questions..."
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none" />
        </div>
        <button onClick={() => setShowFilters(!showFilters)} className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
          <Filter size={16} /> Filters
        </button>
        <button onClick={onImport} className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors">
          <PlusCircle size={16} /> Import Paper
        </button>
      </div>

      {/* Filter Options */}
      {showFilters && (
        <div className="flex flex-wrap gap-2 mb-4 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
          <select value={filters.exam || ''} onChange={e => setFilters({ ...filters, exam: e.target.value || undefined })}
            className="px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs text-gray-700 dark:text-gray-300">
            <option value="">All Exams</option>
            {allExams.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
          <select value={filters.subject || ''} onChange={e => setFilters({ ...filters, subject: e.target.value || undefined })}
            className="px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs text-gray-700 dark:text-gray-300">
            <option value="">All Subjects</option>
            {allSubjects.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={filters.difficulty || ''} onChange={e => setFilters({ ...filters, difficulty: (e.target.value || undefined) as any })}
            className="px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs text-gray-700 dark:text-gray-300">
            <option value="">All Difficulty</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
          <select value={filters.status || ''} onChange={e => setFilters({ ...filters, status: (e.target.value || undefined) as any })}
            className="px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs text-gray-700 dark:text-gray-300">
            <option value="">All Status</option>
            <option value="attempted">Attempted</option>
            <option value="not_attempted">Not Attempted</option>
          </select>
          {(filters.exam || filters.subject || filters.difficulty || filters.status) && (
            <button onClick={() => setFilters({})} className="px-3 py-1.5 text-xs text-red-600 dark:text-red-400 hover:underline">Clear Filters</button>
          )}
        </div>
      )}

      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">{papers.length} paper{papers.length !== 1 ? 's' : ''} found</p>

      {/* Paper Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {papers.map(paper => {
          const bestScore = getBestScore(paper.id);
          const attemptCount = getAttemptCount(paper.id);

          return (
            <div key={paper.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-lg transition-shadow group">
              <div className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-bold text-gray-900 dark:text-white text-sm leading-tight line-clamp-2 flex-1 mr-2">{paper.title}</h3>
                  <div className="flex gap-1 shrink-0">
                    {paper.is_demo && <span className="px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded text-xs font-medium">Demo</span>}
                    {paper.visibility === 'public' && (
                      <span className="flex items-center gap-1 px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded text-xs font-medium">
                        <Globe size={10} /> Public
                      </span>
                    )}
                  </div>
                </div>
                {paper.description && <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 line-clamp-2">{paper.description}</p>}

                <div className="flex flex-wrap gap-1.5 mb-3">
                  <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 rounded text-xs">{paper.exam}</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${getDifficultyColor(paper.difficulty)}`}>{paper.difficulty}</span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center mb-3">
                  <div className="p-1.5 bg-gray-50 dark:bg-gray-900/50 rounded">
                    <div className="text-sm font-bold text-gray-900 dark:text-white">{paper.question_count}</div>
                    <div className="text-xs text-gray-500">Qs</div>
                  </div>
                  <div className="p-1.5 bg-gray-50 dark:bg-gray-900/50 rounded">
                    <div className="text-sm font-bold text-gray-900 dark:text-white">{paper.total_marks}</div>
                    <div className="text-xs text-gray-500">Marks</div>
                  </div>
                  <div className="p-1.5 bg-gray-50 dark:bg-gray-900/50 rounded">
                    <div className="text-sm font-bold text-gray-900 dark:text-white">{paper.duration_minutes}m</div>
                    <div className="text-xs text-gray-500">Time</div>
                  </div>
                </div>

                {attemptCount > 0 && (
                  <div className="flex items-center justify-between text-xs mb-3 p-2 bg-gray-50 dark:bg-gray-900/50 rounded">
                    <span className="text-gray-500">{attemptCount} attempt{attemptCount > 1 ? 's' : ''}</span>
                    {bestScore !== null && (
                      <span className={`font-bold ${getAccuracyColor(bestScore)}`}>Best: {bestScore}%</span>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap gap-1 mb-3">
                  {paper.subjects.slice(0, 3).map(s => (
                    <span key={s} className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded text-xs truncate max-w-[100px]">{s}</span>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="border-t border-gray-100 dark:border-gray-700 p-3 flex flex-wrap gap-1.5">
                <button onClick={() => onStartExam(paper.id)} className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 transition-colors">
                  <Play size={12} /> Exam
                </button>
                <button onClick={() => onPractice(paper.id)} className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 transition-colors">
                  <Target size={12} /> Practice
                </button>
                <button onClick={() => handleExport(paper)} className="p-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors" title="Export JSON">
                  <Download size={12} />
                </button>
                <button onClick={() => handleCopyJSON(paper)} className="p-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors" title="Copy JSON">
                  <Copy size={12} />
                </button>
                <button 
                  onClick={() => handleToggleVisibility(paper)} 
                  className={`p-2 rounded-lg transition-colors ${
                    paper.visibility === 'public' 
                      ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/40' 
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`} 
                  title={paper.visibility === 'public' ? 'Make Private' : 'Make Public'}
                >
                  {paper.visibility === 'public' ? <Globe size={12} /> : <Lock size={12} />}
                </button>
                <button onClick={() => handleDelete(paper.id)} className="p-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors" title="Delete">
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// Practice Tab
// ============================================================
function PracticeTab({ papers, mistakes, onStartExam }: { papers: Paper[]; mistakes: Mistake[]; onStartExam: (id: string) => void }) {
  const modes = [
    { id: 'quick', label: 'Quick Practice', desc: 'Random questions from all papers', icon: Zap, color: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400' },
    { id: 'topic', label: 'Topic Practice', desc: 'Focus on a specific topic', icon: BookOpen, color: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400' },
    { id: 'weak', label: 'Weak Area Practice', desc: 'Practice your weakest topics', icon: Brain, color: 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400' },
    { id: 'mistakes', label: 'Previous Mistakes', desc: 'Review questions you got wrong', icon: AlertTriangle, color: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400' },
    { id: 'timed', label: 'Timed Practice', desc: 'Practice with a time limit', icon: Clock, color: 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400' },
    { id: 'random', label: 'Random Mix', desc: 'Mixed difficulty random selection', icon: RotateCcw, color: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400' },
  ];

  return (
    <div>
      <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Practice Modes</h2>
      {papers.length === 0 ? (
        <div className="text-center py-12">
          <Target size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
          <p className="text-gray-500 dark:text-gray-400">Import papers first to start practicing.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {modes.map(mode => (
            <button key={mode.id} onClick={() => {
              // Start with first paper in practice mode
              if (papers.length > 0) onStartExam(papers[0].id);
            }} className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 text-left hover:shadow-md transition-shadow">
              <div className={`inline-flex items-center justify-center w-10 h-10 rounded-xl mb-3 ${mode.color}`}>
                <mode.icon size={20} />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white text-sm mb-1">{mode.label}</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">{mode.desc}</p>
            </button>
          ))}
        </div>
      )}
      {mistakes.length > 0 && (
        <div className="mt-6 p-4 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-xl">
          <p className="text-sm text-red-700 dark:text-red-400">
            <AlertTriangle size={14} className="inline mr-1" />
            You have <strong>{mistakes.length}</strong> questions in your mistake notebook. Practice them to improve!
          </p>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Mistakes Tab
// ============================================================
function MistakesTab({ mistakes, onResolve }: { mistakes: Mistake[]; onResolve: (id: string) => void }) {
  if (mistakes.length === 0) {
    return (
      <div className="text-center py-16">
        <CheckCircle size={48} className="mx-auto text-green-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-600 dark:text-gray-400 mb-2">Excellent!</h3>
        <p className="text-gray-500 dark:text-gray-500">You don't have any recorded mistakes yet. Keep it up!</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">My Mistakes ({mistakes.length})</h2>
      <div className="space-y-3">
        {mistakes.map(m => (
          <div key={m.id} className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">{m.question_text}</p>
                <div className="flex flex-wrap gap-1.5">
                  <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded text-xs">{m.subject}</span>
                  <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded text-xs">{m.topic}</span>
                  <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded text-xs">{m.incorrect_count}× wrong</span>
                </div>
              </div>
              <button onClick={() => onResolve(m.id)} className="shrink-0 p-1.5 text-gray-400 hover:text-green-600 transition-colors" title="Mark as resolved">
                <CheckCircle size={18} />
              </button>
            </div>
            <div className="text-xs space-y-1">
              <p className="text-red-600 dark:text-red-400">Your answer: {m.selected_answer !== null ? m.options[m.selected_answer] : 'Not attempted'}</p>
              <p className="text-green-600 dark:text-green-400">Correct: {m.options[m.correct_answer]}</p>
              {m.solution && <p className="text-gray-500 dark:text-gray-400 mt-1">💡 {m.solution}</p>}
              {m.shortcut && <p className="text-purple-600 dark:text-purple-400">⚡ {m.shortcut}</p>}
              {m.learning_suggestion && <p className="text-orange-600 dark:text-orange-400">📌 {m.learning_suggestion}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// Bookmarks Tab
// ============================================================
function BookmarksTab({ bookmarks, onRemove }: { bookmarks: Bookmark[]; onRemove: (id: string) => void }) {
  const [filterCat, setFilterCat] = useState<BookmarkCategory | ''>('');
  const filtered = filterCat ? bookmarks.filter(b => b.category === filterCat) : bookmarks;

  if (bookmarks.length === 0) {
    return (
      <div className="text-center py-16">
        <BookmarkIcon size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
        <h3 className="text-lg font-medium text-gray-600 dark:text-gray-400 mb-2">No bookmarks yet</h3>
        <p className="text-gray-500 dark:text-gray-500">Bookmark important questions while taking exams.</p>
      </div>
    );
  }

  const categories: BookmarkCategory[] = ['important', 'difficult', 'revise_later', 'shortcut', 'formula', 'doubt'];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Saved Questions ({bookmarks.length})</h2>
        <select value={filterCat} onChange={e => setFilterCat(e.target.value as BookmarkCategory | '')} className="px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs text-gray-700 dark:text-gray-300">
          <option value="">All Categories</option>
          {categories.map(c => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
        </select>
      </div>
      <div className="space-y-2">
        {filtered.map(b => (
          <div key={b.id} className="flex items-start justify-between gap-3 p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
            <div className="min-w-0">
              <p className="text-sm text-gray-900 dark:text-white mb-1">{b.question_text}</p>
              <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 rounded text-xs">{b.category.replace('_', ' ')}</span>
            </div>
            <button onClick={() => onRemove(b.id)} className="shrink-0 p-1.5 text-gray-400 hover:text-red-600 transition-colors">
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// Analytics Tab
// ============================================================
function AnalyticsTab({ attempts, papers }: { attempts: Attempt[]; papers: Paper[] }) {
  if (attempts.length === 0) {
    return (
      <div className="text-center py-16">
        <BarChart3 size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
        <h3 className="text-lg font-medium text-gray-600 dark:text-gray-400 mb-2">No analytics yet</h3>
        <p className="text-gray-500 dark:text-gray-500">Start your first paper to begin tracking your progress.</p>
      </div>
    );
  }

  const totalQs = attempts.reduce((s, a) => s + a.attempted_count, 0);
  const avgAccuracy = Math.round(attempts.reduce((s, a) => s + a.accuracy, 0) / attempts.length);
  const avgTime = attempts.length > 0 ? Math.round(attempts.reduce((s, a) => s + a.time_spent_seconds, 0) / attempts.length) : 0;
  const avgTimePerQ = totalQs > 0 ? Math.round(attempts.reduce((s, a) => s + a.time_spent_seconds, 0) / totalQs) : 0;
  const bestScore = Math.max(...attempts.map(a => Math.round((a.score / a.total_marks) * 100)));
  const avgScore = Math.round(attempts.reduce((s, a) => s + (a.score / a.total_marks) * 100, 0) / attempts.length);

  // Subject analysis
  const subjectStats = new Map<string, { correct: number; total: number; time: number }>();
  attempts.forEach(a => {
    const paper = papers.find(p => p.id === a.paper_id);
    if (!paper) return;
    paper.raw_json.subjects?.forEach(sub => {
      const subQs = paper.raw_json.questions.filter(q => q.subject === sub);
      if (!subjectStats.has(sub)) subjectStats.set(sub, { correct: 0, total: 0, time: 0 });
    });
  });

  return (
    <div>
      <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Performance Analytics</h2>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <div className="p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 text-center">
          <div className="text-xl font-bold text-indigo-600 dark:text-indigo-400">{attempts.length}</div>
          <div className="text-xs text-gray-500">Total Exams</div>
        </div>
        <div className="p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 text-center">
          <div className="text-xl font-bold text-blue-600 dark:text-blue-400">{totalQs}</div>
          <div className="text-xs text-gray-500">Questions Solved</div>
        </div>
        <div className="p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 text-center">
          <div className="text-xl font-bold text-green-600 dark:text-green-400">{avgAccuracy}%</div>
          <div className="text-xs text-gray-500">Avg Accuracy</div>
        </div>
        <div className="p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 text-center">
          <div className="text-xl font-bold text-purple-600 dark:text-purple-400">{bestScore}%</div>
          <div className="text-xs text-gray-500">Highest Score</div>
        </div>
        <div className="p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 text-center">
          <div className="text-xl font-bold text-yellow-600 dark:text-yellow-400">{formatTime(avgTimePerQ)}</div>
          <div className="text-xs text-gray-500">Avg Time/Q</div>
        </div>
        <div className="p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 text-center">
          <div className="text-xl font-bold text-orange-600 dark:text-orange-400">{avgScore}%</div>
          <div className="text-xs text-gray-500">Avg Score</div>
        </div>
      </div>

      {/* Score Progress Chart (Simple bar chart) */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 mb-6">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-3 text-sm">Score Progress</h3>
        <div className="flex items-end gap-1 h-32">
          {attempts.slice(-20).reverse().map((a, idx) => {
            const pct = Math.round((a.score / a.total_marks) * 100);
            return (
              <div key={a.id} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full rounded-t transition-all hover:opacity-80" style={{
                  height: `${Math.max(4, pct)}%`,
                  backgroundColor: pct >= 70 ? '#22c55e' : pct >= 40 ? '#eab308' : '#ef4444',
                }} title={`${a.paper_title}: ${pct}%`} />
              </div>
            );
          })}
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">Last {Math.min(20, attempts.length)} attempts</p>
      </div>

      {/* Recent Attempts Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-3 text-sm">Recent Attempts</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                <th className="pb-2 pr-4">Paper</th>
                <th className="pb-2 pr-4">Score</th>
                <th className="pb-2 pr-4">Accuracy</th>
                <th className="pb-2 pr-4">Time</th>
                <th className="pb-2">Date</th>
              </tr>
            </thead>
            <tbody>
              {attempts.slice(0, 10).map(a => {
                const pct = Math.round((a.score / a.total_marks) * 100);
                return (
                  <tr key={a.id} className="border-b border-gray-50 dark:border-gray-700/50">
                    <td className="py-2 pr-4 text-gray-900 dark:text-white font-medium truncate max-w-[200px]">{a.paper_title}</td>
                    <td className={`py-2 pr-4 font-bold ${getAccuracyColor(pct)}`}>{a.score}/{a.total_marks}</td>
                    <td className={`py-2 pr-4 ${getAccuracyColor(a.accuracy)}`}>{a.accuracy}%</td>
                    <td className="py-2 pr-4 text-gray-500">{formatTime(a.time_spent_seconds)}</td>
                    <td className="py-2 text-gray-500 text-xs">{new Date(a.started_at).toLocaleDateString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
