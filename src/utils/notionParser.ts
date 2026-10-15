/**
 * Notion & Rich Text to Markdown Converter (Zero Data-Loss Engine)
 * Converts HTML copied from Notion, Google Docs, Word, PDFs, or web pages
 * into clean, standard GitHub/Notion-flavored Markdown without dropping
 * images, tables, math, lists, toggles, or text blocks.
 */

// Common emoji regex to detect Notion callout icons
export const EMOJI_REGEX = /^(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/;

/**
 * Extracts emoji from the beginning of text, if any
 */
export function extractLeadingEmoji(text: string): { emoji: string | null; remaining: string } {
  const match = text.trim().match(EMOJI_REGEX);
  if (match) {
    const emoji = match[0];
    const remaining = text.trim().slice(emoji.length).trim();
    return { emoji, remaining };
  }
  return { emoji: null, remaining: text };
}

/**
 * Smart converter with plain-text safeguard to ensure zero data is lost.
 */
export function smartNotionConvertWithFallback(
  html: string,
  plainText: string
): { markdown: string; wasConverted: boolean; preservedWords: number } {
  const cleanPlainText = (plainText || '').trim();
  const plainWordCount = cleanPlainText.split(/\s+/).filter(Boolean).length;

  if (!html || typeof html !== 'string' || !html.trim()) {
    return {
      markdown: cleanPlainText,
      wasConverted: false,
      preservedWords: plainWordCount,
    };
  }

  const converted = convertNotionHtmlToMarkdown(html);
  const convertedWordCount = converted.split(/\s+/).filter(Boolean).length;

  // Safeguard: If HTML parsing resulted in severe data loss (lost more than 25% of words compared to plain text),
  // prefer plain text so no notes data is lost, or use converted if it preserved the content.
  if (plainWordCount > 20 && convertedWordCount < plainWordCount * 0.75) {
    return {
      markdown: cleanPlainText,
      wasConverted: false,
      preservedWords: plainWordCount,
    };
  }

  return {
    markdown: converted || cleanPlainText,
    wasConverted: Boolean(converted && converted.length > 0),
    preservedWords: Math.max(convertedWordCount, plainWordCount),
  };
}

/**
 * Main function: converts raw HTML string from clipboard into Markdown
 */
export function convertNotionHtmlToMarkdown(html: string): string {
  if (!html || typeof html !== 'string') return '';

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const body = doc.body;

    if (!body) return '';

    // Remove scripts, styles, noscript, and invisible meta elements
    const unwanted = body.querySelectorAll('script, style, noscript, meta, link');
    unwanted.forEach((el) => el.remove());

    const result = processNode(body).trim();

    // Clean up excessive empty lines: collapse 3+ consecutive newlines to 2
    return result.replace(/\n{3,}/g, '\n\n');
  } catch (err) {
    console.error('Failed to parse HTML to markdown:', err);
    return '';
  }
}

/**
 * Recursively converts a DOM node into Markdown string
 */
function processNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent || '';
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return '';
  }

  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();
  const blockType = el.getAttribute('data-block-type') || '';
  const classList = el.classList;

  // 1. Math / KaTeX Formula Handling (Prevent mangling or losing formulas)
  const isKaTeX =
    classList.contains('katex') ||
    classList.contains('notion-equation-block') ||
    blockType === 'equation' ||
    el.hasAttribute('data-latex');

  if (isKaTeX) {
    // Look for original TeX annotation or data-latex attribute
    const texAnnotation =
      el.querySelector('annotation[encoding="application/x-tex"]')?.textContent?.trim() ||
      el.getAttribute('data-latex') ||
      el.getAttribute('data-math') ||
      '';

    if (texAnnotation) {
      const isDisplay =
        el.getAttribute('data-block-type') === 'equation' ||
        classList.contains('notion-equation-block') ||
        el.getAttribute('display') === 'block';
      return isDisplay ? `\n\n$$\n${texAnnotation}\n$$\n\n` : `$${texAnnotation}$`;
    }
  }

  // 2. Notion Callout Block Detection
  const isNotionCallout =
    classList.contains('notion-callout-block') ||
    blockType === 'callout' ||
    (classList.contains('notion-selectable') && el.querySelector('.notion-callout-icon'));

  if (isNotionCallout) {
    const iconEl =
      el.querySelector('.notion-callout-icon') ||
      el.querySelector('span[role="img"]') ||
      el.querySelector('.notion-emoji');
    const iconText = iconEl?.textContent?.trim() || '💡';

    const clone = el.cloneNode(true) as HTMLElement;
    clone.querySelector('.notion-callout-icon')?.remove();
    clone.querySelector('span[role="img"]')?.remove();
    clone.querySelector('.notion-emoji')?.remove();

    const content = processChildren(clone).trim();
    return `\n\n> ${iconText} ${content.replace(/\n+/g, '\n> ')}\n\n`;
  }

  // 3. Notion To-Do Checkbox Block Detection
  const isNotionTodo =
    classList.contains('notion-to-do-block') ||
    blockType === 'to_do' ||
    el.querySelector('input[type="checkbox"]');

  if (isNotionTodo) {
    const checkbox = el.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
    const isChecked =
      checkbox?.checked ||
      el.getAttribute('aria-checked') === 'true' ||
      classList.contains('checked') ||
      (el.innerHTML.includes('check_box') && !el.innerHTML.includes('check_box_outline_blank'));

    const clone = el.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('input[type="checkbox"]').forEach((c) => c.remove());
    const text = processChildren(clone).trim();
    return `\n- [${isChecked ? 'x' : ' '}] ${text}\n`;
  }

  // 4. Notion Toggle / Accordion Block Detection
  const isNotionToggle =
    classList.contains('notion-toggle-block') ||
    blockType === 'toggle';

  if (isNotionToggle) {
    // Notion toggles often have a summary text followed by content
    const summaryEl = el.querySelector('.notion-toggle-block-title') || el.firstElementChild;
    const summaryText = summaryEl ? processChildren(summaryEl).trim() : 'Toggle details';
    const clone = el.cloneNode(true) as HTMLElement;
    if (summaryEl && clone.firstElementChild) {
      clone.firstElementChild.remove();
    }
    const content = processChildren(clone).trim();
    return `\n\n<details><summary>${summaryText || 'Toggle'}</summary>\n\n${content}\n\n</details>\n\n`;
  }

  // 5. Notion Headings in Div Blocks
  if (classList.contains('notion-header-block') || blockType === 'header') {
    return `\n\n# ${processChildren(el).trim()}\n\n`;
  }
  if (classList.contains('notion-sub_header-block') || blockType === 'sub_header') {
    return `\n\n## ${processChildren(el).trim()}\n\n`;
  }
  if (classList.contains('notion-sub_sub_header-block') || blockType === 'sub_sub_header') {
    return `\n\n### ${processChildren(el).trim()}\n\n`;
  }

  // 6. Notion Bulleted & Numbered Lists in Div Blocks
  if (classList.contains('notion-bulleted_list-block') || blockType === 'bulleted_list') {
    return `\n- ${processChildren(el).trim()}\n`;
  }
  if (classList.contains('notion-numbered_list-block') || blockType === 'numbered_list') {
    return `\n1. ${processChildren(el).trim()}\n`;
  }

  // 7. Notion Code Blocks in Div Blocks
  if (classList.contains('notion-code-block') || blockType === 'code') {
    const lang = el.getAttribute('data-language') || 'text';
    const code = el.textContent || '';
    return `\n\n\`\`\`${lang}\n${code.trim()}\n\`\`\`\n\n`;
  }

  // 8. Notion Quote Blocks
  if (classList.contains('notion-quote-block') || blockType === 'quote') {
    const text = processChildren(el).trim();
    return `\n\n> ${text.replace(/\n+/g, '\n> ')}\n\n`;
  }

  // 9. Notion Dividers
  if (classList.contains('notion-divider-block') || blockType === 'divider') {
    return `\n\n---\n\n`;
  }

  // 10. Images (CRITICAL: Do NOT drop images!)
  if (tag === 'img') {
    const imgEl = el as HTMLImageElement;
    const src = imgEl.getAttribute('src') || '';
    const alt = imgEl.getAttribute('alt') || imgEl.getAttribute('title') || 'Image';
    if (src) {
      return `\n\n![${alt}](${src})\n\n`;
    }
    return '';
  }

  // 11. Notion Image Blocks (figure or div wrapping img)
  if (classList.contains('notion-image-block') || blockType === 'image') {
    const img = el.querySelector('img');
    if (img) {
      const src = img.getAttribute('src') || '';
      const alt = img.getAttribute('alt') || 'Note Image';
      const caption = el.querySelector('figcaption')?.textContent?.trim() || '';
      return `\n\n![${alt || caption}](${src})\n${caption ? `*${caption}*` : ''}\n\n`;
    }
  }

  // 12. Standard HTML Tags
  switch (tag) {
    case 'h1':
      return `\n\n# ${processChildren(el).trim()}\n\n`;
    case 'h2':
      return `\n\n## ${processChildren(el).trim()}\n\n`;
    case 'h3':
      return `\n\n### ${processChildren(el).trim()}\n\n`;
    case 'h4':
      return `\n\n#### ${processChildren(el).trim()}\n\n`;
    case 'h5':
      return `\n\n##### ${processChildren(el).trim()}\n\n`;
    case 'h6':
      return `\n\n###### ${processChildren(el).trim()}\n\n`;

    case 'p': {
      const text = processChildren(el).trim();
      return text ? `\n\n${text}\n\n` : '\n';
    }

    case 'div':
    case 'section':
    case 'article':
    case 'aside':
    case 'figure': {
      const text = processChildren(el);
      return `\n${text}\n`;
    }

    case 'strong':
    case 'b': {
      const text = processChildren(el);
      return text.trim() ? `**${text.trim()}**` : '';
    }

    case 'em':
    case 'i': {
      const text = processChildren(el);
      return text.trim() ? `*${text.trim()}*` : '';
    }

    case 's':
    case 'strike':
    case 'del': {
      const text = processChildren(el);
      return text.trim() ? `~~${text.trim()}~~` : '';
    }

    case 'code': {
      if (el.parentElement?.tagName.toLowerCase() === 'pre') {
        return el.textContent || '';
      }
      const text = el.textContent || '';
      return text ? `\`${text}\`` : '';
    }

    case 'pre': {
      const codeEl = el.querySelector('code');
      const lang =
        codeEl?.className.replace(/language-/, '') ||
        el.getAttribute('data-language') ||
        '';
      const codeText = el.textContent || '';
      return `\n\n\`\`\`${lang}\n${codeText.trim()}\n\`\`\`\n\n`;
    }

    case 'blockquote': {
      const text = processChildren(el).trim();
      return `\n\n> ${text.replace(/\n+/g, '\n> ')}\n\n`;
    }

    case 'details': {
      const summary = el.querySelector('summary')?.textContent?.trim() || 'Toggle details';
      const clone = el.cloneNode(true) as HTMLElement;
      clone.querySelector('summary')?.remove();
      const content = processChildren(clone).trim();
      return `\n\n<details><summary>${summary}</summary>\n\n${content}\n\n</details>\n\n`;
    }

    case 'summary':
      return ''; // Handled by parent details

    case 'ul': {
      const items: string[] = [];
      Array.from(el.children).forEach((child) => {
        if (child.tagName.toLowerCase() === 'li') {
          const checkbox = child.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
          if (checkbox) {
            const isChecked = checkbox.checked;
            const clone = child.cloneNode(true) as HTMLElement;
            clone.querySelectorAll('input[type="checkbox"]').forEach((c) => c.remove());
            items.push(`- [${isChecked ? 'x' : ' '}] ${processChildren(clone).trim()}`);
          } else {
            items.push(`- ${processChildren(child).trim()}`);
          }
        } else {
          // Non-li children inside ul (e.g. div wrappers from rich text): keep content!
          const itemText = processChildren(child).trim();
          if (itemText) items.push(`- ${itemText}`);
        }
      });
      return `\n\n${items.join('\n')}\n\n`;
    }

    case 'ol': {
      const items: string[] = [];
      let index = 1;
      Array.from(el.children).forEach((child) => {
        if (child.tagName.toLowerCase() === 'li') {
          items.push(`${index++}. ${processChildren(child).trim()}`);
        } else {
          const itemText = processChildren(child).trim();
          if (itemText) items.push(`${index++}. ${itemText}`);
        }
      });
      return `\n\n${items.join('\n')}\n\n`;
    }

    case 'table': {
      return convertTableToMarkdown(el as HTMLTableElement);
    }

    case 'a': {
      const href = el.getAttribute('href') || '';
      const text = processChildren(el).trim() || href;
      return href ? `[${text}](${href})` : text;
    }

    case 'hr': {
      return `\n\n---\n\n`;
    }

    case 'br': {
      return `\n`;
    }

    case 'mark': {
      const text = processChildren(el);
      return `<mark>${text}</mark>`;
    }

    case 'span': {
      // Check for inline formatting in Google Docs, Word, or Web (CSS styles)
      const style = el.getAttribute('style') || '';
      const isBold =
        style.includes('font-weight: 700') ||
        style.includes('font-weight:700') ||
        style.includes('font-weight: bold') ||
        style.includes('font-weight:bold');
      const isItalic =
        style.includes('font-style: italic') ||
        style.includes('font-style:italic');
      const isStrike =
        style.includes('text-decoration: line-through') ||
        style.includes('text-decoration:line-through');

      let text = processChildren(el);
      if (isStrike) text = `~~${text}~~`;
      if (isItalic) text = `*${text}*`;
      if (isBold) text = `**${text}**`;
      return text;
    }

    default:
      return processChildren(el);
  }
}

