'use client';

import React, { useState, useMemo } from 'react';
import {
    AlertTriangle, AlertCircle, Info, ChevronDown, ChevronRight,
    TrendingUp, TrendingDown, Minus, Target, DollarSign, BarChart3, Percent
} from 'lucide-react';

interface ParsedReport {
    executiveSummary: string | null;
    heroKpis: { label: string; value: string }[];
    alerts: { level: 'CRITICA' | 'ATENCION' | 'INFO'; message: string }[];
    sections: { title: string; content: string }[];
}

function parseReport(content: string): ParsedReport {
    const result: ParsedReport = {
        executiveSummary: null,
        heroKpis: [],
        alerts: [],
        sections: [],
    };

    // Extract executive summary
    const summaryMatch = content.match(/<!-- EXECUTIVE_SUMMARY -->([\s\S]*?)(?=<!-- (?:HERO_KPIS|ALERTS|\/EXECUTIVE_SUMMARY) -->|## )/);
    if (summaryMatch) {
        result.executiveSummary = summaryMatch[1].trim();
    }

    // Extract hero KPIs
    const heroMatch = content.match(/<!-- HERO_KPIS -->([\s\S]*?)<!-- \/HERO_KPIS -->/);
    if (heroMatch) {
        const kpiLine = heroMatch[1].trim();
        const parts = kpiLine.split('|').map(p => p.trim()).filter(Boolean);
        parts.forEach(part => {
            const colonIndex = part.indexOf(':');
            if (colonIndex > 0) {
                result.heroKpis.push({
                    label: part.slice(0, colonIndex).trim(),
                    value: part.slice(colonIndex + 1).trim(),
                });
            }
        });
    }

    // Extract alerts
    const alertsMatch = content.match(/<!-- ALERTS -->([\s\S]*?)<!-- \/ALERTS -->/);
    if (alertsMatch) {
        const alertLines = alertsMatch[1].trim().split('\n').filter(l => l.trim());
        alertLines.forEach(line => {
            const match = line.match(/\[(CRITICA|ATENCION|INFO)\]\s*(.*)/);
            if (match) {
                result.alerts.push({
                    level: match[1] as 'CRITICA' | 'ATENCION' | 'INFO',
                    message: match[2].trim(),
                });
            }
        });
    }

    // Extract content after structured blocks — split into sections by ## headers
    let narrativeContent = content;
    // Remove structured blocks
    narrativeContent = narrativeContent.replace(/<!-- EXECUTIVE_SUMMARY -->[\s\S]*?(?=<!-- |## )/g, '');
    narrativeContent = narrativeContent.replace(/<!-- HERO_KPIS -->[\s\S]*?<!-- \/HERO_KPIS -->/g, '');
    narrativeContent = narrativeContent.replace(/<!-- ALERTS -->[\s\S]*?<!-- \/ALERTS -->/g, '');
    narrativeContent = narrativeContent.replace(/<!-- \/?EXECUTIVE_SUMMARY -->/g, '');

    // Split by ## headers
    const sectionRegex = /## (.+)/g;
    let match;
    const headerPositions: { title: string; start: number; headerEnd: number }[] = [];

    while ((match = sectionRegex.exec(narrativeContent)) !== null) {
        headerPositions.push({
            title: match[1].trim(),
            start: match.index,
            headerEnd: match.index + match[0].length,
        });
    }

    if (headerPositions.length > 0) {
        for (let i = 0; i < headerPositions.length; i++) {
            const startContent = headerPositions[i].headerEnd;
            const endContent = i + 1 < headerPositions.length ? headerPositions[i + 1].start : narrativeContent.length;
            const sectionContent = narrativeContent.slice(startContent, endContent).trim();
            if (sectionContent) {
                result.sections.push({
                    title: headerPositions[i].title,
                    content: sectionContent,
                });
            }
        }
    } else {
        // No sections found, treat entire remaining content as one section
        const cleaned = narrativeContent.trim();
        if (cleaned) {
            result.sections.push({ title: 'Reporte', content: cleaned });
        }
    }

    return result;
}

// --- Sub-components ---

function HeroKPIs({ kpis }: { kpis: { label: string; value: string }[] }) {
    if (kpis.length === 0) return null;

    const getKpiIcon = (label: string) => {
        const lower = label.toLowerCase();
        if (lower.includes('utilidad') || lower.includes('ganancia') || lower.includes('profit')) return DollarSign;
        if (lower.includes('roas')) return TrendingUp;
        if (lower.includes('tasa') || lower.includes('rate')) return Percent;
        if (lower.includes('cpa') || lower.includes('cpe')) return Target;
        return BarChart3;
    };

    const getKpiHealth = (label: string, value: string): 'good' | 'warning' | 'bad' | 'neutral' => {
        const lower = label.toLowerCase();
        const numMatch = value.replace(/[^0-9.,-]/g, '').replace(/,/g, '');
        const num = parseFloat(numMatch);
        if (isNaN(num)) return 'neutral';

        if (lower.includes('utilidad') || lower.includes('ganancia')) {
            return num > 0 ? 'good' : num === 0 ? 'warning' : 'bad';
        }
        if (lower.includes('roas')) {
            return num >= 2 ? 'good' : num >= 1.5 ? 'warning' : 'bad';
        }
        if (lower.includes('entrega')) {
            return num >= 65 ? 'good' : num >= 50 ? 'warning' : 'bad';
        }
        if (lower.includes('cancelac')) {
            return num <= 30 ? 'good' : num <= 40 ? 'warning' : 'bad';
        }
        if (lower.includes('cpa')) {
            return num <= 25000 ? 'good' : num <= 35000 ? 'warning' : 'bad';
        }
        return 'neutral';
    };

    const healthStyles: Record<string, string> = {
        good: 'border-emerald-500/30 bg-emerald-500/5',
        warning: 'border-orange-400/30 bg-orange-400/5',
        bad: 'border-red-500/30 bg-red-500/5',
        neutral: 'border-card-border bg-card',
    };

    const healthTextColor: Record<string, string> = {
        good: 'text-emerald-400',
        warning: 'text-orange-400',
        bad: 'text-red-400',
        neutral: 'text-foreground',
    };

    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mb-4">
            {kpis.map((kpi, i) => {
                const Icon = getKpiIcon(kpi.label);
                const health = getKpiHealth(kpi.label, kpi.value);
                return (
                    <div key={i} className={`rounded-xl border p-3.5 transition-all ${healthStyles[health]}`}>
                        <div className="flex items-center gap-1.5 mb-1.5">
                            <Icon className={`w-3 h-3 ${healthTextColor[health]}`} />
                            <span className="text-[9px] font-bold uppercase tracking-widest text-muted">{kpi.label}</span>
                        </div>
                        <p className={`text-lg font-black tracking-tight ${healthTextColor[health]}`}>{kpi.value}</p>
                    </div>
                );
            })}
        </div>
    );
}

function AlertsPanel({ alerts }: { alerts: { level: string; message: string }[] }) {
    if (alerts.length === 0) return null;

    const config: Record<string, { icon: typeof AlertTriangle; bg: string; border: string; text: string; label: string }> = {
        CRITICA: { icon: AlertTriangle, bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400', label: 'CRITICA' },
        ATENCION: { icon: AlertCircle, bg: 'bg-orange-400/10', border: 'border-orange-400/30', text: 'text-orange-400', label: 'ATENCION' },
        INFO: { icon: Info, bg: 'bg-blue-400/10', border: 'border-blue-400/30', text: 'text-blue-400', label: 'INFO' },
    };

    return (
        <div className="space-y-1.5 mb-4">
            {alerts.map((alert, i) => {
                const c = config[alert.level] || config.INFO;
                const Icon = c.icon;
                return (
                    <div key={i} className={`flex items-start gap-2.5 rounded-xl border p-3 ${c.bg} ${c.border}`}>
                        <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${c.text}`} />
                        <div className="flex-1 min-w-0">
                            <span className={`text-[8px] font-black uppercase tracking-widest ${c.text}`}>{c.label}</span>
                            <p className="text-xs text-foreground/90 mt-0.5 leading-relaxed">{alert.message}</p>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function MarkdownTable({ lines }: { lines: string[] }) {
    const rows = lines
        .filter(line => !line.match(/^\|[\s-:|]+\|$/))
        .map(line =>
            line.split('|').slice(1, -1).map(cell => cell.trim())
        );

    if (rows.length === 0) return null;
    const header = rows[0];
    const body = rows.slice(1);

    const getCellColor = (cell: string, colIndex: number, headerText: string) => {
        const lower = headerText.toLowerCase();
        // Status column
        if (lower.includes('estado') || lower.includes('status')) {
            if (cell.includes('BUENO') || cell.includes('🟢')) return 'text-emerald-400 font-bold';
            if (cell.includes('ATENCION') || cell.includes('🟡')) return 'text-orange-400 font-bold';
            if (cell.includes('CRITICO') || cell.includes('🔴')) return 'text-red-400 font-bold';
        }
        // Change/delta column
        if (lower.includes('cambio') || lower === 'δ%' || lower === 'delta') {
            if (cell.includes('↑') || cell.startsWith('+')) return 'text-emerald-400';
            if (cell.includes('↓') || cell.startsWith('-')) return 'text-red-400';
        }
        return '';
    };

    return (
        <div className="overflow-x-auto rounded-xl border border-card-border mb-3">
            <table className="w-full text-xs">
                <thead>
                    <tr className="bg-[#1a2332]">
                        {header.map((h, i) => (
                            <th key={i} className="text-left px-3 py-2.5 text-[9px] font-bold uppercase tracking-widest text-accent border-b border-card-border">
                                {cleanInlineMarkdown(h)}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {body.map((row, ri) => (
                        <tr key={ri} className={ri % 2 === 0 ? 'bg-card' : 'bg-[#111827]'}>
                            {row.map((cell, ci) => (
                                <td key={ci} className={`px-3 py-2 text-foreground/85 border-b border-card-border/50 ${getCellColor(cell, ci, header[ci] || '')}`}>
                                    {cleanInlineMarkdown(cell)}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function cleanInlineMarkdown(text: string): string {
    return text
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/\*(.*?)\*/g, '$1')
        .replace(/`(.*?)`/g, '$1')
        .trim();
}

function CollapsibleSection({ title, content, defaultOpen = true }: { title: string; content: string; defaultOpen?: boolean }) {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    const Icon = isOpen ? ChevronDown : ChevronRight;

    // Parse content into renderable elements
    const elements = useMemo(() => parseMarkdownContent(content), [content]);

    return (
        <div className="border border-card-border rounded-xl overflow-hidden mb-3">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center gap-2.5 px-4 py-3 bg-card hover:bg-hover-bg transition-colors text-left"
            >
                <Icon className="w-3.5 h-3.5 text-muted shrink-0" />
                <span className="text-[11px] font-black uppercase tracking-widest text-accent">{cleanInlineMarkdown(title)}</span>
            </button>
            {isOpen && (
                <div className="px-4 py-3 border-t border-card-border bg-card/50">
                    {elements}
                </div>
            )}
        </div>
    );
}

function parseMarkdownContent(content: string): React.ReactNode[] {
    const lines = content.split('\n');
    const elements: React.ReactNode[] = [];
    let i = 0;

    while (i < lines.length) {
        const line = lines[i].trim();

        // Skip empty lines
        if (line === '') {
            i++;
            continue;
        }

        // Table block
        if (line.startsWith('|')) {
            const tableLines: string[] = [];
            while (i < lines.length && lines[i].trim().startsWith('|')) {
                tableLines.push(lines[i].trim());
                i++;
            }
            elements.push(<MarkdownTable key={`table-${elements.length}`} lines={tableLines} />);
            continue;
        }

        // ### Sub-header
        if (line.startsWith('### ')) {
            elements.push(
                <h4 key={`h3-${i}`} className="text-[10px] font-bold uppercase tracking-widest text-foreground mt-3 mb-1.5">
                    {cleanInlineMarkdown(line.slice(4))}
                </h4>
            );
            i++;
            continue;
        }

        // Bold section headers (like **INGRESOS:**)
        if (line.startsWith('**') && line.endsWith('**')) {
            elements.push(
                <p key={`bold-${i}`} className="text-[10px] font-black uppercase tracking-widest text-accent mt-3 mb-1">
                    {cleanInlineMarkdown(line)}
                </p>
            );
            i++;
            continue;
        }

        // Numbered list items
        if (/^\d+\.\s/.test(line)) {
            const listItems: string[] = [];
            while (i < lines.length && /^\d+\.\s/.test(lines[i].trim())) {
                listItems.push(lines[i].trim().replace(/^\d+\.\s+/, ''));
                i++;
            }
            elements.push(
                <div key={`ol-${elements.length}`} className="space-y-1.5 mb-2">
                    {listItems.map((item, idx) => (
                        <div key={idx} className="flex items-start gap-2.5 rounded-lg bg-accent/5 border border-accent/10 px-3 py-2">
                            <span className="text-[10px] font-black text-accent mt-0.5 shrink-0">{idx + 1}</span>
                            <p className="text-xs text-foreground/85 leading-relaxed">{renderInlineMarkdown(item)}</p>
                        </div>
                    ))}
                </div>
            );
            continue;
        }

        // Bullet points
        if (line.startsWith('- ') || line.startsWith('* ')) {
            const listItems: { text: string; indent: number }[] = [];
            while (i < lines.length && (lines[i].trimStart().startsWith('- ') || lines[i].trimStart().startsWith('* '))) {
                const raw = lines[i];
                const indent = raw.length - raw.trimStart().length;
                listItems.push({
                    text: raw.trimStart().replace(/^[-*]\s+/, ''),
                    indent: indent >= 2 ? 1 : 0,
                });
                i++;
            }
            elements.push(
                <div key={`ul-${elements.length}`} className="space-y-1 mb-2">
                    {listItems.map((item, idx) => (
                        <div key={idx} className={`flex items-start gap-2 ${item.indent ? 'ml-4' : ''}`}>
                            <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${item.indent ? 'bg-muted/40' : 'bg-accent/60'}`} />
                            <p className="text-xs text-foreground/85 leading-relaxed">{renderInlineMarkdown(item.text)}</p>
                        </div>
                    ))}
                </div>
            );
            continue;
        }

        // Regular paragraph
        elements.push(
            <p key={`p-${i}`} className="text-xs text-foreground/80 leading-relaxed mb-2">
                {renderInlineMarkdown(line)}
            </p>
        );
        i++;
    }

    return elements;
}

function renderInlineMarkdown(text: string): React.ReactNode {
    // Process bold, arrows, and status indicators
    const parts: React.ReactNode[] = [];
    let remaining = text;
    let key = 0;

    while (remaining.length > 0) {
        // Bold
        const boldMatch = remaining.match(/\*\*(.*?)\*\*/);
        if (boldMatch && boldMatch.index !== undefined) {
            if (boldMatch.index > 0) {
                parts.push(<span key={key++}>{remaining.slice(0, boldMatch.index)}</span>);
            }
            parts.push(<strong key={key++} className="text-foreground font-bold">{boldMatch[1]}</strong>);
            remaining = remaining.slice(boldMatch.index + boldMatch[0].length);
            continue;
        }

        // No more matches, push remaining
        parts.push(<span key={key++}>{remaining}</span>);
        break;
    }

    return <>{parts}</>;
}

// --- Main Component ---

export function VegaReportRenderer({ content }: { content: string }) {
    const parsed = useMemo(() => parseReport(content), [content]);

    return (
        <div className="space-y-3">
            {/* Executive Summary */}
            {parsed.executiveSummary && (
                <div className="rounded-xl bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/20 p-4">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-purple-400 mb-1.5">Resumen Ejecutivo</p>
                    <p className="text-sm text-foreground/90 leading-relaxed">{parsed.executiveSummary}</p>
                </div>
            )}

            {/* Hero KPIs */}
            <HeroKPIs kpis={parsed.heroKpis} />

            {/* Alerts */}
            <AlertsPanel alerts={parsed.alerts} />

            {/* Report Sections */}
            {parsed.sections.map((section, i) => (
                <CollapsibleSection
                    key={i}
                    title={section.title}
                    content={section.content}
                    defaultOpen={i < 3}
                />
            ))}
        </div>
    );
}
