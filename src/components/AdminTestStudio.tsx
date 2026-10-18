import React, { useState, useMemo } from 'react';
import { Paper, PaperJSON, QuestionJSON, Difficulty, ExamType } from '../types';
import { savePaper, checkDuplicatePaper } from '../services/database';
import JsonImporter from './JsonImporter';
import {
  GraduationCap,
  FileText,
  Plus,
  Trash2,
  Copy,
  ArrowUp,
  ArrowDown,
  Eye,
  Printer,
  Download,
  Save,
  Sparkles,
  Upload,
  Clock,
  Award,
  AlertCircle,
  Check,
  X,
  ChevronRight,
  BookOpen,
  HelpCircle,
  Code2,
  Settings,
  Layers,
  CheckCircle2,
  Hash,
} from 'lucide-react';
import { formatMathText } from '../utils/mathFormatter';

interface AdminTestStudioProps {
  userId?: string;
  onPaperCreated: (paperId?: string) => void;
  onCancel?: () => void;
}

const SCHOOL_PRESETS = [
  'Delhi Public School',
  'Kendriya Vidyalaya Sangathan',
  'National Testing Agency (NTA)',
  'Central Board of Secondary Education',
  'St. Xavier\'s Collegiate School',
  'Staff Selection Commission',
  'Apex Career Academy',
];

const DEFAULT_INSTRUCTIONS = [
  'All questions are compulsory unless stated otherwise.',
  'Read each question carefully before attempting your answer.',
  'Each question carries specified positive marks for the correct option.',
  'Negative marks will be deducted for each incorrect attempt as configured.',
  'Use of calculators, log tables, or digital devices is strictly prohibited.',
  'Rough work must be done in the designated space provided.',
];

const INITIAL_QUESTION: QuestionJSON = {
  id: 1,
  subject: 'Mathematics',
  topic: 'Arithmetic',
  difficulty: 'medium',
  question: 'If \\(x + \\frac{1}{x} = 5\\), what is the value of \\(x^2 + \\frac{1}{x^2}\\)?',
  options: ['23', '25', '27', '21'],
  correctAnswer: '23',
  answerIndex: 0,
  marks: 2,
  negativeMarks: 0.5,
  solution: 'We know that \\((x + 1/x)^2 = x^2 + 1/x^2 + 2\\). Therefore, \\(x^2 + 1/x^2 = 5^2 - 2 = 25 - 2 = 23\\).',
  hint: 'Square both sides of the given algebraic equation.',
};

