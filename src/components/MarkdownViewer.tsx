import React, { useState, useMemo } from 'react';
import {
  Copy,
  Check,
  ExternalLink,
  Info,
  AlertTriangle,
  Lightbulb,
  AlertCircle,
  ShieldAlert,
  ChevronRight,
  ImageIcon,
} from 'lucide-react';
import { extractLeadingEmoji } from '../utils/notionParser';

interface MarkdownViewerProps {
  content: string;
  fileType?: 'md' | 'txt';
  fontSize?: 'sm' | 'base' | 'lg' | 'xl';
  fontStyle?: 'sans' | 'serif' | 'mono';
  searchQuery?: string;
  className?: string;
  onToggleTask?: (taskIndex: number, newChecked: boolean) => void;
  noteTitle?: string;
  skipTitleHeading?: boolean;
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

// Extract Table of Contents items from markdown & text content with duplicate header de-duplication
export function extractHeadings(markdown: string, noteTitle?: string): TocItem[] {
  const headings: TocItem[] = [];
  const lines = markdown.split(/\r?\n/);
  const seenIds = new Map<string, number>();

  for (const line of lines) {
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      const level = match[1].length;
      const text = match[2].trim();
      const baseId = slugify(text) || 'heading';
      const count = seenIds.get(baseId) || 0;
      seenIds.set(baseId, count + 1);
      const id = count === 0 ? baseId : `${baseId}-${count}`;
      headings.push({ id, text, level });
      continue;
    }
    const partMatch = line.match(/^(PART|CHAPTER|SECTION|MODULE)\s+([0-9IVXLCDM]+)[:\-–\s]+(.+)$/i);
    if (partMatch) {
      const text = `${partMatch[1]} ${partMatch[2]}: ${partMatch[3].trim()}`;
      const baseId = slugify(text) || 'section';
      const count = seenIds.get(baseId) || 0;
      seenIds.set(baseId, count + 1);
      const id = count === 0 ? baseId : `${baseId}-${count}`;
      headings.push({ id, text, level: 2 });
      continue;
    }
  }

  // Duplicate Header Check for Table of Contents:
  // If the very first heading in the TOC is level 1 and repeats the noteTitle,
  // omit it so the TOC displays actual chapters rather than repeating the book title.
  if (noteTitle && headings.length > 0 && headings[0].level === 1) {
    const hNorm = headings[0].text.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const tNorm = noteTitle.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    if (hNorm === tNorm || hNorm.includes(tNorm) || tNorm.includes(hNorm)) {
      return headings.slice(1);
    }
  }

  return headings;
}

function parseTableLine(line: string): string[] {
  const trimmed = line.trim();
  const raw = trimmed.split('|').map((c) => c.trim());
  if (trimmed.startsWith('|') && raw.length > 0 && raw[0] === '') {
    raw.shift();
  }
  if (trimmed.endsWith('|') && raw.length > 0 && raw[raw.length - 1] === '') {
    raw.pop();
  }
  return raw;
}

