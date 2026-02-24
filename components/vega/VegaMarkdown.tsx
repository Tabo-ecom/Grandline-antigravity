'use client';

import React from 'react';

interface VegaMarkdownProps {
    content: string;
    className?: string;
}

/**
 * Rich markdown renderer for Vega AI responses.
 * Parses: headers, bold, italic, lists, tables, horizontal rules, code blocks, emojis.
 */
export const VegaMarkdown: React.FC<VegaMarkdownProps> = ({ content, className = '' }) => {
    const lines = content.split('\n');
    const elements: React.ReactNode[] = [];
    let i = 0;

    while (i < lines.length) {
        const line = lines[i];
        const trimmed = line.trim();

        // Skip empty lines
        if (trimmed === '') {
            i++;
            continue;
        }

        // Table detection: line contains | and next line has |---|
        if (trimmed.includes('|') && i + 1 < lines.length && lines[i + 1]?.trim().match(/^\|?[\s-:|]+\|/)) {
            const tableLines: string[] = [];
            while (i < lines.length && lines[i].trim().includes('|')) {
                tableLines.push(lines[i].trim());
                i++;
            }
            elements.push(<MarkdownTable key={`table-${i}`} lines={tableLines} />);
            continue;
        }

        // Horizontal rule
        if (trimmed.match(/^(-{3,}|_{3,}|\*{3,})$/)) {
            elements.push(<hr key={`hr-${i}`} className="border-foreground/10 my-3" />);
            i++;
            continue;
        }

        // Headers
        if (trimmed.startsWith('### ')) {
            elements.push(
                <h4 key={`h3-${i}`} className="text-sm font-bold text-foreground mt-5 mb-2 flex items-center gap-2">
                    {renderInline(trimmed.slice(4))}
                </h4>
            );
            i++;
            continue;
        }
        if (trimmed.startsWith('## ')) {
            elements.push(
                <h3 key={`h2-${i}`} className="text-base font-bold text-foreground mt-6 mb-2 flex items-center gap-2 border-b border-foreground/10 pb-2">
                    {renderInline(trimmed.slice(3))}
                </h3>
            );
            i++;
            continue;
        }
        if (trimmed.startsWith('# ')) {
            elements.push(
                <h2 key={`h1-${i}`} className="text-lg font-bold text-foreground mt-6 mb-3 flex items-center gap-2">
                    {renderInline(trimmed.slice(2))}
                </h2>
            );
            i++;
            continue;
        }

        // Unordered list items (-, *, or numbered)
        if (trimmed.match(/^[-*]\s/) || trimmed.match(/^\d+\.\s/)) {
            const listItems: { text: string; indent: number }[] = [];
            while (i < lines.length) {
                const l = lines[i];
                const lt = l.trim();
                if (lt === '') { i++; break; }
                if (lt.match(/^[-*]\s/) || lt.match(/^\d+\.\s/)) {
                    const indent = l.length - l.trimStart().length;
                    const text = lt.replace(/^[-*]\s+/, '').replace(/^\d+\.\s+/, '');
                    listItems.push({ text, indent });
                    i++;
                } else {
                    break;
                }
            }
            elements.push(
                <ul key={`list-${i}`} className="space-y-1.5 my-2">
                    {listItems.map((item, j) => (
                        <li
                            key={j}
                            className={`flex items-start gap-2 text-sm text-foreground/80 leading-relaxed ${item.indent > 2 ? 'ml-5' : ''}`}
                        >
                            <span className="text-accent mt-1 shrink-0">&#x2022;</span>
                            <span>{renderInline(item.text)}</span>
                        </li>
                    ))}
                </ul>
            );
            continue;
        }

        // Regular paragraph
        elements.push(
            <p key={`p-${i}`} className="text-sm text-foreground/80 leading-relaxed my-1.5">
                {renderInline(trimmed)}
            </p>
        );
        i++;
    }

    return <div className={`vega-markdown-rich ${className}`}>{elements}</div>;
};

/** Inline markdown: bold, italic, code, and emoji preservation */
function renderInline(text: string): React.ReactNode {
    // Split by markdown patterns and reconstruct
    const parts: React.ReactNode[] = [];
    let remaining = text;
    let key = 0;

    while (remaining.length > 0) {
        // Bold: **text**
        const boldMatch = remaining.match(/^(.*?)\*\*(.*?)\*\*(.*)/);
        if (boldMatch) {
            if (boldMatch[1]) parts.push(<span key={key++}>{boldMatch[1]}</span>);
            parts.push(<strong key={key++} className="font-semibold text-foreground">{boldMatch[2]}</strong>);
            remaining = boldMatch[3];
            continue;
        }

        // Italic: *text* (but not **)
        const italicMatch = remaining.match(/^(.*?)\*([^*]+)\*(.*)/);
        if (italicMatch) {
            if (italicMatch[1]) parts.push(<span key={key++}>{italicMatch[1]}</span>);
            parts.push(<em key={key++} className="italic text-foreground/70">{italicMatch[2]}</em>);
            remaining = italicMatch[3];
            continue;
        }

        // Inline code: `text`
        const codeMatch = remaining.match(/^(.*?)`([^`]+)`(.*)/);
        if (codeMatch) {
            if (codeMatch[1]) parts.push(<span key={key++}>{codeMatch[1]}</span>);
            parts.push(
                <code key={key++} className="bg-foreground/5 text-accent px-1.5 py-0.5 rounded text-xs font-mono">
                    {codeMatch[2]}
                </code>
            );
            remaining = codeMatch[3];
            continue;
        }

        // No more patterns, push remaining text
        parts.push(<span key={key++}>{remaining}</span>);
        break;
    }

    return parts.length === 1 ? parts[0] : <>{parts}</>;
}

/** Markdown table renderer */
function MarkdownTable({ lines }: { lines: string[] }) {
    if (lines.length < 2) return null;

    const parseRow = (line: string) =>
        line.split('|').map(cell => cell.trim()).filter(cell => cell.length > 0 && !cell.match(/^[-:]+$/));

    const headers = parseRow(lines[0]);
    // Skip separator line (index 1)
    const rows = lines.slice(2).map(parseRow);

    if (headers.length === 0) return null;

    return (
        <div className="my-4 overflow-x-auto rounded-xl border border-foreground/10">
            <table className="w-full text-xs">
                <thead>
                    <tr className="bg-foreground/5">
                        {headers.map((h, j) => (
                            <th key={j} className="px-3 py-2.5 text-left font-semibold text-foreground/70 uppercase tracking-wider text-[10px]">
                                {renderInline(h)}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, j) => (
                        <tr key={j} className="border-t border-foreground/5 hover:bg-foreground/[0.02] transition-colors">
                            {row.map((cell, k) => {
                                // Color-code cells with arrows or status indicators
                                const hasUp = cell.includes('↑') || cell.includes('+');
                                const hasDown = cell.includes('↓');
                                const isGreen = cell.includes('🟢');
                                const isYellow = cell.includes('🟡');
                                const isRed = cell.includes('🔴');
                                let cellClass = 'text-foreground/80';
                                if (hasUp || isGreen) cellClass = 'text-emerald-400';
                                if (hasDown || isRed) cellClass = 'text-red-400';
                                if (isYellow) cellClass = 'text-amber-400';

                                return (
                                    <td key={k} className={`px-3 py-2 ${cellClass} font-medium`}>
                                        {renderInline(cell)}
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
