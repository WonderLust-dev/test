import { useState, useMemo } from 'react';
import {
  EXAM_PRESETS,
  ExamPreset,
  buildCustomAIPrompt,
  generateSamplePaperJSON,
  PromptBuilderConfig,
} from '../utils/examReferenceData';
import {
  Sparkles,
  Layers,
  FileText,
  Sliders,
  Copy,
  Check,
  Download,
  Plus,
  BookOpen,
  HelpCircle,
  Wand2,
  FileCode,
} from 'lucide-react';

interface ExamAIPromptBuilderProps {
  onLoadSample: (sampleJson: string) => void;
  initialExamId?: string;
}

const CATEGORIES: Array<ExamPreset['category'] | 'All'> = [
  'All',
  'SSC',
  'Railway',
  'Banking & Insurance',
  'UPSC & Defence',
  'State PSC',
  'Teaching',
  'Custom',
];

export default function ExamAIPromptBuilder({ onLoadSample, initialExamId }: ExamAIPromptBuilderProps) {
  // Category & Preset Selection
  const [selectedCategory, setSelectedCategory] = useState<ExamPreset['category'] | 'All'>('All');
  const [selectedExamId, setSelectedExamId] = useState<string>(initialExamId || 'ssc_cgl');

  // Find active preset
  const currentPreset = useMemo(() => {
    return EXAM_PRESETS.find((p) => p.id === selectedExamId) || EXAM_PRESETS[0];
  }, [selectedExamId]);

  // Filtered Presets by Category
  const filteredPresets = useMemo(() => {
    if (selectedCategory === 'All') return EXAM_PRESETS;
    return EXAM_PRESETS.filter((p) => p.category === selectedCategory);
  }, [selectedCategory]);

  // Mode: fresh | convert | batch
  const [mode, setMode] = useState<'fresh' | 'convert' | 'batch'>('fresh');

  // Custom exam fields (if Custom is active)
  const [customExamName, setCustomExamName] = useState('');

  // Subject Selection
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>(currentPreset.subjects);
  const [customSubjectInput, setCustomSubjectInput] = useState('');

  // Topic & Subtopic
  const [topic, setTopic] = useState('');
  const [subtopic, setSubtopic] = useState('');

  // Test Pattern Parameters
  const [questionCount, setQuestionCount] = useState<number>(currentPreset.defaultQuestions);
  const [durationMinutes, setDurationMinutes] = useState<number>(currentPreset.defaultDuration);
  const [marksPerQuestion, setMarksPerQuestion] = useState<number>(currentPreset.defaultMarks);
  const [negativeMarking, setNegativeMarking] = useState<number>(currentPreset.defaultNegative);
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard' | 'mixed'>('medium');
  const [paperTitle, setPaperTitle] = useState('');
  const [paperDescription, setPaperDescription] = useState('');

  // Batch Mode Settings
  const [batchPaperCount, setBatchPaperCount] = useState<number>(3);

  // Convert Mode Raw Text
  const [rawTextToConvert, setRawTextToConvert] = useState<string>('');

  // Extra Schema Options
  const [includeHints, setIncludeHints] = useState<boolean>(true);
  const [includeSolutions, setIncludeSolutions] = useState<boolean>(true);
  const [includeShortcuts, setIncludeShortcuts] = useState<boolean>(true);
  const [includeFormulas, setIncludeFormulas] = useState<boolean>(true);
  const [includeSuggestions, setIncludeSuggestions] = useState<boolean>(true);
  const [includeTimeEstimate, setIncludeTimeEstimate] = useState<boolean>(true);
  const [includePassages, setIncludePassages] = useState<boolean>(false);

  // Feedback states
  const [copied, setCopied] = useState<boolean>(false);
  const [sampleLoaded, setSampleLoaded] = useState<boolean>(false);

  // When user switches exam preset, auto-tune parameters to match that exam
  const handleSelectExam = (presetId: string) => {
    const preset = EXAM_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setSelectedExamId(presetId);
    setSelectedSubjects(preset.subjects);
    setQuestionCount(preset.defaultQuestions);
    setDurationMinutes(preset.defaultDuration);
    setMarksPerQuestion(preset.defaultMarks);
    setNegativeMarking(preset.defaultNegative);
    setTopic('');
    setSubtopic('');
    setPaperTitle('');
  };

  // Toggle subject selection
  const handleToggleSubject = (subjectName: string) => {
    setSelectedSubjects((prev) =>
      prev.includes(subjectName)
        ? prev.filter((s) => s !== subjectName)
        : [...prev, subjectName]
    );
  };

  // Add custom subject
  const handleAddCustomSubject = () => {
    const clean = customSubjectInput.trim();
    if (!clean) return;
    if (!selectedSubjects.includes(clean)) {
      setSelectedSubjects((prev) => [...prev, clean]);
    }
    setCustomSubjectInput('');
  };

  // Compute active exam name
  const effectiveExamName = useMemo(() => {
    if (currentPreset.id === 'custom_exam' && customExamName.trim()) {
      return customExamName.trim();
    }
    return currentPreset.name.split(' (')[0] || currentPreset.name;
  }, [currentPreset, customExamName]);

  // Construct config & generated prompt
  const generatedPrompt = useMemo(() => {
    const config: PromptBuilderConfig = {
      examName: effectiveExamName,
      category: currentPreset.category,
      mode,
      subjects: selectedSubjects,
      topic: topic.trim(),
      subtopic: subtopic.trim() || undefined,
      difficulty,
      questionCount,
      durationMinutes,
      marksPerQuestion,
      negativeMarking,
      paperTitle: paperTitle.trim() || undefined,
      description: paperDescription.trim() || undefined,
      includeHints,
      includeSolutions,
      includeShortcuts,
      includeFormulas,
      includeSuggestions,
      includeTimeEstimate,
      includePassages,
      rawTextToConvert: mode === 'convert' ? rawTextToConvert : undefined,
      batchPaperCount: mode === 'batch' ? batchPaperCount : undefined,
    };
    return buildCustomAIPrompt(config);
  }, [
    effectiveExamName,
    currentPreset.category,
    mode,
    selectedSubjects,
    topic,
    subtopic,
    difficulty,
    questionCount,
    durationMinutes,
    marksPerQuestion,
    negativeMarking,
    paperTitle,
    paperDescription,
    includeHints,
    includeSolutions,
    includeShortcuts,
    includeFormulas,
    includeSuggestions,
    includeTimeEstimate,
    includePassages,
    rawTextToConvert,
    batchPaperCount,
  ]);

  // Handle Copy Prompt
  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(generatedPrompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  // Handle Load Sample into Editor
  const handleLoadSampleToEditor = () => {
    const sample = generateSamplePaperJSON(currentPreset, selectedSubjects[0]);
    onLoadSample(sample);
    setSampleLoaded(true);
    setTimeout(() => setSampleLoaded(false), 2500);
  };

  // Handle Download Prompt as Text
  const handleDownloadPrompt = () => {
    const blob = new Blob([generatedPrompt], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${effectiveExamName.toLowerCase().replace(/[^\w]/g, '_')}_prompt.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Popular topics for active preset and selected subjects
  const availableTopics = useMemo(() => {
    const list: string[] = [];
    selectedSubjects.forEach((sub) => {
      const subTopics = currentPreset.popularTopics[sub];
      if (subTopics) {
        subTopics.forEach((t) => {
          if (!list.includes(t)) list.push(t);
        });
      }
    });
    return list.slice(0, 16);
  }, [currentPreset, selectedSubjects]);

  return (
    <div className="bento-card p-5 sm:p-6 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-3xl shadow-sm space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[var(--border-color)]">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-2xl bg-indigo-500/10 text-indigo-500">
              <Wand2 size={20} />
            </div>
            <h3 className="font-extrabold text-base sm:text-lg text-[var(--text-main)]">
              AI Question Generator & Prompt Builder
            </h3>
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Generate custom AI prompts for ChatGPT, Gemini, or Claude calibrated to any competitive exam syllabus and schema.
          </p>
        </div>

        {/* Mode Selector Tabs */}
        <div className="flex items-center gap-1 p-1 bg-[var(--bg-subcard)] border border-[var(--border-color)] rounded-full text-xs font-bold self-start sm:self-auto">
          <button
            onClick={() => setMode('fresh')}
            className={`px-3 py-1.5 rounded-full transition-all flex items-center gap-1.5 ${
              mode === 'fresh'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            <Sparkles size={13} /> Fresh Questions
          </button>
          <button
            onClick={() => setMode('convert')}
            className={`px-3 py-1.5 rounded-full transition-all flex items-center gap-1.5 ${
              mode === 'convert'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            <FileText size={13} /> Convert Text / PDF
          </button>
          <button
            onClick={() => setMode('batch')}
            className={`px-3 py-1.5 rounded-full transition-all flex items-center gap-1.5 ${
              mode === 'batch'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            <Layers size={13} /> Batch Sets ([...])
          </button>
        </div>
      </div>

      {/* SECTION 1: Examination & Subject Presets */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <label className="text-xs font-extrabold text-[var(--text-main)] uppercase tracking-wider flex items-center gap-1.5">
            <BookOpen size={14} className="text-indigo-500" />
            1. Select Target Examination & Preset
          </label>
          <span className="text-[11px] font-semibold text-[var(--text-muted)]">
            {filteredPresets.length} presets available
          </span>
        </div>

        {/* Category Filter Pills */}
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => {
                setSelectedCategory(cat);
                const first = cat === 'All' ? EXAM_PRESETS[0] : EXAM_PRESETS.find((p) => p.category === cat);
                if (first && first.id !== selectedExamId) {
                  handleSelectExam(first.id);
                }
              }}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${
                selectedCategory === cat
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'bg-[var(--bg-subcard)] border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-subcard-hover)]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Exam Preset Selector Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {filteredPresets.map((preset) => {
            const isSelected = preset.id === selectedExamId;
            return (
              <button
                key={preset.id}
                onClick={() => handleSelectExam(preset.id)}
                className={`p-3.5 rounded-2xl text-left border transition-all flex flex-col justify-between gap-2 ${
                  isSelected
                    ? 'border-indigo-500 bg-indigo-500/10 shadow-xs'
                    : 'border-[var(--border-color)] bg-[var(--bg-subcard)] hover:border-indigo-500/40 hover:bg-[var(--bg-subcard-hover)]'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-1.5 mb-1">
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400 border border-indigo-500/20">
                      {preset.badge}
                    </span>
                    <span className="text-[10px] font-bold text-[var(--text-muted)]">
                      {preset.defaultDuration}m • {preset.defaultQuestions}Q
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-[var(--text-main)] line-clamp-1">
                    {preset.name}
                  </h4>
                  <p className="text-[11px] text-[var(--text-muted)] line-clamp-1 mt-0.5">
                    {preset.description}
                  </p>
                </div>
                <div className="text-[10px] font-semibold text-emerald-500 truncate pt-1 border-t border-[var(--border-color)]/50">
                  {preset.markingRule}
                </div>
              </button>
            );
          })}
        </div>

        {/* Custom Exam Name Field (if Custom preset chosen) */}
        {currentPreset.id === 'custom_exam' && (
          <div className="p-3.5 rounded-2xl bg-[var(--bg-subcard)] border border-[var(--border-color)] space-y-2">
            <label className="text-xs font-bold text-[var(--text-main)]">Custom Examination Name</label>
            <input
              type="text"
              value={customExamName}
              onChange={(e) => setCustomExamName(e.target.value)}
              placeholder="e.g., Delhi Police Sub-Inspector, GATE CS, or Company Assessment"
              className="w-full px-3.5 py-2 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl text-xs font-medium text-[var(--text-main)] placeholder-[var(--text-subtle)] focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>
        )}
      </div>

      {/* SECTION 2: Subjects & High-Yield Topics */}
      <div className="space-y-3 pt-2 border-t border-[var(--border-color)]">
        <label className="text-xs font-extrabold text-[var(--text-main)] uppercase tracking-wider flex items-center gap-1.5">
          <BookOpen size={14} className="text-indigo-500" />
          2. Prescribed Sections & Subject Focus
        </label>

        {/* Subject Checkbox / Badges */}
        <div className="flex flex-wrap gap-2 items-center">
          {currentPreset.subjects.map((sub) => {
            const isChecked = selectedSubjects.includes(sub);
            return (
              <button
                key={sub}
                onClick={() => handleToggleSubject(sub)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors flex items-center gap-1.5 ${
                  isChecked
                    ? 'border-indigo-500 bg-indigo-500/15 text-indigo-400 shadow-2xs'
                    : 'border-[var(--border-color)] bg-[var(--bg-subcard)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
                }`}
              >
                <span className={`w-3.5 h-3.5 rounded flex items-center justify-center text-[10px] ${
                  isChecked ? 'bg-indigo-600 text-white' : 'border border-[var(--border-color)]'
                }`}>
                  {isChecked ? '✓' : ''}
                </span>
                {sub}
              </button>
            );
          })}
        </div>

        {/* Add custom subject */}
        <div className="flex items-center gap-2 max-w-md pt-1">
          <input
            type="text"
            value={customSubjectInput}
            onChange={(e) => setCustomSubjectInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddCustomSubject()}
            placeholder="Add custom subject (e.g. Current Affairs, Botany)..."
            className="flex-1 px-3 py-1.5 bg-[var(--bg-subcard)] border border-[var(--border-color)] rounded-xl text-xs text-[var(--text-main)] placeholder-[var(--text-subtle)] focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          />
          <button
            onClick={handleAddCustomSubject}
            disabled={!customSubjectInput.trim()}
            className="px-3 py-1.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-subcard)] hover:bg-[var(--bg-subcard-hover)] text-xs font-bold text-[var(--text-main)] flex items-center gap-1 disabled:opacity-40"
          >
            <Plus size={13} /> Add
          </button>
        </div>

        {/* High-Yield Topic Suggestions */}
        {availableTopics.length > 0 && (
          <div className="pt-2">
            <span className="text-[11px] font-bold text-[var(--text-muted)] block mb-1.5">
              💡 Click to populate High-Yield Syllabus Topics:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {availableTopics.map((t) => (
                <button
                  key={t}
                  onClick={() => setTopic(t)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all ${
                    topic === t
                      ? 'border-indigo-500 bg-indigo-500/20 text-indigo-300'
                      : 'border-[var(--border-color)] bg-[var(--bg-subcard)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:border-indigo-500/30'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Topic & Subtopic Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          <div>
            <label className="text-xs font-bold text-[var(--text-main)] mb-1 block">
              Topic / Chapter (Optional)
            </label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. Algebraic Identities, Indian Constitution, Syllogism"
              className="w-full px-3.5 py-2 bg-[var(--bg-subcard)] border border-[var(--border-color)] rounded-xl text-xs font-medium text-[var(--text-main)] placeholder-[var(--text-subtle)] focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-[var(--text-main)] mb-1 block">
              Subtopic / Concept (Optional)
            </label>
            <input
              type="text"
              value={subtopic}
              onChange={(e) => setSubtopic(e.target.value)}
              placeholder="e.g. Successive Percentage, Article 21, Only a Few"
              className="w-full px-3.5 py-2 bg-[var(--bg-subcard)] border border-[var(--border-color)] rounded-xl text-xs font-medium text-[var(--text-main)] placeholder-[var(--text-subtle)] focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* SECTION 3: Mode-Specific Inputs */}
      {mode === 'convert' && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 space-y-2">
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-amber-500" />
            <h4 className="text-xs font-extrabold text-amber-500">
              Raw Questions Source (Paste Questions / PDF Text / PYQs)
            </h4>
          </div>
          <p className="text-[11px] text-[var(--text-muted)]">
            Paste unformatted questions, OCR text from a question paper PDF, or book excerpts below. The generated prompt will instruct the AI to parse them directly into this test schema.
          </p>
          <textarea
            value={rawTextToConvert}
            onChange={(e) => setRawTextToConvert(e.target.value)}
            rows={4}
            placeholder={`Paste raw questions here, for example:\n1. If a train travels at 72 km/h, what is its speed in m/s?\nA) 15 m/s   B) 20 m/s   C) 25 m/s   D) 30 m/s\nAnswer: B\nSolution: 72 * 5/18 = 20 m/s.`}
            className="w-full p-3 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl text-xs font-mono text-[var(--text-main)] placeholder-[var(--text-subtle)] focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          />
        </div>
      )}

      {mode === 'batch' && (
        <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/25 space-y-2">
          <div className="flex items-center gap-2">
            <Layers size={16} className="text-indigo-400" />
            <h4 className="text-xs font-extrabold text-indigo-400">
              Batch Multi-Paper Configuration
            </h4>
          </div>
          <p className="text-[11px] text-[var(--text-muted)]">
            Generate multiple distinct question paper sets in a single JSON array format: <code className="px-1 py-0.5 rounded bg-[var(--bg-subcard)] text-indigo-300">[ &#123; paper 1 &#125;, &#123; paper 2 &#125; ]</code>.
          </p>
          <div className="flex items-center gap-3 pt-1">
            <label className="text-xs font-bold text-[var(--text-main)]">Number of Paper Sets:</label>
            <input
              type="number"
              min={2}
              max={10}
              value={batchPaperCount}
              onChange={(e) => setBatchPaperCount(Math.max(2, Math.min(10, Number(e.target.value) || 2)))}
              className="w-24 px-3 py-1.5 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl text-xs font-extrabold text-[var(--text-main)] text-center"
            />
            <span className="text-xs text-[var(--text-muted)]">sets (2 to 10 papers)</span>
          </div>
        </div>
      )}

      {/* SECTION 4: Test Parameters & Exam Pattern Controls */}
      <div className="space-y-3 pt-2 border-t border-[var(--border-color)]">
        <label className="text-xs font-extrabold text-[var(--text-main)] uppercase tracking-wider flex items-center gap-1.5">
          <Sliders size={14} className="text-indigo-500" />
          3. Test Parameters & Marking Rules
        </label>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div>
            <label className="text-xs font-bold text-[var(--text-main)] mb-1 block">
              Question Count
            </label>
            <input
              type="number"
              min={1}
              max={200}
              value={questionCount}
              onChange={(e) => setQuestionCount(Number(e.target.value) || 1)}
              className="w-full px-3 py-2 bg-[var(--bg-subcard)] border border-[var(--border-color)] rounded-xl text-xs font-bold text-[var(--text-main)]"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-[var(--text-main)] mb-1 block">
              Duration (min)
            </label>
            <input
              type="number"
              min={5}
              max={300}
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(Number(e.target.value) || 10)}
              className="w-full px-3 py-2 bg-[var(--bg-subcard)] border border-[var(--border-color)] rounded-xl text-xs font-bold text-[var(--text-main)]"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-[var(--text-main)] mb-1 block">
              Marks / Question
            </label>
            <input
              type="number"
              step="0.5"
              min={0.5}
              max={10}
              value={marksPerQuestion}
              onChange={(e) => setMarksPerQuestion(Number(e.target.value) || 1)}
              className="w-full px-3 py-2 bg-[var(--bg-subcard)] border border-[var(--border-color)] rounded-xl text-xs font-bold text-[var(--text-main)]"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-[var(--text-main)] mb-1 block">
              Negative Penalty
            </label>
            <input
              type="number"
              step="0.05"
              min={0}
              max={5}
              value={negativeMarking}
              onChange={(e) => setNegativeMarking(Number(e.target.value) || 0)}
              className="w-full px-3 py-2 bg-[var(--bg-subcard)] border border-[var(--border-color)] rounded-xl text-xs font-bold text-[var(--text-main)]"
            />
          </div>

          <div className="col-span-2 sm:col-span-2">
            <label className="text-xs font-bold text-[var(--text-main)] mb-1 block">
              Difficulty Level
            </label>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as PromptBuilderConfig['difficulty'])}
              className="w-full px-3 py-2 bg-[var(--bg-subcard)] border border-[var(--border-color)] rounded-xl text-xs font-bold text-[var(--text-main)]"
            >
              <option value="easy">Easy (Foundational / Direct)</option>
              <option value="medium">Medium (Standard Exam Standard)</option>
              <option value="hard">Hard (Advanced / Trap / Tricky)</option>
              <option value="mixed">Mixed (Balanced Realistic Distribution)</option>
            </select>
          </div>
        </div>

        {/* Paper Title & Custom Description */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div>
            <label className="text-xs font-bold text-[var(--text-main)] mb-1 block">
              Paper Title Override (Optional)
            </label>
            <input
              type="text"
              value={paperTitle}
              onChange={(e) => setPaperTitle(e.target.value)}
              placeholder={`e.g. ${effectiveExamName} Tier-1 Speed Booster`}
              className="w-full px-3.5 py-2 bg-[var(--bg-subcard)] border border-[var(--border-color)] rounded-xl text-xs text-[var(--text-main)] placeholder-[var(--text-subtle)] focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-[var(--text-main)] mb-1 block">
              Description / Notes (Optional)
            </label>
            <input
              type="text"
              value={paperDescription}
              onChange={(e) => setPaperDescription(e.target.value)}
              placeholder="e.g. Strictly conforming to the latest TCS 2024 syllabus pattern"
              className="w-full px-3.5 py-2 bg-[var(--bg-subcard)] border border-[var(--border-color)] rounded-xl text-xs text-[var(--text-main)] placeholder-[var(--text-subtle)] focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* SECTION 5: Schema Enhancements & Explanations */}
      <div className="space-y-2.5 pt-2 border-t border-[var(--border-color)]">
        <label className="text-xs font-extrabold text-[var(--text-main)] uppercase tracking-wider flex items-center gap-1.5">
          <HelpCircle size={14} className="text-indigo-500" />
          4. Include Rich Schema Fields in Output
        </label>
        <p className="text-[11px] text-[var(--text-muted)]">
          Enable or disable rich fields to embed within each generated question:
        </p>

        <div className="flex flex-wrap gap-2.5">
          <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-subcard)] text-xs font-semibold text-[var(--text-main)] cursor-pointer hover:bg-[var(--bg-subcard-hover)] transition-colors">
            <input
              type="checkbox"
              checked={includeHints}
              onChange={(e) => setIncludeHints(e.target.checked)}
              className="rounded accent-indigo-600"
            />
            <span>Hints (<code className="text-[10px] font-mono text-indigo-400">hint</code>)</span>
          </label>

          <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-subcard)] text-xs font-semibold text-[var(--text-main)] cursor-pointer hover:bg-[var(--bg-subcard-hover)] transition-colors">
            <input
              type="checkbox"
              checked={includeSolutions}
              onChange={(e) => setIncludeSolutions(e.target.checked)}
              className="rounded accent-indigo-600"
            />
            <span>Step Solutions (<code className="text-[10px] font-mono text-indigo-400">solution</code>)</span>
          </label>

          <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-subcard)] text-xs font-semibold text-[var(--text-main)] cursor-pointer hover:bg-[var(--bg-subcard-hover)] transition-colors">
            <input
              type="checkbox"
              checked={includeShortcuts}
              onChange={(e) => setIncludeShortcuts(e.target.checked)}
              className="rounded accent-indigo-600"
            />
            <span>Speed Tricks (<code className="text-[10px] font-mono text-indigo-400">shortcut</code>)</span>
          </label>

          <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-subcard)] text-xs font-semibold text-[var(--text-main)] cursor-pointer hover:bg-[var(--bg-subcard-hover)] transition-colors">
            <input
              type="checkbox"
              checked={includeFormulas}
              onChange={(e) => setIncludeFormulas(e.target.checked)}
              className="rounded accent-indigo-600"
            />
            <span>Formulas (<code className="text-[10px] font-mono text-indigo-400">formula</code>)</span>
          </label>

          <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-subcard)] text-xs font-semibold text-[var(--text-main)] cursor-pointer hover:bg-[var(--bg-subcard-hover)] transition-colors">
            <input
              type="checkbox"
              checked={includeSuggestions}
              onChange={(e) => setIncludeSuggestions(e.target.checked)}
              className="rounded accent-indigo-600"
            />
            <span>Revision Advice (<code className="text-[10px] font-mono text-indigo-400">learningSuggestion</code>)</span>
          </label>

          <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-subcard)] text-xs font-semibold text-[var(--text-main)] cursor-pointer hover:bg-[var(--bg-subcard-hover)] transition-colors">
            <input
              type="checkbox"
              checked={includeTimeEstimate}
              onChange={(e) => setIncludeTimeEstimate(e.target.checked)}
              className="rounded accent-indigo-600"
            />
            <span>Target Seconds (<code className="text-[10px] font-mono text-indigo-400">timeEstimate</code>)</span>
          </label>

          <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-subcard)] text-xs font-semibold text-[var(--text-main)] cursor-pointer hover:bg-[var(--bg-subcard-hover)] transition-colors">
            <input
              type="checkbox"
              checked={includePassages}
              onChange={(e) => setIncludePassages(e.target.checked)}
              className="rounded accent-indigo-600"
            />
            <span>Comprehension Passage (<code className="text-[10px] font-mono text-indigo-400">passage</code>)</span>
          </label>
        </div>
      </div>

      {/* SECTION 6: Generated Prompt Preview & Quick Actions */}
      <div className="space-y-3 pt-2 border-t border-[var(--border-color)]">
        <div className="flex items-center justify-between">
          <label className="text-xs font-extrabold text-[var(--text-main)] uppercase tracking-wider flex items-center gap-1.5">
            <FileCode size={14} className="text-indigo-500" />
            Generated AI Prompt (Ready to Copy to ChatGPT / Gemini / Claude)
          </label>
          <span className="text-[11px] font-semibold text-[var(--text-muted)]">
            {generatedPrompt.length} chars
          </span>
        </div>

        <pre className="p-4 bg-[var(--bg-subcard)] border border-[var(--border-color)] rounded-2xl text-xs text-[var(--text-main)] font-mono overflow-x-auto max-h-56 overflow-y-auto whitespace-pre-wrap selection:bg-indigo-500 selection:text-white">
          {generatedPrompt}
        </pre>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 pt-1">
          <button
            onClick={handleCopyPrompt}
            className="btn btn-primary text-xs py-2.5 px-5 rounded-full font-bold shadow-soft flex items-center gap-1.5"
          >
            {copied ? (
              <>
                <Check size={14} className="text-emerald-400" /> Copied to Clipboard!
              </>
            ) : (
              <>
                <Copy size={14} /> Copy AI Prompt
              </>
            )}
          </button>

          <button
            onClick={handleLoadSampleToEditor}
            className="px-4 py-2.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 text-xs font-bold transition-colors flex items-center gap-1.5 shadow-2xs"
          >
            {sampleLoaded ? (
              <>
                <Check size={14} className="text-emerald-400" /> Loaded into JSON Editor!
              </>
            ) : (
              <>
                <Sparkles size={14} /> Load {effectiveExamName} Sample to Editor
              </>
            )}
          </button>

          <button
            onClick={handleDownloadPrompt}
            className="px-4 py-2.5 rounded-full border border-[var(--border-color)] bg-[var(--bg-subcard)] hover:bg-[var(--bg-subcard-hover)] text-[var(--text-main)] text-xs font-bold transition-colors flex items-center gap-1.5 shadow-2xs"
          >
            <Download size={14} /> Download Prompt (.txt)
          </button>
        </div>
      </div>
    </div>
  );
}