export default function MarkdownViewer({
  content,
  fileType = 'md',
  fontSize = 'base',
  fontStyle = 'sans',
  searchQuery = '',
  className = '',
  onToggleTask,
  noteTitle,
  skipTitleHeading = false,
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

  const fontStyleClass = {
    sans: 'font-sans',
    serif: 'font-serif',
    mono: 'font-mono',
  }[fontStyle];

  // Parse markdown & text into structured block tokens
  const blocks = useMemo(() => {
    const rawBlocks = parseMarkdownBlocks(content);
    if (!skipTitleHeading && !noteTitle) return rawBlocks;

    // Duplicate header check: if the first block is an H1 that duplicates noteTitle
    // or if skipTitleHeading is explicitly true, suppress the duplicate first heading
    if (rawBlocks.length > 0 && rawBlocks[0].type === 'heading' && rawBlocks[0].level === 1) {
      if (skipTitleHeading) {
        return rawBlocks.slice(1);
      }
      if (noteTitle) {
        const hNorm = rawBlocks[0].text.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
        const tNorm = noteTitle.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
        if (hNorm === tNorm || hNorm.includes(tNorm) || tNorm.includes(hNorm)) {
          return rawBlocks.slice(1);
        }
      }
    }
    return rawBlocks;
  }, [content, skipTitleHeading, noteTitle]);

  return (
    <article
      className={`space-y-4 text-[var(--text-main)] leading-relaxed select-text ${fontStyleClass} ${fontClasses} ${className}`}
    >
      {blocks.map((block, idx) => (
        <React.Fragment key={idx}>
          {renderBlock(block, idx, copiedCodeId, handleCopyCode, searchQuery, onToggleTask)}
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
  | { type: 'chapter_banner'; chapterNumber?: string; title: string; id: string }
  | { type: 'definition'; number?: string; term: string; meaning: string; context?: string }
  | { type: 'alert'; alertType: 'NOTE' | 'TIP' | 'IMPORTANT' | 'WARNING' | 'CAUTION'; text: string }
  | { type: 'notion_callout'; emoji: string; text: string }
  | { type: 'toggle'; title: string; content: string }
  | { type: 'math_block'; formula: string }
  | { type: 'image'; src: string; alt: string; caption?: string }
  | { type: 'blockquote'; text: string }
  | { type: 'code'; language: string; code: string }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | {
      type: 'list';
      ordered: boolean;
      items: Array<{
        text: string;
        checked?: boolean;
        globalTaskIndex?: number;
        indent: number;
        bullet: string;
      }>;
    }
  | { type: 'hr' }
  | { type: 'paragraph'; text: string };

function parseMarkdownBlocks(markdown: string): Block[] {
  const blocks: Block[] = [];
  const lines = markdown.split(/\r?\n/);
  let i = 0;
  let taskCounter = 0;
  const seenHeadingIds = new Map<string, number>();

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
      const baseId = slugify(text) || 'heading';
      const count = seenHeadingIds.get(baseId) || 0;
      seenHeadingIds.set(baseId, count + 1);
      const id = count === 0 ? baseId : `${baseId}-${count}`;
      blocks.push({
        type: 'heading',
        level,
        text,
        id,
      });
      i++;
      continue;
    }

    // 3. Chapter / Part Banner (e.g. PART 1: GOVERNMENTS & SYSTEMS OF RULE)
    const chapterMatch = line.match(
      /^(PART|CHAPTER|SECTION|MODULE)\s+([0-9IVXLCDM]+)[:\-–\s]+(.+)$/i
    );
    if (chapterMatch) {
      const chapterNumber = `${chapterMatch[1].toUpperCase()} ${chapterMatch[2]}`;
      const title = chapterMatch[3].trim();
      const baseId = slugify(`${chapterNumber}-${title}`) || 'chapter';
      const count = seenHeadingIds.get(baseId) || 0;
      seenHeadingIds.set(baseId, count + 1);
      const id = count === 0 ? baseId : `${baseId}-${count}`;
      blocks.push({
        type: 'chapter_banner',
        chapterNumber,
        title,
        id,
      });
      i++;
      continue;
    }

    // 4. Horizontal Rule (---, ***, ___, ===)
    if (/^([*_\-=]{3,})$/.test(line.trim())) {
      blocks.push({ type: 'hr' });
      i++;
      continue;
    }

    // 5. Standalone Image Block (![alt](url "title"))
    const imgBlockMatch = line.trim().match(/^!\[(.*?)\]\((.+?)\)$/);
    if (imgBlockMatch) {
      const alt = imgBlockMatch[1].trim() || 'Note image';
      const rawSrc = imgBlockMatch[2].trim();
      const parts = rawSrc.split(/\s+"(.*)"$/);
      const src = parts[0].trim();
      const caption = parts[1] || '';
      blocks.push({
        type: 'image',
        alt,
        src,
        caption,
      });
      i++;
      continue;
    }

    // 6. Definitions: ONLY for concise vocabulary/concept terms (<= 35 chars)
    // Avoid hijacking regular numbers, questions, or notes
    const defMatch = line.match(/^(\d+)\.\s+([A-Za-z\s"'\-]{2,35})\s*:\s*(.{3,})$/);
    if (
      defMatch &&
      !/^(Note|Tip|Rule|Important|Warning|Example|Context|Question|Problem|Solution|Method)/i.test(
        defMatch[2].trim()
      )
    ) {
      const number = defMatch[1];
      const term = defMatch[2].trim().replace(/^"|"$/g, '');
      const meaning = defMatch[3].trim();
      blocks.push({
        type: 'definition',
        number,
        term,
        meaning,
      });
      i++;
      continue;
    }

    // 7. Idioms with multi-line Meaning/Context:
    const idiomMatch = line.match(/^(\d+)\.\s+("[^"]+"|[A-Za-z\s\-]{2,30})\s*$/);
    if (
      idiomMatch &&
      i + 1 < lines.length &&
      /^\s*(Meaning|Definition)[:\-–]/i.test(lines[i + 1])
    ) {
      const number = idiomMatch[1];
      const term = idiomMatch[2].trim().replace(/^"|"$/g, '');
      i++;
      const meaningLine = lines[i].replace(/^\s*(Meaning|Definition)[:\-–]\s*/i, '').trim();
      let context: string | undefined = undefined;
      if (i + 1 < lines.length && /^\s*(Context|Note|Example)[:\-–]/i.test(lines[i + 1])) {
        i++;
        context = lines[i].replace(/^\s*(Context|Note|Example)[:\-–]\s*/i, '').trim();
      }
      blocks.push({
        type: 'definition',
        number,
        term,
        meaning: meaningLine,
        context,
      });
      i++;
      continue;
    }

    // 8. Study Tips & Rules (e.g. Tip: Revise root words like "Cide"...)
    const tipMatch = line.match(/^(Tip|Rule|Shortcut)[:\-–]\s*(.+)$/i);
    if (tipMatch) {
      blocks.push({
        type: 'alert',
        alertType: 'TIP',
        text: tipMatch[2].trim(),
      });
      i++;
      continue;
    }

    // 9. Math Blocks ($$ ... $$)
    if (line.trim().startsWith('$$')) {
      const singleMatch = line.trim().match(/^\$\$(.+?)\$\$$/);
      if (singleMatch) {
        blocks.push({
          type: 'math_block',
          formula: singleMatch[1].trim(),
        });
        i++;
        continue;
      }
      const mathLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('$$')) {
        mathLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++; // skip closing $$
      blocks.push({
        type: 'math_block',
        formula: mathLines.join('\n').trim(),
      });
      continue;
    }

    // 10. Code Blocks (```lang ... ```)
    if (line.trim().startsWith('```')) {
      const language = line.trim().slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++; // skip closing ```
      blocks.push({
        type: 'code',
        language: language || 'text',
        code: codeLines.join('\n'),
      });
      continue;
    }

    // 11. GitHub Style Alerts (> [!NOTE], > [!TIP], > [!IMPORTANT], > [!WARNING], > [!CAUTION])
    const alertMatch = line.match(/^>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/i);
    if (alertMatch) {
      const alertType = alertMatch[1].toUpperCase() as
        | 'NOTE'
        | 'TIP'
        | 'IMPORTANT'
        | 'WARNING'
        | 'CAUTION';
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

    // 12. Notion Callouts (> 💡 text) or Standard Blockquote (> text)
    if (line.trim().startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoteLines.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      const fullQuote = quoteLines.join('\n').trim();
      const { emoji, remaining } = extractLeadingEmoji(fullQuote);
      if (emoji) {
        blocks.push({
          type: 'notion_callout',
          emoji,
          text: remaining,
        });
      } else {
        blocks.push({
          type: 'blockquote',
          text: fullQuote,
        });
      }
      continue;
    }

    // 13. Collapsible Toggles (<details><summary>...</summary>...</details> or ▶ Title)
    if (line.trim().toLowerCase().startsWith('<details>')) {
      let summary = 'Toggle details';
      const toggleLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().toLowerCase().includes('</details>')) {
        const cur = lines[i];
        const sumMatch = cur.match(/<summary>(.*?)<\/summary>/i);
        if (sumMatch) {
          summary = sumMatch[1].trim();
        } else {
          toggleLines.push(cur);
        }
        i++;
      }
      if (i < lines.length) i++; // skip closing </details>
      blocks.push({
        type: 'toggle',
        title: summary,
        content: toggleLines.join('\n').trim(),
      });
      continue;
    }

    const toggleMatch = line.match(/^[▶▸]\s+(.+)$/);
    if (toggleMatch) {
      const title = toggleMatch[1].trim();
      const toggleLines: string[] = [];
      i++;
      while (
        i < lines.length &&
        lines[i].trim() !== '' &&
        !lines[i].match(/^#{1,6}\s/) &&
        !lines[i].match(/^[▶▸]\s/) &&
        !lines[i].trim().startsWith('```') &&
        !lines[i].trim().startsWith('$$') &&
        !lines[i].trim().startsWith('>')
      ) {
        toggleLines.push(lines[i]);
        i++;
      }
      blocks.push({
        type: 'toggle',
        title,
        content: toggleLines.join('\n').trim(),
      });
      continue;
    }

    // 14. Markdown Tables (| col1 | col2 |)
    if (line.includes('|')) {
      const isHeaderWithDelimiter =
        i + 1 < lines.length &&
        lines[i + 1].includes('|') &&
        /[-:]+/.test(lines[i + 1]);

      if (isHeaderWithDelimiter) {
        const headers = parseTableLine(line);
        i += 2; // skip header and delimiter line
        const rows: string[][] = [];
        const headerKey = headers.map(h => h.trim().toLowerCase()).join('||');
        while (i < lines.length && lines[i].includes('|') && lines[i].trim() !== '') {
          const cells = parseTableLine(lines[i]);
          const rowKey = cells.map(c => c.trim().toLowerCase()).join('||');
          // Duplicate header row check: if row duplicates table headers, omit it
          if (cells.length > 0 && rowKey !== headerKey) {
            rows.push(cells);
          }
          i++;
        }
        blocks.push({ type: 'table', headers, rows });
        continue;
      }
    }

    // 15. Lists (- [ ] Task, - Unordered, • Unicode bullets, 1. Ordered, Indented Sub-bullets)
    const listLineMatch = line.match(/^(\s*)([-*+•◦▪▫‣⁃–—]|\d+\.)\s+(.+)$/);
    if (listLineMatch) {
      const items: Array<{
        text: string;
        checked?: boolean;
        globalTaskIndex?: number;
        indent: number;
        bullet: string;
      }> = [];

      const initialBullet = listLineMatch[2];
      const ordered = /^\d+\./.test(initialBullet);

      while (i < lines.length) {
        const curLine = lines[i];
        if (!curLine.trim()) {
          // Allow loose lists if next non-empty line is also a list item
          let nextIdx = i + 1;
          while (nextIdx < lines.length && !lines[nextIdx].trim()) nextIdx++;
          if (
            nextIdx < lines.length &&
            lines[nextIdx].match(/^(\s*)([-*+•◦▪▫‣⁃–—]|\d+\.)\s+(.+)$/)
          ) {
            i++;
            continue;
          }
          break;
        }

        const match = curLine.match(/^(\s*)([-*+•◦▪▫‣⁃–—]|\d+\.)\s+(.+)$/);
        if (!match) break;

        const indentSpaces = match[1].length;
        const indent = Math.min(3, Math.floor(indentSpaces / 2));
        const bulletChar = match[2];
        const contentText = match[3];

        const taskMatch = contentText.match(/^\[([ xX])\]\s+(.+)$/);
        if (taskMatch) {
          items.push({
            text: taskMatch[2],
            checked: taskMatch[1].toLowerCase() === 'x',
            globalTaskIndex: taskCounter++,
            indent,
            bullet: bulletChar,
          });
        } else {
          items.push({
            text: contentText,
            indent,
            bullet: bulletChar,
          });
        }
        i++;
      }

      if (items.length > 0) {
        blocks.push({
          type: 'list',
          ordered,
          items,
        });
        continue;
      }
    }

    // 16. Standard Paragraph (consume continuous lines until next block)
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].match(/^(#{1,6})\s+/) &&
      !lines[i].trim().startsWith('```') &&
      !lines[i].trim().startsWith('$$') &&
      !lines[i].trim().toLowerCase().startsWith('<details>') &&
      !lines[i].match(/^[▶▸]\s+/) &&
      !lines[i].trim().startsWith('>') &&
      !/^([*_\-=]{3,})$/.test(lines[i].trim()) &&
      !lines[i].match(/^(\s*)([-*+•◦▪▫‣⁃–—]|\d+\.)\s+/) &&
      !lines[i].trim().match(/^!\[(.*?)\]\((.*?)\)$/)
    ) {
      paraLines.push(lines[i]);
      i++;
    }

    if (paraLines.length > 0) {
      blocks.push({
        type: 'paragraph',
        text: paraLines.join('\n'),
      });
    } else {
      // Safety advance: if an unhandled line is encountered, render as single paragraph
      // so zero data is EVER omitted or dropped
      blocks.push({
        type: 'paragraph',
        text: lines[i],
      });
      i++;
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
  searchQuery: string,
  onToggleTask?: (taskIndex: number, newChecked: boolean) => void
) {
  switch (block.type) {
    case 'heading': {
      const content = renderInline(block.text, searchQuery);
      if (block.level === 1) {
        return (
          <h1
            id={block.id}
            className="text-xl sm:text-2xl md:text-3xl font-black text-[var(--text-main)] tracking-tight pt-3 pb-2 border-b border-[var(--border-color)] mt-4"
          >
            {content}
          </h1>
        );
      }
      if (block.level === 2) {
        return (
          <h2
            id={block.id}
            className="text-lg sm:text-xl md:text-2xl font-extrabold text-[var(--text-main)] tracking-tight pt-3 pb-1 mt-4"
          >
            {content}
          </h2>
        );
      }
      if (block.level === 3) {
        return (
          <h3
            id={block.id}
            className="text-base sm:text-lg md:text-xl font-bold text-[var(--text-main)] tracking-tight pt-2 mt-3"
          >
            {content}
          </h3>
        );
      }
      return (
        <h4
          id={block.id}
          className="text-sm sm:text-base font-bold text-[var(--text-main)] pt-1 mt-2"
        >
          {content}
        </h4>
      );
    }

    case 'chapter_banner': {
      return (
        <div id={block.id} className="pt-6 pb-3 my-4 border-b border-[var(--border-color)]">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-[#E0564C]/15 text-[#E0564C] border border-[#E0564C]/30 font-mono">
              {block.chapterNumber || 'Chapter'}
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-[var(--text-main)] tracking-tight">
            {renderInline(block.title, searchQuery)}
          </h2>
        </div>
      );
    }

    case 'definition': {
      return (
        <div className="p-3.5 sm:p-4 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-subcard)]/60 my-2.5 shadow-2xs hover:border-[#E0564C]/40 transition-colors">
          <div className="flex items-start gap-3">
            {block.number && (
              <span className="w-6 h-6 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-[11px] font-black flex items-center justify-center shrink-0 text-[var(--text-muted)] mt-0.5 shadow-2xs font-mono">
                {block.number}
              </span>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="font-extrabold text-sm sm:text-base text-[var(--text-main)] tracking-tight">
                  {block.term}
                </span>
                {block.context && (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                    {block.context}
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-[var(--text-main)]/90 leading-relaxed font-normal">
                {renderInline(block.meaning, searchQuery)}
              </p>
            </div>
          </div>
        </div>
      );
    }

    case 'notion_callout':
      return (
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-[var(--bg-subcard)]/80 border border-[var(--border-color)] my-3 shadow-2xs hover:border-indigo-500/30 transition-colors">
          <div className="text-2xl select-none shrink-0 pt-0.5 leading-none">{block.emoji}</div>
          <div className="flex-1 min-w-0 text-xs sm:text-sm text-[var(--text-main)] leading-relaxed font-medium">
            {renderInline(block.text, searchQuery)}
          </div>
        </div>
      );

    case 'toggle':
      return (
        <details className="group my-2.5 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-subcard)]/40 overflow-hidden transition-all">
          <summary className="cursor-pointer select-none px-4 py-2.5 flex items-center gap-2 font-bold text-xs sm:text-sm text-[var(--text-main)] hover:bg-[var(--bg-subcard)]/80 transition-colors list-none">
            <ChevronRight
              size={15}
              className="text-indigo-400 transition-transform duration-200 group-open:rotate-90 shrink-0"
            />
            <span className="flex-1">{renderInline(block.title, searchQuery)}</span>
            <span className="text-[10px] text-[var(--text-muted)] font-normal group-open:hidden">
              (click to expand)
            </span>
          </summary>
          <div className="px-4 py-3 pt-2 text-xs sm:text-sm border-t border-[var(--border-color)]/50 text-[var(--text-main)]/90 leading-relaxed bg-[var(--bg-surface)]">
            {block.content.split('\n').map((line, lIdx) => (
              <p key={lIdx} className="my-1">
                {renderInline(line, searchQuery)}
              </p>
            ))}
          </div>
        </details>
      );

    case 'math_block': {
      const mathId = `math_${key}`;
      const isCopied = copiedCodeId === mathId;
      return (
        <div className="my-3 p-3.5 sm:p-4 rounded-2xl border border-amber-500/30 bg-amber-500/5 text-amber-300 font-mono text-xs sm:text-sm overflow-x-auto custom-scrollbar flex items-center justify-between gap-3 shadow-2xs">
          <div className="flex-1 text-center py-1 overflow-x-auto font-semibold tracking-wide">
            {block.formula}
          </div>
          <button
            onClick={() => handleCopyCode(block.formula, mathId)}
            className="shrink-0 p-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 transition-colors text-xs cursor-pointer"
            title="Copy formula"
          >
            {isCopied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
          </button>
        </div>
      );
    }

    case 'image':
      return (
        <figure className="my-4 rounded-2xl overflow-hidden border border-[var(--border-color)] bg-[var(--bg-subcard)]/50 p-2 sm:p-3 text-center">
          <img
            src={block.src}
            alt={block.alt}
            loading="lazy"
            className="max-h-[500px] w-auto max-w-full rounded-xl mx-auto object-contain shadow-xs"
            onError={(e) => {
              const target = e.currentTarget;
              target.onerror = null;
              target.parentElement?.classList.add('p-4');
              target.style.display = 'none';
              const fallback = document.createElement('div');
              fallback.className = 'text-xs text-[var(--text-muted)] flex items-center justify-center gap-1.5 py-4';
              fallback.innerHTML = `<span>[Image: ${block.alt || 'Unavailable'}]</span>`;
              target.parentElement?.appendChild(fallback);
            }}
          />
          {(block.caption || block.alt) && (
            <figcaption className="text-xs text-[var(--text-muted)] mt-2 font-medium italic">
              {block.caption || block.alt}
            </figcaption>
          )}
        </figure>
      );

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
        <div
          className={`p-4 rounded-2xl border-l-4 border ${config.border} my-3 space-y-1.5 shadow-xs`}
        >
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
            <span className="uppercase text-[11px] font-bold text-gray-300">
              {block.language}
            </span>
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
          <ol className="space-y-1.5 my-2.5 pl-2 text-[var(--text-main)]">
            {block.items.map((item, idx) => (
              <li
                key={idx}
                style={{ paddingLeft: `${item.indent * 16}px` }}
                className="leading-relaxed flex items-start gap-2"
              >
                <span className="font-bold font-mono text-xs opacity-75 shrink-0">
                  {idx + 1}.
                </span>
                <span className="flex-1">{renderInline(item.text, searchQuery)}</span>
              </li>
            ))}
          </ol>
        );
      }

      return (
        <ul className="space-y-1.5 my-2.5 pl-1 text-[var(--text-main)]">
          {block.items.map((item, idx) => (
            <li
              key={idx}
              style={{ paddingLeft: `${item.indent * 16}px` }}
              className="flex items-start gap-2.5 leading-relaxed"
            >
              {item.checked !== undefined ? (
                onToggleTask && item.globalTaskIndex !== undefined ? (
                  <button
                    type="button"
                    onClick={() => onToggleTask(item.globalTaskIndex!, !item.checked)}
                    className={`mt-0.5 w-4 h-4 rounded-md border flex items-center justify-center transition-all shrink-0 cursor-pointer ${
                      item.checked
                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-2xs'
                        : 'border-[var(--border-color)] bg-[var(--bg-subcard)] hover:border-indigo-400'
                    }`}
                    title={item.checked ? 'Mark uncompleted' : 'Mark completed'}
                  >
                    {item.checked && <Check size={11} className="stroke-[3]" />}
                  </button>
                ) : (
                  <input
                    type="checkbox"
                    checked={item.checked}
                    readOnly
                    className="mt-1 h-3.5 w-3.5 rounded text-indigo-600 focus:ring-0 shrink-0 cursor-default"
                  />
                )
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
        <p className="my-2 leading-relaxed text-[var(--text-main)] whitespace-pre-wrap">
          {renderInline(block.text, searchQuery)}
        </p>
      );
  }
}

// ============================================================
// Inline Formatter (Bold, Italic, Images, Code, Links, Math, Search Highlight)
// ============================================================

function renderInline(text: string, searchQuery: string): React.ReactNode[] {
  const tokens: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // 0. Inline Images (![alt](url))
    const imgMatch = remaining.match(/^!\[(.*?)\]\((.*?)\)/);
    if (imgMatch) {
      tokens.push(
        <img
          key={key++}
          src={imgMatch[2]}
          alt={imgMatch[1] || 'image'}
          className="inline-block max-h-48 max-w-full rounded-lg border border-[var(--border-color)] my-1 align-middle"
        />
      );
      remaining = remaining.slice(imgMatch[0].length);
      continue;
    }

    // 1. Inline code (`code`)
    const codeMatch = remaining.match(/^`([^`]+)`/);
    if (codeMatch) {
      tokens.push(
        <code
          key={key++}
          className="px-1.5 py-0.5 rounded-md font-mono text-[11px] sm:text-xs bg-[var(--bg-subcard)] border border-[var(--border-color)] text-indigo-400 font-bold mx-0.5"
        >
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
        <span
          key={key++}
          className="font-mono text-xs sm:text-sm font-bold text-amber-400 bg-amber-500/10 px-1 py-0.2 rounded border border-amber-500/20 mx-0.5"
        >
          {mathMatch[1]}
        </span>
      );
      remaining = remaining.slice(mathMatch[0].length);
      continue;
    }

    // 7. Inline HTML Highlights (<mark>text</mark>)
    const markMatch = remaining.match(/^<mark>(.*?)<\/mark>/i);
    if (markMatch) {
      tokens.push(
        <mark key={key++} className="bg-amber-300 dark:bg-amber-500/40 text-inherit px-1 rounded-sm">
          {renderInline(markMatch[1], searchQuery)}
        </mark>
      );
      remaining = remaining.slice(markMatch[0].length);
      continue;
    }

    // Plain text chunk before next markdown special token
    const nextSpecialIndex = remaining.search(/[`*_~\[\$<]/);
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
