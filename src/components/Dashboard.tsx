import { useState, useEffect, useMemo } from 'react';
import { Paper, Attempt, Mistake, Bookmark, PaperFilters, BookmarkCategory, QuestionJSON } from '../types';
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
  onStartCustomPractice: (paper: Paper) => void;
  onImport: () => void;
  onStartReview: () => void;
  refreshKey: number;
}

export default function Dashboard({ userId, onStartExam, onPractice, onStartCustomPractice, onImport, onStartReview, refreshKey }: DashboardProps) {
  const effectiveUserId = userId || 'guest';
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
        getPapers(effectiveUserId),
        getAttempts(effectiveUserId),
        getMistakes(effectiveUserId),
        getBookmarks(effectiveUserId),
      ]);
      setPapers(p);
      setAttempts(a);
      setMistakes(m);
      setBookmarks(b);
    }
    load();
  }, [effectiveUserId, refreshKey]);

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

  const allQuestions = useMemo(() => {
    const list: QuestionJSON[] = [];
    papers.forEach(p => {
      if (p.raw_json?.questions) {
        list.push(...p.raw_json.questions);
      }
    });
    return list;
  }, [papers]);

  // Stats
  const totalAttempts = attempts.length;
  const totalQuestions = attempts.reduce((s, a) => s + a.attempted_count, 0);
  const overallAccuracy = totalAttempts > 0 ? Math.round(attempts.reduce((s, a) => s + a.accuracy, 0) / totalAttempts) : 0;
  const highestScore = totalAttempts > 0 ? Math.max(...attempts.map(a => Math.round((a.score / a.total_marks) * 100))) : 0;

  // Weak areas calculated from mistake notebook
  const weakTopics = useMemo(() => {
    const mistMap = new Map<string, number>();
    mistakes.forEach(m => {
      mistMap.set(m.topic, (mistMap.get(m.topic) || 0) + m.incorrect_count);
    });
    return Array.from(mistMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([topic, count]) => ({ topic, count }));
  }, [mistakes]);

  const handlePracticeTopicClick = (topicName: string) => {
    const matched = allQuestions.filter(q => q.topic.toLowerCase() === topicName.toLowerCase());
    const questionsToUse = matched.length > 0 ? matched : allQuestions.slice(0, 10);
    if (questionsToUse.length === 0) return;

    const customPaper: Paper = {
      id: `custom_drill_${Date.now()}`,
      user_id: effectiveUserId,
      exam: 'SSC CGL',
      title: `${topicName} — Focused Drill`,
      description: `Targeted revision drill for ${topicName} (${questionsToUse.length} questions)`,
      difficulty: 'medium',
      duration_minutes: Math.max(5, Math.ceil(questionsToUse.length * 1.5)),
      total_marks: questionsToUse.length * 2,
      negative_marking: 0.5,
      question_count: questionsToUse.length,
      subjects: Array.from(new Set(questionsToUse.map(q => q.subject))),
      raw_json: {
        exam: 'SSC CGL',
        paperTitle: `${topicName} — Focused Drill`,
        durationMinutes: Math.max(5, Math.ceil(questionsToUse.length * 1.5)),
        totalMarks: questionsToUse.length * 2,
        negativeMarking: 0.5,
        subjects: Array.from(new Set(questionsToUse.map(q => q.subject))),
        questions: questionsToUse,
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      visibility: 'private',
    };
    onStartCustomPractice(customPaper);
  };

  const tabs = [
    { id: 'library' as const, label: 'Exam Library', icon: BookOpen },
    { id: 'practice' as const, label: 'Practice Hub', icon: Target },
    { id: 'mistakes' as const, label: 'Mistakes', icon: AlertTriangle, count: mistakes.length },
    { id: 'bookmarks' as const, label: 'Bookmarks', icon: BookmarkIcon, count: bookmarks.length },
    { id: 'analytics' as const, label: 'Analytics', icon: BarChart3 },
  ];

  return (
    <div className="max-w-7xl mx-auto animate-fadeIn">
      {/* Welcome Banner */}
      <div className="glass-card rounded-3xl p-6 sm:p-8 mb-8 border border-white/40 shadow-soft">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="badge badge-accent">SSC CGL 2026</span>
              <span className="text-xs text-slate-500 dark:text-slate-400">Target Preparation Hub</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white" style={{ fontFamily: 'var(--font-heading)' }}>
              Master Every Topic with Adaptive Drills
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Real exam simulation, instant step-by-step shortcuts, and active spaced repetition recall.
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setActiveTab('practice')} className="btn btn-primary text-xs py-2.5 px-4 shadow-soft">
              <Target size={15} /> Quick Drill
            </button>
            <button onClick={onImport} className="btn btn-outline text-xs py-2.5 px-4">
              <PlusCircle size={15} /> Import Paper
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 mb-8">
        <StatCard icon={FileText} label="Papers" value={papers.length} color="primary" />
        <StatCard icon={Play} label="Attempts" value={totalAttempts} color="accent" />
        <StatCard icon={Target} label="Questions" value={totalQuestions} color="success" />
        <StatCard icon={TrendingUp} label="Accuracy" value={`${overallAccuracy}%`} color="warning" />
        <StatCard icon={Award} label="Best Score" value={`${highestScore}%`} color="info" />
        <StatCard icon={AlertTriangle} label="Mistakes" value={mistakes.length} color="danger" />
      </div>

      {/* Spaced Repetition Review Dashboard */}
      <ReviewDashboard userId={effectiveUserId} onStartReview={onStartReview} />

      {/* Clickable Weak Areas Banner */}
      {weakTopics.length > 0 && (
        <div className="glass-card rounded-2xl p-5 mb-8 border border-amber-200 dark:border-amber-900/40 bg-amber-50/40 dark:bg-amber-950/20">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
            <h3 className="text-sm font-bold flex items-center gap-2 text-amber-900 dark:text-amber-200">
              <Brain size={18} className="text-amber-600 dark:text-amber-400" />
              Focus Areas (Based on your incorrect answers)
            </h3>
            <span className="text-xs text-amber-700/80 dark:text-amber-400/80">Click any topic to start a targeted drill</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {weakTopics.map(wt => (
              <button
                key={wt.topic}
                onClick={() => handlePracticeTopicClick(wt.topic)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/40 dark:hover:bg-amber-900/70 text-amber-800 dark:text-amber-300 border border-amber-300/60 dark:border-amber-700/60 transition-all hover:scale-105 flex items-center gap-1.5 shadow-soft cursor-pointer"
                title={`Click to practice ${wt.topic}`}
              >
                <span>{wt.topic}</span>
                <span className="px-1.5 py-0.5 bg-amber-200/80 dark:bg-amber-800/80 rounded-full text-[10px] font-bold">
                  {wt.count} errors
                </span>
                <Play size={10} className="text-amber-700 dark:text-amber-400 fill-amber-700" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="glass-card rounded-3xl mb-8 overflow-hidden border border-white/40 shadow-soft">
        <div className="flex overflow-x-auto border-b border-slate-200/70 dark:border-slate-800/70 bg-white/40 dark:bg-slate-900/40 px-2">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-3.5 text-sm font-semibold whitespace-nowrap transition-all relative ${
                activeTab === tab.id
                  ? 'text-indigo-600 dark:text-indigo-400 font-bold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-white/40'
              }`}
            >
              <tab.icon size={17} />
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className="ml-1 badge badge-danger text-[10px] py-0.5 px-1.5">{tab.count}</span>
              )}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full" style={{ background: 'var(--gradient-brand)' }}></div>
              )}
            </button>
          ))}
        </div>
        <div className="p-5 sm:p-7">

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
          userId={effectiveUserId}
        />
      )}
      {activeTab === 'practice' && (
        <PracticeTab
          papers={papers}
          mistakes={mistakes}
          allQuestions={allQuestions}
          onStartCustomPractice={onStartCustomPractice}
          effectiveUserId={effectiveUserId}
        />
      )}
      {activeTab === 'mistakes' && (
        <MistakesTab
          mistakes={mistakes}
          onResolve={async (id) => { await resolveMistake(id); setMistakes(await getMistakes(effectiveUserId)); }}
          onStartCustomPractice={onStartCustomPractice}
          effectiveUserId={effectiveUserId}
        />
      )}
      {activeTab === 'bookmarks' && (
        <BookmarksTab
          bookmarks={bookmarks}
          allQuestions={allQuestions}
          onRemove={async (id) => { await removeBookmark(id); setBookmarks(await getBookmarks(effectiveUserId)); }}
          onStartCustomPractice={onStartCustomPractice}
          effectiveUserId={effectiveUserId}
        />
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
// Practice Tab (Dynamic Custom Drills & Adaptive Modes)
// ============================================================
function PracticeTab({
  papers,
  mistakes,
  allQuestions,
  onStartCustomPractice,
  effectiveUserId,
}: {
  papers: Paper[];
  mistakes: Mistake[];
  allQuestions: QuestionJSON[];
  onStartCustomPractice: (paper: Paper) => void;
  effectiveUserId: string;
}) {
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [selectedTopic, setSelectedTopic] = useState<string>('');

  const subjects = useMemo(() => {
    return Array.from(new Set(allQuestions.map(q => q.subject).filter(Boolean)));
  }, [allQuestions]);

  const topicsForSubject = useMemo(() => {
    const list = allQuestions.filter(q => !selectedSubject || q.subject === selectedSubject);
    return Array.from(new Set(list.map(q => q.topic).filter(Boolean)));
  }, [allQuestions, selectedSubject]);

  const topicMatchedQuestions = useMemo(() => {
    return allQuestions.filter(q => {
      const subMatch = !selectedSubject || q.subject === selectedSubject;
      const topMatch = !selectedTopic || q.topic === selectedTopic;
      return subMatch && topMatch;
    });
  }, [allQuestions, selectedSubject, selectedTopic]);

  const launchCustomDrill = (title: string, desc: string, questions: QuestionJSON[], durationMins: number) => {
    if (questions.length === 0) {
      alert('No questions available for this practice mode. Import more papers to unlock drills.');
      return;
    }
    const customPaper: Paper = {
      id: `practice_${Date.now()}`,
      user_id: effectiveUserId,
      exam: 'SSC CGL',
      title,
      description: desc,
      difficulty: 'medium',
      duration_minutes: durationMins,
      total_marks: questions.length * 2,
      negative_marking: 0.5,
      question_count: questions.length,
      subjects: Array.from(new Set(questions.map(q => q.subject))),
      raw_json: {
        exam: 'SSC CGL',
        paperTitle: title,
        durationMinutes: durationMins,
        totalMarks: questions.length * 2,
        negativeMarking: 0.5,
        subjects: Array.from(new Set(questions.map(q => q.subject))),
        questions,
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      visibility: 'private',
    };
    onStartCustomPractice(customPaper);
  };

  const startQuickSprint = () => {
    const shuffled = [...allQuestions].sort(() => 0.5 - Math.random()).slice(0, 10);
    launchCustomDrill('Quick Sprint (10 Questions)', 'Rapid-fire 10 questions to test current readiness', shuffled, 10);
  };

  const startSpeedDrill = () => {
    const shuffled = [...allQuestions].sort(() => 0.5 - Math.random()).slice(0, 10);
    launchCustomDrill('Speed Challenge (5 Minutes)', '10 questions under high-pressure 5-minute countdown', shuffled, 5);
  };

  const startWeakAreaDrill = () => {
    if (mistakes.length === 0) {
      startQuickSprint();
      return;
    }
    const weakTopicsSet = new Set(mistakes.map(m => m.topic.toLowerCase()));
    let matched = allQuestions.filter(q => weakTopicsSet.has(q.topic.toLowerCase()));
    if (matched.length === 0) matched = allQuestions.slice(0, 10);
    launchCustomDrill('Weak Areas Remediation', 'Targeted drill focusing strictly on topics with past mistakes', matched, Math.max(5, Math.ceil(matched.length * 1.5)));
  };

  const startMistakesDrill = () => {
    if (mistakes.length === 0) {
      alert('You have 0 mistakes recorded! Take an exam to log questions for review.');
      return;
    }
    const mistakeQuestions: QuestionJSON[] = mistakes.map((m, idx) => ({
      id: m.question_id || idx + 1,
      subject: m.subject,
      topic: m.topic,
      question: m.question_text,
      options: m.options,
      correctAnswer: m.options[m.correct_answer] || '',
      answerIndex: m.correct_answer,
      marks: 2,
      negativeMarks: 0.5,
      solution: m.solution,
      shortcut: m.shortcut,
      hint: m.hint,
      learningSuggestion: m.learning_suggestion,
    }));
    launchCustomDrill('Mistake Notebook Retest', 'Retest questions that you previously answered incorrectly', mistakeQuestions, Math.max(5, Math.ceil(mistakeQuestions.length * 1.5)));
  };

  const startMixedComprehensive = () => {
    const shuffled = [...allQuestions].sort(() => 0.5 - Math.random()).slice(0, 15);
    launchCustomDrill('Comprehensive Mix (15 Qs)', 'Multi-subject randomized practice session', shuffled, 15);
  };

  const startTopicDrill = () => {
    if (topicMatchedQuestions.length === 0) return;
    const topicLabel = selectedTopic || selectedSubject || 'All Topics';
    launchCustomDrill(
      `${topicLabel} Practice Drill`,
      `Focused drill on ${topicLabel} with ${topicMatchedQuestions.length} questions`,
      topicMatchedQuestions,
      Math.max(5, Math.ceil(topicMatchedQuestions.length * 1.5))
    );
  };

  if (allQuestions.length === 0) {
    return (
      <div className="text-center py-16">
        <Target size={48} className="mx-auto text-slate-300 dark:text-slate-600 mb-4" />
        <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-1">No Questions Available</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Please import a question set or paper first to unlock practice modes.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Interactive Topic Selector */}
      <div className="glass-card rounded-2xl p-6 border border-indigo-100 dark:border-indigo-950/60 bg-gradient-to-r from-indigo-50/50 via-white to-sky-50/50 dark:from-slate-900/60 dark:to-indigo-950/20 shadow-soft">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div>
            <span className="badge badge-accent mb-1">Custom Practice Builder</span>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <BookOpen size={18} className="text-indigo-600" />
              Targeted Topic Drill
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
              Filter by subject and specific topic to practice weak syllabus areas.
            </p>
          </div>
          <button
            onClick={startTopicDrill}
            disabled={topicMatchedQuestions.length === 0}
            className="btn btn-primary text-xs py-2.5 px-5 shadow-soft shrink-0 self-start md:self-auto"
          >
            <Play size={14} className="fill-white" /> Start Topic Drill ({topicMatchedQuestions.length} Qs)
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 block">Subject</label>
            <select
              value={selectedSubject}
              onChange={e => { setSelectedSubject(e.target.value); setSelectedTopic(''); }}
              className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
            >
              <option value="">All Subjects ({allQuestions.length} Questions)</option>
              {subjects.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 block">Specific Topic</label>
            <select
              value={selectedTopic}
              onChange={e => setSelectedTopic(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
            >
              <option value="">All Topics</option>
              {topicsForSubject.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Quick Launch Practice Modes */}
      <div>
        <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <Zap size={18} className="text-amber-500" />
          Smart Practice Modes
        </h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <button
            onClick={startQuickSprint}
            className="p-5 bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 text-left hover:shadow-medium transition-all group hover:border-amber-400"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-3 shadow-soft group-hover:scale-110 transition-transform">
              <Zap size={20} />
            </div>
            <h4 className="font-bold text-slate-900 dark:text-white text-sm mb-1 group-hover:text-indigo-600 transition-colors">
              Quick 10-Q Sprint
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              10 random questions across all subjects. Perfect for a 10-minute coffee break drill.
            </p>
          </button>

          <button
            onClick={startSpeedDrill}
            className="p-5 bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 text-left hover:shadow-medium transition-all group hover:border-purple-400"
          >
            <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-3 shadow-soft group-hover:scale-110 transition-transform">
              <Clock size={20} />
            </div>
            <h4 className="font-bold text-slate-900 dark:text-white text-sm mb-1 group-hover:text-indigo-600 transition-colors">
              5-Minute Speed Drill
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              10 questions in 5 minutes. Trains high-speed calculation and fast elimination.
            </p>
          </button>

          <button
            onClick={startWeakAreaDrill}
            className="p-5 bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 text-left hover:shadow-medium transition-all group hover:border-rose-400"
          >
            <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 flex items-center justify-center mb-3 shadow-soft group-hover:scale-110 transition-transform">
              <Brain size={20} />
            </div>
            <h4 className="font-bold text-slate-900 dark:text-white text-sm mb-1 group-hover:text-indigo-600 transition-colors">
              Weak Areas Drill
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Dynamically targets topics where you have logged the most mistakes.
            </p>
          </button>

          <button
            onClick={startMistakesDrill}
            className="p-5 bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 text-left hover:shadow-medium transition-all group hover:border-orange-400"
          >
            <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 flex items-center justify-center mb-3 shadow-soft group-hover:scale-110 transition-transform">
              <AlertTriangle size={20} />
            </div>
            <h4 className="font-bold text-slate-900 dark:text-white text-sm mb-1 group-hover:text-indigo-600 transition-colors">
              Mistake Notebook Test
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              {mistakes.length > 0
                ? `Test yourself on ${mistakes.length} recorded mistake question${mistakes.length > 1 ? 's' : ''}.`
                : 'Retest questions you previously got wrong.'}
            </p>
          </button>

          <button
            onClick={startMixedComprehensive}
            className="p-5 bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 text-left hover:shadow-medium transition-all group hover:border-emerald-400"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-3 shadow-soft group-hover:scale-110 transition-transform">
              <RotateCcw size={20} />
            </div>
            <h4 className="font-bold text-slate-900 dark:text-white text-sm mb-1 group-hover:text-indigo-600 transition-colors">
              Comprehensive Mixed (15 Qs)
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Balanced mix covering Quant, Reasoning, English, and General Awareness.
            </p>
          </button>

          <button
            onClick={startTopicDrill}
            className="p-5 bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 text-left hover:shadow-medium transition-all group hover:border-blue-400"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-3 shadow-soft group-hover:scale-110 transition-transform">
              <Target size={20} />
            </div>
            <h4 className="font-bold text-slate-900 dark:text-white text-sm mb-1 group-hover:text-indigo-600 transition-colors">
              Subject Deep Dive
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Select any subject and master questions topic-by-topic with instant solutions.
            </p>
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Mistakes Tab
// ============================================================
function MistakesTab({
  mistakes,
  onResolve,
  onStartCustomPractice,
  effectiveUserId,
}: {
  mistakes: Mistake[];
  onResolve: (id: string) => void;
  onStartCustomPractice: (paper: Paper) => void;
  effectiveUserId: string;
}) {
  const handlePracticeMistakes = () => {
    if (mistakes.length === 0) return;
    const questions: QuestionJSON[] = mistakes.map((m, idx) => ({
      id: m.question_id || idx + 1,
      subject: m.subject,
      topic: m.topic,
      question: m.question_text,
      options: m.options,
      correctAnswer: m.options[m.correct_answer] || '',
      answerIndex: m.correct_answer,
      marks: 2,
      negativeMarks: 0.5,
      solution: m.solution,
      shortcut: m.shortcut,
      hint: m.hint,
      learningSuggestion: m.learning_suggestion,
    }));

    const customPaper: Paper = {
      id: `mistakes_practice_${Date.now()}`,
      user_id: effectiveUserId,
      exam: 'SSC CGL',
      title: 'Mistake Notebook Retest',
      description: `Targeted revision test for ${mistakes.length} past incorrect questions.`,
      difficulty: 'medium',
      duration_minutes: Math.max(5, Math.ceil(questions.length * 1.5)),
      total_marks: questions.length * 2,
      negative_marking: 0.5,
      question_count: questions.length,
      subjects: Array.from(new Set(questions.map(q => q.subject))),
      raw_json: {
        exam: 'SSC CGL',
        paperTitle: 'Mistake Notebook Retest',
        durationMinutes: Math.max(5, Math.ceil(questions.length * 1.5)),
        totalMarks: questions.length * 2,
        negativeMarking: 0.5,
        subjects: Array.from(new Set(questions.map(q => q.subject))),
        questions,
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      visibility: 'private',
    };
    onStartCustomPractice(customPaper);
  };

  if (mistakes.length === 0) {
    return (
      <div className="text-center py-16">
        <CheckCircle size={48} className="mx-auto text-emerald-500 mb-4" />
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-1">Mistake Notebook Clean!</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400">You have no pending mistakes. Keep practicing to maintain high accuracy!</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">My Mistake Notebook ({mistakes.length})</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Questions you missed during mock tests. Review solutions and retest anytime.</p>
        </div>
        <button
          onClick={handlePracticeMistakes}
          className="btn btn-primary text-xs py-2.5 px-4 shadow-soft self-start sm:self-auto"
        >
          <RotateCcw size={14} /> Practice All Mistakes ({mistakes.length})
        </button>
      </div>

      <div className="space-y-3">
        {mistakes.map(m => (
          <div key={m.id} className="p-4 sm:p-5 bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-soft">
            <div className="flex items-start justify-between gap-3 mb-2.5">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900 dark:text-white mb-1.5 leading-relaxed">{m.question_text}</p>
                <div className="flex flex-wrap gap-1.5">
                  <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded text-xs font-medium">{m.subject}</span>
                  <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded text-xs font-medium">{m.topic}</span>
                  <span className="px-2 py-0.5 bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 rounded text-xs font-bold">{m.incorrect_count}× wrong</span>
                </div>
              </div>
              <button onClick={() => onResolve(m.id)} className="shrink-0 p-2 text-slate-400 hover:text-emerald-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors" title="Mark as resolved">
                <CheckCircle size={18} />
              </button>
            </div>
            <div className="text-xs space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-700/60">
              <p className="text-rose-600 dark:text-rose-400 font-medium">Your answer: {m.selected_answer !== null ? m.options[m.selected_answer] : 'Not attempted'}</p>
              <p className="text-emerald-600 dark:text-emerald-400 font-medium">Correct answer: {m.options[m.correct_answer]}</p>
              {m.solution && <p className="text-slate-600 dark:text-slate-300 mt-1 whitespace-pre-wrap">💡 <strong>Solution:</strong> {m.solution}</p>}
              {m.shortcut && <p className="text-purple-600 dark:text-purple-400">⚡ <strong>Shortcut:</strong> {m.shortcut}</p>}
              {m.learning_suggestion && <p className="text-amber-600 dark:text-amber-400">📌 <strong>Tip:</strong> {m.learning_suggestion}</p>}
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
function BookmarksTab({
  bookmarks,
  allQuestions,
  onRemove,
  onStartCustomPractice,
  effectiveUserId,
}: {
  bookmarks: Bookmark[];
  allQuestions: QuestionJSON[];
  onRemove: (id: string) => void;
  onStartCustomPractice: (paper: Paper) => void;
  effectiveUserId: string;
}) {
  const [filterCat, setFilterCat] = useState<BookmarkCategory | ''>('');
  const filtered = filterCat ? bookmarks.filter(b => b.category === filterCat) : bookmarks;

  const handlePracticeBookmarks = () => {
    if (bookmarks.length === 0) return;
    const bIds = new Set(bookmarks.map(b => String(b.question_id)));
    let questions = allQuestions.filter(q => bIds.has(String(q.id)));
    if (questions.length === 0) {
      questions = bookmarks.map((b, idx) => ({
        id: b.question_id || idx + 1,
        subject: 'Revision',
        topic: b.category,
        question: b.question_text,
        options: ['A', 'B', 'C', 'D'],
        correctAnswer: 'A',
        answerIndex: 0,
        marks: 2,
        negativeMarks: 0.5,
      }));
    }

    const customPaper: Paper = {
      id: `bookmarks_practice_${Date.now()}`,
      user_id: effectiveUserId,
      exam: 'SSC CGL',
      title: 'Bookmarked Questions Revision',
      description: `Revision practice for ${bookmarks.length} saved questions`,
      difficulty: 'medium',
      duration_minutes: Math.max(5, Math.ceil(questions.length * 1.5)),
      total_marks: questions.length * 2,
      negative_marking: 0.5,
      question_count: questions.length,
      subjects: Array.from(new Set(questions.map(q => q.subject))),
      raw_json: {
        exam: 'SSC CGL',
        paperTitle: 'Bookmarked Questions Revision',
        durationMinutes: Math.max(5, Math.ceil(questions.length * 1.5)),
        totalMarks: questions.length * 2,
        negativeMarking: 0.5,
        subjects: Array.from(new Set(questions.map(q => q.subject))),
        questions,
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      visibility: 'private',
    };
    onStartCustomPractice(customPaper);
  };

  if (bookmarks.length === 0) {
    return (
      <div className="text-center py-16">
        <BookmarkIcon size={48} className="mx-auto text-slate-300 dark:text-slate-600 mb-4" />
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-1">No Bookmarks Saved</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400">Click the bookmark icon or press [B] during exams to save questions here.</p>
      </div>
    );
  }

  const categories: BookmarkCategory[] = ['important', 'difficult', 'revise_later', 'shortcut', 'formula', 'doubt'];

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Saved Questions ({bookmarks.length})</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Questions pinned for special review and revision.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={filterCat}
            onChange={e => setFilterCat(e.target.value as BookmarkCategory | '')}
            className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200"
          >
            <option value="">All Categories</option>
            {categories.map(c => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
          </select>
          <button
            onClick={handlePracticeBookmarks}
            className="btn btn-primary text-xs py-2 px-3.5 shadow-soft"
          >
            <Play size={13} className="fill-white" /> Practice Bookmarks
          </button>
        </div>
      </div>

      <div className="space-y-2.5">
        {filtered.map(b => (
          <div key={b.id} className="flex items-start justify-between gap-3 p-4 bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-soft">
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-900 dark:text-white mb-1.5">{b.question_text}</p>
              <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 rounded text-xs font-semibold uppercase tracking-wider text-[10px]">
                {b.category.replace('_', ' ')}
              </span>
            </div>
            <button onClick={() => onRemove(b.id)} className="shrink-0 p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors" title="Remove bookmark">
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