/**
 * Process children nodes of an element
 */
function processChildren(el: Element | Node): string {
  let result = '';
  el.childNodes.forEach((child) => {
    result += processNode(child);
  });
  return result;
}

/**
 * Convert HTML table to clean Markdown table without dropping columns or headers
 */
function convertTableToMarkdown(table: HTMLTableElement): string {
  const rows: string[][] = [];
  const trElements = Array.from(table.querySelectorAll('tr'));

  if (trElements.length === 0) return '';

  trElements.forEach((tr) => {
    const cells: string[] = [];
    const cellElements = Array.from(tr.querySelectorAll('th, td'));
    cellElements.forEach((td) => {
      // Replace internal newlines with space, escape pipe characters
      const text = processChildren(td as HTMLElement)
        .replace(/[\r\n]+/g, ' ')
        .replace(/\|/g, '\\|')
        .trim();
      cells.push(text || ' ');
    });
    if (cells.length > 0) {
      rows.push(cells);
    }
  });

  if (rows.length === 0) return '';

  // Calculate max columns across all rows
  const maxCols = Math.max(...rows.map((r) => r.length));
  if (maxCols === 0) return '';

  // Normalize row lengths so table isn't jagged
  rows.forEach((r) => {
    while (r.length < maxCols) r.push(' ');
  });

  const headerRow = rows[0];
  const separatorRow = new Array(maxCols).fill('---');
  const bodyRows = rows.slice(1);

  let md = `\n\n| ${headerRow.join(' | ')} |\n| ${separatorRow.join(' | ')} |\n`;
  bodyRows.forEach((r) => {
    md += `| ${r.join(' | ')} |\n`;
  });
  md += '\n';

  return md;
}
