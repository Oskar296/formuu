'use client';

import katex from 'katex';
import { useMemo } from 'react';

function renderMathInText(text: string): string {
  // Replace display math $$...$$ first
  let result = text.replace(/\$\$([\s\S]*?)\$\$/g, (_, tex) => {
    try {
      return katex.renderToString(tex.trim(), { displayMode: true, throwOnError: false });
    } catch {
      return tex;
    }
  });
  // Replace inline math $...$
  result = result.replace(/\$([^\$]+?)\$/g, (_, tex) => {
    try {
      return katex.renderToString(tex.trim(), { displayMode: false, throwOnError: false });
    } catch {
      return tex;
    }
  });
  // Markdown-style bold **text** → <strong> (math is already rendered to HTML,
  // so this only ever touches plain text like part labels "**(a)**").
  result = result.replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>');
  return result;
}

export default function Math({ text, className = '' }: { text: string; className?: string }) {
  const html = useMemo(() => {
    const lines = text.split('\n');
    const rendered = lines.map((line) => {
      if (line.trim() === '') return '<br/>';
      return `<p class="my-1">${renderMathInText(line)}</p>`;
    });
    return rendered.join('');
  }, [text]);

  return (
    <div
      className={className}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
