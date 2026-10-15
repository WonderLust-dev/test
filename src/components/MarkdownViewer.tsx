import React, { useState, useMemo } from 'react';
import { Copy, Check, ExternalLink, Info, AlertTriangle, Lightbulb, AlertCircle, ShieldAlert } from 'lucide-react';

interface MarkdownViewerProps {
  content: string;
  fileType?: 'md' | 'txt';
  fontSize?: 'sm' | 'base' | 'lg' | 'xl';
  searchQuery?: string;
  className?: string;
}

interface TocItem {
  id: string;
  text: string;
  level: number;
}

// Generate anchor-safe ID from heading text
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

// Extract Table of Contents items from markdown content
export function extractHeadings(markdown: string): TocItem[] {
  const headings: TocItem[] = [];
  const lines = markdown.split('\n');
  for (const line of lines) {
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      const level = match[1].length;
      const text = match[2].trim();
      const id = slugify(text);
      headings.push({ id, text, level });
    }
  }
  return headings;
}

export default function MarkdownViewer({
  content,
  fileType = 'md',
  fontSize = 'base',
  searchQuery = '',
  className = '',
}: MarkdownViewerProps) {
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);

  const handleCopyCode = async (code: string, id: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCodeId(id);
      setTimeout(() => setCopiedCodeId(null), 2000);
    } catch {}
  };

  // Font size classes
  const fontClasses = {
    sm: 'text-xs sm:text-sm',
    base: 'text-sm sm:text-base',
    lg: 'text-base sm:text-lg',
    xl: 'text-lg sm:text-xl',
  }[fontSize];

  // If plain text file, render with preserved whitespace and structured divider highlights
  if (fileType === 'txt') {
    return (
      <div className={`font-mono text-[var(--text-main)] leading-relaxed whitespace-pre-wrap select-text p-4 sm:p-6 bg-[var(--bg-subcard)]/40 rounded-2xl border border-[var(--border-color)] overflow-x-auto ${fontClasses} ${className}`}>
        {content}
      </div>
    );
  }

  // Parse markdown into structured block tokens
  const blocks = useMemo(() => {
    return parseMarkdownBlocks(content);
  }, [content]);

  return (
    <article className={`space-y-4 text-[var(--text-main)] leading-relaxed select-text font-sans ${fontClasses} ${className}`}>
      {blocks.map((block, idx) => (
        <React.Fragment key={idx}>
          {renderBlock(block, idx, copiedCodeId, handleCopyCode, searchQuery)}
        </React.Fragment>
      ))}
    </article>
  );
}

// ============================================================
// Block Parser
// ============================================================

type Block =
  | { type: 'heading'; level: number; text: string; id: string }
  | { type: 'alert'; alertType: 'NOTE' | 'TIP' | 'IMPORTANT' | 'WARNING' | 'CAUTION'; text: string }
  | { type: 'blockquote'; text: string }
  | { type: 'code'; language: string; code: string }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'list'; ordered: boolean; items: Array<{ text: string; checked?: boolean }> }
  | { type: 'hr' }
  | { type: 'paragraph'; text: string };