export default function AdminTestStudio({ userId, onPaperCreated, onCancel }: AdminTestStudioProps) {
  const effectiveUserId = userId || 'guest';
  const [activeStudioTab, setActiveStudioTab] = useState<'builder' | 'paper_preview' | 'json_import'>('builder');

  // School & Paper Configuration
  const [institution, setInstitution] = useState('Delhi Public School');
  const [paperTitle, setPaperTitle] = useState('Annual Examination — Class X Mathematics & Reasoning');
  const [paperCode, setPaperCode] = useState('DPS-EXAM-2026-X');
  const [examType, setExamType] = useState('SSC CGL');
  const [subjectName, setSubjectName] = useState('Mathematics');
  const [classGrade, setClassGrade] = useState('Class X');
  const [academicSession, setAcademicSession] = useState('2025 – 2026');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [defaultMarks, setDefaultMarks] = useState(2);
  const [defaultNegativeMarks, setDefaultNegativeMarks] = useState(0.5);
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [instructions, setInstructions] = useState<string[]>(DEFAULT_INSTRUCTIONS);
  const [newInstructionText, setNewInstructionText] = useState('');

  // Questions List
  const [questions, setQuestions] = useState<QuestionJSON[]>([
    INITIAL_QUESTION,
    {
      id: 2,
      subject: 'General Intelligence',
      topic: 'Analogy & Series',
      difficulty: 'easy',
      question: 'Find the missing number in the following series: 3, 7, 15, 31, 63, ?',
      options: ['95', '111', '127', '128'],
      correctAnswer: '127',
      answerIndex: 2,
      marks: 2,
      negativeMarks: 0.5,
      solution: 'Pattern is \\(n \\times 2 + 1\\): \\(3\\times 2 + 1 = 7\\), \\(7\\times 2 + 1 = 15\\), ..., \\(63 \\times 2 + 1 = 127\\).',
    },
    {
      id: 3,
      subject: 'English Comprehension',
      topic: 'Vocabulary',
      difficulty: 'medium',
      question: 'Select the most appropriate synonym for the word "METICULOUS":',
      options: ['Careless', 'Painstaking', 'Hasty', 'Superficial'],
      correctAnswer: 'Painstaking',
      answerIndex: 1,
      marks: 2,
      negativeMarks: 0.5,
      solution: '"Meticulous" means showing great attention to detail; very careful and precise. "Painstaking" is the closest synonym.',
    },
  ]);

  // Paper preview options
  const [previewColumns, setPreviewColumns] = useState<'single' | 'two_column'>('two_column');
  const [showAnswerKeyInPreview, setShowAnswerKeyInPreview] = useState(false);

  // Status & notifications
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Total marks computed from questions
  const totalCalculatedMarks = useMemo(() => {
    return questions.reduce((sum, q) => sum + (q.marks || defaultMarks), 0);
  }, [questions, defaultMarks]);

  // Unique subjects in questions
  const allPaperSubjects = useMemo(() => {
    const set = new Set<string>();
    if (subjectName) set.add(subjectName);
    questions.forEach(q => {
      if (q.subject) set.add(q.subject);
    });
    return Array.from(set);
  }, [questions, subjectName]);

  // Add a new question card
  const handleAddQuestion = () => {
    const nextId = questions.length + 1;
    const newQ: QuestionJSON = {
      id: nextId,
      subject: subjectName || 'General',
      topic: 'Topic ' + nextId,
      difficulty: 'medium',
      question: `Question ${nextId} statement... Type your question here.`,
      options: ['Option A', 'Option B', 'Option C', 'Option D'],
      correctAnswer: 'Option A',
      answerIndex: 0,
      marks: defaultMarks,
      negativeMarks: defaultNegativeMarks,
      solution: 'Explanation / step-by-step solution for Question ' + nextId,
    };
    setQuestions([...questions, newQ]);
  };

  // Duplicate a question
  const handleDuplicateQuestion = (idx: number) => {
    const q = questions[idx];
    const duplicated: QuestionJSON = {
      ...q,
      id: questions.length + 1,
      question: `${q.question} (Copy)`,
    };
    const updated = [...questions];
    updated.splice(idx + 1, 0, duplicated);
    setQuestions(updated);
  };

  // Move question up / down
  const handleMoveQuestion = (idx: number, direction: 'up' | 'down') => {
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === questions.length - 1) return;
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    const updated = [...questions];
    const temp = updated[idx];
    updated[idx] = updated[targetIdx];
    updated[targetIdx] = temp;
    setQuestions(updated);
  };

  // Delete a question
  const handleDeleteQuestion = (idx: number) => {
    if (questions.length <= 1) {
      alert('A test must contain at least one question.');
      return;
    }
    const updated = questions.filter((_, i) => i !== idx);
    setQuestions(updated);
  };

  // Update a question field
  const handleUpdateQuestion = (idx: number, patch: Partial<QuestionJSON>) => {
    setQuestions(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], ...patch };
      return updated;
    });
  };

  // Add / remove / update options
  const handleUpdateOption = (qIdx: number, optIdx: number, value: string) => {
    setQuestions(prev => {
      const updated = [...prev];
      const q = { ...updated[qIdx] };
      const opts = [...q.options];
      opts[optIdx] = value;
      q.options = opts;
      if (q.answerIndex === optIdx) {
        q.correctAnswer = value;
      }
      updated[qIdx] = q;
      return updated;
    });
  };

  const handleAddOption = (qIdx: number) => {
    setQuestions(prev => {
      const updated = [...prev];
      const q = { ...updated[qIdx] };
      q.options = [...q.options, `Option ${String.fromCharCode(65 + q.options.length)}`];
      updated[qIdx] = q;
      return updated;
    });
  };

  const handleRemoveOption = (qIdx: number, optIdx: number) => {
    setQuestions(prev => {
      const updated = [...prev];
      const q = { ...updated[qIdx] };
      if (q.options.length <= 2) {
        alert('Questions must have at least 2 options.');
        return prev;
      }
      const opts = q.options.filter((_, i) => i !== optIdx);
      q.options = opts;
      if (q.answerIndex >= opts.length) {
        q.answerIndex = opts.length - 1;
        q.correctAnswer = opts[q.answerIndex];
      }
      updated[qIdx] = q;
      return updated;
    });
  };

  // Add custom instruction
  const handleAddInstruction = () => {
    if (!newInstructionText.trim()) return;
    setInstructions([...instructions, newInstructionText.trim()]);
    setNewInstructionText('');
  };

  const handleRemoveInstruction = (idx: number) => {
    setInstructions(instructions.filter((_, i) => i !== idx));
  };

  // Save Test Paper directly to database
  const handleSaveAndPublish = async () => {
    if (!paperTitle.trim()) {
      setErrorMessage('Please specify an Examination Paper Title.');
      return;
    }
    if (questions.length === 0) {
      setErrorMessage('Please add at least one question to the paper.');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    setSaveSuccess(null);

    try {
      const paperJSON: PaperJSON = {
        exam: examType,
        paperTitle: paperTitle.trim(),
        description: `${institution} — ${classGrade} ${subjectName} Examination Paper. Academic Year ${academicSession}.`,
        durationMinutes: Number(durationMinutes) || 60,
        totalMarks: totalCalculatedMarks,
        negativeMarking: defaultNegativeMarks,
        difficulty,
        subjects: allPaperSubjects,
        questions,
        institution: institution.trim(),
        paperCode: paperCode.trim(),
        instructions,
      };

      const saved = await savePaper({
        user_id: effectiveUserId,
        exam: examType,
        title: paperTitle.trim(),
        description: paperJSON.description || '',
        difficulty,
        duration_minutes: Number(durationMinutes) || 60,
        total_marks: totalCalculatedMarks,
        negative_marking: defaultNegativeMarks,
        question_count: questions.length,
        subjects: allPaperSubjects,
        raw_json: paperJSON,
        visibility: 'private',
      });

      setSaveSuccess(`Test "${saved.title}" published successfully to your exam library!`);
      setTimeout(() => {
        onPaperCreated(saved.id);
      }, 1500);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to publish exam paper.');
    } finally {
      setIsSaving(false);
    }
  };

  // Trigger browser print
  const handlePrintPaper = () => {
    window.print();
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 animate-fadeIn pb-16 text-[var(--text-main)]">
      {/* ============================================================ */}
      {/* STUDIO NAVIGATION & MODE TABS */}
      {/* ============================================================ */}
      <div className="bento-card p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-[var(--bg-surface)] border border-[var(--border-color)] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold shadow-xs shrink-0">
            <GraduationCap size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-black text-[var(--text-main)] tracking-tight">
                Admin Test & Exam Creator Studio
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                School & Institute Grade
              </span>
            </div>
            <p className="text-xs text-[var(--text-muted)] font-medium">
              Create, configure, and publish professional examination papers with full academic control.
            </p>
          </div>
        </div>

        {/* View mode pill tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-[var(--bg-subcard)] rounded-2xl border border-[var(--border-color)] overflow-x-auto hide-scrollbar shrink-0">
          <button
            onClick={() => setActiveStudioTab('builder')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
              activeStudioTab === 'builder'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-subcard-hover)]'
            }`}
          >
            <Settings size={14} />
            <span>Interactive Builder</span>
          </button>
          <button
            onClick={() => setActiveStudioTab('paper_preview')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
              activeStudioTab === 'paper_preview'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-subcard-hover)]'
            }`}
          >
            <Eye size={14} />
            <span>School Paper View</span>
          </button>
          <button
            onClick={() => setActiveStudioTab('json_import')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
              activeStudioTab === 'json_import'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-subcard-hover)]'
            }`}
          >
            <Code2 size={14} />
            <span>AI Prompt & JSON</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {saveSuccess && (
        <div className="p-4 bg-emerald-500/15 border border-emerald-500/30 rounded-2xl text-emerald-400 text-xs sm:text-sm font-semibold flex items-center gap-2 animate-fadeIn shadow-xs">
          <CheckCircle2 size={18} className="shrink-0" />
          <span>{saveSuccess}</span>
        </div>
      )}
      {errorMessage && (
        <div className="p-4 bg-rose-500/15 border border-rose-500/30 rounded-2xl text-rose-400 text-xs sm:text-sm font-semibold flex items-center gap-2 animate-fadeIn shadow-xs">
          <AlertCircle size={18} className="shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 1: INTERACTIVE TEST BUILDER (ADMIN FULL CONTROL) */}
      {/* ============================================================ */}
      {activeStudioTab === 'builder' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Section 1: Official Examination Header & School Branding Settings */}
          <div className="bento-card p-5 sm:p-6 rounded-3xl bg-[var(--bg-surface)] border border-[var(--border-color)] shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-3">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold text-xs">
                  1
                </span>
                <h3 className="text-base font-extrabold text-[var(--text-main)]">
                  School & Paper Header Configuration
                </h3>
              </div>
              <span className="text-xs text-[var(--text-muted)] font-mono">
                {questions.length} Question{questions.length !== 1 ? 's' : ''} · {totalCalculatedMarks} Marks
              </span>
            </div>

            {/* School / Institution Preset Pills */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                Select Institution Preset:
              </label>
              <div className="flex items-center gap-1.5 overflow-x-auto hide-scrollbar pb-1">
                {SCHOOL_PRESETS.map(school => (
                  <button
                    key={school}
                    onClick={() => setInstitution(school)}
                    className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition-all border cursor-pointer ${
                      institution === school
                        ? 'bg-indigo-600 text-white border-indigo-700 shadow-2xs'
                        : 'bg-[var(--bg-subcard)] border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
                    }`}
                  >
                    {school}
                  </button>
                ))}
              </div>
            </div>

            {/* Header Fields Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-[var(--text-muted)] mb-1">
                  Institution / School Name
                </label>
                <input
                  type="text"
                  value={institution}
                  onChange={e => setInstitution(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--bg-subcard)] border border-[var(--border-color)] text-xs sm:text-sm font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  placeholder="e.g. Delhi Public School"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--text-muted)] mb-1">
                  Examination Paper Title
                </label>
                <input
                  type="text"
                  value={paperTitle}
                  onChange={e => setPaperTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--bg-subcard)] border border-[var(--border-color)] text-xs sm:text-sm font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  placeholder="e.g. Annual Assessment 2026"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--text-muted)] mb-1">
                  Paper Code / Subject Code
                </label>
                <input
                  type="text"
                  value={paperCode}
                  onChange={e => setPaperCode(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--bg-subcard)] border border-[var(--border-color)] text-xs sm:text-sm font-semibold font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  placeholder="e.g. MATH-X-2026"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--text-muted)] mb-1">
                  Class / Grade / Level
                </label>
                <input
                  type="text"
                  value={classGrade}
                  onChange={e => setClassGrade(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--bg-subcard)] border border-[var(--border-color)] text-xs sm:text-sm font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  placeholder="e.g. Class X"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--text-muted)] mb-1">
                  Primary Subject
                </label>
                <input
                  type="text"
                  value={subjectName}
                  onChange={e => setSubjectName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--bg-subcard)] border border-[var(--border-color)] text-xs sm:text-sm font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  placeholder="e.g. Mathematics"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--text-muted)] mb-1">
                  Academic Session / Year
                </label>
                <input
                  type="text"
                  value={academicSession}
                  onChange={e => setAcademicSession(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--bg-subcard)] border border-[var(--border-color)] text-xs sm:text-sm font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  placeholder="e.g. 2025 – 2026"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--text-muted)] mb-1">
                  Duration (Minutes)
                </label>
                <input
                  type="number"
                  min="5"
                  max="360"
                  value={durationMinutes}
                  onChange={e => setDurationMinutes(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--bg-subcard)] border border-[var(--border-color)] text-xs sm:text-sm font-semibold font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--text-muted)] mb-1">
                  Default Marks Per Question
                </label>
                <input
                  type="number"
                  min="0.5"
                  step="0.5"
                  value={defaultMarks}
                  onChange={e => setDefaultMarks(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--bg-subcard)] border border-[var(--border-color)] text-xs sm:text-sm font-semibold font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--text-muted)] mb-1">
                  Negative Marking Penalty
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.25"
                  value={defaultNegativeMarks}
                  onChange={e => setDefaultNegativeMarks(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--bg-subcard)] border border-[var(--border-color)] text-xs sm:text-sm font-semibold font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            {/* General Instructions Accordion */}
            <div className="pt-2 border-t border-[var(--border-color)] space-y-2.5">
              <label className="block text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                Official General Instructions for Candidates:
              </label>
              <div className="space-y-1.5">
                {instructions.map((inst, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 rounded-xl bg-[var(--bg-subcard)] border border-[var(--border-color)] text-xs font-medium">
                    <span className="font-bold text-indigo-400 shrink-0 font-mono">{i + 1}.</span>
                    <span className="flex-1 min-w-0">{inst}</span>
                    <button
                      onClick={() => handleRemoveInstruction(i)}
                      className="p-1 text-[var(--text-muted)] hover:text-rose-400 rounded-lg transition-colors cursor-pointer"
                      title="Remove instruction"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="text"
                  value={newInstructionText}
                  onChange={e => setNewInstructionText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddInstruction()}
                  placeholder="Add custom candidate instruction..."
                  className="flex-1 px-3 py-2 rounded-xl bg-[var(--bg-subcard)] border border-[var(--border-color)] text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
                <button
                  onClick={handleAddInstruction}
                  className="btn btn-outline text-xs py-2 px-3.5 rounded-xl font-bold cursor-pointer"
                >
                  Add
                </button>
              </div>
            </div>
          </div>

          {/* Section 2: Questions Authoring Cards (Full Control) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold text-xs">
                  2
                </span>
                <h3 className="text-base font-extrabold text-[var(--text-main)]">
                  Examination Questions Studio ({questions.length})
                </h3>
              </div>

              <button
                onClick={handleAddQuestion}
                className="btn btn-primary text-xs py-2 px-4 rounded-xl flex items-center gap-1.5 font-bold shadow-xs cursor-pointer"
              >
                <Plus size={15} />
                <span>Add Question</span>
              </button>
            </div>

            {/* Questions List */}
            {questions.map((q, idx) => (
              <div
                key={idx}
                className="bento-card p-5 sm:p-6 rounded-3xl bg-[var(--bg-surface)] border border-[var(--border-color)] shadow-sm space-y-4 relative group"
              >
                {/* Question Header Bar: Q number, subject, topic, actions */}
                <div className="flex items-center justify-between gap-2 border-b border-[var(--border-color)] pb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="px-2.5 py-1 rounded-xl bg-indigo-600 text-white font-extrabold text-xs shadow-xs font-mono">
                      Q.{idx + 1}
                    </span>
                    <input
                      type="text"
                      value={q.subject}
                      onChange={e => handleUpdateQuestion(idx, { subject: e.target.value })}
                      className="px-2.5 py-1 rounded-lg bg-[var(--bg-subcard)] border border-[var(--border-color)] text-xs font-bold text-indigo-400 max-w-[150px]"
                      placeholder="Subject"
                    />
                    <input
                      type="text"
                      value={q.topic}
                      onChange={e => handleUpdateQuestion(idx, { topic: e.target.value })}
                      className="px-2.5 py-1 rounded-lg bg-[var(--bg-subcard)] border border-[var(--border-color)] text-xs font-medium text-[var(--text-muted)] max-w-[180px] hidden sm:block"
                      placeholder="Topic"
                    />
                  </div>

                  {/* Move Up, Down, Duplicate, Delete */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleMoveQuestion(idx, 'up')}
                      disabled={idx === 0}
                      className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-main)] disabled:opacity-30 rounded-lg hover:bg-[var(--bg-subcard)] transition-colors cursor-pointer"
                      title="Move Up"
                    >
                      <ArrowUp size={14} />
                    </button>
                    <button
                      onClick={() => handleMoveQuestion(idx, 'down')}
                      disabled={idx === questions.length - 1}
                      className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-main)] disabled:opacity-30 rounded-lg hover:bg-[var(--bg-subcard)] transition-colors cursor-pointer"
                      title="Move Down"
                    >
                      <ArrowDown size={14} />
                    </button>
                    <button
                      onClick={() => handleDuplicateQuestion(idx)}
                      className="p-1.5 text-[var(--text-muted)] hover:text-indigo-400 rounded-lg hover:bg-[var(--bg-subcard)] transition-colors cursor-pointer"
                      title="Duplicate Question"
                    >
                      <Copy size={14} />
                    </button>
                    <button
                      onClick={() => handleDeleteQuestion(idx)}
                      className="p-1.5 text-[var(--text-muted)] hover:text-rose-400 rounded-lg hover:bg-[var(--bg-subcard)] transition-colors cursor-pointer"
                      title="Delete Question"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Question Statement */}
                <div>
                  <label className="block text-xs font-bold text-[var(--text-muted)] mb-1">
                    Question Statement (Supports LaTeX math like \(x^2 + y^2 = r^2\)):
                  </label>
                  <textarea
                    rows={3}
                    value={q.question}
                    onChange={e => handleUpdateQuestion(idx, { question: e.target.value })}
                    className="w-full p-3 rounded-2xl bg-[var(--bg-subcard)] border border-[var(--border-color)] text-xs sm:text-sm font-semibold text-[var(--text-main)] focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    placeholder="Enter question text..."
                  />
                  {(q.question.includes('\\(') || q.question.includes('$') || q.question.includes('\\[') || q.question.includes('\\frac')) && (
                    <div className="mt-1.5 p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-[var(--text-main)] font-medium">
                      <span className="text-[10px] uppercase font-mono font-bold text-amber-500 mr-1.5">Live Math Preview:</span>
                      {formatMathText(q.question)}
                    </div>
                  )}
                </div>

                {/* Options List with 1-click correct radio */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                      Options & Correct Answer Selection:
                    </label>
                    <button
                      onClick={() => handleAddOption(idx)}
                      className="text-xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
                    >
                      <Plus size={12} />
                      <span>Add Option</span>
                    </button>
                  </div>

                  <div className="space-y-2">
                    {q.options.map((opt, optIdx) => {
                      const isCorrect = q.answerIndex === optIdx;
                      return (
                        <div
                          key={optIdx}
                          className={`flex items-center gap-2.5 p-2 rounded-2xl border transition-all ${
                            isCorrect
                              ? 'border-emerald-500/50 bg-emerald-500/10'
                              : 'border-[var(--border-color)] bg-[var(--bg-subcard)]'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              handleUpdateQuestion(idx, {
                                answerIndex: optIdx,
                                correctAnswer: opt,
                              });
                            }}
                            className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 cursor-pointer transition-all ${
                              isCorrect
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'bg-[var(--bg-surface)] text-[var(--text-muted)] border border-[var(--border-color)] hover:border-emerald-500'
                            }`}
                            title={isCorrect ? 'Correct Answer' : 'Click to mark as correct answer'}
                          >
                            {String.fromCharCode(65 + optIdx)}
                          </button>

                          <input
                            type="text"
                            value={opt}
                            onChange={e => handleUpdateOption(idx, optIdx, e.target.value)}
                            className="flex-1 bg-transparent text-xs sm:text-sm font-medium focus:outline-none"
                            placeholder={`Option ${String.fromCharCode(65 + optIdx)}`}
                          />

                          {isCorrect && (
                            <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1 pr-1 shrink-0">
                              <Check size={13} />
                              <span className="hidden sm:inline">Correct</span>
                            </span>
                          )}

                          {q.options.length > 2 && (
                            <button
                              onClick={() => handleRemoveOption(idx, optIdx)}
                              className="p-1 text-[var(--text-muted)] hover:text-rose-400 rounded-lg transition-colors cursor-pointer"
                              title="Delete option"
                            >
                              <X size={13} />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Question Solution & Marks Details */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-[var(--text-muted)] mb-1">
                      Step-by-Step Explanation / Solution (Optional):
                    </label>
                    <input
                      type="text"
                      value={q.solution || ''}
                      onChange={e => handleUpdateQuestion(idx, { solution: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-[var(--bg-subcard)] border border-[var(--border-color)] text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      placeholder="Explain the solution for candidate review..."
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <label className="block text-xs font-bold text-emerald-400 mb-1">
                        +Marks
                      </label>
                      <input
                        type="number"
                        min="1"
                        step="0.5"
                        value={q.marks || defaultMarks}
                        onChange={e => handleUpdateQuestion(idx, { marks: Number(e.target.value) })}
                        className="w-full px-2.5 py-2 rounded-xl bg-[var(--bg-subcard)] border border-[var(--border-color)] text-xs font-mono font-bold"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs font-bold text-rose-400 mb-1">
                        -Penalty
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.25"
                        value={q.negativeMarks !== undefined ? q.negativeMarks : defaultNegativeMarks}
                        onChange={e => handleUpdateQuestion(idx, { negativeMarks: Number(e.target.value) })}
                        className="w-full px-2.5 py-2 rounded-xl bg-[var(--bg-subcard)] border border-[var(--border-color)] text-xs font-mono font-bold"
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* Bottom Actions Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-3xl bg-[var(--bg-surface)] border border-[var(--border-color)] shadow-sm sticky bottom-4 z-20 backdrop-blur-md">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleAddQuestion}
                  className="btn btn-outline text-xs py-2.5 px-4 rounded-xl flex items-center gap-1.5 font-bold cursor-pointer"
                >
                  <Plus size={14} />
                  <span>Add Another Question</span>
                </button>
                <button
                  onClick={() => setActiveStudioTab('paper_preview')}
                  className="btn btn-outline text-xs py-2.5 px-4 rounded-xl flex items-center gap-1.5 font-bold cursor-pointer"
                >
                  <Eye size={14} />
                  <span>Preview Paper</span>
                </button>
              </div>

              <div className="flex items-center gap-3">
                {onCancel && (
                  <button
                    onClick={onCancel}
                    className="btn btn-outline text-xs py-2.5 px-4 rounded-xl font-bold cursor-pointer"
                  >
                    Cancel
                  </button>
                )}
                <button
                  onClick={handleSaveAndPublish}
                  disabled={isSaving}
                  className="btn btn-primary text-xs py-2.5 px-6 rounded-xl flex items-center gap-2 font-bold shadow-xs cursor-pointer active:scale-95 transition-all"
                >
                  <Save size={15} />
                  <span>{isSaving ? 'Publishing...' : 'Publish Test to Library'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 2: OFFICIAL PRINTABLE SCHOOL QUESTION PAPER PREVIEW */}
      {/* ============================================================ */}
      {activeStudioTab === 'paper_preview' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Controls Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] shadow-2xs">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[var(--text-muted)]">Layout:</span>
              <button
                onClick={() => setPreviewColumns('two_column')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  previewColumns === 'two_column'
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'bg-[var(--bg-subcard)] text-[var(--text-muted)]'
                }`}
              >
                2-Column School Style
              </button>
              <button
                onClick={() => setPreviewColumns('single')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  previewColumns === 'single'
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'bg-[var(--bg-subcard)] text-[var(--text-muted)]'
                }`}
              >
                Standard Flow
              </button>
            </div>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-xs font-bold text-[var(--text-muted)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={showAnswerKeyInPreview}
                  onChange={e => setShowAnswerKeyInPreview(e.target.checked)}
                  className="rounded"
                />
                <span>Include Answer Key Sheet</span>
              </label>

              <button
                onClick={handlePrintPaper}
                className="btn btn-outline text-xs py-2 px-4 rounded-xl flex items-center gap-1.5 font-bold cursor-pointer"
                title="Print this official exam paper onto physical paper or save as PDF"
              >
                <Printer size={14} />
                <span>Print / Save PDF</span>
              </button>
              <button
                onClick={handleSaveAndPublish}
                disabled={isSaving}
                className="btn btn-primary text-xs py-2 px-4 rounded-xl flex items-center gap-1.5 font-bold shadow-xs cursor-pointer"
              >
                <Save size={14} />
                <span>Publish Test</span>
              </button>
            </div>
          </div>

          {/* Authentic Printed Examination Sheet (Exact real school layout) */}
          <div className="p-6 sm:p-10 rounded-3xl bg-white text-gray-900 shadow-xl border border-gray-300 font-serif max-w-4xl mx-auto printable-sheet">
            {/* Top Official School Seal & Header */}
            <div className="text-center border-b-2 border-gray-900 pb-4 space-y-1">
              <div className="font-mono text-[10px] uppercase tracking-[0.25em] font-extrabold text-gray-600">
                OFFICIAL EXAMINATION PAPER · {academicSession}
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-gray-950 font-serif uppercase">
                {institution}
              </h1>
              <div className="text-sm font-bold text-gray-800">
                {paperTitle}
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-6 text-xs font-bold text-gray-700 pt-1 font-mono">
                <span>Class: {classGrade}</span>
                <span>Subject: {subjectName}</span>
                <span>Code: {paperCode}</span>
              </div>
            </div>

            {/* Time, Marks & Candidate Roll No Box */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 py-3 border-b border-gray-400 text-xs font-bold font-mono">
              <div className="flex items-center gap-1">
                <span>Time Allowed:</span>
                <span className="text-gray-900 font-extrabold">{durationMinutes} Minutes</span>
              </div>
              <div className="text-center">
                <span>Maximum Marks:</span>
                <span className="text-gray-900 font-extrabold ml-1">{totalCalculatedMarks}</span>
              </div>
              <div className="text-right sm:text-right flex items-center justify-end gap-1">
                <span>Roll No:</span>
                <span className="border border-gray-600 px-3 py-0.5 tracking-widest font-mono">[  ][  ][  ][  ]</span>
              </div>
            </div>

            {/* General Instructions Box */}
            <div className="my-4 p-3 bg-gray-50 border border-gray-300 rounded-xl text-[11px] leading-relaxed text-gray-800 space-y-1 font-sans">
              <div className="font-bold uppercase tracking-wider text-gray-900 font-mono text-[10px]">
                General Instructions:
              </div>
              <ol className="list-decimal pl-4 space-y-0.5">
                {instructions.map((inst, i) => (
                  <li key={i}>{inst}</li>
                ))}
              </ol>
            </div>

            {/* Questions Grid */}
            <div className={`mt-6 ${previewColumns === 'two_column' ? 'sm:columns-2 gap-8' : 'space-y-6'}`}>
              {questions.map((q, idx) => (
                <div key={idx} className="break-inside-avoid mb-6 pb-4 border-b border-gray-200 space-y-2">
                  {/* Question Line */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-xs sm:text-sm font-bold text-gray-950 font-serif leading-relaxed">
                      <span className="font-black font-mono mr-1.5">Q.{idx + 1}.</span>
                      {formatMathText(q.question)}
                    </div>
                    <span className="text-[11px] font-bold font-mono text-gray-600 shrink-0">
                      [{q.marks || defaultMarks}M]
                    </span>
                  </div>

                  {/* Options */}
                  <div className="grid grid-cols-1 gap-1 pl-4 pt-1 text-xs text-gray-800 font-sans">
                    {q.options.map((opt, oIdx) => (
                      <div key={oIdx} className="flex items-start gap-1.5">
                        <span className="font-bold font-mono text-gray-900">
                          ({String.fromCharCode(65 + oIdx)})
                        </span>
                        <span>{formatMathText(opt)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Official Answer Key Sheet (if enabled) */}
            {showAnswerKeyInPreview && (
              <div className="mt-8 pt-6 border-t-2 border-gray-900 break-before-page space-y-4">
                <div className="text-center font-bold font-mono uppercase tracking-wider text-sm">
                  --- OFFICIAL ANSWER KEY & SOLUTIONS ---
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                  {questions.map((q, idx) => (
                    <div key={idx} className="p-2 border border-gray-300 rounded-lg bg-gray-50 flex items-center justify-between">
                      <span className="font-bold">Q.{idx + 1}:</span>
                      <span className="font-extrabold text-emerald-700">
                        ({String.fromCharCode(65 + q.answerIndex)}) {formatMathText(q.correctAnswer)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 3: JSON IMPORTER & AI PROMPT GENERATOR (PRESERVED WORKFLOW) */}
      {/* ============================================================ */}
      {activeStudioTab === 'json_import' && (
        <div className="animate-fadeIn">
          <JsonImporter userId={effectiveUserId} onImported={() => onPaperCreated()} />
        </div>
      )}
    </div>
  );
}
