import { useState, useEffect, useMemo } from 'react';
import { Paper, Attempt, Mistake, Bookmark, PaperFilters, BookmarkCategory, QuestionJSON } from '../types';
import { getPapers, getAttempts, getMistakes, getBookmarks, getNotes, deletePaper, removeBookmark, resolveMistake, exportPaperAsJSON, downloadJSON, getAttemptsByPaper, updatePaperVisibility, saveCustomPaper } from '../services/database';
import { getAccuracyColor, getDifficultyColor, formatTime } from '../utils/grader';
import { Search, Filter, Play, BookOpen, Trash2, Download, Copy, Eye, AlertTriangle, Bookmark as BookmarkIcon, BookmarkCheck, Target, TrendingUp, Award, Clock, BarChart3, X, CheckCircle, RotateCcw, Zap, Brain, FileText, PlusCircle, Globe, Lock, LayoutDashboard, Users, Flame, ChevronRight, ArrowUpRight, Share2, Check } from 'lucide-react';

// ============================================================
// Dashboard (Home)
// ============================================================
import ReviewDashboard from './ReviewDashboard';
import StudyNotes from './StudyNotes';

export type DashboardTab = 'overview' | 'library' | 'mistakes' | 'bookmarks' | 'analytics' | 'practice' | 'notes';

interface DashboardProps {
  userId?: string;
  onStartExam: (paperId: string) => void;
  onPractice: (paperId: string) => void;
  onStartCustomPractice: (paper: Paper) => void;
  onImport: () => void;
  onStartReview: () => void;
  onViewResults?: (attemptId: string, paper?: Paper) => void;
  refreshKey: number;
  activeTab?: DashboardTab;
  onTabChange?: (tab: DashboardTab) => void;
}