function parseMarkdownBlocks(markdown: string): Block[] {
  const blocks: Block[] = [];
  const lines = markdown.split(/\r?\n/);
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // 1. Skip empty lines
    if (!line.trim()) {
      i++;
      continue;
    }

    // 2. Headings (# H1 to ###### H6)
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2].trim();
      blocks.push({
        type: 'heading',
        level,
        text,
        id: slugify(text),
      });
      i++;
      continue;
    }

    // 3. Horizontal Rule (---, ***, ___)
    if (/^(\*{3,}|-{3,}|_{3,})$/.test(line.trim())) {
      blocks.push({ type: 'hr' });
      i++;
      continue;
    }

    // 4. Code Blocks (```lang ... ```)
    if (line.trim().startsWith('```')) {
      const language = line.trim().slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      blocks.push({
        type: 'code',
        language: language || 'text',
        code: codeLines.join('\n'),
      });
      continue;
    }

    // 5. GitHub Style Alerts (> [!NOTE], > [!TIP], > [!IMPORTANT], > [!WARNING], > [!CAUTION])
    const alertMatch = line.match(/^>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/i);
    if (alertMatch) {
      const alertType = alertMatch[1].toUpperCase() as 'NOTE' | 'TIP' | 'IMPORTANT' | 'WARNING' | 'CAUTION';
      const alertLines: string[] = [];
      i++;
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        alertLines.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      blocks.push({
        type: 'alert',
        alertType,
        text: alertLines.join('\n').trim(),
      });
      continue;
    }

    // 6. Standard Blockquote (> text)
    if (line.trim().startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoteLines.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      blocks.push({
        type: 'blockquote',
        text: quoteLines.join('\n').trim(),
      });
      continue;
    }

    // 7. Markdown Tables (| col1 | col2 |)
    if (line.includes('|') && i + 1 < lines.length && lines[i + 1].includes('|') && /[-:]+/.test(lines[i + 1])) {
      const headers = line.split('|').map(s => s.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1 || arr.length <= 2);
      i += 2; // skip header and delimiter line
      const rows: string[][] = [];
      while (i < lines.length && lines[i].includes('|') && lines[i].trim() !== '') {
        const cells = lines[i].split('|').map(s => s.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1 || arr.length <= 2);
        if (cells.length > 0) rows.push(cells);
        i++;
      }
      blocks.push({ type: 'table', headers, rows });
      continue;
    }

    // 8. Lists (- [ ] Task, - Unordered, 1. Ordered)
    const taskMatch = line.match(/^[-*]\s+\[([ xX])\]\s+(.+)$/);
    const unordMatch = line.match(/^[-*+]\s+(.+)$/);
    const ordMatch = line.match(/^\d+\.\s+(.+)$/);

    if (taskMatch || unordMatch || ordMatch) {
      const ordered = Boolean(ordMatch && !taskMatch);
      const items: Array<{ text: string; checked?: boolean }> = [];

      while (i < lines.length) {
        const curLine = lines[i];
        const tMatch = curLine.match(/^[-*]\s+\[([ xX])\]\s+(.+)$/);
        const uMatch = curLine.match(/^[-*+]\s+(.+)$/);
        const oMatch = curLine.match(/^\d+\.\s+(.+)$/);

        if (tMatch) {
          items.push({ text: tMatch[2], checked: tMatch[1].toLowerCase() === 'x' });
          i++;
        } else if (uMatch) {
          items.push({ text: uMatch[1] });
          i++;
        } else if (oMatch) {
          items.push({ text: oMatch[1] });
          i++;
        } else {
          break;
        }
      }

      blocks.push({ type: 'list', ordered, items });
      continue;
    }

    // 9. Standard Paragraph (consume continuous lines)
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].match(/^#{1,6}\s/) &&
      !lines[i].trim().startsWith('```') &&
      !lines[i].trim().startsWith('>') &&
      !/^(\*{3,}|-{3,}|_{3,})$/.test(lines[i].trim()) &&
      !lines[i].match(/^[-*+]\s/) &&
      !lines[i].match(/^\d+\.\s/)
    ) {
      paraLines.push(lines[i]);
      i++;
    }

    if (paraLines.length > 0) {
      blocks.push({
        type: 'paragraph',
        text: paraLines.join('\n'),
      });
    }
  }

  return blocks;
}

// ============================================================
// Render Block
// ============================================================

