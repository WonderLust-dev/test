/**
 * Notion & Rich Text to Markdown Converter
 * Converts HTML copied from Notion, Google Docs, Word, or web pages
 * into clean, standard GitHub/Notion-flavored Markdown.
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
 * Main function: converts raw HTML string from clipboard into Markdown
 */
export function convertNotionHtmlToMarkdown(html: string): string {
  if (!html || typeof html !== 'string') return '';

  // Use browser's DOMParser to parse the HTML document cleanly
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const body = doc.body;

  if (!body) return '';

  return processNode(body).trim();
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

  // Notion-specific block detection
  const isNotionCallout =
    el.classList.contains('notion-callout-block') ||
    el.getAttribute('data-block-type') === 'callout' ||
    (el.getAttribute('style') || '').includes('border-radius') && el.querySelector('.notion-callout-icon');

  if (isNotionCallout) {
    const iconEl = el.querySelector('.notion-callout-icon') || el.querySelector('span[role="img"]');
    const iconText = iconEl?.textContent?.trim() || '💡';
    // Remove icon element from content parsing
    const clone = el.cloneNode(true) as HTMLElement;
    clone.querySelector('.notion-callout-icon')?.remove();
    clone.querySelector('span[role="img"]')?.remove();
    const content = processChildren(clone).trim();
    return `\n\n> ${iconText} ${content.replace(/\n+/g, '\n> ')}\n\n`;
  }

  // Notion To-do block detection
  const isNotionTodo =
    el.classList.contains('notion-to-do-block') ||
    el.getAttribute('data-block-type') === 'to_do' ||
    el.querySelector('input[type="checkbox"]');

  if (isNotionTodo) {
    const checkbox = el.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
    const isChecked =
      checkbox?.checked ||
      el.getAttribute('aria-checked') === 'true' ||
      el.classList.contains('checked') ||
      (el.innerHTML.includes('check_box') && !el.innerHTML.includes('check_box_outline_blank'));

    const clone = el.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('input[type="checkbox"]').forEach(c => c.remove());
    const text = processChildren(clone).trim();
    return `\n- [${isChecked ? 'x' : ' '}] ${text}\n`;
  }

  // Handle standard HTML elements
  switch (tag) {
    case 'h1': {
      const text = processChildren(el).trim();
      return `\n\n# ${text}\n\n`;
    }
    case 'h2': {
      const text = processChildren(el).trim();
      return `\n\n## ${text}\n\n`;
    }
    case 'h3': {
      const text = processChildren(el).trim();
      return `\n\n### ${text}\n\n`;
    }
    case 'h4': {
      const text = processChildren(el).trim();
      return `\n\n#### ${text}\n\n`;
    }
    case 'h5':
    case 'h6': {
      const text = processChildren(el).trim();
      return `\n\n##### ${text}\n\n`;
    }

    case 'p': {
      const text = processChildren(el).trim();
      return text ? `\n\n${text}\n\n` : '\n';
    }

    case 'div': {
      // Check for notion page content container
      const text = processChildren(el);
      return `\n${text}\n`;
    }

    case 'strong':
    case 'b': {
      const text = processChildren(el);
      return text.trim() ? `**${text}**` : '';
    }

    case 'em':
    case 'i': {
      const text = processChildren(el);
      return text.trim() ? `*${text}*` : '';
    }

    case 's':
    case 'strike':
    case 'del': {
      const text = processChildren(el);
      return text.trim() ? `~~${text}~~` : '';
    }

    case 'code': {
      // Inline code or inside pre
      if (el.parentElement?.tagName.toLowerCase() === 'pre') {
        return el.textContent || '';
      }
      const text = el.textContent || '';
      return text ? `\`${text}\`` : '';
    }

    case 'pre': {
      const codeEl = el.querySelector('code');
      const lang = codeEl?.className.replace(/language-/, '') || el.getAttribute('data-language') || '';
      const codeText = el.textContent || '';
      return `\n\n\`\`\`${lang}\n${codeText.trim()}\n\`\`\`\n\n`;
    }

    case 'blockquote': {
      const text = processChildren(el).trim();
      return `\n\n> ${text.replace(/\n+/g, '\n> ')}\n\n`;
    }

    case 'details': {
      const summary = el.querySelector('summary')?.textContent?.trim() || 'Toggle';
      const clone = el.cloneNode(true) as HTMLElement;
      clone.querySelector('summary')?.remove();
      const content = processChildren(clone).trim();
      return `\n\n<details><summary>${summary}</summary>\n\n${content}\n\n</details>\n\n`;
    }

    case 'summary':
      return ''; // Handled by details

    case 'ul': {
      const items: string[] = [];
      Array.from(el.children).forEach(child => {
        if (child.tagName.toLowerCase() === 'li') {
          // Check for todo checkbox inside li
          const checkbox = child.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
          if (checkbox) {
            const isChecked = checkbox.checked;
            const clone = child.cloneNode(true) as HTMLElement;
            clone.querySelectorAll('input[type="checkbox"]').forEach(c => c.remove());
            items.push(`- [${isChecked ? 'x' : ' '}] ${processChildren(clone).trim()}`);
          } else {
            items.push(`- ${processChildren(child).trim()}`);
          }
        }
      });
      return `\n\n${items.join('\n')}\n\n`;
    }

    case 'ol': {
      const items: string[] = [];
      let index = 1;
      Array.from(el.children).forEach(child => {
        if (child.tagName.toLowerCase() === 'li') {
          items.push(`${index++}. ${processChildren(child).trim()}`);
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

    default:
      return processChildren(el);
  }
}

/**
 * Process children nodes of an element
 */
function processChildren(el: Element | Node): string {
  let result = '';
  el.childNodes.forEach(child => {
    result += processNode(child);
  });
  return result;
}

/**
 * Convert HTML table to clean Markdown table
 */
function convertTableToMarkdown(table: HTMLTableElement): string {
  const rows: string[][] = [];
  const trElements = Array.from(table.querySelectorAll('tr'));

  if (trElements.length === 0) return '';

  trElements.forEach(tr => {
    const cells: string[] = [];
    const cellElements = Array.from(tr.querySelectorAll('th, td'));
    cellElements.forEach(td => {
      // Replace internal newlines with space
      const text = processChildren(td as HTMLElement).replace(/[\r\n]+/g, ' ').replace(/\|/g, '\\|').trim();
      cells.push(text);
    });
    if (cells.length > 0) {
      rows.push(cells);
    }
  });

  if (rows.length === 0) return '';

  // Calculate max columns
  const maxCols = Math.max(...rows.map(r => r.length));
  if (maxCols === 0) return '';

  // Normalize row lengths
  rows.forEach(r => {
    while (r.length < maxCols) r.push('');
  });

  const headerRow = rows[0];
  const separatorRow = new Array(maxCols).fill('---');
  const bodyRows = rows.slice(1);

  let md = `\n\n| ${headerRow.join(' | ')} |\n| ${separatorRow.join(' | ')} |\n`;
  bodyRows.forEach(r => {
    md += `| ${r.join(' | ')} |\n`;
  });
  md += '\n';

  return md;
}
