import { useState, useMemo } from 'react';
import {
  SCHEMA_DOCS,
  EXAM_PRESETS,
  ExamPreset,
  generateSamplePaperJSON,
  SchemaFieldDoc,
} from '../utils/examReferenceData';
import {
  FileJson,
  Search,
  Copy,
  Check,
  Download,
  Table,
  Code2,
  Sparkles,
  ArrowRight,
  BookOpen,
} from 'lucide-react';

interface JsonSchemaExplorerProps {
  onInsertTemplate: (templateJson: string) => void;
  onSelectExamForPrompt?: (presetId: string) => void;
}

export default function JsonSchemaExplorer({
  onInsertTemplate,
  onSelectExamForPrompt,
}: JsonSchemaExplorerProps) {
  const [activeTab, setActiveTab] = useState<'fields' | 'template' | 'cheatsheet'>('fields');

  // Search & Filter state for Field Explorer
  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState<'all' | 'paper' | 'question'>('all');
  const [requiredFilter, setRequiredFilter] = useState<'all' | 'required' | 'optional'>('all');

  // Active Preset for Live Template
  const [selectedTemplateExamId, setSelectedTemplateExamId] = useState<string>('ssc_cgl');

  // Feedback states
  const [copiedExampleKey, setCopiedExampleKey] = useState<string | null>(null);
  const [templateCopied, setTemplateCopied] = useState<boolean>(false);
  const [templateInserted, setTemplateInserted] = useState<boolean>(false);

  // Filtered Schema Docs
  const filteredFields = useMemo(() => {
    return SCHEMA_DOCS.filter((field: SchemaFieldDoc) => {
      // Level filter
      if (levelFilter !== 'all' && field.level !== levelFilter) return false;

      // Required filter
      if (requiredFilter === 'required' && !field.required) return false;
      if (requiredFilter === 'optional' && field.required) return false;

      // Text search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = field.name.toLowerCase().includes(q);
        const matchesType = field.type.toLowerCase().includes(q);
        const matchesDesc = field.description.toLowerCase().includes(q);
        const matchesEx = field.example.toLowerCase().includes(q);
        if (!matchesName && !matchesType && !matchesDesc && !matchesEx) return false;
      }

      return true;
    });
  }, [searchQuery, levelFilter, requiredFilter]);

  // Active Template Exam Preset
  const activeTemplatePreset = useMemo(() => {
    return EXAM_PRESETS.find((p) => p.id === selectedTemplateExamId) || EXAM_PRESETS[0];
  }, [selectedTemplateExamId]);

  // Generated JSON Template
  const liveTemplateJson = useMemo(() => {
    return generateSamplePaperJSON(activeTemplatePreset);
  }, [activeTemplatePreset]);

  // Copy Example Snippet
  const handleCopyExample = async (key: string, exampleText: string) => {
    try {
      await navigator.clipboard.writeText(exampleText);
      setCopiedExampleKey(key);
      setTimeout(() => setCopiedExampleKey(null), 1800);
    } catch {
      // ignore
    }
  };

  // Copy Live Template
  const handleCopyTemplate = async () => {
    try {
      await navigator.clipboard.writeText(liveTemplateJson);
      setTemplateCopied(true);
      setTimeout(() => setTemplateCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  // Insert Template into Editor
  const handleInsert = () => {
    onInsertTemplate(liveTemplateJson);
    setTemplateInserted(true);
    setTimeout(() => setTemplateInserted(false), 2200);
  };

  // Download Template JSON
  const handleDownloadTemplate = () => {
    const blob = new Blob([liveTemplateJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeTemplatePreset.id}_template.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bento-card p-5 sm:p-6 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-3xl shadow-sm space-y-5 animate-fadeIn">
      {/* Header and Tab Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[var(--border-color)]">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-2xl bg-indigo-500/10 text-indigo-500">
              <FileJson size={20} />
            </div>
            <h3 className="font-extrabold text-base sm:text-lg text-[var(--text-main)]">
              Interactive JSON Schema & Examination Reference
            </h3>
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Complete field specifications, types, validation rules, live templates, and marking schemes.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 p-1 bg-[var(--bg-subcard)] border border-[var(--border-color)] rounded-full text-xs font-bold self-start sm:self-auto">
          <button
            onClick={() => setActiveTab('fields')}
            className={`px-3 py-1.5 rounded-full transition-all flex items-center gap-1.5 ${
              activeTab === 'fields'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            <Search size={13} /> Field Reference ({SCHEMA_DOCS.length})
          </button>
          <button
            onClick={() => setActiveTab('template')}
            className={`px-3 py-1.5 rounded-full transition-all flex items-center gap-1.5 ${
              activeTab === 'template'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            <Code2 size={13} /> Live Template
          </button>
          <button
            onClick={() => setActiveTab('cheatsheet')}
            className={`px-3 py-1.5 rounded-full transition-all flex items-center gap-1.5 ${
              activeTab === 'cheatsheet'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            <Table size={13} /> Exam Marking Cheat Sheet
          </button>
        </div>
      </div>

      {/* TAB 1: FIELD REFERENCE */}
      {activeTab === 'fields' && (
        <div className="space-y-4">
          {/* Search & Filter Toolbar */}
          <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search
                size={14}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search schema fields by name, type, or description..."
                className="w-full pl-9 pr-3.5 py-2 bg-[var(--bg-subcard)] border border-[var(--border-color)] rounded-xl text-xs font-medium text-[var(--text-main)] placeholder-[var(--text-subtle)] focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Level Filter */}
              <div className="flex items-center gap-1 p-0.5 bg-[var(--bg-subcard)] border border-[var(--border-color)] rounded-lg text-xs font-bold">
                <button
                  onClick={() => setLevelFilter('all')}
                  className={`px-2.5 py-1 rounded-md text-[11px] transition-colors ${
                    levelFilter === 'all' ? 'bg-indigo-600 text-white' : 'text-[var(--text-muted)]'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setLevelFilter('paper')}
                  className={`px-2.5 py-1 rounded-md text-[11px] transition-colors ${
                    levelFilter === 'paper' ? 'bg-indigo-600 text-white' : 'text-[var(--text-muted)]'
                  }`}
                >
                  Paper
                </button>
                <button
                  onClick={() => setLevelFilter('question')}
                  className={`px-2.5 py-1 rounded-md text-[11px] transition-colors ${
                    levelFilter === 'question' ? 'bg-indigo-600 text-white' : 'text-[var(--text-muted)]'
                  }`}
                >
                  Question
                </button>
              </div>

              {/* Required Filter */}
              <div className="flex items-center gap-1 p-0.5 bg-[var(--bg-subcard)] border border-[var(--border-color)] rounded-lg text-xs font-bold">
                <button
                  onClick={() => setRequiredFilter('all')}
                  className={`px-2.5 py-1 rounded-md text-[11px] transition-colors ${
                    requiredFilter === 'all' ? 'bg-indigo-600 text-white' : 'text-[var(--text-muted)]'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setRequiredFilter('required')}
                  className={`px-2.5 py-1 rounded-md text-[11px] transition-colors ${
                    requiredFilter === 'required' ? 'bg-rose-500 text-white' : 'text-[var(--text-muted)]'
                  }`}
                >
                  Required
                </button>
                <button
                  onClick={() => setRequiredFilter('optional')}
                  className={`px-2.5 py-1 rounded-md text-[11px] transition-colors ${
                    requiredFilter === 'optional' ? 'bg-indigo-600 text-white' : 'text-[var(--text-muted)]'
                  }`}
                >
                  Optional
                </button>
              </div>
            </div>
          </div>

          {/* Results Summary */}
          <div className="flex items-center justify-between text-[11px] font-semibold text-[var(--text-muted)] px-1">
            <span>
              Showing {filteredFields.length} of {SCHEMA_DOCS.length} schema fields
            </span>
            <span>
              Required: {SCHEMA_DOCS.filter((f) => f.required).length} | Optional:{' '}
              {SCHEMA_DOCS.filter((f) => !f.required).length}
            </span>
          </div>

          {/* Field Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[500px] overflow-y-auto custom-scrollbar pr-1">
            {filteredFields.map((field) => {
              const uniqueKey = `${field.level}_${field.name}`;
              const isCopied = copiedExampleKey === uniqueKey;

              return (
                <div
                  key={uniqueKey}
                  className="p-3.5 rounded-2xl bg-[var(--bg-subcard)] border border-[var(--border-color)] hover:border-indigo-500/30 transition-all flex flex-col justify-between gap-2.5"
                >
                  <div>
                    {/* Top Row: Name & Badges */}
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <code className="text-xs font-mono font-extrabold text-[var(--text-main)] px-1.5 py-0.5 rounded bg-[var(--bg-surface)] border border-[var(--border-color)]">
                          {field.name}
                        </code>
                        <span
                          className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full ${
                            field.level === 'paper'
                              ? 'bg-purple-500/15 text-purple-400 border border-purple-500/20'
                              : 'bg-blue-500/15 text-blue-400 border border-blue-500/20'
                          }`}
                        >
                          {field.level}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        <span
                          className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                            field.required
                              ? 'bg-rose-500/15 text-rose-400 border border-rose-500/25'
                              : 'bg-[var(--bg-surface)] text-[var(--text-muted)] border border-[var(--border-color)]'
                          }`}
                        >
                          {field.required ? 'Required' : 'Optional'}
                        </span>
                      </div>
                    </div>

                    {/* Type Badge */}
                    <div className="mb-2">
                      <span className="text-[10px] font-mono font-semibold text-indigo-400">
                        {field.type}
                      </span>
                    </div>

                    {/* Description */}
                    <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                      {field.description}
                    </p>
                  </div>

                  {/* Example Snippet Row */}
                  <div className="pt-2 border-t border-[var(--border-color)] flex items-center justify-between gap-2 bg-[var(--bg-surface)] px-2.5 py-1.5 rounded-xl border border-[var(--border-color)]">
                    <div className="truncate text-[11px] font-mono text-[var(--text-main)]">
                      <span className="text-[var(--text-muted)] text-[10px]">example: </span>
                      {field.example}
                    </div>
                    <button
                      onClick={() => handleCopyExample(uniqueKey, field.example)}
                      className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors shrink-0"
                      title="Copy example"
                    >
                      {isCopied ? (
                        <Check size={12} className="text-emerald-400" />
                      ) : (
                        <Copy size={12} />
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: LIVE CODE TEMPLATE */}
      {activeTab === 'template' && (
        <div className="space-y-4">
          {/* Preset Selector */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <label className="text-xs font-bold text-[var(--text-main)] block">
                Select Exam Preset Template:
              </label>
              <p className="text-[11px] text-[var(--text-muted)]">
                Viewing ready-to-test schema template calibrated for {activeTemplatePreset.name}.
              </p>
            </div>

            <select
              value={selectedTemplateExamId}
              onChange={(e) => setSelectedTemplateExamId(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-[var(--bg-subcard)] border border-[var(--border-color)] text-xs font-bold text-[var(--text-main)] max-w-xs"
            >
              {EXAM_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Code Viewer */}
          <div className="relative">
            <pre className="p-4 bg-[var(--bg-subcard)] border border-[var(--border-color)] rounded-2xl text-xs font-mono text-[var(--text-main)] max-h-80 overflow-y-auto overflow-x-auto whitespace-pre selection:bg-indigo-500 selection:text-white">
              {liveTemplateJson}
            </pre>
          </div>

          {/* Template Actions */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handleCopyTemplate}
              className="btn btn-primary text-xs py-2 px-4 rounded-full font-bold shadow-soft flex items-center gap-1.5"
            >
              {templateCopied ? (
                <>
                  <Check size={13} className="text-emerald-400" /> Copied Template!
                </>
              ) : (
                <>
                  <Copy size={13} /> Copy JSON Template
                </>
              )}
            </button>

            <button
              onClick={handleInsert}
              className="px-4 py-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 text-xs font-bold transition-colors flex items-center gap-1.5 shadow-2xs"
            >
              {templateInserted ? (
                <>
                  <Check size={13} className="text-emerald-400" /> Inserted into Editor!
                </>
              ) : (
                <>
                  <Sparkles size={13} /> Insert into JSON Editor
                </>
              )}
            </button>

            <button
              onClick={handleDownloadTemplate}
              className="px-4 py-2 rounded-full border border-[var(--border-color)] bg-[var(--bg-subcard)] hover:bg-[var(--bg-subcard-hover)] text-[var(--text-main)] text-xs font-bold transition-colors flex items-center gap-1.5 shadow-2xs"
            >
              <Download size={13} /> Download .json Template
            </button>
          </div>
        </div>
      )}

      {/* TAB 3: EXAM MARKING CHEAT SHEET */}
      {activeTab === 'cheatsheet' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-[var(--text-muted)]">
              Comparison of marking schemes, positive rewards, negative penalties, and standard durations across all supported competitive exams:
            </p>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-[var(--border-color)]">
            <table className="w-full text-left text-xs">
              <thead className="bg-[var(--bg-subcard)] border-b border-[var(--border-color)] text-[var(--text-muted)] font-extrabold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-3.5">Examination</th>
                  <th className="py-3 px-3.5">Category</th>
                  <th className="py-3 px-3.5">Standard Timing</th>
                  <th className="py-3 px-3.5">Marking Scheme</th>
                  <th className="py-3 px-3.5">Subjects Covered</th>
                  <th className="py-3 px-3.5 text-right">Prompt Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-color)]">
                {EXAM_PRESETS.map((preset) => (
                  <tr
                    key={preset.id}
                    className="hover:bg-[var(--bg-subcard-hover)] transition-colors"
                  >
                    <td className="py-3 px-3.5">
                      <div className="font-extrabold text-[var(--text-main)] line-clamp-1">
                        {preset.name}
                      </div>
                      <div className="text-[10px] text-[var(--text-muted)] line-clamp-1">
                        {preset.description}
                      </div>
                    </td>
                    <td className="py-3 px-3.5 whitespace-nowrap">
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400 border border-indigo-500/20">
                        {preset.category}
                      </span>
                    </td>
                    <td className="py-3 px-3.5 whitespace-nowrap text-[var(--text-main)] font-semibold">
                      {preset.defaultDuration} min ({preset.defaultQuestions} Qs)
                    </td>
                    <td className="py-3 px-3.5 whitespace-nowrap">
                      <span className="font-bold text-emerald-500">
                        +{preset.defaultMarks}
                      </span>{' '}
                      /{' '}
                      <span className="font-bold text-rose-400">
                        -{preset.defaultNegative}
                      </span>
                    </td>
                    <td className="py-3 px-3.5 max-w-xs truncate text-[var(--text-muted)]">
                      {preset.subjects.join(', ')}
                    </td>
                    <td className="py-3 px-3.5 text-right whitespace-nowrap">
                      <button
                        onClick={() => onSelectExamForPrompt && onSelectExamForPrompt(preset.id)}
                        className="px-2.5 py-1 rounded-full border border-[var(--border-color)] bg-[var(--bg-subcard)] hover:bg-indigo-600 hover:text-white hover:border-indigo-600 text-[11px] font-bold text-[var(--text-main)] transition-all inline-flex items-center gap-1"
                      >
                        Prompt <ArrowRight size={11} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