function renderBlock(
  block: Block,
  key: number,
  copiedCodeId: string | null,
  handleCopyCode: (code: string, id: string) => void,
  searchQuery: string
) {
  switch (block.type) {
    case 'heading': {
      const content = renderInline(block.text, searchQuery);
      if (block.level === 1) {
        return (
          <h1 id={block.id} className="text-xl sm:text-2xl md:text-3xl font-black text-[var(--text-main)] tracking-tight pt-3 pb-2 border-b border-[var(--border-color)] mt-4">
            {content}
          </h1>
        );
      }
      if (block.level === 2) {
        return (
          <h2 id={block.id} className="text-lg sm:text-xl md:text-2xl font-extrabold text-[var(--text-main)] tracking-tight pt-3 pb-1 mt-4">
            {content}
          </h2>
        );
      }
      if (block.level === 3) {
        return (
          <h3 id={block.id} className="text-base sm:text-lg md:text-xl font-bold text-[var(--text-main)] tracking-tight pt-2 mt-3">
            {content}
          </h3>
        );
      }
      return (
        <h4 id={block.id} className="text-sm sm:text-base font-bold text-[var(--text-main)] pt-1 mt-2">
          {content}
        </h4>
      );
    }

    case 'alert': {
      const config = {
        NOTE: {
          icon: Info,
          border: 'border-blue-500/40 bg-blue-500/10 text-blue-400',
          title: 'Note',
        },
        TIP: {
          icon: Lightbulb,
          border: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400',
          title: 'Tip',
        },
        IMPORTANT: {
          icon: AlertCircle,
          border: 'border-purple-500/40 bg-purple-500/10 text-purple-400',
          title: 'Important',
        },
        WARNING: {
          icon: AlertTriangle,
          border: 'border-amber-500/40 bg-amber-500/10 text-amber-400',
          title: 'Warning',
        },
        CAUTION: {
          icon: ShieldAlert,
          border: 'border-rose-500/40 bg-rose-500/10 text-rose-400',
          title: 'Caution',
        },
      }[block.alertType];

      const IconComponent = config.icon;

      return (
        <div className={`p-4 rounded-2xl border-l-4 border ${config.border} my-3 space-y-1.5 shadow-xs`}>
          <div className="flex items-center gap-1.5 font-extrabold text-xs tracking-wider uppercase">
            <IconComponent size={15} />
            <span>{config.title}</span>
          </div>
          <div className="text-xs sm:text-sm leading-relaxed text-[var(--text-main)] whitespace-pre-wrap font-medium">
            {renderInline(block.text, searchQuery)}
          </div>
        </div>
      );
    }

    case 'blockquote':
      return (
        <blockquote className="p-3.5 sm:p-4 rounded-2xl bg-[var(--bg-subcard)]/60 border-l-4 border-indigo-500 text-[var(--text-main)] italic leading-relaxed my-3 border border-[var(--border-color)]">
          {renderInline(block.text, searchQuery)}
        </blockquote>
      );

    case 'code': {
      const codeId = `code_${key}`;
      const isCopied = copiedCodeId === codeId;
      return (
        <div className="my-4 rounded-2xl border border-[var(--border-color)] overflow-hidden bg-gray-950 text-gray-100 shadow-md">
          <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800 text-xs font-mono text-gray-400">
            <span className="uppercase text-[11px] font-bold text-gray-300">{block.language}</span>
            <button
              onClick={() => handleCopyCode(block.code, codeId)}
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 transition-colors text-[11px] font-sans"
              title="Copy snippet"
            >
              {isCopied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
              <span>{isCopied ? 'Copied!' : 'Copy'}</span>
            </button>
          </div>
          <pre className="p-4 overflow-x-auto text-xs sm:text-sm font-mono leading-relaxed custom-scrollbar">
            <code>{block.code}</code>
          </pre>
        </div>
      );
    }

    case 'table':
      return (
        <div className="my-4 overflow-x-auto rounded-2xl border border-[var(--border-color)] shadow-xs custom-scrollbar">
          <table className="w-full text-left text-xs sm:text-sm border-collapse">
            <thead>
              <tr className="bg-[var(--bg-subcard)] border-b border-[var(--border-color)] text-[var(--text-main)] font-extrabold">
                {block.headers.map((h, hIdx) => (
                  <th key={hIdx} className="px-3.5 py-2.5">
                    {renderInline(h, searchQuery)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-color)]/60 bg-[var(--bg-surface)]">
              {block.rows.map((row, rIdx) => (
                <tr key={rIdx} className="hover:bg-[var(--bg-subcard)]/50 transition-colors">
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} className="px-3.5 py-2.5 text-[var(--text-main)]">
                      {renderInline(cell, searchQuery)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    case 'list': {
      if (block.ordered) {
        return (
          <ol className="list-decimal list-inside space-y-1.5 my-2.5 pl-2 text-[var(--text-main)]">
            {block.items.map((item, idx) => (
              <li key={idx} className="leading-relaxed">
                {renderInline(item.text, searchQuery)}
              </li>
            ))}
          </ol>
        );
      }

      return (
        <ul className="space-y-1.5 my-2.5 pl-1 text-[var(--text-main)]">
          {block.items.map((item, idx) => (
            <li key={idx} className="flex items-start gap-2 leading-relaxed">
              {item.checked !== undefined ? (
                <input
                  type="checkbox"
                  checked={item.checked}
                  readOnly
                  className="mt-1 h-3.5 w-3.5 rounded text-indigo-600 focus:ring-0 shrink-0 cursor-default"
                />
              ) : (
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-2 shrink-0 inline-block" />
              )}
              <span className={item.checked ? 'line-through opacity-70' : ''}>
                {renderInline(item.text, searchQuery)}
              </span>
            </li>
          ))}
        </ul>
      );
    }

    case 'hr':
      return <hr className="my-6 border-t border-[var(--border-color)]" />;

    case 'paragraph':
      return (
        <p className="my-2 leading-relaxed text-[var(--text-main)]">
          {renderInline(block.text, searchQuery)}
        </p>
      );
  }
}

// ============================================================
// Inline Formatter (Bold, Italic, Code, Links, Math, Search Highlight)
// ============================================================

function renderInline(text: string, searchQuery: string): React.ReactNode[] {
  // Tokenize string for markdown formatting
  const tokens: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // 1. Inline code (`code`)
    const codeMatch = remaining.match(/^`([^`]+)`/);
    if (codeMatch) {
      tokens.push(
        <code key={key++} className="px-1.5 py-0.5 rounded-md font-mono text-[11px] sm:text-xs bg-[var(--bg-subcard)] border border-[var(--border-color)] text-indigo-400 font-bold mx-0.5">
          {codeMatch[1]}
        </code>
      );
      remaining = remaining.slice(codeMatch[0].length);
      continue;
    }

    // 2. Bold (**text** or __text__)
    const boldMatch = remaining.match(/^(\*\*|__)(.*?)\1/);
    if (boldMatch) {
      tokens.push(
        <strong key={key++} className="font-extrabold text-[var(--text-main)]">
          {renderInline(boldMatch[2], searchQuery)}
        </strong>
      );
      remaining = remaining.slice(boldMatch[0].length);
      continue;
    }

    // 3. Strikethrough (~~text~~)
    const strikeMatch = remaining.match(/^~~(.*?)~~/);
    if (strikeMatch) {
      tokens.push(
        <del key={key++} className="line-through opacity-75">
          {renderInline(strikeMatch[1], searchQuery)}
        </del>
      );
      remaining = remaining.slice(strikeMatch[0].length);
      continue;
    }

    // 4. Italic (*text* or _text_)
    const italicMatch = remaining.match(/^(\*|_)(.*?)\1/);
    if (italicMatch && italicMatch[2].length > 0) {
      tokens.push(
        <em key={key++} className="italic">
          {renderInline(italicMatch[2], searchQuery)}
        </em>
      );
      remaining = remaining.slice(italicMatch[0].length);
      continue;
    }

    // 5. Links ([label](url))
    const linkMatch = remaining.match(/^\[(.*?)\]\((.*?)\)/);
    if (linkMatch) {
      tokens.push(
        <a
          key={key++}
          href={linkMatch[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-indigo-500 hover:text-indigo-400 underline underline-offset-2 font-semibold inline-flex items-center gap-0.5"
        >
          <span>{linkMatch[1]}</span>
          <ExternalLink size={11} className="inline ml-0.5 opacity-70" />
        </a>
      );
      remaining = remaining.slice(linkMatch[0].length);
      continue;
    }

    // 6. LaTeX Math tokens ($...$)
    const mathMatch = remaining.match(/^\$([^$]+)\$/);
    if (mathMatch) {
      tokens.push(
        <span key={key++} className="font-mono text-xs sm:text-sm font-bold text-amber-400 bg-amber-500/10 px-1 py-0.2 rounded border border-amber-500/20 mx-0.5">
          {mathMatch[1]}
        </span>
      );
      remaining = remaining.slice(mathMatch[0].length);
      continue;
    }

    // Plain text chunk before next markdown special token
    const nextSpecialIndex = remaining.search(/[`*_~\[\$]/);
    if (nextSpecialIndex === -1) {
      tokens.push(highlightSearch(remaining, searchQuery, key++));
      break;
    } else if (nextSpecialIndex > 0) {
      const plain = remaining.slice(0, nextSpecialIndex);
      tokens.push(highlightSearch(plain, searchQuery, key++));
      remaining = remaining.slice(nextSpecialIndex);
    } else {
      // Unmatched markdown character, push single character and advance
      tokens.push(remaining[0]);
      remaining = remaining.slice(1);
    }
  }

  return tokens;
}

// Highlight matching search query in plain text
function highlightSearch(text: string, query: string, key: number): React.ReactNode {
  if (!query || !query.trim()) return text;
  const q = query.trim();
  const lower = text.toLowerCase();
  const queryLower = q.toLowerCase();

  const parts: React.ReactNode[] = [];
  let start = 0;
  let matchIndex = lower.indexOf(queryLower, start);
  let pKey = 0;

  if (matchIndex === -1) return text;

  while (matchIndex !== -1) {
    if (matchIndex > start) {
      parts.push(text.slice(start, matchIndex));
    }
    parts.push(
      <mark key={pKey++} className="bg-amber-300 text-gray-900 rounded-xs px-0.5 font-bold">
        {text.slice(matchIndex, matchIndex + q.length)}
      </mark>
    );
    start = matchIndex + q.length;
    matchIndex = lower.indexOf(queryLower, start);
  }

  if (start < text.length) {
    parts.push(text.slice(start));
  }

  return <React.Fragment key={key}>{parts}</React.Fragment>;
}
