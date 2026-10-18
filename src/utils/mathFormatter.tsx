import React from 'react';

/**
 * Format common LaTeX symbols into clean mathematical unicode representation
 * for crisp and authentic examination rendering without needing heavy external engines.
 */
function beautifyMathFormula(latex: string): string {
  return latex
    .replace(/\\times/g, '×')
    .replace(/\\cdot/g, '·')
    .replace(/\\div/g, '÷')
    .replace(/\\pm/g, '±')
    .replace(/\\neq/g, '≠')
    .replace(/\\approx/g, '≈')
    .replace(/\\leq/g, '≤')
    .replace(/\\geq/g, '≥')
    .replace(/\\infty/g, '∞')
    .replace(/\\pi/g, 'π')
    .replace(/\\theta/g, 'θ')
    .replace(/\\alpha/g, 'α')
    .replace(/\\beta/g, 'β')
    .replace(/\\delta/g, 'δ')
    .replace(/\\Delta/g, 'Δ')
    .replace(/\\sigma/g, 'σ')
    .replace(/\\lambda/g, 'λ')
    .replace(/\\omega/g, 'ω')
    .replace(/\\sqrt\{([^}]+)\}/g, '√($1)')
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1/$2)')
    .replace(/\\text\{([^}]+)\}/g, '$1')
    .replace(/\\left\(/g, '(')
    .replace(/\\right\)/g, ')')
    .replace(/\\left\[/g, '[')
    .replace(/\\right\]/g, ']')
    .replace(/\\/g, ''); // strip remaining lone slashes
}

/**
 * Parses and formats question statements, options, passages, and notes
 * containing LaTeX formulas (\( ... \), $ ... $, $$ ... $$, \[ ... \]) into
 * high-fidelity mathematical tokens.
 */
export function formatMathText(text: string): React.ReactNode {
  if (!text) return '';
  if (!text.includes('\\(') && !text.includes('$') && !text.includes('\\[') && !text.includes('\\frac')) {
    return text;
  }

  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // 1. Block display math: $$ ... $$ or \[ ... \]
    const blockMatch = remaining.match(/^(\$\$([\s\S]*?)\$\$|\\\[([\s\S]*?)\\\])/);
    if (blockMatch) {
      const rawFormula = (blockMatch[2] || blockMatch[3] || '').trim();
      const pretty = beautifyMathFormula(rawFormula);
      parts.push(
        <div
          key={key++}
          className="my-2.5 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-600 dark:text-amber-300 font-mono text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-2xs select-all"
        >
          <span className="text-amber-500 opacity-70">📐</span>
          <span>{pretty}</span>
        </div>
      );
      remaining = remaining.slice(blockMatch[0].length);
      continue;
    }

    // 2. Inline math: \( ... \) or $ ... $
    const inlineMatch = remaining.match(/^(\\\((.*?)\\\)|\$([^$]+)\$)/);
    if (inlineMatch) {
      const rawFormula = (inlineMatch[2] || inlineMatch[3] || '').trim();
      const pretty = beautifyMathFormula(rawFormula);
      parts.push(
        <span
          key={key++}
          className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/25 text-amber-600 dark:text-amber-300 font-mono text-[11px] sm:text-xs font-bold mx-0.5 align-baseline shadow-2xs"
          title={`Formula: ${rawFormula}`}
        >
          {pretty}
        </span>
      );
      remaining = remaining.slice(inlineMatch[0].length);
      continue;
    }

    // 3. Next delimiter index
    const nextIdx = remaining.search(/(\\\(|\$\$|\\\[|\$)/);
    if (nextIdx === -1) {
      parts.push(remaining);
      break;
    } else if (nextIdx > 0) {
      parts.push(remaining.slice(0, nextIdx));
      remaining = remaining.slice(nextIdx);
    } else {
      parts.push(remaining[0]);
      remaining = remaining.slice(1);
    }
  }

  return <React.Fragment>{parts}</React.Fragment>;
}