export default function Dashboard({
  userId,
  onStartExam,
  onPractice,
  onStartCustomPractice,
  onImport,
  onStartReview,
  onViewResults,
  refreshKey,
  activeTab: propTab,
  onTabChange,
}: DashboardProps) {
  const effectiveUserId = userId || 'guest';
  const [papers, setPapers] = useState<Paper[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [mistakes, setMistakes] = useState<Mistake[]>([]);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [notesCount, setNotesCount] = useState(0);
  const [internalTab, setInternalTab] = useState<DashboardTab>('overview');
  const activeTab = propTab || internalTab;
  const setActiveTab = (tab: DashboardTab) => {
    setInternalTab(tab);
    onTabChange?.(tab);
  };
  const [filters, setFilters] = useState<PaperFilters>({});
  const [search, setSearch] = useState('');

  useEffect(() => {
    async function load() {
      const [p, a, m, b, n] = await Promise.all([
        getPapers(effectiveUserId),
        getAttempts(effectiveUserId),
        getMistakes(effectiveUserId),
        getBookmarks(effectiveUserId),
        getNotes(effectiveUserId),
      ]);
      setPapers(p);
      setAttempts(a);
      setMistakes(m);
      setBookmarks(b);
      setNotesCount(n.length);
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
      const attemptedIds = new Set(attempts.map(a => String(a.paper_id).trim()));
      const attemptedTitles = new Set(attempts.map(a => a.paper_title?.trim().toLowerCase()).filter(Boolean));
      result = result.filter(p => attemptedIds.has(String(p.id).trim()) || (p.title && attemptedTitles.has(p.title.trim().toLowerCase())));
    } else if (filters.status === 'not_attempted') {
      const attemptedIds = new Set(attempts.map(a => String(a.paper_id).trim()));
      const attemptedTitles = new Set(attempts.map(a => a.paper_title?.trim().toLowerCase()).filter(Boolean));
      result = result.filter(p => !attemptedIds.has(String(p.id).trim()) && (!p.title || !attemptedTitles.has(p.title.trim().toLowerCase())));
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
    saveCustomPaper(customPaper);
    onStartCustomPractice(customPaper);
  };

  const tabs = [
    { id: 'overview' as const, label: 'Overview', icon: LayoutDashboard },
    { id: 'library' as const, label: 'Exam Library', icon: BookOpen, count: papers.length },
    { id: 'practice' as const, label: 'Practice Hub', icon: Target },
    { id: 'notes' as const, label: 'Study Notes', icon: FileText, count: notesCount },
    { id: 'mistakes' as const, label: 'Mistakes', icon: AlertTriangle, count: mistakes.length },
    { id: 'bookmarks' as const, label: 'Bookmarks', icon: BookmarkIcon, count: bookmarks.length },
    { id: 'analytics' as const, label: 'Analytics', icon: BarChart3 },
  ];

  return (
    <div className="max-w-7xl mx-auto animate-fadeIn space-y-6">
      {/* Top Bento Navigation Tabs */}
      <div className="flex items-center gap-1.5 p-1.5 bg-[var(--bg-subcard)] border border-[var(--border-color)] rounded-2xl overflow-x-auto hide-scrollbar w-fit max-w-full shadow-2xs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              activeTab === tab.id
                ? 'bg-[var(--bg-surface)] text-[var(--text-main)] shadow-xs border border-[var(--border-color)] font-bold'
                : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface)]/60'
            }`}
          >
            <tab.icon size={15} className={activeTab === tab.id ? 'text-[var(--text-main)]' : 'text-[var(--text-subtle)]'} />
            <span>{tab.label}</span>
            {tab.count !== undefined && tab.count > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                activeTab === tab.id
                  ? 'bg-[var(--bg-subcard)] text-[var(--text-main)] border border-[var(--border-color)]'
                  : 'bg-black/5 dark:bg-white/5 text-[var(--text-muted)]'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <OverviewBento
          papers={papers}
          attempts={attempts}
          mistakes={mistakes}
          notesCount={notesCount}
          totalQuestions={totalQuestions}
          overallAccuracy={overallAccuracy}
          highestScore={highestScore}
          weakTopics={weakTopics}
          onStartExam={onStartExam}
          onPractice={onPractice}
          onStartReview={onStartReview}
          onViewResults={onViewResults}
          onSelectTab={setActiveTab}
          onPracticeTopicClick={handlePracticeTopicClick}
        />
      )}
      {activeTab === 'library' && (
        <LibraryTab
          papers={filteredPapers}
          totalPapersCount={papers.length}
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
          onViewResults={onViewResults}
          onRefresh={async () => {
            const p = await getPapers(effectiveUserId);
            setPapers(p);
          }}
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
      {activeTab === 'notes' && (
        <StudyNotes userId={effectiveUserId} />
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
        <AnalyticsTab attempts={attempts} papers={papers} onViewResults={onViewResults} />
      )}
    </div>
  );
}

// ============================================================
// Overview Bento Component (Image 2 Aesthetic)
// ============================================================
function OverviewBento({
  papers,
  attempts,
  mistakes,
  notesCount = 0,
  totalQuestions,
  overallAccuracy,
  highestScore,
  weakTopics,
  onStartExam,
  onPractice,
  onStartReview,
  onViewResults,
  onSelectTab,
  onPracticeTopicClick,
}: {
  papers: Paper[];
  attempts: Attempt[];
  mistakes: Mistake[];
  notesCount?: number;
  totalQuestions: number;
  overallAccuracy: number;
  highestScore: number;
  weakTopics: { topic: string; count: number }[];
  onStartExam: (paperId: string) => void;
  onPractice: (paperId: string) => void;
  onStartReview: () => void;
  onViewResults?: (attemptId: string, paper?: Paper) => void;
  onSelectTab: (tab: DashboardTab) => void;
  onPracticeTopicClick: (topic: string) => void;
}) {
  const barData = useMemo(() => {
    if (attempts.length >= 7) {
      return attempts.slice(-7).map(a => Math.round((a.score / (a.total_marks || 100)) * 100));
    }
    return [45, 68, 55, 84, 62, 92, 78];
  }, [attempts]);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Bento Row: Overview (2 cols) + Popular Mock Tests (1 col) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left: Overview Card */}
        <div className="lg:col-span-2 bento-card p-6 sm:p-7 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-900 tracking-tight">Overview</h2>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 bg-gray-50 border border-gray-100 rounded-full px-3 py-1 shadow-xs">
                <span>Target: SSC CGL 2026</span>
                <ChevronRight size={12} className="text-gray-400 rotate-90" />
              </div>
            </div>

            {/* 2 Big Stat Cards inside (matching Image 2) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <div className="bento-subcard">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-gray-500 text-xs font-semibold">
                    <Users size={15} />
                    <span>Questions</span>
                  </div>
                  <span className="badge badge-accent">↑ 36.8%</span>
                </div>
                <div className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight">
                  {totalQuestions > 0 ? totalQuestions.toLocaleString() : '1,293'}
                </div>
                <div className="text-xs text-gray-400 mt-1 font-medium">
                  vs last month
                </div>
              </div>

              <div className="bento-subcard">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-gray-500 text-xs font-semibold">
                    <Target size={15} />
                    <span>Accuracy</span>
                  </div>
                  <span className="badge badge-accent">↑ 36.8%</span>
                </div>
                <div className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight">
                  {overallAccuracy > 0 ? `${overallAccuracy}%` : '85%'}
                </div>
                <div className="text-xs text-gray-400 mt-1 font-medium">
                  vs target cutoff
                </div>
              </div>
            </div>

            {/* Latest Attempt Review Pill */}
            {attempts.length > 0 && (
              <div className="mb-4 p-3.5 bg-indigo-50/70 border border-indigo-100 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
                    <Eye size={16} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-extrabold text-gray-900 truncate">
                      Latest Exam: {attempts[0].paper_title}
                    </div>
                    <div className="text-[11px] text-gray-500 font-medium">
                      Score: {attempts[0].score}/{attempts[0].total_marks} • Accuracy: {attempts[0].accuracy}% • {formatTime(attempts[0].time_spent_seconds)}
                    </div>
                  </div>
                </div>
                {onViewResults && (
                  <button
                    onClick={() => onViewResults(attempts[0].id, papers.find(p => p.id === attempts[0].paper_id))}
                    className="self-start sm:self-auto px-3.5 py-1.5 bg-white hover:bg-gray-50 border border-indigo-200 text-indigo-700 text-xs font-bold rounded-xl shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>Review Answers & Solutions</span>
                    <ArrowUpRight size={13} />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Bottom Exam Readiness Row */}
          <div className="pt-5 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold shrink-0 border border-emerald-100">
                <Flame size={20} />
              </div>
              <div>
                <div className="text-xs font-bold text-gray-900">
                  Target: SSC CGL Tier 1 & 2
                </div>
                <div className="text-xs text-gray-400 mt-0.5">
                  Consistent practice builds speed, accuracy, and negative-marking discipline.
                </div>
              </div>
            </div>
            
            <button
              onClick={() => onSelectTab('practice')}
              className="flex items-center gap-2 px-4 py-2 bg-gray-900 hover:bg-black text-white text-xs font-bold rounded-xl transition-all shadow-xs shrink-0 self-start sm:self-auto"
            >
              <span>Practice Drills</span>
              <ArrowUpRight size={14} />
            </button>
          </div>
        </div>

        {/* Right: Popular Mock Tests Card (matching Image 2) */}
        <div className="bento-card p-6 sm:p-7 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">Popular Tests</h2>
              <span className="text-xs font-semibold text-gray-400">{papers.length} Papers</span>
            </div>

            <div className="space-y-3">
              {papers.slice(0, 4).map((paper, idx) => {
                const gradients = [
                  'bg-gradient-to-br from-indigo-500 to-purple-600',
                  'bg-gradient-to-br from-amber-400 to-orange-500',
                  'bg-gradient-to-br from-emerald-400 to-teal-600',
                  'bg-gradient-to-br from-blue-500 to-cyan-600',
                ];
                const grad = gradients[idx % gradients.length];

                return (
                  <div
                    key={paper.id}
                    onClick={() => onStartExam(paper.id)}
                    className="flex items-center gap-3 p-2 rounded-2xl hover:bg-gray-50 transition-all cursor-pointer group"
                  >
                    <div className={`w-11 h-11 rounded-2xl ${grad} text-white flex items-center justify-center shrink-0 font-bold shadow-xs`}>
                      <BookOpen size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-gray-900 truncate group-hover:text-black">
                        {paper.title}
                      </div>
                      <div className="text-[11px] text-gray-400 mt-0.5">
                        {paper.exam} • {paper.duration_minutes}m
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs font-bold text-gray-900">
                        {paper.total_marks > 0 ? `${paper.total_marks} M` : '200 M'}
                      </div>
                      <span className="badge badge-accent mt-0.5">
                        Active
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <button
            onClick={() => onSelectTab('library')}
            className="w-full mt-4 py-2.5 border border-gray-200 hover:border-gray-900 rounded-full text-xs font-bold text-gray-700 hover:text-black transition-all text-center bg-white"
          >
            All mock tests
          </button>
        </div>
      </div>

      {/* Second Bento Row: Product View / Bar Chart (2 cols) + Spaced Repetition SRS (1 col) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Performance Bar Chart (matching Image 2) */}
        <div className="lg:col-span-2 bento-card p-6 sm:p-7 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Performance view</h2>
                <p className="text-xs text-gray-400 mt-0.5">Recent accuracy trend</p>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 bg-gray-50 border border-gray-100 rounded-full px-3 py-1 shadow-xs">
                <span>Last 7 sessions</span>
                <ChevronRight size={12} className="text-gray-400 rotate-90" />
              </div>
            </div>

            {/* Stylized Bar Chart */}
            <div className="h-44 flex items-end justify-between gap-3 sm:gap-6 pt-10 px-2 sm:px-6">
              {barData.map((val, i) => {
                const isHighlight = i === barData.length - 2 || (i === 5);
                const heightPercent = Math.max(25, Math.min(val, 95));

                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group relative">
                    {/* Tooltip on Highlight Bar (matching 2.2m tooltip in Image 2) */}
                    {isHighlight && (
                      <div className="absolute -top-7 bg-gray-900 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-md whitespace-nowrap flex items-center gap-1 animate-bounce">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                        {val}% Acc
                      </div>
                    )}
                    <div
                      style={{ height: `${heightPercent}%` }}
                      className={`w-full max-w-[42px] rounded-2xl transition-all duration-300 ${
                        isHighlight
                          ? 'bg-emerald-500 shadow-sm'
                          : 'bg-gray-100 group-hover:bg-gray-200'
                      }`}
                    ></div>
                    <span className="text-[10px] font-medium text-gray-400">
                      {['M', 'T', 'W', 'T', 'F', 'S', 'S'][i]}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
            <div className="text-3xl sm:text-4xl font-black text-gray-900 tracking-tight">
              {highestScore > 0 ? `${highestScore}%` : '88.4%'}
            </div>
            <div className="text-xs text-gray-400 text-right">
              Cutoff probability: <span className="font-bold text-emerald-600">High (Tier 1 Ready)</span>
            </div>
          </div>
        </div>

        {/* Spaced Repetition Quick Review Card */}
        <div className="bento-card p-6 sm:p-7 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Brain size={18} className="text-indigo-600" />
                Spaced Recall
              </h2>
              <span className="badge badge-accent">SM-2 Active</span>
            </div>

            <p className="text-xs text-gray-500 leading-relaxed mb-4">
              Review missed questions right when your memory curve drops.
            </p>

            {/* Quick Stat Pill */}
            <div className="bento-subcard mb-4 flex items-center justify-between">
              <div>
                <div className="text-xs text-gray-400 font-medium">Mistakes Logged</div>
                <div className="text-xl font-extrabold text-gray-900">{mistakes.length}</div>
              </div>
              <div className="w-9 h-9 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center font-bold text-xs border border-rose-100">
                <AlertTriangle size={16} />
              </div>
            </div>

            {/* Weak topics mini-list */}
            {weakTopics.length > 0 && (
              <div>
                <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                  Focus Topics
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {weakTopics.slice(0, 3).map(wt => (
                    <button
                      key={wt.topic}
                      onClick={() => onPracticeTopicClick(wt.topic)}
                      className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 transition-colors flex items-center gap-1"
                    >
                      <span>{wt.topic}</span>
                      <span className="text-gray-400 font-bold">({wt.count})</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="mt-5 space-y-2">
            <button
              onClick={onStartReview}
              className="btn btn-primary w-full text-xs py-2.5 rounded-full"
            >
              Start Spaced Review
            </button>
            <button
              onClick={() => onSelectTab('mistakes')}
              className="w-full text-center text-xs font-semibold text-gray-500 hover:text-black py-1"
            >
              View all mistakes →
            </button>
          </div>
        </div>
      </div>

      {/* Third Bento Row: Study & Revision Notes Banner */}
      <div className="bento-card p-5 sm:p-6 bg-gradient-to-r from-emerald-50/50 via-teal-50/30 to-indigo-50/40 border border-emerald-100/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
            <FileText size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-extrabold text-gray-900">Revision & Study Notes</h3>
              <span className="badge badge-accent text-[10px]">MD & TXT Support</span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Access {notesCount > 0 ? `${notesCount} preloaded notes` : 'revision notes'} (Math formulas, Indian Polity, Vocab) or upload your own .md & .txt files with distraction-free reader mode and 1-click table of contents.
            </p>
          </div>
        </div>
        <button
          onClick={() => onSelectTab('notes')}
          className="flex items-center gap-2 px-4 py-2.5 bg-gray-900 hover:bg-black text-white text-xs font-bold rounded-xl transition-all shadow-xs shrink-0 self-start sm:self-auto"
        >
          <span>Open Notes</span>
          <ArrowUpRight size={14} />
        </button>
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
  totalPapersCount?: number;
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
  onViewResults?: (attemptId: string, paper?: Paper) => void;
  userId?: string;
}

function LibraryTab({ papers, totalPapersCount = 0, attempts, search, setSearch, filters, setFilters, allSubjects, allExams, onStartExam, onPractice, onImport, onRefresh, onViewResults, userId }: LibraryTabProps) {
  const [showFilters, setShowFilters] = useState(false);
  const [viewFilter, setViewFilter] = useState<'all' | 'mine' | 'public'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const getBestScore = (paperId: string) => {
    const paperAttempts = attempts.filter(a => String(a.paper_id) === String(paperId));
    if (paperAttempts.length === 0) return null;
    return Math.max(...paperAttempts.map(a => Math.round((a.score / a.total_marks) * 100)));
  };

  const getAttemptCount = (paperId: string) => attempts.filter(a => String(a.paper_id) === String(paperId)).length;

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
    const result = await updatePaperVisibility(paper.id, newVisibility, userId);
    if (result.success) {
      await onRefresh();
    } else {
      alert(`Visibility update: ${result.error || 'Failed to update visibility'}`);
    }
  };

  const handleShare = async (paper: Paper) => {
    if (paper.visibility !== 'public') {
      const makePub = confirm(
        `"${paper.title}" is currently private.\n\nMake it Public so your colleagues can open and take it?`
      );
      if (makePub) {
        const res = await updatePaperVisibility(paper.id, 'public', userId);
        if (!res.success) {
          alert(res.error || 'Failed to make test public');
          return;
        }
        await onRefresh();
      } else {
        return;
      }
    }

    const shareUrl = `${window.location.origin}${window.location.pathname}?exam=${encodeURIComponent(paper.id)}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedId(paper.id);
      setTimeout(() => setCopiedId(null), 3500);
    } catch {
      prompt('Copy this link to share with colleagues:', shareUrl);
    }
  };

  const displayedPapers = useMemo(() => {
    let list = papers;
    if (viewFilter === 'mine') {
      list = list.filter(p => p.user_id === userId || p.user_id === 'guest');
    } else if (viewFilter === 'public') {
      list = list.filter(p => p.visibility === 'public');
    }
    return list;
  }, [papers, viewFilter, userId]);

  const myCount = useMemo(() => papers.filter(p => p.user_id === userId || p.user_id === 'guest').length, [papers, userId]);
  const publicCount = useMemo(() => papers.filter(p => p.visibility === 'public').length, [papers]);

  const hasActiveFilters = Boolean(
    filters.exam || filters.subject || filters.difficulty || filters.status || search
  );

  // Only show the initial onboarding empty screen when the library has zero papers overall
  if (totalPapersCount === 0 && !hasActiveFilters && papers.length === 0) {
    return (
      <div className="text-center py-20 bento-card p-10">
        <BookOpen size={48} className="mx-auto text-gray-300 mb-4" />
        <h3 className="text-lg font-bold text-gray-900 mb-2">No question papers yet</h3>
        <p className="text-sm text-gray-500 mb-6 max-w-md mx-auto">
          Import your first AI-generated question set or load our demo exam to get started.
        </p>
        <button onClick={onImport} className="btn btn-primary text-xs py-3 px-6 rounded-full inline-flex items-center gap-2 shadow-xs">
          <PlusCircle size={16} /> Import Paper
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search papers, topics, or questions..."
            className="w-full pl-11 pr-4 py-2.5 bg-white border border-gray-200/90 rounded-full text-xs sm:text-sm text-gray-900 placeholder-gray-400 shadow-2xs focus:ring-2 focus:ring-gray-900 focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`btn text-xs py-2 px-4 rounded-full flex items-center gap-1.5 transition-all ${
              hasActiveFilters || showFilters
                ? 'bg-gray-900 text-white shadow-2xs'
                : 'btn-outline'
            }`}
          >
            <Filter size={14} />
            <span>Filters</span>
            {hasActiveFilters && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
            )}
          </button>
          <button
            onClick={onImport}
            className="btn btn-primary text-xs py-2 px-4.5 rounded-full flex items-center gap-1.5 shadow-xs"
          >
            <PlusCircle size={14} /> Import Paper
          </button>
        </div>
      </div>

      {/* Active Filter Pills */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2 pt-0.5">
          <span className="text-xs font-semibold text-gray-400 mr-0.5">Active Filters:</span>
          {filters.status && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
              Status: {filters.status === 'attempted' ? 'Attempted' : 'Not Attempted'}
              <button
                onClick={() => setFilters({ ...filters, status: undefined })}
                className="hover:text-indigo-950 p-0.5 rounded-full"
                title="Remove status filter"
              >
                <X size={12} />
              </button>
            </span>
          )}
          {filters.exam && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
              Exam: {filters.exam}
              <button
                onClick={() => setFilters({ ...filters, exam: undefined })}
                className="hover:text-indigo-950 p-0.5 rounded-full"
                title="Remove exam filter"
              >
                <X size={12} />
              </button>
            </span>
          )}
          {filters.subject && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
              Subject: {filters.subject}
              <button
                onClick={() => setFilters({ ...filters, subject: undefined })}
                className="hover:text-indigo-950 p-0.5 rounded-full"
                title="Remove subject filter"
              >
                <X size={12} />
              </button>
            </span>
          )}
          {filters.difficulty && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
              Difficulty: {filters.difficulty}
              <button
                onClick={() => setFilters({ ...filters, difficulty: undefined })}
                className="hover:text-indigo-950 p-0.5 rounded-full"
                title="Remove difficulty filter"
              >
                <X size={12} />
              </button>
            </span>
          )}
          {search && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-800 border border-gray-200">
              Search: "{search}"
              <button
                onClick={() => setSearch('')}
                className="hover:text-black p-0.5 rounded-full"
                title="Clear search"
              >
                <X size={12} />
              </button>
            </span>
          )}
          <button
            onClick={() => { setFilters({}); setSearch(''); }}
            className="text-xs font-bold text-rose-600 hover:underline ml-1"
          >
            Clear All
          </button>
        </div>
      )}

      {/* Quick View Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setViewFilter('all')}
          className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
            viewFilter === 'all'
              ? 'bg-gray-900 text-white shadow-2xs'
              : 'bg-white border border-gray-200 text-gray-600 hover:text-black'
          }`}
        >
          All Tests ({papers.length})
        </button>
        <button
          onClick={() => setViewFilter('mine')}
          className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
            viewFilter === 'mine'
              ? 'bg-gray-900 text-white shadow-2xs'
              : 'bg-white border border-gray-200 text-gray-600 hover:text-black'
          }`}
        >
          My Tests ({myCount})
        </button>
        <button
          onClick={() => setViewFilter('public')}
          className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
            viewFilter === 'public'
              ? 'bg-emerald-600 text-white shadow-2xs'
              : 'bg-white border border-gray-200 text-gray-600 hover:text-black'
          }`}
        >
          <span className="inline-flex items-center gap-1.5">
            <Globe size={12} /> Public & Shared ({publicCount})
          </span>
        </button>
      </div>

      {/* Advanced Filter Options */}
      {showFilters && (
        <div className="flex flex-wrap gap-2.5 p-4 bg-white border border-gray-200/80 rounded-2xl shadow-2xs">
          <select
            value={filters.exam || ''}
            onChange={e => setFilters({ ...filters, exam: e.target.value || undefined })}
            className="px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 outline-none"
          >
            <option value="">All Exams</option>
            {allExams.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
          <select
            value={filters.subject || ''}
            onChange={e => setFilters({ ...filters, subject: e.target.value || undefined })}
            className="px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 outline-none"
          >
            <option value="">All Subjects</option>
            {allSubjects.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select
            value={filters.difficulty || ''}
            onChange={e => setFilters({ ...filters, difficulty: (e.target.value || undefined) as any })}
            className="px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 outline-none"
          >
            <option value="">All Difficulty</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
          <select
            value={filters.status || ''}
            onChange={e => setFilters({ ...filters, status: (e.target.value || undefined) as any })}
            className="px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 outline-none"
          >
            <option value="">All Status</option>
            <option value="attempted">Attempted</option>
            <option value="not_attempted">Not Attempted</option>
          </select>
          {(filters.exam || filters.subject || filters.difficulty || filters.status) && (
            <button
              onClick={() => setFilters({})}
              className="px-3 py-1.5 text-xs font-bold text-rose-600 hover:underline"
            >
              Clear Filters
            </button>
          )}
        </div>
      )}

      {/* Paper Cards Grid */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {displayedPapers.length === 0 ? (
          <div className="bento-card p-10 sm:p-14 text-center bg-white border border-gray-200/80 rounded-3xl col-span-full shadow-xs">
            <Filter size={40} className="mx-auto text-gray-300 mb-3" />
            <h3 className="font-extrabold text-gray-900 text-base sm:text-lg mb-1.5">
              {filters.status === 'attempted'
                ? 'No Attempted Tests Found'
                : filters.status === 'not_attempted'
                ? 'All Available Tests Have Been Attempted'
                : 'No Tests Found Matching Filters'}
            </h3>
            <p className="text-xs text-gray-500 max-w-md mx-auto mb-5 leading-relaxed">
              {filters.status === 'attempted'
                ? "You haven't completed an exam attempt for any tests under this view yet. Take any exam from your library to view your results and analytics here."
                : 'Try adjusting your search query or clearing your filter selections to view available question papers.'}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2.5">
              <button
                onClick={() => { setFilters({}); setSearch(''); setViewFilter('all'); }}
                className="btn btn-primary text-xs py-2.5 px-6 rounded-full font-bold shadow-xs"
              >
                Clear All Filters
              </button>
              {filters.status === 'attempted' && (
                <button
                  onClick={() => { setFilters({}); setViewFilter('all'); }}
                  className="btn btn-outline text-xs py-2.5 px-5 rounded-full font-bold"
                >
                  Browse All Tests ({totalPapersCount || papers.length})
                </button>
              )}
            </div>
          </div>
        ) : (
          displayedPapers.map(paper => {
          const bestScore = getBestScore(paper.id);
          const attemptCount = getAttemptCount(paper.id);

          return (
            <div
              key={paper.id}
              className="bento-card p-5 sm:p-6 flex flex-col justify-between hover:shadow-soft transition-all duration-200 group bg-white border border-gray-200/80 rounded-3xl"
            >
              <div>
                {/* Header Row: Title & Badges */}
                <div className="flex items-start justify-between gap-3 mb-2">
                  <h3 className="font-extrabold text-gray-900 text-sm sm:text-base leading-snug line-clamp-2 flex-1">
                    {paper.title}
                  </h3>
                  <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
                    <span
                      className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80 flex items-center gap-1"
                      title="Stored locally on this device • Ready to take offline anytime"
                    >
                      <CheckCircle size={10} className="text-emerald-600" /> Offline Ready
                    </span>
                    {paper.is_demo && (
                      <span className="badge badge-warning">Demo</span>
                    )}
                    {paper.visibility === 'public' ? (
                      <span className="badge badge-accent flex items-center gap-1">
                        <Globe size={10} /> Public
                      </span>
                    ) : (
                      <span className="badge badge-muted flex items-center gap-1">
                        <Lock size={10} /> Private
                      </span>
                    )}
                  </div>
                </div>

                {paper.description && (
                  <p className="text-xs text-gray-500 mb-3.5 line-clamp-2 leading-relaxed">
                    {paper.description}
                  </p>
                )}

                {/* Exam & Difficulty Row */}
                <div className="flex flex-wrap items-center gap-1.5 mb-3.5">
                  <span className="px-2.5 py-0.5 bg-gray-100 text-gray-700 rounded-full text-[11px] font-semibold">
                    {paper.exam}
                  </span>
                  <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${getDifficultyColor(paper.difficulty)}`}>
                    {paper.difficulty}
                  </span>
                </div>

                {/* Bento Subcard Stats Box (Image 2 style) */}
                <div className="grid grid-cols-3 gap-2 my-3">
                  <div className="p-2.5 bg-gray-50/80 border border-gray-100 rounded-2xl text-center">
                    <div className="text-sm font-extrabold text-gray-900">{paper.question_count}</div>
                    <div className="text-[10px] font-semibold text-gray-400 mt-0.5">Questions</div>
                  </div>
                  <div className="p-2.5 bg-gray-50/80 border border-gray-100 rounded-2xl text-center">
                    <div className="text-sm font-extrabold text-gray-900">{paper.total_marks}</div>
                    <div className="text-[10px] font-semibold text-gray-400 mt-0.5">Marks</div>
                  </div>
                  <div className="p-2.5 bg-gray-50/80 border border-gray-100 rounded-2xl text-center">
                    <div className="text-sm font-extrabold text-gray-900">{paper.duration_minutes}m</div>
                    <div className="text-[10px] font-semibold text-gray-400 mt-0.5">Duration</div>
                  </div>
                </div>

                {/* Attempt History Pill */}
                {attemptCount > 0 && (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-xs mb-3 px-3 py-2 bg-indigo-50/60 border border-indigo-100/80 rounded-2xl">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500 text-[11px] font-medium">{attemptCount} attempt{attemptCount > 1 ? 's' : ''}</span>
                      {bestScore !== null && (
                        <span className={`font-bold text-[11px] ${getAccuracyColor(bestScore)}`}>Best: {bestScore}%</span>
                      )}
                    </div>
                    {onViewResults && (
                      <button
                        onClick={() => {
                          const pAttempts = attempts.filter(a => String(a.paper_id) === String(paper.id));
                          if (pAttempts.length > 0) {
                            onViewResults(pAttempts[0].id, paper);
                          }
                        }}
                        className="text-[11px] font-extrabold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer self-start sm:self-auto hover:underline"
                      >
                        <Eye size={12} /> View Solutions & Review
                      </button>
                    )}
                  </div>
                )}

                {/* Subject Tags */}
                <div className="flex flex-wrap gap-1 mb-4">
                  {paper.subjects.slice(0, 3).map(s => (
                    <span key={s} className="px-2 py-0.5 bg-gray-50 border border-gray-100 text-gray-600 rounded-full text-[10px] font-medium truncate max-w-[120px]">
                      {s}
                    </span>
                  ))}
                  {paper.subjects.length > 3 && (
                    <span className="px-1.5 py-0.5 text-gray-400 text-[10px] font-medium">
                      +{paper.subjects.length - 3}
                    </span>
                  )}
                </div>

                {/* Share Link Copied Toast Banner */}
                {copiedId === paper.id && (
                  <div className="mb-3 px-3 py-2 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-2xl flex items-center gap-1.5 animate-fadeIn">
                    <Check size={13} className="text-emerald-600" />
                    <span>Share link copied! Send to colleagues to take test.</span>
                  </div>
                )}
              </div>

              {/* Actions Bottom Bar */}
              <div className="pt-3.5 border-t border-gray-100 flex items-center gap-1.5">
                <button
                  onClick={() => onStartExam(paper.id)}
                  className="flex-1 btn btn-primary text-xs py-2 px-3 rounded-full flex items-center justify-center gap-1.5 shadow-2xs"
                >
                  <Play size={12} className="fill-white" /> Exam
                </button>
                <button
                  onClick={() => onPractice(paper.id)}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2 px-3 rounded-full flex items-center justify-center gap-1.5 shadow-2xs transition-colors"
                >
                  <Target size={12} /> Practice
                </button>
                <button
                  onClick={() => handleShare(paper)}
                  className={`p-2 rounded-full border transition-all shadow-2xs ${
                    copiedId === paper.id
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-600'
                      : 'bg-white border-gray-200 text-gray-600 hover:text-black hover:bg-gray-50'
                  }`}
                  title="Share test with colleagues (copies direct exam link)"
                >
                  {copiedId === paper.id ? <Check size={13} /> : <Share2 size={13} />}
                </button>
                <button
                  onClick={() => handleToggleVisibility(paper)}
                  className={`p-2 rounded-full border transition-all shadow-2xs ${
                    paper.visibility === 'public'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-100'
                      : 'bg-white border-gray-200 text-gray-500 hover:text-black hover:bg-gray-50'
                  }`}
                  title={paper.visibility === 'public' ? 'Make Private' : 'Publish test so colleagues can access it'}
                >
                  {paper.visibility === 'public' ? <Globe size={13} /> : <Lock size={13} />}
                </button>
                <button
                  onClick={() => handleExport(paper)}
                  className="p-2 rounded-full border border-gray-200 bg-white text-gray-500 hover:text-black hover:bg-gray-50 transition-colors shadow-2xs"
                  title="Export JSON"
                >
                  <Download size={13} />
                </button>
                <button
                  onClick={() => handleDelete(paper.id)}
                  className="p-2 rounded-full border border-rose-200 bg-white text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition-colors shadow-2xs"
                  title="Delete Paper"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          );
        })
      )}
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
    saveCustomPaper(customPaper);
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
      <div className="text-center py-20 bento-card p-10">
        <Target size={48} className="mx-auto text-gray-300 mb-4" />
        <h3 className="text-lg font-bold text-gray-900 mb-1">No Questions Available</h3>
        <p className="text-sm text-gray-500 mb-4">Please import a question set or paper first to unlock practice modes.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Interactive Topic Selector */}
      <div className="bento-card p-6 sm:p-7 bg-white border border-gray-200/80 rounded-3xl shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
          <div>
            <span className="badge badge-accent mb-2">Custom Practice Builder</span>
            <h3 className="text-lg font-extrabold text-gray-900 flex items-center gap-2">
              <BookOpen size={18} className="text-gray-900" />
              Targeted Topic Drill
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              Filter by subject and specific topic to practice weak syllabus areas.
            </p>
          </div>
          <button
            onClick={startTopicDrill}
            disabled={topicMatchedQuestions.length === 0}
            className="btn btn-primary text-xs py-2.5 px-5 shadow-xs shrink-0 self-start md:self-auto rounded-full"
          >
            <Play size={13} className="fill-white" /> Start Topic Drill ({topicMatchedQuestions.length} Qs)
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className="text-xs font-bold text-gray-700 mb-1.5 block">Subject</label>
            <select
              value={selectedSubject}
              onChange={e => { setSelectedSubject(e.target.value); setSelectedTopic(''); }}
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-2xl text-xs font-semibold text-gray-800 outline-none focus:ring-2 focus:ring-gray-900 shadow-2xs"
            >
              <option value="">All Subjects ({allQuestions.length} Questions)</option>
              {subjects.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-gray-700 mb-1.5 block">Specific Topic</label>
            <select
              value={selectedTopic}
              onChange={e => setSelectedTopic(e.target.value)}
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-2xl text-xs font-semibold text-gray-800 outline-none focus:ring-2 focus:ring-gray-900 shadow-2xs"
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
        <h3 className="text-base font-extrabold text-gray-900 mb-4 flex items-center gap-2">
          <Zap size={18} className="text-amber-500" />
          Smart Practice Modes
        </h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <button
            onClick={startQuickSprint}
            className="bento-card p-6 bg-white border border-gray-200/80 rounded-3xl text-left hover:shadow-soft transition-all group"
          >
            <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-3 shadow-2xs group-hover:scale-105 transition-transform">
              <Zap size={20} />
            </div>
            <h4 className="font-extrabold text-gray-900 text-sm mb-1 group-hover:text-black transition-colors">
              Quick 10-Q Sprint
            </h4>
            <p className="text-xs text-gray-500 leading-relaxed">
              10 random questions across all subjects. Perfect for a 10-minute coffee break drill.
            </p>
          </button>

          <button
            onClick={startSpeedDrill}
            className="bento-card p-6 bg-white border border-gray-200/80 rounded-3xl text-left hover:shadow-soft transition-all group"
          >
            <div className="w-11 h-11 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mb-3 shadow-2xs group-hover:scale-105 transition-transform">
              <Clock size={20} />
            </div>
            <h4 className="font-extrabold text-gray-900 text-sm mb-1 group-hover:text-black transition-colors">
              5-Minute Speed Drill
            </h4>
            <p className="text-xs text-gray-500 leading-relaxed">
              10 questions in 5 minutes. Trains high-speed calculation and fast elimination.
            </p>
          </button>

          <button
            onClick={startWeakAreaDrill}
            className="bento-card p-6 bg-white border border-gray-200/80 rounded-3xl text-left hover:shadow-soft transition-all group"
          >
            <div className="w-11 h-11 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mb-3 shadow-2xs group-hover:scale-105 transition-transform">
              <Brain size={20} />
            </div>
            <h4 className="font-extrabold text-gray-900 text-sm mb-1 group-hover:text-black transition-colors">
              Weak Areas Drill
            </h4>
            <p className="text-xs text-gray-500 leading-relaxed">
              Dynamically targets topics where you have logged the most mistakes.
            </p>
          </button>

          <button
            onClick={startMistakesDrill}
            className="bento-card p-6 bg-white border border-gray-200/80 rounded-3xl text-left hover:shadow-soft transition-all group"
          >
            <div className="w-11 h-11 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center mb-3 shadow-2xs group-hover:scale-105 transition-transform">
              <AlertTriangle size={20} />
            </div>
            <h4 className="font-extrabold text-gray-900 text-sm mb-1 group-hover:text-black transition-colors">
              Mistake Notebook Test
            </h4>
            <p className="text-xs text-gray-500 leading-relaxed">
              {mistakes.length > 0
                ? `Test yourself on ${mistakes.length} recorded mistake question${mistakes.length > 1 ? 's' : ''}.`
                : 'Retest questions you previously got wrong.'}
            </p>
          </button>

          <button
            onClick={startMixedComprehensive}
            className="bento-card p-6 bg-white border border-gray-200/80 rounded-3xl text-left hover:shadow-soft transition-all group"
          >
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3 shadow-2xs group-hover:scale-105 transition-transform">
              <RotateCcw size={20} />
            </div>
            <h4 className="font-extrabold text-gray-900 text-sm mb-1 group-hover:text-black transition-colors">
              Comprehensive Mixed (15 Qs)
            </h4>
            <p className="text-xs text-gray-500 leading-relaxed">
              Balanced mix covering Quant, Reasoning, English, and General Awareness.
            </p>
          </button>

          <button
            onClick={startTopicDrill}
            className="bento-card p-6 bg-white border border-gray-200/80 rounded-3xl text-left hover:shadow-soft transition-all group"
          >
            <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3 shadow-2xs group-hover:scale-105 transition-transform">
              <Target size={20} />
            </div>
            <h4 className="font-extrabold text-gray-900 text-sm mb-1 group-hover:text-black transition-colors">
              Subject Deep Dive
            </h4>
            <p className="text-xs text-gray-500 leading-relaxed">
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
      <div className="text-center py-20 bento-card p-10">
        <CheckCircle size={48} className="mx-auto text-emerald-500 mb-4" />
        <h3 className="text-lg font-extrabold text-gray-900 mb-1">Mistake Notebook Clean!</h3>
        <p className="text-sm text-gray-500">You have no pending mistakes. Keep practicing to maintain high accuracy!</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fadeIn">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-gray-900">My Mistake Notebook ({mistakes.length})</h2>
          <p className="text-xs text-gray-500">Questions you missed during mock tests. Review solutions and retest anytime.</p>
        </div>
        <button
          onClick={handlePracticeMistakes}
          className="btn btn-primary text-xs py-2.5 px-4.5 rounded-full shadow-xs self-start sm:self-auto flex items-center gap-1.5"
        >
          <RotateCcw size={14} /> Practice All Mistakes ({mistakes.length})
        </button>
      </div>

      <div className="space-y-3">
        {mistakes.map(m => (
          <div key={m.id} className="bento-card p-5 bg-white border border-gray-200/80 rounded-3xl shadow-xs">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="min-w-0">
                <p className="text-sm font-bold text-gray-900 mb-2 leading-relaxed">{m.question_text}</p>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="px-2.5 py-0.5 bg-gray-100 text-gray-700 rounded-full text-[11px] font-semibold">{m.subject}</span>
                  <span className="px-2.5 py-0.5 bg-gray-100 text-gray-700 rounded-full text-[11px] font-semibold">{m.topic}</span>
                  <span className="px-2.5 py-0.5 bg-rose-50 border border-rose-200/80 text-rose-700 rounded-full text-[11px] font-bold">{m.incorrect_count}× wrong</span>
                </div>
              </div>
              <button
                onClick={() => onResolve(m.id)}
                className="shrink-0 p-2 text-gray-400 hover:text-emerald-600 rounded-full hover:bg-gray-100 transition-colors"
                title="Mark as resolved"
              >
                <CheckCircle size={18} />
              </button>
            </div>
            <div className="text-xs space-y-1.5 pt-3 border-t border-gray-100">
              <p className="text-rose-600 font-semibold">Your answer: {m.selected_answer !== null ? m.options[m.selected_answer] : 'Not attempted'}</p>
              <p className="text-emerald-600 font-semibold">Correct answer: {m.options[m.correct_answer]}</p>
              {m.solution && <p className="text-gray-700 mt-1 whitespace-pre-wrap">💡 <strong>Solution:</strong> {m.solution}</p>}
              {m.shortcut && <p className="text-purple-600">⚡ <strong>Shortcut:</strong> {m.shortcut}</p>}
              {m.learning_suggestion && <p className="text-amber-600">📌 <strong>Tip:</strong> {m.learning_suggestion}</p>}
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
      <div className="text-center py-20 bento-card p-10">
        <BookmarkIcon size={48} className="mx-auto text-gray-300 mb-4" />
        <h3 className="text-lg font-extrabold text-gray-900 mb-1">No Bookmarks Saved</h3>
        <p className="text-sm text-gray-500">Click the bookmark icon or press [B] during exams to save questions here.</p>
      </div>
    );
  }

  const categories: BookmarkCategory[] = ['important', 'difficult', 'revise_later', 'shortcut', 'formula', 'doubt'];

  return (
    <div className="space-y-5 animate-fadeIn">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-gray-900">Saved Questions ({bookmarks.length})</h2>
          <p className="text-xs text-gray-500">Questions pinned for special review and revision.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={filterCat}
            onChange={e => setFilterCat(e.target.value as BookmarkCategory | '')}
            className="px-3.5 py-2 bg-white border border-gray-200 rounded-full text-xs font-semibold text-gray-700 outline-none shadow-2xs"
          >
            <option value="">All Categories</option>
            {categories.map(c => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
          </select>
          <button
            onClick={handlePracticeBookmarks}
            className="btn btn-primary text-xs py-2 px-4 rounded-full shadow-xs flex items-center gap-1.5"
          >
            <Play size={12} className="fill-white" /> Practice Bookmarks
          </button>
        </div>
      </div>

      <div className="space-y-2.5">
        {filtered.map(b => (
          <div key={b.id} className="bento-card p-4 sm:p-5 bg-white border border-gray-200/80 rounded-2xl shadow-xs flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 mb-2">{b.question_text}</p>
              <span className="px-2.5 py-0.5 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-full text-[10px] font-bold uppercase tracking-wider">
                {b.category.replace('_', ' ')}
              </span>
            </div>
            <button
              onClick={() => onRemove(b.id)}
              className="shrink-0 p-1.5 text-gray-400 hover:text-rose-600 rounded-full hover:bg-gray-100 transition-colors"
              title="Remove bookmark"
            >
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
function AnalyticsTab({ attempts, papers, onViewResults }: { attempts: Attempt[]; papers: Paper[]; onViewResults?: (attemptId: string, paper?: Paper) => void }) {
  if (attempts.length === 0) {
    return (
      <div className="text-center py-20 bento-card p-10">
        <BarChart3 size={48} className="mx-auto text-gray-300 mb-4" />
        <h3 className="text-lg font-extrabold text-gray-900 mb-2">No analytics yet</h3>
        <p className="text-sm text-gray-500">Take your first mock exam to begin tracking your score progress and topic mastery.</p>
      </div>
    );
  }

  const totalQs = attempts.reduce((s, a) => s + a.attempted_count, 0);
  const avgAccuracy = Math.round(attempts.reduce((s, a) => s + a.accuracy, 0) / attempts.length);
  const avgTimePerQ = totalQs > 0 ? Math.round(attempts.reduce((s, a) => s + a.time_spent_seconds, 0) / totalQs) : 0;
  const bestScore = Math.max(...attempts.map(a => Math.round((a.score / a.total_marks) * 100)));
  const avgScore = Math.round(attempts.reduce((s, a) => s + (a.score / a.total_marks) * 100, 0) / attempts.length);

  return (
    <div className="space-y-6 animate-fadeIn">
      <h2 className="text-lg font-extrabold text-gray-900">Performance Analytics</h2>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bento-card p-4 bg-white border border-gray-200/80 rounded-2xl text-center shadow-xs">
          <div className="text-2xl font-extrabold text-gray-900">{attempts.length}</div>
          <div className="text-[11px] font-semibold text-gray-400 mt-1">Total Exams</div>
        </div>
        <div className="bento-card p-4 bg-white border border-gray-200/80 rounded-2xl text-center shadow-xs">
          <div className="text-2xl font-extrabold text-gray-900">{totalQs}</div>
          <div className="text-[11px] font-semibold text-gray-400 mt-1">Questions Solved</div>
        </div>
        <div className="bento-card p-4 bg-white border border-gray-200/80 rounded-2xl text-center shadow-xs">
          <div className="text-2xl font-extrabold text-emerald-600">{avgAccuracy}%</div>
          <div className="text-[11px] font-semibold text-gray-400 mt-1">Avg Accuracy</div>
        </div>
        <div className="bento-card p-4 bg-white border border-gray-200/80 rounded-2xl text-center shadow-xs">
          <div className="text-2xl font-extrabold text-indigo-600">{bestScore}%</div>
          <div className="text-[11px] font-semibold text-gray-400 mt-1">Highest Score</div>
        </div>
        <div className="bento-card p-4 bg-white border border-gray-200/80 rounded-2xl text-center shadow-xs">
          <div className="text-2xl font-extrabold text-amber-600">{formatTime(avgTimePerQ)}</div>
          <div className="text-[11px] font-semibold text-gray-400 mt-1">Avg Time/Q</div>
        </div>
        <div className="bento-card p-4 bg-white border border-gray-200/80 rounded-2xl text-center shadow-xs">
          <div className="text-2xl font-extrabold text-gray-900">{avgScore}%</div>
          <div className="text-[11px] font-semibold text-gray-400 mt-1">Avg Score</div>
        </div>
      </div>

      {/* Score Progress Chart */}
      <div className="bento-card p-6 bg-white border border-gray-200/80 rounded-3xl shadow-xs">
        <h3 className="font-extrabold text-gray-900 mb-4 text-sm">Score Progress</h3>
        <div className="flex items-end gap-1.5 h-36">
          {attempts.slice(-20).reverse().map((a) => {
            const pct = Math.round((a.score / a.total_marks) * 100);
            return (
              <div key={a.id} className="flex-1 flex flex-col items-center gap-1 group relative">
                <div
                  className="w-full rounded-t-lg transition-all hover:opacity-80"
                  style={{
                    height: `${Math.max(6, pct)}%`,
                    backgroundColor: pct >= 70 ? '#10B981' : pct >= 40 ? '#F59E0B' : '#EF4444',
                  }}
                  title={`${a.paper_title}: ${pct}%`}
                />
              </div>
            );
          })}
        </div>
        <p className="text-[11px] text-gray-400 mt-3 text-center font-medium">Last {Math.min(20, attempts.length)} attempts</p>
      </div>

      {/* Recent Attempts Table */}
      <div className="bento-card p-6 bg-white border border-gray-200/80 rounded-3xl shadow-xs">
        <h3 className="font-extrabold text-gray-900 mb-4 text-sm">Recent Attempts</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left font-bold text-gray-400 border-b border-gray-100">
                <th className="pb-3 pr-4">Paper</th>
                <th className="pb-3 pr-4">Score</th>
                <th className="pb-3 pr-4">Accuracy</th>
                <th className="pb-3 pr-4">Time</th>
                <th className="pb-3 pr-4">Date</th>
                <th className="pb-3 text-right">Solutions & Review</th>
              </tr>
            </thead>
            <tbody>
              {attempts.slice(0, 10).map(a => {
                const pct = Math.round((a.score / a.total_marks) * 100);
                return (
                  <tr key={a.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="py-3 pr-4 text-gray-900 font-bold truncate max-w-[220px]">{a.paper_title}</td>
                    <td className={`py-3 pr-4 font-extrabold ${getAccuracyColor(pct)}`}>{a.score}/{a.total_marks}</td>
                    <td className={`py-3 pr-4 font-bold ${getAccuracyColor(a.accuracy)}`}>{a.accuracy}%</td>
                    <td className="py-3 pr-4 text-gray-500 font-medium">{formatTime(a.time_spent_seconds)}</td>
                    <td className="py-3 pr-4 text-gray-400 font-medium">{new Date(a.started_at).toLocaleDateString()}</td>
                    <td className="py-3 text-right">
                      {onViewResults && (
                        <button
                          onClick={() => onViewResults(a.id, papers.find(p => p.id === a.paper_id))}
                          className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg text-[11px] transition-colors cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                        >
                          <Eye size={12} />
                          <span>View Solutions</span>
                        </button>
                      )}
                    </td>
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
