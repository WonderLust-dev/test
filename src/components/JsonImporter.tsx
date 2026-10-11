import { useState, useRef } from 'react';
import { validatePaperJSON, parsePaperJSON } from '../utils/validator';
import { savePaper, checkDuplicatePaper } from '../services/database';
import { getDemoPaperJSON } from '../utils/demoData';
import { PaperJSON, ValidationResult } from '../types';
import { Upload, FileJson, CheckCircle, AlertTriangle, XCircle, ClipboardPaste, Eye, Download, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';

interface JsonImporterProps {
  userId?: string;
  onImported: () => void;
}

export default function JsonImporter({ userId, onImported }: JsonImporterProps) {
  const [jsonInput, setJsonInput] = useState('');
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [parsedPaper, setParsedPaper] = useState<PaperJSON | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const [duplicateWarning, setDuplicateWarning] = useState('');
  const [showSchema, setShowSchema] = useState(false);
  const [showPromptGen, setShowPromptGen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleValidate = () => {
    const result = validatePaperJSON(jsonInput);
    setValidation(result);
    if (result.valid) {
      const paper = parsePaperJSON(jsonInput);
      setParsedPaper(paper);
      setShowPreview(true);
    } else {
      setParsedPaper(null);
      setShowPreview(false);
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
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleLoadDemo = () => {
    setJsonInput(getDemoPaperJSON());
    setValidation(null);
    setParsedPaper(null);
    setShowPreview(false);
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
    } catch { setImportError('Failed to save.'); }
    setImporting(false);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fadeIn">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 mb-1.5">Import Question Paper</h1>
        <p className="text-xs sm:text-sm text-gray-500">Paste AI-generated JSON, validate schema conformity, and import into your exam library.</p>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-2.5">
        <button onClick={handleLoadDemo} className="flex items-center gap-1.5 px-4 py-2 bg-purple-50 border border-purple-200/60 text-purple-700 rounded-full hover:bg-purple-100 transition-colors text-xs font-bold shadow-2xs">
          <Sparkles size={14} /> Load Demo Paper
        </button>
        <button onClick={() => fileRef.current?.click()} className="flex items-center gap-1.5 px-4 py-2 bg-blue-50 border border-blue-200/60 text-blue-700 rounded-full hover:bg-blue-100 transition-colors text-xs font-bold shadow-2xs">
          <Upload size={14} /> Upload .json File
        </button>
        <button onClick={() => setShowPromptGen(!showPromptGen)} className="flex items-center gap-1.5 px-4 py-2 bg-indigo-50 border border-indigo-200/60 text-indigo-700 rounded-full hover:bg-indigo-100 transition-colors text-xs font-bold shadow-2xs">
          <Sparkles size={14} /> AI Prompt Generator
        </button>
        <button onClick={() => setShowSchema(!showSchema)} className="flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-full hover:bg-gray-50 transition-colors text-xs font-bold shadow-2xs">
          <FileJson size={14} /> {showSchema ? 'Hide' : 'Show'} Schema
        </button>
        <input ref={fileRef} type="file" accept=".json" onChange={handleFileUpload} className="hidden" />
      </div>

      {/* AI Prompt Generator */}
      {showPromptGen && <AIPromptHelper />}

      {/* JSON Schema */}
      {showSchema && (
        <div className="bento-card p-5 bg-white border border-gray-200/80 rounded-3xl shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-gray-900 text-sm">JSON Schema Reference</h3>
            <button onClick={() => { navigator.clipboard.writeText(SCHEMA_EXAMPLE); }} className="text-xs px-3 py-1 bg-gray-100 rounded-full font-bold hover:bg-gray-200 transition-colors">Copy Schema</button>
          </div>
          <pre className="text-xs text-gray-700 overflow-x-auto max-h-64 overflow-y-auto bg-gray-50 p-3 rounded-2xl border border-gray-100 font-mono">{SCHEMA_EXAMPLE}</pre>
        </div>
      )}

      {/* JSON Editor */}
      <div className="bento-card p-5 sm:p-6 bg-white border border-gray-200/80 rounded-3xl shadow-xs">
        <label className="block text-xs font-bold text-gray-700 mb-2">Paste your JSON below</label>
        <textarea
          value={jsonInput}
          onChange={(e) => { setJsonInput(e.target.value); setValidation(null); setParsedPaper(null); }}
          placeholder='Paste your AI-generated question paper JSON here...'
          className="w-full h-64 p-4 font-mono text-xs sm:text-sm bg-gray-50/60 border border-gray-200 rounded-2xl resize-y focus:ring-2 focus:ring-gray-900 focus:outline-none text-gray-900 placeholder-gray-400"
          spellCheck={false}
        />
        <div className="mt-4 flex items-center justify-between">
          <button
            onClick={handleValidate}
            disabled={!jsonInput.trim()}
            className="btn btn-primary text-xs py-2.5 px-6 rounded-full shadow-xs flex items-center gap-1.5 disabled:opacity-50"
          >
            <CheckCircle size={15} /> Validate JSON
          </button>
        </div>
      </div>

      {/* Validation Results */}
      {validation && (
        <div className={`bento-card p-5 sm:p-6 rounded-3xl border shadow-xs ${validation.valid ? 'bg-emerald-50/40 border-emerald-200' : 'bg-rose-50/40 border-rose-200'}`}>
          <div className="flex items-center gap-2 mb-3.5">
            {validation.valid ? <CheckCircle size={20} className="text-emerald-600" /> : <XCircle size={20} className="text-rose-600" />}
            <h3 className={`font-extrabold text-sm ${validation.valid ? 'text-emerald-900' : 'text-rose-900'}`}>
              {validation.valid ? 'JSON is Valid & Ready to Import!' : `Validation Failed (${validation.errors.length} error${validation.errors.length > 1 ? 's' : ''})`}
            </h3>
          </div>

          {validation.valid && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <div className="p-3 bg-white border border-emerald-100 rounded-2xl text-center shadow-2xs">
                <div className="text-lg font-extrabold text-gray-900">{validation.questionCount}</div>
                <div className="text-[11px] font-semibold text-gray-400">Questions</div>
              </div>
              <div className="p-3 bg-white border border-emerald-100 rounded-2xl text-center shadow-2xs">
                <div className="text-lg font-extrabold text-gray-900">{validation.totalMarks}</div>
                <div className="text-[11px] font-semibold text-gray-400">Total Marks</div>
              </div>
              <div className="p-3 bg-white border border-emerald-100 rounded-2xl text-center shadow-2xs">
                <div className="text-lg font-extrabold text-gray-900">{validation.duration}m</div>
                <div className="text-[11px] font-semibold text-gray-400">Duration</div>
              </div>
              <div className="p-3 bg-white border border-emerald-100 rounded-2xl text-center shadow-2xs">
                <div className="text-lg font-extrabold text-gray-900">{validation.subjects.length}</div>
                <div className="text-[11px] font-semibold text-gray-400">Subjects</div>
              </div>
            </div>
          )}

          {validation.errors.length > 0 && (
            <ul className="space-y-1.5 mb-3">
              {validation.errors.map((err, i) => (
                <li key={i} className="text-xs text-rose-700 flex items-start gap-2">
                  <XCircle size={14} className="mt-0.5 shrink-0" />
                  <span><code className="text-xs bg-rose-100 px-1 py-0.5 rounded font-mono">{err.path}</code> — {err.message}</span>
                </li>
              ))}
            </ul>
          )}

          {validation.warnings.length > 0 && (
            <ul className="space-y-1.5">
              {validation.warnings.map((w, i) => (
                <li key={i} className="text-xs text-amber-700 flex items-start gap-2">
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
        <div className="bento-card p-5 bg-amber-50/50 border border-amber-200 rounded-3xl shadow-xs">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={18} className="text-amber-600" />
            <p className="font-bold text-amber-900 text-xs sm:text-sm">{duplicateWarning}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={handleForceImport} className="btn bg-amber-600 text-white hover:bg-amber-700 text-xs py-2 px-4 rounded-full font-bold">Import Anyway</button>
            <button onClick={() => setDuplicateWarning('')} className="btn btn-outline text-xs py-2 px-4 rounded-full font-bold">Cancel</button>
          </div>
        </div>
      )}

      {importError && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs font-semibold">{importError}</div>
      )}

      {/* Preview */}
      {showPreview && parsedPaper && validation?.valid && (
        <div className="bento-card bg-white rounded-3xl border border-gray-200/80 shadow-xs overflow-hidden">
          <button onClick={() => setShowPreview(!showPreview)} className="w-full flex items-center justify-between p-5 hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-2">
              <Eye size={18} className="text-gray-900" />
              <span className="font-extrabold text-gray-900 text-sm">Preview Paper</span>
            </div>
            {showPreview ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
          {showPreview && (
            <div className="p-5 border-t border-gray-100">
              <h4 className="text-base font-extrabold text-gray-900 mb-1">{parsedPaper.paperTitle}</h4>
              <p className="text-xs text-gray-500 mb-3">{parsedPaper.description}</p>
              <div className="flex flex-wrap gap-2 mb-4">
                <span className="px-2.5 py-0.5 bg-gray-100 text-gray-700 rounded-full text-xs font-semibold">{parsedPaper.exam}</span>
                <span className="px-2.5 py-0.5 bg-gray-100 text-gray-700 rounded-full text-xs font-semibold">{parsedPaper.durationMinutes} min</span>
                <span className="px-2.5 py-0.5 bg-gray-100 text-gray-700 rounded-full text-xs font-semibold">{parsedPaper.totalMarks} marks</span>
                {parsedPaper.subjects?.map(s => (
                  <span key={s} className="px-2.5 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs font-semibold">{s}</span>
                ))}
              </div>
              <div className="space-y-2.5 max-h-96 overflow-y-auto">
                {parsedPaper.questions.map((q, idx) => (
                  <div key={idx} className="p-3 bg-gray-50/80 border border-gray-100 rounded-2xl">
                    <p className="text-xs font-bold text-gray-900 mb-1.5">Q{idx + 1}. {q.question}</p>
                    <div className="grid grid-cols-2 gap-1 text-xs text-gray-600">
                      {q.options.map((opt, oi) => (
                        <span key={oi} className={`px-2 py-1 rounded-lg ${oi === q.answerIndex ? 'bg-emerald-100 text-emerald-800 font-bold' : ''}`}>
                          {String.fromCharCode(65 + oi)}) {opt}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Import Button */}
      {validation?.valid && parsedPaper && !duplicateWarning && (
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

// AI Prompt Generator Sub-component
function AIPromptHelper() {
  const [subject, setSubject] = useState('Quantitative Aptitude');
  const [topic, setTopic] = useState('');
  const [count, setCount] = useState(10);
  const [difficulty, setDifficulty] = useState('medium');
  const [includeHints, setIncludeHints] = useState(true);
  const [includeSolutions, setIncludeSolutions] = useState(true);
  const [includeShortcuts, setIncludeShortcuts] = useState(true);
  const [includeSuggestions, setIncludeSuggestions] = useState(true);
  const [copied, setCopied] = useState(false);

  const generatePrompt = () => {
    const parts = [
      `Generate ${count} SSC CGL ${subject} questions`,
      topic ? `on the topic "${topic}"` : '',
      `with ${difficulty} difficulty level.`,
      '',
      'Each question must follow this exact JSON schema:',
      '```',
      JSON.stringify({
        id: "number",
        subject: subject,
        topic: topic || "topic_name",
        difficulty: difficulty,
        question: "Question text here",
        options: ["Option A", "Option B", "Option C", "Option D"],
        correctAnswer: "Exact text of correct option",
        answerIndex: "0-based index of correct option",
        marks: 2,
        negativeMarks: 0.5,
        ...(includeHints && { hint: "A helpful hint" }),
        ...(includeSolutions && { solution: "Step-by-step solution" }),
        ...(includeShortcuts && { shortcut: "Faster method if applicable" }),
        ...(includeSuggestions && { learningSuggestion: "What to practice" }),
      }, null, 2),
      '```',
      '',
      'IMPORTANT RULES:',
      '1. Return ONLY valid JSON — no Markdown, no explanations outside JSON.',
      '2. Wrap the entire output in a paper object with: exam, paperTitle, description, durationMinutes, totalMarks, negativeMarking, difficulty, subjects, questions.',
      '3. Each question must have exactly 4 options with exactly one correct answer.',
      '4. The correctAnswer must exactly match one of the options.',
      '5. The answerIndex must be the 0-based index of the correct option.',
      '6. Verify all calculations are correct.',
      '7. Match SSC CGL exam style and difficulty.',
      '8. Avoid duplicate questions.',
      '9. Provide useful but concise hints and solutions.',
      '10. Provide shortcut methods where mathematically appropriate.',
    ].filter(Boolean);

    return parts.join('\n');
  };

  const prompt = generatePrompt();

  const handleCopy = () => {
    navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bento-card p-5 sm:p-6 bg-white border border-indigo-100 rounded-3xl shadow-xs space-y-4">
      <h3 className="font-extrabold text-gray-900 text-sm flex items-center gap-2">
        <Sparkles size={16} className="text-indigo-600" /> AI Question Generator — Prompt Builder
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <div>
          <label className="text-xs font-bold text-gray-700 mb-1 block">Subject</label>
          <select value={subject} onChange={e => setSubject(e.target.value)} className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-900">
            <option>Quantitative Aptitude</option>
            <option>General Intelligence & Reasoning</option>
            <option>English Comprehension</option>
            <option>General Awareness</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-bold text-gray-700 mb-1 block">Topic (optional)</label>
          <input value={topic} onChange={e => setTopic(e.target.value)} placeholder="e.g., Percentage" className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-900 placeholder-gray-400" />
        </div>
        <div>
          <label className="text-xs font-bold text-gray-700 mb-1 block">Number of Questions</label>
          <input type="number" min={1} max={100} value={count} onChange={e => setCount(Number(e.target.value))} className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-900" />
        </div>
        <div>
          <label className="text-xs font-bold text-gray-700 mb-1 block">Difficulty</label>
          <select value={difficulty} onChange={e => setDifficulty(e.target.value)} className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-900">
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold text-gray-700 mb-1 block">Include Extras:</label>
          <div className="flex flex-wrap gap-2.5">
            <label className="flex items-center gap-1 text-xs text-gray-600 font-medium"><input type="checkbox" checked={includeHints} onChange={e => setIncludeHints(e.target.checked)} className="rounded" /> Hints</label>
            <label className="flex items-center gap-1 text-xs text-gray-600 font-medium"><input type="checkbox" checked={includeSolutions} onChange={e => setIncludeSolutions(e.target.checked)} className="rounded" /> Solutions</label>
            <label className="flex items-center gap-1 text-xs text-gray-600 font-medium"><input type="checkbox" checked={includeShortcuts} onChange={e => setIncludeShortcuts(e.target.checked)} className="rounded" /> Shortcuts</label>
            <label className="flex items-center gap-1 text-xs text-gray-600 font-medium"><input type="checkbox" checked={includeSuggestions} onChange={e => setIncludeSuggestions(e.target.checked)} className="rounded" /> Suggestions</label>
          </div>
        </div>
      </div>
      <div>
        <label className="text-xs font-bold text-gray-700 mb-1 block">Generated Prompt:</label>
        <pre className="p-3 bg-gray-50 border border-gray-200 rounded-2xl text-xs text-gray-800 overflow-x-auto max-h-48 overflow-y-auto whitespace-pre-wrap font-mono">{prompt}</pre>
      </div>
      <div className="flex gap-2">
        <button onClick={handleCopy} className="btn btn-primary text-xs py-2 px-4 rounded-full flex items-center gap-1.5 shadow-2xs">
          <ClipboardPaste size={14} /> {copied ? 'Copied to Clipboard!' : 'Copy AI Prompt'}
        </button>
      </div>
    </div>
  );
}

const SCHEMA_EXAMPLE = `{
  "exam": "SSC CGL",
  "paperTitle": "Your Paper Title",
  "description": "Brief description",
  "durationMinutes": 60,
  "totalMarks": 100,
  "negativeMarking": 0.5,
  "difficulty": "medium",
  "subjects": ["Quantitative Aptitude", "General Intelligence & Reasoning", "English Comprehension", "General Awareness"],
  "questions": [
    {
      "id": 1,
      "subject": "Quantitative Aptitude",
      "topic": "Percentage",
      "subtopic": "Successive Percentage",
      "difficulty": "medium",
      "question": "Question text here?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": "Option B",
      "answerIndex": 1,
      "marks": 2,
      "negativeMarks": 0.5,
      "hint": "A helpful hint for the student",
      "solution": "Step-by-step solution...",
      "method": "Standard method explanation",
      "shortcut": "Faster approach",
      "learningSuggestion": "What to practice next",
      "timeEstimate": 60,
      "tags": ["ssc-cgl", "quant"],
      "source": "Previous year paper",
      "image": "https://example.com/image.png",
      "formula": "A = P(1 + r/100)^n",
      "passage": "For English comprehension questions"
    }
  ]
}`;
