import { useState, useRef } from 'react';
import { validateInputJSON } from '../utils/validator';
import { savePaper, savePapersBatch, checkDuplicatePaper } from '../services/database';
import { getDemoPaperJSON } from '../utils/demoData';
import { PaperJSON, ValidationResult, BatchValidationResult } from '../types';
import ExamAIPromptBuilder from './ExamAIPromptBuilder';
import JsonSchemaExplorer from './JsonSchemaExplorer';
import {
  Upload,
  FileJson,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Eye,
  Download,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Layers,
  CheckSquare,
  Square,
  Code2,
  Trash2,
  Check,
} from 'lucide-react';

interface JsonImporterProps {
  userId?: string;
  onImported: () => void;
}

export default function JsonImporter({ userId, onImported }: JsonImporterProps) {
  const [jsonInput, setJsonInput] = useState('');
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [parsedPaper, setParsedPaper] = useState<PaperJSON | null>(null);
  const [batchValidation, setBatchValidation] = useState<BatchValidationResult | null>(null);
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [previewItemIndex, setPreviewItemIndex] = useState<number | null>(null);
  const [batchSuccessMessage, setBatchSuccessMessage] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const [duplicateWarning, setDuplicateWarning] = useState('');
  const [showSchema, setShowSchema] = useState(false);
  const [showPromptGen, setShowPromptGen] = useState(false);
  const [activePromptExamId, setActivePromptExamId] = useState<string>('ssc_cgl');
  const [formatSuccess, setFormatSuccess] = useState(false);
  const [formatError, setFormatError] = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const promptGenRef = useRef<HTMLDivElement>(null);

  const handleValidate = () => {
    setBatchSuccessMessage(null);
    setImportError('');
    setDuplicateWarning('');

    const result = validateInputJSON(jsonInput);
    if (result.isBatch) {
      setBatchValidation(result);
      setSelectedIndices(result.items.filter((it) => it.validation.valid).map((it) => it.index));
      setValidation(null);
      setParsedPaper(null);
      setShowPreview(false);
    } else {
      setBatchValidation(null);
      setSelectedIndices([]);
      setValidation(result.singleResult || null);
      if (result.singleResult?.valid && result.singlePaper) {
        setParsedPaper(result.singlePaper);
        setShowPreview(true);
      } else {
        setParsedPaper(null);
        setShowPreview(false);
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      setJsonInput(content);
      setValidation(null);
      setParsedPaper(null);
      setBatchValidation(null);
      setBatchSuccessMessage(null);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleLoadDemo = () => {
    setJsonInput(getDemoPaperJSON());
    setValidation(null);
    setParsedPaper(null);
    setBatchValidation(null);
    setBatchSuccessMessage(null);
    setShowPreview(false);
  };

  const handleInsertFromHelper = (sampleJson: string) => {
    setJsonInput(sampleJson);
    setValidation(null);
    setParsedPaper(null);
    setBatchValidation(null);
    setBatchSuccessMessage(null);
    setShowPreview(false);
    // Smooth scroll down to the editor
    setTimeout(() => {
      editorRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handlePrettifyJson = () => {
    if (!jsonInput.trim()) return;
    try {
      const parsed = JSON.parse(jsonInput);
      setJsonInput(JSON.stringify(parsed, null, 2));
      setFormatSuccess(true);
      setFormatError(null);
      setTimeout(() => setFormatSuccess(false), 2000);
    } catch (err: unknown) {
      setFormatError(err instanceof Error ? err.message : 'Invalid JSON syntax');
      setTimeout(() => setFormatError(null), 3500);
    }
  };

  const handleClearEditor = () => {
    setJsonInput('');
    setValidation(null);
    setParsedPaper(null);
    setBatchValidation(null);
    setBatchSuccessMessage(null);
    setDuplicateWarning('');
    setImportError('');
    setShowPreview(false);
  };

  const handleSelectExamFromCheatSheet = (presetId: string) => {
    setActivePromptExamId(presetId);
    setShowPromptGen(true);
    setTimeout(() => {
      promptGenRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleToggleSelect = (index: number) => {
    setSelectedIndices((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    );
  };

  const handleSelectAll = (select: boolean) => {
    if (!batchValidation) return;
    if (select) {
      setSelectedIndices(batchValidation.items.filter((it) => it.validation.valid).map((it) => it.index));
    } else {
      setSelectedIndices([]);
    }
  };

  const handleBatchImport = async () => {
    if (!batchValidation) return;
    const selectedItems = batchValidation.items.filter(
      (it) => selectedIndices.includes(it.index) && it.validation.valid && it.paper
    );
    if (selectedItems.length === 0) return;

    setImporting(true);
    setImportError('');
    setBatchSuccessMessage(null);

    try {
      const papersToSave = selectedItems.map((it) => {
        const p = it.paper!;
        return {
          user_id: userId || 'guest',
          exam: p.exam || 'SSC CGL',
          title: p.paperTitle,
          description: p.description || '',
          difficulty: p.difficulty || 'medium',
          duration_minutes: p.durationMinutes,
          total_marks: p.totalMarks || it.validation.totalMarks,
          negative_marking: p.negativeMarking || 0,
          question_count: p.questions.length,
          subjects: p.subjects || it.validation.subjects,
          raw_json: p,
          is_demo: false,
          visibility: 'private' as const,
        };
      });

      await savePapersBatch(papersToSave);
      setBatchSuccessMessage(
        `Successfully imported ${papersToSave.length} question paper${
          papersToSave.length > 1 ? 's' : ''
        } to your library!`
      );
      setTimeout(() => {
        setJsonInput('');
        setBatchValidation(null);
        setSelectedIndices([]);
        onImported();
      }, 1500);
    } catch (err) {
      setImportError('Failed to import batch papers. Please try again.');
      console.error(err);
    } finally {
      setImporting(false);
    }
  };

  const handleImport = async () => {
    if (!parsedPaper || !validation?.valid) return;
    setImporting(true);
    setImportError('');
    setDuplicateWarning('');

    // Check for duplicates
    const existing = await checkDuplicatePaper(parsedPaper.paperTitle, userId);
    if (existing) {
      setDuplicateWarning(`A paper titled "${parsedPaper.paperTitle}" already exists.`);
      setImporting(false);
      return;
    }

    try {
      await savePaper({
        user_id: userId || 'guest',
        exam: parsedPaper.exam || 'SSC CGL',
        title: parsedPaper.paperTitle,
        description: parsedPaper.description || '',
        difficulty: parsedPaper.difficulty || 'medium',
        duration_minutes: parsedPaper.durationMinutes,
        total_marks: parsedPaper.totalMarks || validation.totalMarks,
        negative_marking: parsedPaper.negativeMarking || 0,
        question_count: parsedPaper.questions.length,
        subjects: parsedPaper.subjects || validation.subjects,
        raw_json: parsedPaper,
        is_demo: false,
        visibility: 'private',
      });
      setJsonInput('');
      setValidation(null);
      setParsedPaper(null);
      setShowPreview(false);
      onImported();
    } catch (err) {
      setImportError('Failed to save paper. Please try again.');
      console.error(err);
    }
    setImporting(false);
  };

  const handleForceImport = async () => {
    if (!parsedPaper) return;
    setImporting(true);
    try {
      await savePaper({
        user_id: userId || 'guest',
        exam: parsedPaper.exam || 'SSC CGL',
        title: parsedPaper.paperTitle + ' (Copy)',
        description: parsedPaper.description || '',
        difficulty: parsedPaper.difficulty || 'medium',
        duration_minutes: parsedPaper.durationMinutes,
        total_marks: parsedPaper.totalMarks || validation!.totalMarks,
        negative_marking: parsedPaper.negativeMarking || 0,
        question_count: parsedPaper.questions.length,
        subjects: parsedPaper.subjects || validation!.subjects,
        raw_json: parsedPaper,
        is_demo: false,
        visibility: 'private',
      });
      setDuplicateWarning('');
      setJsonInput('');
      setValidation(null);
      setParsedPaper(null);
      setShowPreview(false);
      onImported();
    } catch {
      setImportError('Failed to save.');
    }
    setImporting(false);
  };

  const lineCount = jsonInput ? jsonInput.split('\n').length : 0;
  const charCount = jsonInput.length;

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fadeIn pb-12">
      {/* Title & Description */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--text-main)] mb-1.5">
          Import Question Paper
        </h1>
        <p className="text-xs sm:text-sm text-[var(--text-muted)]">
          Paste AI-generated JSON, validate schema conformity, and import into your exam library across SSC, Railways, Banking, UPSC, State PSCs, and Teaching exams.
        </p>
      </div>

      {/* Quick Action Toolbar */}
      <div className="flex flex-wrap items-center gap-2.5">
        <button
          onClick={handleLoadDemo}
          className="flex items-center gap-1.5 px-4 py-2 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-full hover:bg-purple-500/20 transition-colors text-xs font-bold shadow-2xs"
        >
          <Sparkles size={14} /> Load Demo Paper
        </button>
        <button
          onClick={() => fileRef.current?.click()}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-full hover:bg-blue-500/20 transition-colors text-xs font-bold shadow-2xs"
        >
          <Upload size={14} /> Upload .json File
        </button>
        <button
          onClick={() => setShowPromptGen(!showPromptGen)}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-full transition-colors text-xs font-bold shadow-2xs ${
            showPromptGen
              ? 'bg-indigo-600 text-white'
              : 'bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/20'
          }`}
        >
          <Sparkles size={14} /> AI Prompt Generator {showPromptGen ? '▲' : '▼'}
        </button>
        <button
          onClick={() => setShowSchema(!showSchema)}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-full transition-colors text-xs font-bold shadow-2xs ${
            showSchema
              ? 'bg-indigo-600 text-white'
              : 'bg-[var(--bg-subcard)] border border-[var(--border-color)] text-[var(--text-main)] hover:bg-[var(--bg-subcard-hover)]'
          }`}
        >
          <FileJson size={14} /> {showSchema ? 'Hide' : 'Show'} Schema & Marking Reference
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".json"
          onChange={handleFileUpload}
          className="hidden"
        />
      </div>

      {/* Interactive AI Prompt Generator (with references to all exams & subjects) */}
      {showPromptGen && (
        <div ref={promptGenRef}>
          <ExamAIPromptBuilder
            onLoadSample={handleInsertFromHelper}
            initialExamId={activePromptExamId}
          />
        </div>
      )}

      {/* Interactive JSON Schema & Examination Marking Reference */}
      {showSchema && (
        <JsonSchemaExplorer
          onInsertTemplate={handleInsertFromHelper}
          onSelectExamForPrompt={handleSelectExamFromCheatSheet}
        />
      )}

      {/* JSON Editor & Validation Section */}
      <div
        ref={editorRef}
        className="bento-card p-5 sm:p-6 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-3xl shadow-sm space-y-3"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <label className="block text-xs font-extrabold text-[var(--text-main)] uppercase tracking-wider">
              Paste or Edit JSON Below
            </label>
            <span className="text-[11px] text-[var(--text-muted)]">
              Accepts single paper objects or batch paper arrays <code className="text-indigo-400">[&#123;...&#125;]</code>.
            </span>
          </div>

          {/* Editor Action Buttons */}
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={handlePrettifyJson}
              disabled={!jsonInput.trim()}
              className="px-3 py-1.5 rounded-full border border-[var(--border-color)] bg-[var(--bg-subcard)] hover:bg-[var(--bg-subcard-hover)] text-xs font-bold text-[var(--text-main)] transition-colors flex items-center gap-1.5 disabled:opacity-40"
              title="Auto-format and indent JSON"
            >
              <Code2 size={13} /> Prettify
            </button>
            <button
              onClick={handleClearEditor}
              disabled={!jsonInput.trim()}
              className="px-3 py-1.5 rounded-full border border-[var(--border-color)] bg-[var(--bg-subcard)] hover:bg-rose-500/10 hover:border-rose-500/30 text-xs font-bold text-[var(--text-muted)] hover:text-rose-400 transition-colors flex items-center gap-1.5 disabled:opacity-40"
              title="Clear editor contents"
            >
              <Trash2 size={13} /> Clear
            </button>
          </div>
        </div>

        {/* Format Success / Error Toasts */}
        {formatSuccess && (
          <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 flex items-center gap-1.5">
            <Check size={14} /> JSON formatted cleanly!
          </div>
        )}
        {formatError && (
          <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400 flex items-center gap-1.5">
            <XCircle size={14} /> Syntax Error: {formatError}
          </div>
        )}

        {/* Textarea */}
        <textarea
          value={jsonInput}
          onChange={(e) => {
            setJsonInput(e.target.value);
            setValidation(null);
            setParsedPaper(null);
          }}
          placeholder="Paste your AI-generated question paper JSON here (or click 'Load Demo Paper' or 'AI Prompt Generator')..."
          className="w-full h-72 p-4 font-mono text-xs sm:text-sm bg-[var(--bg-subcard)] border border-[var(--border-color)] rounded-2xl resize-y focus:ring-2 focus:ring-indigo-500 focus:outline-none text-[var(--text-main)] placeholder-[var(--text-subtle)]"
          spellCheck={false}
        />

        {/* Editor Bottom Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          <div className="text-[11px] font-semibold text-[var(--text-muted)] flex items-center gap-3">
            <span>{lineCount} lines</span>
            <span>•</span>
            <span>{charCount} characters</span>
          </div>

          <button
            onClick={handleValidate}
            disabled={!jsonInput.trim()}
            className="btn btn-primary text-xs py-2.5 px-6 rounded-full shadow-soft flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <CheckCircle size={15} /> Validate JSON Conformance
          </button>
        </div>
      </div>

      {/* Success Notification */}
      {batchSuccessMessage && (
        <div className="bento-card p-5 bg-emerald-500/10 border border-emerald-500/30 rounded-3xl shadow-xs flex items-center gap-3">
          <CheckCircle size={24} className="text-emerald-500 shrink-0" />
          <div>
            <h3 className="font-extrabold text-sm text-emerald-950 dark:text-emerald-200">
              {batchSuccessMessage}
            </h3>
            <p className="text-xs text-emerald-700 dark:text-emerald-300">
              Redirecting to your exam library...
            </p>
          </div>
        </div>
      )}

      {/* Batch Validation Results */}
      {batchValidation && (
        <div className="space-y-4">
          <div className="bento-card p-5 sm:p-6 rounded-3xl border border-[var(--border-color)] bg-[var(--bg-surface)] shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-4 border-b border-[var(--border-color)]">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-2xl bg-indigo-500/10 text-indigo-500">
                  <Layers size={22} />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base text-[var(--text-main)]">
                    Batch Import Detected ({batchValidation.totalPapers} Paper Sets)
                  </h3>
                  <p className="text-xs text-[var(--text-muted)]">
                    Multiple JSON papers found. Choose which papers to import into your library.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => handleSelectAll(selectedIndices.length !== batchValidation.validCount)}
                  className="px-3 py-1.5 rounded-full border border-[var(--border-color)] bg-[var(--bg-subcard)] text-[var(--text-main)] text-xs font-bold hover:bg-[var(--bg-subcard-hover)] transition-colors flex items-center gap-1.5"
                >
                  {selectedIndices.length === batchValidation.validCount ? (
                    <>
                      <Square size={13} /> Deselect All
                    </>
                  ) : (
                    <>
                      <CheckSquare size={13} /> Select All Valid ({batchValidation.validCount})
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Batch Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              <div className="p-3 bg-[var(--bg-subcard)] border border-[var(--border-color)] rounded-2xl text-center shadow-2xs">
                <div className="text-xl font-extrabold text-[var(--text-main)]">
                  {batchValidation.totalPapers}
                </div>
                <div className="text-[11px] font-semibold text-[var(--text-muted)]">Total Papers</div>
              </div>
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-center shadow-2xs">
                <div className="text-xl font-extrabold text-emerald-500">
                  {batchValidation.validCount}
                </div>
                <div className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                  Valid & Ready
                </div>
              </div>
              <div className="p-3 bg-[var(--bg-subcard)] border border-[var(--border-color)] rounded-2xl text-center shadow-2xs">
                <div className="text-xl font-extrabold text-[var(--text-main)]">
                  {batchValidation.items.reduce((acc, it) => acc + it.validation.questionCount, 0)}
                </div>
                <div className="text-[11px] font-semibold text-[var(--text-muted)]">
                  Total Questions
                </div>
              </div>
              <div className="p-3 bg-[var(--bg-subcard)] border border-[var(--border-color)] rounded-2xl text-center shadow-2xs">
                <div className="text-xl font-extrabold text-[var(--text-main)]">
                  {batchValidation.items.reduce((acc, it) => acc + it.validation.totalMarks, 0)}
                </div>
                <div className="text-[11px] font-semibold text-[var(--text-muted)]">
                  Total Marks
                </div>
              </div>
            </div>

            {/* Batch Action Banner */}
            {selectedIndices.length > 0 && (
              <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="text-xs">
                  <span className="font-extrabold text-indigo-400">
                    {selectedIndices.length} of {batchValidation.validCount} valid papers selected
                  </span>
                  <p className="text-[var(--text-muted)]">
                    All selected papers will be created as individual test sets in your library.
                  </p>
                </div>
                <button
                  onClick={handleBatchImport}
                  disabled={importing}
                  className="btn btn-primary text-xs py-2.5 px-6 rounded-full font-bold shadow-soft flex items-center justify-center gap-2 shrink-0 disabled:opacity-50"
                >
                  <Download size={15} />
                  {importing ? 'Importing Batch...' : `Import All ${selectedIndices.length} Papers`}
                </button>
              </div>
            )}
          </div>

          {/* List of Detected Papers */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider px-1">
              Detected Papers ({batchValidation.items.length})
            </h4>

            {batchValidation.items.map((item) => {
              const isSelected = selectedIndices.includes(item.index);
              const isValid = item.validation.valid;
              const isExpanded = previewItemIndex === item.index;

              return (
                <div
                  key={item.index}
                  className={`bento-card rounded-2xl border transition-all ${
                    isValid
                      ? isSelected
                        ? 'border-indigo-500/40 bg-[var(--bg-surface)] shadow-xs'
                        : 'border-[var(--border-color)] bg-[var(--bg-surface)] opacity-80'
                      : 'border-rose-500/30 bg-rose-500/5'
                  }`}
                >
                  <div className="p-4 flex items-start gap-3">
                    <input
                      type="checkbox"
                      disabled={!isValid}
                      checked={isSelected}
                      onChange={() => handleToggleSelect(item.index)}
                      className="mt-1 rounded cursor-pointer accent-indigo-600 w-4 h-4"
                    />

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-md bg-[var(--bg-subcard)] border border-[var(--border-color)] text-[var(--text-main)]">
                          #{item.index + 1}
                        </span>
                        <h4 className="font-extrabold text-sm text-[var(--text-main)] truncate max-w-sm sm:max-w-md">
                          {item.title}
                        </h4>
                        {isValid ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 border border-emerald-500/25 flex items-center gap-1">
                            <CheckCircle size={10} /> Valid
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-500 border border-rose-500/25 flex items-center gap-1">
                            <XCircle size={10} /> {item.validation.errors.length} Errors
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)]">
                        <span>{item.validation.questionCount} Questions</span>
                        <span>•</span>
                        <span>{item.validation.duration} min</span>
                        <span>•</span>
                        <span>{item.validation.totalMarks} Marks</span>
                        {item.validation.subjects.length > 0 && (
                          <>
                            <span>•</span>
                            <span className="truncate max-w-[200px]">
                              {item.validation.subjects.join(', ')}
                            </span>
                          </>
                        )}
                      </div>

                      {/* Item validation errors */}
                      {!isValid && item.validation.errors.length > 0 && (
                        <div className="mt-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400 space-y-1">
                          {item.validation.errors.slice(0, 3).map((err, ei) => (
                            <div key={ei} className="flex items-start gap-1.5">
                              <XCircle size={12} className="mt-0.5 shrink-0" />
                              <span>{err.message}</span>
                            </div>
                          ))}
                          {item.validation.errors.length > 3 && (
                            <p className="text-[11px] font-semibold text-rose-300">
                              + {item.validation.errors.length - 3} more errors
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Preview Toggle Button */}
                    {isValid && item.paper && (
                      <button
                        onClick={() => setPreviewItemIndex(isExpanded ? null : item.index)}
                        className="p-1.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-subcard)] hover:bg-[var(--bg-subcard-hover)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors shrink-0"
                        title="Preview Questions"
                      >
                        {isExpanded ? <ChevronUp size={16} /> : <Eye size={16} />}
                      </button>
                    )}
                  </div>

                  {/* Expanded Mini Question Preview */}
                  {isExpanded && item.paper && (
                    <div className="p-4 pt-0 border-t border-[var(--border-color)] space-y-2 mt-2">
                      <p className="text-xs font-bold text-[var(--text-muted)] pt-3">
                        First Questions Sample:
                      </p>
                      <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                        {item.paper.questions.slice(0, 5).map((pq, pqi) => (
                          <div
                            key={pqi}
                            className="p-2.5 rounded-xl bg-[var(--bg-subcard)] border border-[var(--border-color)] text-xs"
                          >
                            <span className="font-bold text-[var(--text-main)]">
                              Q{pqi + 1}. {pq.question}
                            </span>
                            <div className="text-[11px] text-[var(--text-muted)] mt-1">
                              Answer: Option {String.fromCharCode(65 + pq.answerIndex)} (
                              {pq.options[pq.answerIndex]})
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Single Paper Validation Results */}
      {!batchValidation && validation && (
        <div
          className={`bento-card p-5 sm:p-6 rounded-3xl border shadow-xs ${
            validation.valid
              ? 'bg-emerald-500/10 border-emerald-500/25'
              : 'bg-rose-500/10 border-rose-500/25'
          }`}
        >
          <div className="flex items-center gap-2 mb-3.5">
            {validation.valid ? (
              <CheckCircle size={20} className="text-emerald-500" />
            ) : (
              <XCircle size={20} className="text-rose-500" />
            )}
            <h3
              className={`font-extrabold text-sm ${
                validation.valid ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {validation.valid
                ? 'JSON is Valid & Ready to Import!'
                : `Validation Failed (${validation.errors.length} error${
                    validation.errors.length > 1 ? 's' : ''
                  })`}
            </h3>
          </div>

          {validation.valid && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <div className="p-3 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl text-center shadow-2xs">
                <div className="text-lg font-extrabold text-[var(--text-main)]">
                  {validation.questionCount}
                </div>
                <div className="text-[11px] font-semibold text-[var(--text-muted)]">Questions</div>
              </div>
              <div className="p-3 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl text-center shadow-2xs">
                <div className="text-lg font-extrabold text-[var(--text-main)]">
                  {validation.totalMarks}
                </div>
                <div className="text-[11px] font-semibold text-[var(--text-muted)]">Total Marks</div>
              </div>
              <div className="p-3 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl text-center shadow-2xs">
                <div className="text-lg font-extrabold text-[var(--text-main)]">
                  {validation.duration}m
                </div>
                <div className="text-[11px] font-semibold text-[var(--text-muted)]">Duration</div>
              </div>
              <div className="p-3 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl text-center shadow-2xs">
                <div className="text-lg font-extrabold text-[var(--text-main)]">
                  {validation.subjects.length}
                </div>
                <div className="text-[11px] font-semibold text-[var(--text-muted)]">Subjects</div>
              </div>
            </div>
          )}

          {validation.errors.length > 0 && (
            <ul className="space-y-1.5 mb-3">
              {validation.errors.map((err, i) => (
                <li key={i} className="text-xs text-rose-400 flex items-start gap-2">
                  <XCircle size={14} className="mt-0.5 shrink-0" />
                  <span>
                    <code className="text-xs bg-rose-500/20 px-1 py-0.5 rounded font-mono text-rose-300">
                      {err.path}
                    </code>{' '}
                    — {err.message}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {validation.warnings.length > 0 && (
            <ul className="space-y-1.5">
              {validation.warnings.map((w, i) => (
                <li key={i} className="text-xs text-amber-400 flex items-start gap-2">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                  <span>{w.message}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Duplicate Warning */}
      {duplicateWarning && (
        <div className="bento-card p-5 bg-amber-500/10 border border-amber-500/25 rounded-3xl shadow-xs">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={18} className="text-amber-500" />
            <p className="font-bold text-amber-300 text-xs sm:text-sm">{duplicateWarning}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleForceImport}
              className="btn bg-amber-600 text-white hover:bg-amber-700 text-xs py-2 px-4 rounded-full font-bold"
            >
              Import Anyway
            </button>
            <button
              onClick={() => setDuplicateWarning('')}
              className="btn btn-outline text-xs py-2 px-4 rounded-full font-bold"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {importError && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/25 rounded-2xl text-rose-400 text-xs font-semibold">
          {importError}
        </div>
      )}

      {/* Single Paper Preview */}
      {!batchValidation && showPreview && parsedPaper && validation?.valid && (
        <div className="bento-card bg-[var(--bg-surface)] rounded-3xl border border-[var(--border-color)] shadow-xs overflow-hidden">
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="w-full flex items-center justify-between p-5 hover:bg-[var(--bg-subcard-hover)] transition-colors"
          >
            <div className="flex items-center gap-2">
              <Eye size={18} className="text-[var(--text-main)]" />
              <span className="font-extrabold text-[var(--text-main)] text-sm">Preview Paper</span>
            </div>
            {showPreview ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
          {showPreview && (
            <div className="p-5 border-t border-[var(--border-color)] space-y-4">
              <div>
                <h4 className="text-base font-extrabold text-[var(--text-main)] mb-1">
                  {parsedPaper.paperTitle}
                </h4>
                {parsedPaper.description && (
                  <p className="text-xs text-[var(--text-muted)]">{parsedPaper.description}</p>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <span className="px-2.5 py-0.5 bg-[var(--bg-subcard)] border border-[var(--border-color)] text-[var(--text-main)] rounded-full text-xs font-semibold">
                  {parsedPaper.exam || 'Competitive Exam'}
                </span>
                <span className="px-2.5 py-0.5 bg-[var(--bg-subcard)] border border-[var(--border-color)] text-[var(--text-main)] rounded-full text-xs font-semibold">
                  {parsedPaper.durationMinutes} min
                </span>
                <span className="px-2.5 py-0.5 bg-[var(--bg-subcard)] border border-[var(--border-color)] text-[var(--text-main)] rounded-full text-xs font-semibold">
                  {parsedPaper.totalMarks} marks
                </span>
                {parsedPaper.subjects?.map((s) => (
                  <span
                    key={s}
                    className="px-2.5 py-0.5 bg-indigo-500/15 border border-indigo-500/20 text-indigo-400 rounded-full text-xs font-semibold"
                  >
                    {s}
                  </span>
                ))}
              </div>

              <div className="space-y-2.5 max-h-96 overflow-y-auto custom-scrollbar">
                {parsedPaper.questions.map((q, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 bg-[var(--bg-subcard)] border border-[var(--border-color)] rounded-2xl space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-bold text-[var(--text-main)]">
                        Q{idx + 1}. {q.question}
                      </p>
                      {q.difficulty && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-muted)] shrink-0">
                          {q.difficulty}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
                      {q.options.map((opt, oi) => {
                        const isCorrect = oi === q.answerIndex;
                        return (
                          <div
                            key={oi}
                            className={`px-2.5 py-1.5 rounded-xl border transition-colors ${
                              isCorrect
                                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 font-bold'
                                : 'bg-[var(--bg-surface)] border-[var(--border-color)] text-[var(--text-muted)]'
                            }`}
                          >
                            <span className="font-semibold mr-1.5">
                              {String.fromCharCode(65 + oi)})
                            </span>
                            {opt}
                          </div>
                        );
                      })}
                    </div>

                    {q.solution && (
                      <div className="p-2.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)] text-[11px] text-[var(--text-muted)]">
                        <span className="font-bold text-indigo-400 mr-1">Solution:</span>
                        {q.solution}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Single Paper Import Button */}
      {!batchValidation && validation?.valid && parsedPaper && !duplicateWarning && (
        <div className="pt-2">
          <button
            onClick={handleImport}
            disabled={importing}
            className="btn btn-primary text-xs py-3 px-8 rounded-full font-bold shadow-soft flex items-center gap-2"
          >
            <Download size={16} /> {importing ? 'Importing...' : 'Confirm & Import to Library'}
          </button>
        </div>
      )}
    </div>
  );
}
