'use client';

import React, { useState, useMemo } from 'react';
import {
    ChevronDown, ChevronRight, TrendingUp, Target, DollarSign, Percent
} from 'lucide-react';
import { evaluateHealth, findTarget } from '@/lib/utils/health';
import { DEFAULT_KPI_TARGETS } from '@/lib/types/kpi-targets';
import type { VegaReportMetadata } from '@/lib/types/vega';

// --- Types ---

interface ParsedReport {
    executiveSummary: string | null;
    alerts: { level: 'CRITICA' | 'ATENCION' | 'INFO'; message: string }[];
    sections: { title: string; content: string }[];
}

interface VegaReportRendererProps {
    content: string;
    metadata?: VegaReportMetadata;
    reportType?: string;
    expandAll?: boolean;
}

// --- Constants ---

const REPORT_TITLES: Record<string, { type: string; title: string; subtitle: string; healthLabel: string }> = {
    daily: { type: 'Reporte Diario', title: 'El Latido del Negocio', subtitle: 'Resumen operativo y financiero del dia', healthLabel: 'Estado del Dia' },
    weekly: { type: 'Reporte Semanal', title: 'La Brujula Tactica', subtitle: 'Analisis tactico y rendimiento de la semana', healthLabel: 'Estado de la Semana' },
    monthly: { type: 'Reporte Mensual', title: 'La Vision del Almirante', subtitle: 'Panorama completo, P&L y proyecciones estrategicas', healthLabel: 'Estado del Mes' },
    audit: { type: 'Auditoria Completa', title: 'Diagnostico Integral', subtitle: 'Evaluacion completa de metricas, operacion y finanzas', healthLabel: 'Estado General' },
    efficiency: { type: 'Eficiencia Operativa', title: 'Eficiencia Operativa', subtitle: 'Tasas de entrega, cancelacion y rendimiento logistico', healthLabel: 'Eficiencia' },
    ads: { type: 'Rendimiento en Ads', title: 'Rendimiento Publicitario', subtitle: 'ROAS, CPA, plataformas y optimizacion de campanas', healthLabel: 'Salud Publicitaria' },
    profitability: { type: 'Analisis de Rentabilidad', title: 'Rentabilidad del Negocio', subtitle: 'Margenes, costos, P&L y sostenibilidad', healthLabel: 'Rentabilidad' },
};

const HEALTH_BADGE_STYLES: Record<string, { bg: string; border: string; text: string; dot: string }> = {
    'EXCELENTE': { bg: 'bg-emerald-500/15', border: 'border-emerald-500/30', text: 'text-emerald-400', dot: 'bg-emerald-400 shadow-[0_0_12px_theme(colors.emerald.400)]' },
    'MUY BUENO': { bg: 'bg-blue-500/15', border: 'border-blue-500/30', text: 'text-blue-400', dot: 'bg-blue-400 shadow-[0_0_12px_theme(colors.blue.400)]' },
    'BUENO': { bg: 'bg-blue-500/15', border: 'border-blue-500/30', text: 'text-blue-400', dot: 'bg-blue-400 shadow-[0_0_12px_theme(colors.blue.400)]' },
    'ALERTA': { bg: 'bg-orange-500/15', border: 'border-orange-500/30', text: 'text-orange-400', dot: 'bg-orange-400 shadow-[0_0_12px_theme(colors.orange.400)]' },
    'CRITICO': { bg: 'bg-red-500/15', border: 'border-red-500/30', text: 'text-red-400', dot: 'bg-red-400 shadow-[0_0_12px_theme(colors.red.400)]' },
};

const ACTION_TAG_STYLES: Record<string, string> = {
    'ESCALAR': 'bg-emerald-500/10 text-emerald-400',
    'PAUSAR': 'bg-red-500/10 text-red-400',
    'OPTIMIZAR': 'bg-orange-500/10 text-orange-400',
    'MONITOREAR': 'bg-blue-500/10 text-blue-400',
    'REASIGNAR': 'bg-purple-500/10 text-purple-400',
    'NEGOCIAR': 'bg-cyan-500/10 text-cyan-400',
};

const COUNTRY_FLAGS: Record<string, string> = {
    'Colombia': '\u{1F1E8}\u{1F1F4}',
    'Ecuador': '\u{1F1EA}\u{1F1E8}',
    'Panama': '\u{1F1F5}\u{1F1E6}',
    'Panam\u00e1': '\u{1F1F5}\u{1F1E6}',
    'Guatemala': '\u{1F1EC}\u{1F1F9}',
};

// --- Parser ---

function parseReport(content: string): ParsedReport {
    const result: ParsedReport = { executiveSummary: null, alerts: [], sections: [] };

    // Extract executive summary — try tagged version first, fallback to text before first ## or alerts
    const summaryMatch = content.match(/<!-- EXECUTIVE_SUMMARY -->([\s\S]*?)(?=<!-- (?:HERO_KPIS|ALERTS|\/EXECUTIVE_SUMMARY) -->|## )/);
    if (summaryMatch) {
        result.executiveSummary = summaryMatch[1].trim();
    } else {
        // Fallback: grab text before the first ## heading or <!-- ALERTS --> as summary
        const firstMarker = content.search(/(?:## |<!-- ALERTS|<!-- HERO_KPIS|\[CRITICA\]|\[ATENCION\]|\[INFO\])/);
        if (firstMarker > 0) {
            const candidate = content.slice(0, firstMarker).replace(/<!-- \/?EXECUTIVE_SUMMARY -->/g, '').trim();
            if (candidate.length > 20) result.executiveSummary = candidate;
        }
    }

    // Extract alerts — try with closing tag first, then fallback to unclosed block
    const alertsMatch = content.match(/<!-- ALERTS -->([\s\S]*?)<!-- \/ALERTS -->/);
    const alertsBlock = alertsMatch
        ? alertsMatch[1]
        : (() => {
            // Fallback: <!-- ALERTS --> without closing tag — grab until next ## or end
            const unclosed = content.match(/<!-- ALERTS -->([\s\S]*?)(?=## |$)/);
            return unclosed ? unclosed[1] : null;
        })();

    if (alertsBlock) {
        alertsBlock.trim().split('\n').filter(l => l.trim()).forEach(line => {
            const match = line.match(/\[(CRITICA|ATENCION|INFO)\]\s*(.*)/);
            if (match) result.alerts.push({ level: match[1] as 'CRITICA' | 'ATENCION' | 'INFO', message: match[2].trim() });
        });
    }

    // Also scan the full content for standalone [CRITICA]/[ATENCION]/[INFO] lines not inside ## sections
    // (handles cases where AI puts alerts without any <!-- ALERTS --> wrapper)
    if (result.alerts.length === 0) {
        const preSection = content.split(/## /)[0] || '';
        preSection.split('\n').forEach(line => {
            const match = line.trim().match(/^\[(CRITICA|ATENCION|INFO)\]\s*(.*)/);
            if (match) result.alerts.push({ level: match[1] as 'CRITICA' | 'ATENCION' | 'INFO', message: match[2].trim() });
        });
    }

    // Strip structured blocks from narrative
    let narrative = content;
    narrative = narrative.replace(/<!-- EXECUTIVE_SUMMARY -->[\s\S]*?(?=<!-- |## )/g, '');
    narrative = narrative.replace(/<!-- HERO_KPIS -->[\s\S]*?<!-- \/HERO_KPIS -->/g, '');
    narrative = narrative.replace(/<!-- ALERTS -->[\s\S]*?<!-- \/ALERTS -->/g, '');
    // Also strip unclosed alerts block (<!-- ALERTS --> ... until ## or end)
    narrative = narrative.replace(/<!-- ALERTS -->[\s\S]*?(?=## |$)/g, '');
    narrative = narrative.replace(/<!-- \/?EXECUTIVE_SUMMARY -->/g, '');
    // Remove any remaining HTML comment tags
    narrative = narrative.replace(/<!-- ?\/?[A-Z_]+ ?-->/g, '');
    // Remove standalone alert lines before first section (already parsed above)
    const firstH2 = narrative.indexOf('## ');
    if (firstH2 > 0) {
        const preContent = narrative.slice(0, firstH2);
        const cleanedPre = preContent.split('\n').filter(l => !l.trim().match(/^\[(CRITICA|ATENCION|INFO)\]\s/)).join('\n');
        narrative = cleanedPre + narrative.slice(firstH2);
    }

    const sectionRegex = /## (.+)/g;
    let match;
    const headers: { title: string; start: number; headerEnd: number }[] = [];
    while ((match = sectionRegex.exec(narrative)) !== null) {
        headers.push({ title: match[1].trim(), start: match.index, headerEnd: match.index + match[0].length });
    }

    if (headers.length > 0) {
        for (let i = 0; i < headers.length; i++) {
            const endContent = i + 1 < headers.length ? headers[i + 1].start : narrative.length;
            const sectionContent = narrative.slice(headers[i].headerEnd, endContent).trim();
            if (sectionContent) result.sections.push({ title: headers[i].title, content: sectionContent });
        }
    } else {
        const cleaned = narrative.trim();
        if (cleaned) result.sections.push({ title: 'Reporte', content: cleaned });
    }

    return result;
}

// --- Helpers ---

function fmt(n: number): string {
    if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
    return `$${Math.round(n).toLocaleString('es-CO')}`;
}

function fmtFull(n: number): string {
    return `$${Math.round(n).toLocaleString('es-CO')}`;
}

function pct(n: number): string {
    return `${n.toFixed(1)}%`;
}

function getHealthClass(status: 'good' | 'warning' | 'bad'): { border: string; bg: string; text: string; accent: string } {
    const map = {
        good: { border: 'border-emerald-500/30', bg: 'bg-emerald-500/5', text: 'text-emerald-400', accent: 'bg-emerald-500' },
        warning: { border: 'border-orange-400/30', bg: 'bg-orange-400/5', text: 'text-orange-400', accent: 'bg-orange-400' },
        bad: { border: 'border-red-500/30', bg: 'bg-red-500/5', text: 'text-red-400', accent: 'bg-red-500' },
    };
    return map[status];
}

function getSectionIcon(title: string): string {
    const lower = title.toLowerCase();
    if (lower.includes('resumen') || lower.includes('dashboard') || lower.includes('ejecutivo')) return '\u{1F4CA}';
    if (lower.includes('producto') || lower.includes('rentabilidad')) return '\u{1F4E6}';
    if (lower.includes('pais') || lower.includes('país')) return '\u{1F30E}';
    if (lower.includes('publicit') || lower.includes('ads') || lower.includes('campañ')) return '\u{1F4E3}';
    if (lower.includes('recomend') || lower.includes('plan') || lower.includes('táctico') || lower.includes('tactico')) return '\u{1F3AF}';
    if (lower.includes('p&l') || lower.includes('resultado') || lower.includes('estado')) return '\u{1F4B0}';
    if (lower.includes('tendencia') || lower.includes('proyecc')) return '\u{1F52E}';
    if (lower.includes('roadmap')) return '\u{1F5FA}\u{FE0F}';
    if (lower.includes('eficiencia') || lower.includes('logistic') || lower.includes('diagnóstico') || lower.includes('diagnostico')) return '\u{2699}\u{FE0F}';
    if (lower.includes('problema') || lower.includes('cuello')) return '\u{26A0}\u{FE0F}';
    if (lower.includes('oportunidad')) return '\u{1F4A1}';
    if (lower.includes('acción') || lower.includes('accion') || lower.includes('mejora') || lower.includes('optimiz')) return '\u{1F527}';
    return '\u{1F4CB}';
}

function getSectionIconBg(title: string): string {
    const lower = title.toLowerCase();
    if (lower.includes('recomend') || lower.includes('plan') || lower.includes('roadmap') || lower.includes('acción') || lower.includes('accion')) return 'bg-accent/10';
    if (lower.includes('publicit') || lower.includes('ads')) return 'bg-purple-500/10';
    if (lower.includes('pais') || lower.includes('país') || lower.includes('resumen') || lower.includes('dashboard')) return 'bg-blue-500/10';
    if (lower.includes('p&l') || lower.includes('resultado') || lower.includes('producto')) return 'bg-accent/10';
    if (lower.includes('tendencia') || lower.includes('proyecc')) return 'bg-emerald-500/10';
    return 'bg-blue-500/10';
}

// --- Visual Components ---

function Portada({ reportType, healthLevel }: { reportType: string; healthLevel?: string }) {
    const info = REPORT_TITLES[reportType] || REPORT_TITLES.daily;
    const style = healthLevel ? (HEALTH_BADGE_STYLES[healthLevel] || HEALTH_BADGE_STYLES['BUENO']) : null;
    const now = new Date();
    const dateStr = now.toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    return (
        <div className="text-center py-10 px-8 border border-card-border rounded-3xl mb-6 relative overflow-hidden"
            style={{ background: 'linear-gradient(135deg, rgba(215,92,51,0.05) 0%, transparent 50%, rgba(139,92,246,0.05) 100%)' }}>
            <div className="absolute -top-1/2 -left-1/2 w-[200%] h-[200%] pointer-events-none"
                style={{ background: 'radial-gradient(circle at 30% 30%, rgba(215,92,51,0.08) 0%, transparent 50%)' }} />
            <div className="relative z-10">
                <div className="flex items-center justify-center gap-3 mb-5">
                    <img src="/logos/vega-logo.png" alt="VEGA" className="h-10 hidden dark:block" />
                    <img src="/logos/vega-logo-dark.png" alt="VEGA" className="h-10 block dark:hidden" />
                    <div className="w-1.5 h-1.5 rounded-full bg-accent opacity-50" />
                    <img src="/logos/grandline-logo.png" alt="Grand Line" className="h-10 hidden dark:block" />
                    <img src="/logos/grandline-logo-dark.png" alt="Grand Line" className="h-10 block dark:hidden" />
                </div>
                <p className="text-[10px] font-black tracking-[0.3em] uppercase text-accent mb-2">{info.type}</p>
                <h1 className="text-2xl md:text-3xl font-black tracking-tight mb-1.5">{info.title}</h1>
                <p className="text-sm text-muted font-medium">{info.subtitle}</p>
                <div className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-foreground/5 border border-card-border rounded-full">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-xs font-semibold text-muted capitalize">{dateStr}</span>
                </div>
                {style && healthLevel && (
                    <div className="mt-4">
                        <div className={`inline-flex items-center gap-2.5 px-6 py-3 rounded-2xl border-2 text-sm font-black uppercase tracking-[0.1em] ${style.bg} ${style.border} ${style.text}`}>
                            <div className={`w-3 h-3 rounded-full ${style.dot}`} />
                            {info.healthLabel}: {healthLevel}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function SectionHeader({ title, icon, iconBg }: { title: string; icon?: string; iconBg?: string }) {
    const emoji = icon || getSectionIcon(title);
    const bg = iconBg || getSectionIconBg(title);
    return (
        <div className="flex items-center gap-3 mb-4 mt-8">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-base ${bg}`}>
                {emoji}
            </div>
            <h2 className="text-sm font-black uppercase tracking-[0.08em] text-foreground">{title}</h2>
            <div className="flex-1 h-px bg-card-border" />
        </div>
    );
}

function ExecutiveSummary({ text }: { text: string }) {
    return (
        <div className="rounded-2xl bg-card border border-card-border border-l-[3px] border-l-accent px-6 py-5 mb-6">
            <p className="text-[10px] font-black tracking-[0.2em] uppercase text-accent mb-2">Resumen Ejecutivo</p>
            <p className="text-sm text-foreground leading-relaxed" dangerouslySetInnerHTML={{
                __html: text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            }} />
        </div>
    );
}

function HeroKPIs({ metadata, reportType }: { metadata: VegaReportMetadata; reportType: string }) {
    const k = metadata.kpis as any;
    const prev = metadata.prevKpis as any;
    const targets = DEFAULT_KPI_TARGETS;
    const isDaily = reportType === 'daily';

    const cards: { label: string; value: string; key: string; raw: number; icon: typeof DollarSign; iconLabel: string }[] = isDaily
        ? [
            { label: 'Utilidad Proyectada', value: fmt(k.utilidad_proyectada || 0), key: 'u_proy', raw: k.utilidad_proyectada || 0, icon: DollarSign, iconLabel: '$' },
            { label: 'ROAS Real', value: `${(k.roas_real || 0).toFixed(2)}x`, key: 'roas_real', raw: k.roas_real || 0, icon: TrendingUp, iconLabel: 'R' },
            { label: 'CPA', value: fmt(k.cpa || 0), key: 'cpa', raw: k.cpa || 0, icon: Target, iconLabel: 'C' },
        ]
        : [
            { label: 'Utilidad Real', value: fmt(k.u_real || 0), key: 'u_real', raw: k.u_real || 0, icon: DollarSign, iconLabel: '$' },
            { label: 'ROAS Real', value: `${(k.roas_real || 0).toFixed(2)}x`, key: 'roas_real', raw: k.roas_real || 0, icon: TrendingUp, iconLabel: 'R' },
            { label: 'Tasa Entrega', value: pct(k.tasa_ent || 0), key: 'tasa_ent', raw: k.tasa_ent || 0, icon: Percent, iconLabel: '%' },
            { label: 'CPA', value: fmt(k.cpa || 0), key: 'cpa', raw: k.cpa || 0, icon: Target, iconLabel: 'C' },
        ];

    return (
        <div className={`grid gap-3 mb-6 ${isDaily ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-2 lg:grid-cols-4'}`}>
            {cards.map((card, i) => {
                let status: 'good' | 'warning' | 'bad' = 'good';
                if (card.key === 'u_real' || card.key === 'u_proy') {
                    status = card.raw > 0 ? 'good' : card.raw === 0 ? 'warning' : 'bad';
                } else {
                    const target = findTarget(targets, card.key);
                    if (target) status = evaluateHealth(card.raw, target);
                }
                const hc = getHealthClass(status);

                let change: string | null = null;
                let changeUp = true;
                if (prev) {
                    const prevKey = card.key === 'u_proy' ? 'utilidad_proyectada' : card.key;
                    const prevVal = prev[prevKey];
                    if (prevVal !== undefined && prevVal !== 0) {
                        const delta = ((card.raw - prevVal) / Math.abs(prevVal)) * 100;
                        change = `${delta > 0 ? '+' : ''}${delta.toFixed(1)}% vs anterior`;
                        changeUp = delta > 0;
                    }
                }

                const target = findTarget(targets, card.key);

                return (
                    <div key={i} className={`rounded-2xl border p-5 relative overflow-hidden ${hc.border} bg-card`}>
                        <div className={`absolute top-0 left-0 right-0 h-[3px] ${hc.accent}`} />
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted">{card.label}</span>
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black ${hc.bg} ${hc.text}`}>
                                {card.iconLabel}
                            </div>
                        </div>
                        <p className={`text-2xl font-black tracking-tight mb-1 ${hc.text}`}>{card.value}</p>
                        {change && (
                            <p className={`text-xs font-semibold flex items-center gap-1 ${changeUp ? 'text-emerald-400' : 'text-red-400'}`}>
                                {changeUp ? '\u2191' : '\u2193'} {change}
                            </p>
                        )}
                        {target && (
                            <p className="text-[10px] text-muted mt-1">
                                Meta: {card.key === 'cpa' ? `< $${(target.good || 0).toLocaleString('es-CO')}` :
                                    card.key === 'roas_real' ? `> ${target.good}x` :
                                        card.key === 'tasa_ent' ? `> ${target.good}%` :
                                            `> ${target.good}`}
                            </p>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

function AdsSummaryCard({ metadata }: { metadata: VegaReportMetadata }) {
    const k = metadata.kpis as any;
    const platforms = metadata.adPlatformMetrics;
    if (!platforms) return null;

    const totalAds = k.g_ads || 0;
    if (totalAds === 0) return null;

    const adsRevPct = k.perc_ads_revenue || 0;
    const target = findTarget(DEFAULT_KPI_TARGETS, 'perc_ads_revenue');
    const adsStatus = target ? evaluateHealth(adsRevPct, target) : 'warning';
    const adsHc = getHealthClass(adsStatus);

    const ingReal = k.ing_real || 0;
    const platData = [
        { name: 'Facebook', spend: platforms.fb, color: '#1877F2', roas: ingReal > 0 && platforms.fb > 0 ? (ingReal * (platforms.fb / totalAds)) / platforms.fb : 0 },
        { name: 'TikTok', spend: platforms.tiktok, color: '#00f2ea', roas: ingReal > 0 && platforms.tiktok > 0 ? (ingReal * (platforms.tiktok / totalAds)) / platforms.tiktok : 0 },
        { name: 'Google', spend: platforms.google, color: '#4285F4', roas: ingReal > 0 && platforms.google > 0 ? (ingReal * (platforms.google / totalAds)) / platforms.google : 0 },
    ].filter(p => p.spend > 0);

    return (
        <div className="rounded-2xl border border-card-border bg-card p-6 mb-6">
            <div className="flex items-center justify-between mb-5">
                <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted mb-1">Gasto Publicitario</p>
                    <p className="text-2xl font-black font-mono tracking-tight text-foreground">{fmtFull(totalAds)} <span className="text-sm text-muted font-normal">COP</span></p>
                </div>
                <div className="text-right">
                    <p className="text-[10px] font-black uppercase tracking-[0.12em] text-muted mb-1">% Ads vs Revenue</p>
                    <p className={`text-xl font-black font-mono ${adsHc.text}`}>{pct(adsRevPct)}</p>
                </div>
            </div>
            {platData.length > 0 && (
                <>
                    <div className="grid grid-cols-3 gap-3 mb-4">
                        {platData.map((p, i) => {
                            const roasStatus = p.roas >= 2.5 ? 'text-emerald-400' : p.roas >= 1.5 ? 'text-orange-400' : 'text-red-400';
                            return (
                                <div key={i} className="rounded-xl bg-hover-bg p-4 text-center border border-card-border/50" style={{ borderTop: `3px solid ${p.color}` }}>
                                    <p className="text-[9px] font-black uppercase tracking-[0.12em] text-muted mb-2">{p.name}</p>
                                    <p className="text-lg font-black font-mono text-foreground mb-0.5">{fmt(p.spend)}</p>
                                    {p.roas > 0 && <p className={`text-xs font-bold ${roasStatus}`}>ROAS {p.roas.toFixed(1)}x</p>}
                                </div>
                            );
                        })}
                    </div>
                    <div>
                        <div className="flex justify-between text-[10px] font-semibold text-muted mb-1.5">
                            <span>Distribucion del gasto</span>
                            <span>{platData.map(p => `${p.name.slice(0, 2)} ${totalAds > 0 ? Math.round((p.spend / totalAds) * 100) : 0}%`).join(' | ')}</span>
                        </div>
                        <div className="h-2 rounded-full bg-hover-bg flex overflow-hidden gap-[2px]">
                            {platData.map((p, i) => (
                                <div key={i} className="h-full" style={{
                                    width: `${(p.spend / totalAds) * 100}%`,
                                    background: p.color,
                                    borderRadius: i === 0 ? '4px 0 0 4px' : i === platData.length - 1 ? '0 4px 4px 0' : '0',
                                }} />
                            ))}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

function AlertsPanel({ alerts }: { alerts: { level: string; message: string }[] }) {
    if (alerts.length === 0) return null;

    const config: Record<string, { bg: string; border: string; text: string; badgeBg: string; label: string }> = {
        CRITICA: { bg: 'bg-red-500/10', border: 'border-red-500/20', text: 'text-red-400', badgeBg: 'bg-red-500/20', label: 'Critica' },
        ATENCION: { bg: 'bg-orange-400/10', border: 'border-orange-400/20', text: 'text-orange-400', badgeBg: 'bg-orange-400/20', label: 'Atencion' },
        INFO: { bg: 'bg-blue-400/10', border: 'border-blue-400/20', text: 'text-blue-400', badgeBg: 'bg-blue-400/20', label: 'Info' },
    };

    return (
        <div className="space-y-2 mb-6">
            {alerts.map((alert, i) => {
                const c = config[alert.level] || config.INFO;
                return (
                    <div key={i} className={`flex items-start gap-3 rounded-xl border p-3.5 ${c.bg} ${c.border} ${c.text}`}>
                        <span className={`text-[9px] font-black uppercase tracking-[0.15em] px-2 py-0.5 rounded-md shrink-0 mt-0.5 ${c.badgeBg}`}>
                            {c.label}
                        </span>
                        <span className="text-xs font-semibold leading-relaxed min-w-0">{alert.message}</span>
                    </div>
                );
            })}
        </div>
    );
}

function TwoColumnProducts({ metadata, reportType }: { metadata: VegaReportMetadata; reportType: string }) {
    const allProducts: any[] = [];
    metadata.metricsByCountry.forEach(c => {
        c.products.forEach(p => allProducts.push({ ...p, country: c.countryName }));
    });
    if (allProducts.length === 0) return null;

    const profitable = allProducts.filter(p => p.utilProy > 0).sort((a, b) => b.utilProy - a.utilProy);
    const losing = allProducts.filter(p => p.utilProy <= 0).sort((a, b) => a.utilProy - b.utilProy);

    const isMonthly = reportType === 'monthly';
    const utilLabel = isMonthly ? 'Util. Real' : 'Util. Proy.';
    const utilField = isMonthly ? 'utilReal' : 'utilProy';
    const lossLabel = isMonthly ? 'Perdida' : 'Util. Proy.';

    const renderProductRow = (p: any, isLoss: boolean) => {
        const utilValue = p[utilField] || p.utilProy || 0;
        const roas = p.ads > 0 ? ((p.utilReal || 0) + (p.ads || 0)) / p.ads : 0;
        return (
            <div className="flex items-center justify-between px-5 py-3 border-b border-card-border/20 bg-card hover:bg-hover-bg transition-colors last:border-b-0">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                        <p className="text-xs font-bold text-foreground truncate max-w-[200px]">{p.name}</p>
                        {isLoss && p.lossStreak && p.lossStreak >= 2 && (
                            <span className="inline-flex items-center gap-1 text-[9px] font-black px-1.5 py-0.5 rounded-md bg-red-500/15 text-red-400 shrink-0 tracking-wide">
                                {'\u{1F525}'} {p.lossStreak} dias en perdida
                            </span>
                        )}
                    </div>
                    <p className="text-[10px] text-muted mt-0.5">{p.n_ord} ordenes &middot; {p.country}</p>
                </div>
                <div className="flex gap-4 shrink-0">
                    <div className="text-right">
                        <p className="text-[8px] font-bold text-muted uppercase tracking-wider">{isLoss ? lossLabel : utilLabel}</p>
                        <p className={`text-sm font-black font-mono ${isLoss ? 'text-red-400' : 'text-emerald-400'}`}>{fmt(utilValue)}</p>
                    </div>
                    {roas > 0 && (
                        <div className="text-right">
                            <p className="text-[8px] font-bold text-muted uppercase tracking-wider">ROAS</p>
                            <p className={`text-sm font-black font-mono ${roas >= 2 ? 'text-emerald-400' : roas >= 1.5 ? 'text-orange-400' : 'text-red-400'}`}>{roas.toFixed(1)}x</p>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <>
            <SectionHeader title="Rentabilidad por Producto" icon={'\u{1F4E6}'} iconBg="bg-accent/10" />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
                <div className="rounded-2xl border border-card-border overflow-hidden">
                    <div className="flex items-center gap-2 px-5 py-3 bg-emerald-500/10 border-b border-emerald-500/15">
                        <span className="text-[10px] font-black uppercase tracking-[0.15em] text-emerald-400">
                            {'\u2705'} Generando Ganancia
                        </span>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400">{profitable.length} productos</span>
                    </div>
                    {profitable.length === 0 ? (
                        <div className="px-5 py-8 text-center bg-card"><p className="text-xs text-muted italic">Sin productos rentables</p></div>
                    ) : profitable.slice(0, 10).map((p, i) => <React.Fragment key={i}>{renderProductRow(p, false)}</React.Fragment>)}
                </div>
                <div className="rounded-2xl border border-card-border overflow-hidden">
                    <div className="flex items-center gap-2 px-5 py-3 bg-red-500/10 border-b border-red-500/15">
                        <span className="text-[10px] font-black uppercase tracking-[0.15em] text-red-400">
                            {'\u274C'} Generando Perdida
                        </span>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-red-500/20 text-red-400">{losing.length} productos</span>
                    </div>
                    {losing.length === 0 ? (
                        <div className="px-5 py-8 text-center bg-card"><p className="text-xs text-muted italic">Todos los productos son rentables</p></div>
                    ) : losing.slice(0, 10).map((p, i) => <React.Fragment key={i}>{renderProductRow(p, true)}</React.Fragment>)}
                </div>
            </div>
        </>
    );
}

function CountryBreakdown({ metadata }: { metadata: VegaReportMetadata }) {
    if (metadata.metricsByCountry.length === 0) return null;

    return (
        <>
            <SectionHeader title="Desglose por Pais" icon={'\u{1F30E}'} iconBg="bg-blue-500/10" />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
                {metadata.metricsByCountry.map((c, i) => {
                    const ck = c.kpis as any;
                    const flag = COUNTRY_FLAGS[c.countryName] || '\u{1F30E}';
                    const cUtilProy = c.products.reduce((s: number, p: any) => s + (p.utilProy || 0), 0);
                    const best = [...c.products].sort((a: any, b: any) => b.utilProy - a.utilProy)[0];
                    const worst = [...c.products].sort((a: any, b: any) => a.utilProy - b.utilProy)[0];

                    const roas = ck?.g_ads > 0 ? (ck?.ing_real || 0) / ck.g_ads : 0;
                    const roasColor = roas >= 2.5 ? 'text-emerald-400' : roas >= 1.5 ? 'text-orange-400' : roas > 0 ? 'text-red-400' : 'text-foreground';

                    return (
                        <div key={i} className="rounded-2xl border border-card-border bg-card p-5">
                            <div className="flex items-center gap-2.5 mb-4">
                                <span className="text-2xl">{flag}</span>
                                <span className="text-base font-black uppercase tracking-wide">{c.countryName}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-3 mb-3">
                                <div className="rounded-lg bg-hover-bg p-3">
                                    <p className="text-[9px] font-bold text-muted uppercase tracking-wider">Ordenes</p>
                                    <p className="text-lg font-black font-mono">{ck?.n_ord || 0}</p>
                                </div>
                                <div className="rounded-lg bg-hover-bg p-3">
                                    <p className="text-[9px] font-bold text-muted uppercase tracking-wider">Facturacion</p>
                                    <p className="text-lg font-black font-mono">{fmt(ck?.fact_neto || 0)}</p>
                                </div>
                                <div className="rounded-lg bg-hover-bg p-3">
                                    <p className="text-[9px] font-bold text-muted uppercase tracking-wider">Util. Proy.</p>
                                    <p className={`text-lg font-black font-mono ${cUtilProy >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmt(cUtilProy)}</p>
                                </div>
                                <div className="rounded-lg bg-hover-bg p-3">
                                    <p className="text-[9px] font-bold text-muted uppercase tracking-wider">ROAS</p>
                                    <p className={`text-lg font-black font-mono ${roasColor}`}>{roas > 0 ? `${roas.toFixed(1)}x` : 'N/A'}</p>
                                </div>
                            </div>
                            {best && best.utilProy > 0 && (
                                <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/10 px-3.5 py-2 mb-1.5">
                                    <p className="text-[10px] text-emerald-400 font-semibold">
                                        {'\u2B50'} <strong>Estrella:</strong> {best.name} (ROAS {best.ads > 0 ? (((best.utilReal || 0) + (best.ads || 0)) / best.ads).toFixed(1) : '?'}x)
                                    </p>
                                </div>
                            )}
                            {worst && worst.utilProy < 0 && (
                                <div className="rounded-lg bg-red-500/5 border border-red-500/10 px-3.5 py-2">
                                    <p className="text-[10px] text-red-400 font-semibold">
                                        {'\u26A0'} <strong>En riesgo:</strong> {worst.name} (U.Proy {fmt(worst.utilProy)})
                                    </p>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </>
    );
}

function PLSection({ metadata }: { metadata: VegaReportMetadata }) {
    const k = metadata.kpis as any;
    if (!k.fact_neto && !k.ing_real) return null;

    const sections: { header: string; headerClass: string; rows: { label: string; value: number; pct?: number; highlight?: boolean; muted?: boolean }[] }[] = [
        {
            header: 'Ingresos',
            headerClass: 'text-emerald-400 bg-emerald-500/10',
            rows: [
                { label: 'Facturacion Neta', value: k.fact_neto || 0 },
                { label: 'Ingreso Real (Entregados)', value: k.ing_real || 0 },
            ],
        },
        {
            header: 'Costos Variables',
            headerClass: 'text-red-400 bg-red-500/10',
            rows: [
                { label: 'Costo de Producto', value: -(k.cpr || 0), pct: k.ing_real ? ((k.cpr / k.ing_real) * 100) : 0 },
                { label: 'Fletes Entrega', value: -(k.fl_ent || 0) },
                { label: 'Fletes Devolucion', value: -(k.fl_dev || 0) },
                { label: 'Fletes Transito', value: -(k.fl_tra || 0), muted: true },
                { label: 'Gasto Publicitario', value: -(k.g_ads || 0), pct: k.fact_neto ? ((k.g_ads / k.fact_neto) * 100) : 0 },
            ],
        },
        {
            header: 'Resultado',
            headerClass: 'text-accent bg-accent/10',
            rows: [
                { label: 'Utilidad Real (Entregados)', value: k.u_real || 0 },
                { label: 'Utilidad Proyectada (inc. Transito)', value: k.utilidad_proyectada || 0, highlight: true },
                { label: 'Margen Neto', value: k.ing_real ? ((k.u_real / k.ing_real) * 100) : 0 },
            ],
        },
    ];

    return (
        <>
            <SectionHeader title="Estado de Resultados (P&L)" icon={'\u{1F4B0}'} iconBg="bg-accent/10" />
            <div className="rounded-2xl border border-card-border overflow-hidden mb-6">
                {sections.map((section, si) => (
                    <React.Fragment key={si}>
                        <div className={`px-5 py-3 text-[10px] font-black uppercase tracking-[0.2em] border-b border-card-border ${section.headerClass}`}>
                            {section.header}
                        </div>
                        {section.rows.map((row, ri) => {
                            const isMargen = row.label.includes('Margen');
                            const displayValue = isMargen ? `${row.value.toFixed(1)}%` : fmtFull(row.value);
                            const valueColor = row.highlight ? (row.value >= 0 ? 'text-accent' : 'text-red-400') :
                                row.muted ? 'text-muted' :
                                    row.value < 0 ? 'text-red-400' :
                                        row.value > 0 ? (section.header === 'Resultado' ? 'text-emerald-400' : 'text-foreground') :
                                            'text-foreground';

                            return (
                                <div key={ri} className={`flex justify-between items-center px-5 py-3 border-b border-card-border/20 text-sm last:border-b-0 ${row.highlight ? 'bg-accent/5' : 'bg-card'}`}>
                                    <span className={`${row.highlight ? 'text-accent font-black' : 'text-muted font-medium'}`}>{row.label}</span>
                                    <div className="flex items-center gap-2">
                                        <span className={`font-mono font-bold ${row.highlight ? 'text-lg' : ''} ${valueColor}`}>
                                            {displayValue}
                                        </span>
                                        {row.pct !== undefined && row.pct > 0 && (
                                            <span className="text-[10px] text-muted">({row.pct.toFixed(1)}%)</span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </React.Fragment>
                ))}
            </div>
        </>
    );
}

// --- Type-Specific Components: EFFICIENCY ---

function EfficiencyKPIs({ metadata }: { metadata: VegaReportMetadata }) {
    const k = metadata.kpis as any;
    const prev = metadata.prevKpis as any;
    const targets = DEFAULT_KPI_TARGETS;

    // Aggregate transit and return counts across all countries
    const totalTransit = metadata.metricsByCountry.reduce((s, c) => s + c.products.reduce((ps, p) => ps + (p.n_tra || 0), 0), 0);
    const totalOrders = k.n_ord || 0;
    const tasaDev = k.tasa_dev || (totalOrders > 0 ? (metadata.metricsByCountry.reduce((s, c) => s + c.products.reduce((ps, p) => ps + (p.n_dev || 0), 0), 0) / totalOrders * 100) : 0);

    const cards = [
        { label: 'Tasa Entrega', value: pct(k.tasa_ent || 0), key: 'tasa_ent', raw: k.tasa_ent || 0, iconLabel: '📦' },
        { label: 'Tasa Cancelacion', value: pct(k.tasa_can || 0), key: 'tasa_can', raw: k.tasa_can || 0, iconLabel: '✕' },
        { label: 'En Transito', value: `${totalTransit}`, key: 'transit', raw: totalTransit, iconLabel: '🚚' },
        { label: 'Tasa Devolucion', value: pct(tasaDev), key: 'tasa_dev', raw: tasaDev, iconLabel: '↩' },
    ];

    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            {cards.map((card, i) => {
                let status: 'good' | 'warning' | 'bad' = 'good';
                if (card.key === 'transit') {
                    status = totalTransit > (totalOrders * 0.3) ? 'bad' : totalTransit > (totalOrders * 0.2) ? 'warning' : 'good';
                } else {
                    const target = findTarget(targets, card.key);
                    if (target) status = evaluateHealth(card.raw, target);
                }
                const hc = getHealthClass(status);

                let change: string | null = null;
                let changeUp = true;
                if (prev && prev[card.key] !== undefined && card.key !== 'transit') {
                    const delta = card.raw - prev[card.key];
                    const isGoodUp = card.key === 'tasa_ent'; // higher delivery is good
                    change = `${delta > 0 ? '+' : ''}${delta.toFixed(1)}${card.key.startsWith('tasa') ? 'pp' : ''} vs anterior`;
                    changeUp = isGoodUp ? delta > 0 : delta < 0;
                }

                return (
                    <div key={i} className={`rounded-2xl border p-5 relative overflow-hidden ${hc.border} bg-card`}>
                        <div className={`absolute top-0 left-0 right-0 h-[3px] ${hc.accent}`} />
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted">{card.label}</span>
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm ${hc.bg}`}>
                                {card.iconLabel}
                            </div>
                        </div>
                        <p className={`text-2xl font-black tracking-tight mb-1 ${hc.text}`}>{card.value}</p>
                        {change && (
                            <p className={`text-xs font-semibold flex items-center gap-1 ${changeUp ? 'text-emerald-400' : 'text-red-400'}`}>
                                {changeUp ? '↑' : '↓'} {change}
                            </p>
                        )}
                        {card.key !== 'transit' && (
                            <p className="text-[10px] text-muted mt-1">
                                Meta: {card.key === 'tasa_ent' ? '> 70%' : card.key === 'tasa_can' ? '< 15%' : '< 5%'}
                            </p>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

function LogisticsFunnel({ metadata }: { metadata: VegaReportMetadata }) {
    const k = metadata.kpis as any;
    const totalOrders = k.n_ord || 0;
    if (totalOrders === 0) return null;

    const totalEnt = metadata.metricsByCountry.reduce((s, c) => s + c.products.reduce((ps, p) => ps + (p.n_ent || 0), 0), 0);
    const totalCan = metadata.metricsByCountry.reduce((s, c) => s + c.products.reduce((ps, p) => ps + (p.n_can || 0), 0), 0);
    const totalTra = metadata.metricsByCountry.reduce((s, c) => s + c.products.reduce((ps, p) => ps + (p.n_tra || 0), 0), 0);
    const totalDev = metadata.metricsByCountry.reduce((s, c) => s + c.products.reduce((ps, p) => ps + (p.n_dev || 0), 0), 0);
    const dispatched = totalOrders - totalCan;

    const steps = [
        { label: 'Ordenes', value: totalOrders, pct: 100, color: 'from-blue-500 to-blue-400', width: '100%' },
        { label: 'Despachadas', value: dispatched, pct: Math.round((dispatched / totalOrders) * 100), color: 'from-purple-500 to-purple-400', width: `${Math.round((dispatched / totalOrders) * 100)}%`, drop: `${totalCan} canceladas (${((totalCan / totalOrders) * 100).toFixed(1)}%)` },
        { label: 'Entregadas', value: totalEnt, pct: Math.round((totalEnt / totalOrders) * 100), color: 'from-emerald-500 to-emerald-400', width: `${Math.round((totalEnt / totalOrders) * 100)}%`, drop: `${totalTra} en transito (${((totalTra / totalOrders) * 100).toFixed(1)}%)` },
        { label: 'Cobradas', value: totalEnt - totalDev, pct: Math.round(((totalEnt - totalDev) / totalOrders) * 100), color: 'from-accent to-orange-400', width: `${Math.round(((totalEnt - totalDev) / totalOrders) * 100)}%`, drop: totalDev > 0 ? `${totalDev} devueltas (${((totalDev / totalOrders) * 100).toFixed(1)}%)` : undefined },
    ];

    return (
        <>
            <SectionHeader title="Funnel Logistico" icon="📊" iconBg="bg-blue-500/10" />
            <div className="space-y-1.5 mb-6">
                {steps.map((step, i) => (
                    <React.Fragment key={i}>
                        {i > 0 && step.drop && (
                            <div className="text-center py-0.5">
                                <span className="text-[10px] font-bold text-red-400">-{step.drop}</span>
                            </div>
                        )}
                        <div className="flex items-center gap-4">
                            <span className="w-24 text-right text-[10px] font-bold uppercase tracking-wider text-muted shrink-0">{step.label}</span>
                            <div className="flex-1">
                                <div className={`h-10 rounded-xl bg-gradient-to-r ${step.color} flex items-center justify-between px-4`} style={{ width: step.width }}>
                                    <span className="text-sm font-black font-mono text-white">{step.value}</span>
                                    <span className="text-[10px] font-bold text-white/70">{step.pct}%</span>
                                </div>
                            </div>
                        </div>
                    </React.Fragment>
                ))}
            </div>
        </>
    );
}

function EfficiencyCountryCards({ metadata }: { metadata: VegaReportMetadata }) {
    if (metadata.metricsByCountry.length === 0) return null;

    return (
        <>
            <SectionHeader title="Eficiencia por Pais" icon="🌎" iconBg="bg-blue-500/10" />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
                {metadata.metricsByCountry.map((c, i) => {
                    const flag = COUNTRY_FLAGS[c.countryName] || '🌎';
                    const totalOrd = c.products.reduce((s, p) => s + (p.n_ord || 0), 0);
                    const totalEnt = c.products.reduce((s, p) => s + (p.n_ent || 0), 0);
                    const totalCan = c.products.reduce((s, p) => s + (p.n_can || 0), 0);
                    const totalTra = c.products.reduce((s, p) => s + (p.n_tra || 0), 0);
                    const totalDev = c.products.reduce((s, p) => s + (p.n_dev || 0), 0);

                    const tasaEnt = totalOrd > 0 ? (totalEnt / totalOrd * 100) : 0;
                    const tasaCan = totalOrd > 0 ? (totalCan / totalOrd * 100) : 0;
                    const tasaDev = totalOrd > 0 ? (totalDev / totalOrd * 100) : 0;

                    const entStatus = tasaEnt >= 70 ? 'text-emerald-400' : tasaEnt >= 60 ? 'text-orange-400' : 'text-red-400';
                    const canStatus = tasaCan <= 15 ? 'text-emerald-400' : tasaCan <= 22 ? 'text-orange-400' : 'text-red-400';
                    const devStatus = tasaDev <= 5 ? 'text-emerald-400' : tasaDev <= 8 ? 'text-orange-400' : 'text-red-400';

                    const borderColor = tasaEnt >= 70 ? 'border-t-emerald-500' : tasaEnt >= 60 ? 'border-t-orange-400' : 'border-t-red-500';

                    // Determine highlight
                    let highlight: { text: string; type: 'star' | 'risk' | 'info' } | null = null;
                    if (tasaEnt >= 70 && tasaCan <= 15) highlight = { text: '✅ Operacion eficiente — cumple targets', type: 'star' };
                    else if (tasaEnt < 55) highlight = { text: `⚠ Entrega critica (${pct(tasaEnt)}) — revisar transportadora`, type: 'risk' };
                    else if (tasaCan > 25) highlight = { text: `⚠ Cancelacion muy alta (${pct(tasaCan)}) — revisar confirmacion`, type: 'risk' };
                    else if (tasaEnt < 70) highlight = { text: `ℹ Cerca del target — mejorar tiempos de despacho`, type: 'info' };

                    const highlightStyles = {
                        star: 'bg-emerald-500/5 border-emerald-500/10 text-emerald-400',
                        risk: 'bg-red-500/5 border-red-500/10 text-red-400',
                        info: 'bg-blue-500/5 border-blue-500/10 text-blue-400',
                    };

                    return (
                        <div key={i} className={`rounded-2xl border border-card-border border-t-[3px] ${borderColor} bg-card p-5`}>
                            <div className="flex items-center gap-2.5 mb-4">
                                <span className="text-2xl">{flag}</span>
                                <span className="text-base font-black uppercase tracking-wide">{c.countryName}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-3 mb-3">
                                <div className="rounded-lg bg-hover-bg p-3">
                                    <p className="text-[9px] font-bold text-muted uppercase tracking-wider">Entrega</p>
                                    <p className={`text-lg font-black font-mono ${entStatus}`}>{pct(tasaEnt)}</p>
                                </div>
                                <div className="rounded-lg bg-hover-bg p-3">
                                    <p className="text-[9px] font-bold text-muted uppercase tracking-wider">Cancelacion</p>
                                    <p className={`text-lg font-black font-mono ${canStatus}`}>{pct(tasaCan)}</p>
                                </div>
                                <div className="rounded-lg bg-hover-bg p-3">
                                    <p className="text-[9px] font-bold text-muted uppercase tracking-wider">En Transito</p>
                                    <p className="text-lg font-black font-mono text-foreground">{totalTra}</p>
                                </div>
                                <div className="rounded-lg bg-hover-bg p-3">
                                    <p className="text-[9px] font-bold text-muted uppercase tracking-wider">Devolucion</p>
                                    <p className={`text-lg font-black font-mono ${devStatus}`}>{pct(tasaDev)}</p>
                                </div>
                            </div>
                            {highlight && (
                                <div className={`rounded-lg border px-3.5 py-2 ${highlightStyles[highlight.type]}`}>
                                    <p className="text-[10px] font-semibold">{highlight.text}</p>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </>
    );
}

function TopProductsByDelivery({ metadata }: { metadata: VegaReportMetadata }) {
    // Gather all products with country info
    const allProducts: { name: string; country: string; tasaEnt: number; orders: number; transit: number }[] = [];
    metadata.metricsByCountry.forEach(c => {
        c.products.forEach(p => {
            if (p.n_ord > 0) {
                allProducts.push({
                    name: p.name,
                    country: c.countryName,
                    tasaEnt: p.tasa_ent || (p.n_ord > 0 ? (p.n_ent / p.n_ord * 100) : 0),
                    orders: p.n_ord,
                    transit: p.n_tra || 0,
                });
            }
        });
    });

    if (allProducts.length === 0) return null;

    const best = [...allProducts].sort((a, b) => b.tasaEnt - a.tasaEnt).slice(0, 5);
    const worst = [...allProducts].sort((a, b) => a.tasaEnt - b.tasaEnt).slice(0, 5);

    const renderRow = (p: typeof allProducts[0], isBest: boolean) => {
        const flag = COUNTRY_FLAGS[p.country] || '🌎';
        const color = p.tasaEnt >= 70 ? 'text-emerald-400' : p.tasaEnt >= 60 ? 'text-orange-400' : 'text-red-400';
        return (
            <div className="flex items-center justify-between px-5 py-3 border-b border-card-border/20 bg-card hover:bg-hover-bg transition-colors last:border-b-0">
                <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-foreground truncate max-w-[200px]">{p.name}</p>
                    <p className="text-[10px] text-muted mt-0.5">{flag} {p.country} &middot; {p.orders} ordenes</p>
                </div>
                <div className="flex gap-4 shrink-0">
                    <div className="text-right">
                        <p className="text-[8px] font-bold text-muted uppercase tracking-wider">Entrega</p>
                        <p className={`text-sm font-black font-mono ${color}`}>{pct(p.tasaEnt)}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-[8px] font-bold text-muted uppercase tracking-wider">Transito</p>
                        <p className="text-sm font-black font-mono text-foreground">{p.transit}</p>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <>
            <SectionHeader title="Top Productos por Entrega" icon="📦" iconBg="bg-accent/10" />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
                <div className="rounded-2xl border border-card-border overflow-hidden">
                    <div className="flex items-center gap-2 px-5 py-3 bg-emerald-500/10 border-b border-emerald-500/15">
                        <span className="text-[10px] font-black uppercase tracking-[0.15em] text-emerald-400">
                            ✅ Mejor Entrega
                        </span>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400">Top 5</span>
                    </div>
                    {best.map((p, i) => <React.Fragment key={i}>{renderRow(p, true)}</React.Fragment>)}
                </div>
                <div className="rounded-2xl border border-card-border overflow-hidden">
                    <div className="flex items-center gap-2 px-5 py-3 bg-red-500/10 border-b border-red-500/15">
                        <span className="text-[10px] font-black uppercase tracking-[0.15em] text-red-400">
                            ⚠ Peor Entrega
                        </span>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-red-500/20 text-red-400">Top 5</span>
                    </div>
                    {worst.map((p, i) => <React.Fragment key={i}>{renderRow(p, false)}</React.Fragment>)}
                </div>
            </div>
        </>
    );
}

// --- Type-Specific Components: ADS ---

function AdsDetailedKPIs({ metadata }: { metadata: VegaReportMetadata }) {
    const k = metadata.kpis as any;
    const prev = metadata.prevKpis as any;
    const targets = DEFAULT_KPI_TARGETS;

    const cards = [
        { label: 'ROAS Consolidado', value: `${(k.roas_real || 0).toFixed(1)}x`, key: 'roas_real', raw: k.roas_real || 0, iconLabel: 'R' },
        { label: 'CPA Promedio', value: fmt(k.cpa || 0), key: 'cpa', raw: k.cpa || 0, iconLabel: 'C' },
        { label: 'CPA Despachado', value: fmt(k.cpa || 0), key: 'cpa_desp', raw: k.cpa || 0, iconLabel: 'D', subtitle: 'Costo por orden despachada' },
        { label: 'CPA Entregado', value: fmt(k.cpe || k.cpa_ent || 0), key: 'cpe', raw: k.cpe || k.cpa_ent || 0, iconLabel: 'E', subtitle: 'Costo por orden entregada' },
        { label: '% Ads / Revenue', value: pct(k.perc_ads_revenue || 0), key: 'perc_ads_revenue', raw: k.perc_ads_revenue || 0, iconLabel: '%' },
        { label: 'Gasto Total', value: fmt(k.g_ads || 0), key: 'g_ads', raw: k.g_ads || 0, iconLabel: '$' },
    ];

    return (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
            {cards.map((card, i) => {
                let status: 'good' | 'warning' | 'bad' = 'good';
                const target = findTarget(targets, card.key);
                if (target) status = evaluateHealth(card.raw, target);
                else if (card.key === 'g_ads') status = 'good'; // neutral for total spend
                const hc = getHealthClass(status);

                let change: string | null = null;
                let changeUp = true;
                if (prev && prev[card.key] !== undefined && prev[card.key] !== 0) {
                    const delta = ((card.raw - prev[card.key]) / Math.abs(prev[card.key])) * 100;
                    change = `${delta > 0 ? '+' : ''}${delta.toFixed(1)}% vs anterior`;
                    const isGoodUp = card.key === 'roas_real';
                    changeUp = isGoodUp ? delta > 0 : delta < 0;
                }

                return (
                    <div key={i} className={`rounded-2xl border p-5 relative overflow-hidden ${hc.border} bg-card`}>
                        <div className={`absolute top-0 left-0 right-0 h-[3px] ${hc.accent}`} />
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted">{card.label}</span>
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black ${hc.bg} ${hc.text}`}>
                                {card.iconLabel}
                            </div>
                        </div>
                        <p className={`text-2xl font-black tracking-tight mb-1 ${hc.text}`}>{card.value}</p>
                        {change && (
                            <p className={`text-xs font-semibold flex items-center gap-1 ${changeUp ? 'text-emerald-400' : 'text-red-400'}`}>
                                {changeUp ? '↑' : '↓'} {change}
                            </p>
                        )}
                        {(card as any).subtitle && (
                            <p className="text-[10px] text-muted mt-1">{(card as any).subtitle}</p>
                        )}
                        {!((card as any).subtitle) && target && (
                            <p className="text-[10px] text-muted mt-1">
                                Meta: {card.key === 'roas_real' ? `> ${target.good}x` :
                                    card.key === 'cpa' ? `< $${(target.good || 0).toLocaleString('es-CO')}` :
                                        card.key === 'perc_ads_revenue' ? `< ${target.good}%` : ''}
                            </p>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

function AdsDetailedPlatformCard({ metadata }: { metadata: VegaReportMetadata }) {
    const k = metadata.kpis as any;
    const platforms = metadata.adPlatformMetrics;
    if (!platforms) return null;

    const totalAds = k.g_ads || 0;
    if (totalAds === 0) return null;

    const adsRevPct = k.perc_ads_revenue || 0;
    const ingReal = k.ing_real || 0;
    const totalOrders = k.n_ord || 0;

    const platData = [
        { name: 'Facebook / Meta', spend: platforms.fb, color: '#1877F2', shortName: 'FB' },
        { name: 'TikTok Ads', spend: platforms.tiktok, color: '#00f2ea', shortName: 'TK' },
        { name: 'Google Ads', spend: platforms.google, color: '#4285F4', shortName: 'GG' },
    ].filter(p => p.spend > 0).map(p => {
        const pctShare = totalAds > 0 ? p.spend / totalAds : 0;
        const estOrders = Math.round(totalOrders * pctShare);
        const roas = ingReal > 0 && p.spend > 0 ? (ingReal * pctShare) / p.spend : 0;
        const cpa = estOrders > 0 ? p.spend / estOrders : 0;
        return { ...p, roas, cpa, orders: estOrders, pctShare };
    });

    return (
        <>
            <SectionHeader title="Rendimiento por Plataforma" icon="📣" iconBg="bg-purple-500/10" />
            <div className="rounded-2xl border border-card-border bg-card p-6 mb-6">
                <div className="flex items-center justify-between mb-5">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted mb-1">Inversion Publicitaria</p>
                        <p className="text-2xl font-black font-mono tracking-tight text-foreground">{fmtFull(totalAds)} <span className="text-sm text-muted font-normal">COP</span></p>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] font-black uppercase tracking-[0.12em] text-muted mb-1">ROAS Promedio</p>
                        <p className={`text-xl font-black font-mono ${(k.roas_real || 0) >= 2.5 ? 'text-emerald-400' : (k.roas_real || 0) >= 1.5 ? 'text-orange-400' : 'text-red-400'}`}>
                            {(k.roas_real || 0).toFixed(1)}x
                        </p>
                    </div>
                </div>
                <div className="grid grid-cols-3 gap-3 mb-4">
                    {platData.map((p, i) => {
                        const roasColor = p.roas >= 2.5 ? 'text-emerald-400' : p.roas >= 1.5 ? 'text-orange-400' : 'text-red-400';
                        return (
                            <div key={i} className="rounded-xl bg-hover-bg p-4 text-center border border-card-border/50" style={{ borderTop: `3px solid ${p.color}` }}>
                                <p className="text-[9px] font-black uppercase tracking-[0.12em] text-muted mb-2">{p.name}</p>
                                <p className="text-lg font-black font-mono text-foreground mb-0.5">{fmt(p.spend)}</p>
                                {p.roas > 0 && <p className={`text-xs font-bold ${roasColor}`}>ROAS {p.roas.toFixed(1)}x</p>}
                                <p className="text-[10px] text-muted mt-1">CPA: {fmt(p.cpa)} &middot; {p.orders} ord.</p>
                            </div>
                        );
                    })}
                </div>
                <div>
                    <div className="flex justify-between text-[10px] font-semibold text-muted mb-1.5">
                        <span>Distribucion del gasto</span>
                        <span>{platData.map(p => `${p.shortName} ${Math.round(p.pctShare * 100)}%`).join(' | ')}</span>
                    </div>
                    <div className="h-2 rounded-full bg-hover-bg flex overflow-hidden gap-[2px]">
                        {platData.map((p, i) => (
                            <div key={i} className="h-full" style={{
                                width: `${p.pctShare * 100}%`,
                                background: p.color,
                                borderRadius: i === 0 ? '4px 0 0 4px' : i === platData.length - 1 ? '0 4px 4px 0' : '0',
                            }} />
                        ))}
                    </div>
                </div>
            </div>
        </>
    );
}

function TopProductsByProfitability({ metadata }: { metadata: VegaReportMetadata }) {
    const allProducts: { name: string; country: string; utilProy: number; orders: number; ads: number; cpa: number }[] = [];
    metadata.metricsByCountry.forEach(c => {
        c.products.forEach(p => {
            if (p.n_ord > 0) {
                allProducts.push({
                    name: p.name,
                    country: c.countryName,
                    utilProy: p.utilProy || 0,
                    orders: p.n_ord,
                    ads: p.ads || 0,
                    cpa: p.cpa || 0,
                });
            }
        });
    });

    if (allProducts.length === 0) return null;

    const best = [...allProducts].sort((a, b) => b.utilProy - a.utilProy).slice(0, 5);
    const worst = [...allProducts].sort((a, b) => a.utilProy - b.utilProy).slice(0, 5);

    const renderRow = (p: typeof allProducts[0]) => {
        const flag = COUNTRY_FLAGS[p.country] || '🌎';
        const color = p.utilProy > 0 ? 'text-emerald-400' : p.utilProy === 0 ? 'text-orange-400' : 'text-red-400';
        return (
            <div className="flex items-center justify-between px-5 py-3 border-b border-card-border/20 bg-card hover:bg-hover-bg transition-colors last:border-b-0">
                <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-foreground truncate max-w-[200px]">{p.name}</p>
                    <p className="text-[10px] text-muted mt-0.5">{flag} {p.country} &middot; {p.orders} ord. &middot; CPA: {fmt(p.cpa)}</p>
                </div>
                <div className="flex gap-4 shrink-0">
                    <div className="text-right">
                        <p className="text-[8px] font-bold text-muted uppercase tracking-wider">Ads</p>
                        <p className="text-sm font-black font-mono text-red-400">{fmt(p.ads)}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-[8px] font-bold text-muted uppercase tracking-wider">Util. Proy.</p>
                        <p className={`text-sm font-black font-mono ${color}`}>{fmt(p.utilProy)}</p>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <>
            <SectionHeader title="Top Productos por Rentabilidad" icon="💰" iconBg="bg-emerald-500/10" />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
                <div className="rounded-2xl border border-card-border overflow-hidden">
                    <div className="flex items-center gap-2 px-5 py-3 bg-emerald-500/10 border-b border-emerald-500/15">
                        <span className="text-[10px] font-black uppercase tracking-[0.15em] text-emerald-400">
                            ✅ Mas Rentables
                        </span>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400">Top 5</span>
                    </div>
                    {best.map((p, i) => <React.Fragment key={i}>{renderRow(p)}</React.Fragment>)}
                </div>
                <div className="rounded-2xl border border-card-border overflow-hidden">
                    <div className="flex items-center gap-2 px-5 py-3 bg-red-500/10 border-b border-red-500/15">
                        <span className="text-[10px] font-black uppercase tracking-[0.15em] text-red-400">
                            ⚠ Menos Rentables
                        </span>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-red-500/20 text-red-400">Top 5</span>
                    </div>
                    {worst.map((p, i) => <React.Fragment key={i}>{renderRow(p)}</React.Fragment>)}
                </div>
            </div>
        </>
    );
}

// --- Type-Specific Components: PROFITABILITY ---

function ProfitabilityKPIs({ metadata }: { metadata: VegaReportMetadata }) {
    const k = metadata.kpis as any;
    const prev = metadata.prevKpis as any;
    const targets = DEFAULT_KPI_TARGETS;

    const margenNeto = k.ing_real ? ((k.u_real || 0) / k.ing_real * 100) : 0;
    const prevMargen = prev?.ing_real ? ((prev.u_real || 0) / prev.ing_real * 100) : 0;

    const cards = [
        { label: 'Utilidad Real', value: fmt(k.u_real || 0), key: 'u_real', raw: k.u_real || 0, iconLabel: '$' },
        { label: 'Util. Proyectada', value: fmt(k.utilidad_proyectada || 0), key: 'u_proy', raw: k.utilidad_proyectada || 0, iconLabel: '📊' },
        { label: 'Margen Neto', value: pct(margenNeto), key: 'margen', raw: margenNeto, iconLabel: '%' },
        { label: 'ROAS Real', value: `${(k.roas_real || 0).toFixed(1)}x`, key: 'roas_real', raw: k.roas_real || 0, iconLabel: 'R' },
    ];

    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            {cards.map((card, i) => {
                let status: 'good' | 'warning' | 'bad' = 'good';
                if (card.key === 'u_real' || card.key === 'u_proy') {
                    status = card.raw > 0 ? 'good' : card.raw === 0 ? 'warning' : 'bad';
                } else if (card.key === 'margen') {
                    status = card.raw >= 15 ? 'good' : card.raw >= 10 ? 'warning' : 'bad';
                } else {
                    const target = findTarget(targets, card.key);
                    if (target) status = evaluateHealth(card.raw, target);
                }
                const hc = getHealthClass(status);

                let change: string | null = null;
                let changeUp = true;
                if (prev) {
                    let prevVal: number | undefined;
                    if (card.key === 'margen') prevVal = prevMargen;
                    else if (card.key === 'u_proy') prevVal = prev.utilidad_proyectada;
                    else prevVal = prev[card.key];

                    if (prevVal !== undefined && prevVal !== 0) {
                        if (card.key === 'margen') {
                            const delta = card.raw - prevVal;
                            change = `${delta > 0 ? '+' : ''}${delta.toFixed(1)}pp vs anterior`;
                            changeUp = delta > 0;
                        } else {
                            const delta = ((card.raw - prevVal) / Math.abs(prevVal)) * 100;
                            change = `${delta > 0 ? '+' : ''}${delta.toFixed(1)}% vs anterior`;
                            changeUp = delta > 0;
                        }
                    }
                }

                return (
                    <div key={i} className={`rounded-2xl border p-5 relative overflow-hidden ${hc.border} bg-card`}>
                        <div className={`absolute top-0 left-0 right-0 h-[3px] ${hc.accent}`} />
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted">{card.label}</span>
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black ${hc.bg} ${hc.text}`}>
                                {card.iconLabel}
                            </div>
                        </div>
                        <p className={`text-2xl font-black tracking-tight mb-1 ${hc.text}`}>{card.value}</p>
                        {change && (
                            <p className={`text-xs font-semibold flex items-center gap-1 ${changeUp ? 'text-emerald-400' : 'text-red-400'}`}>
                                {changeUp ? '↑' : '↓'} {change}
                            </p>
                        )}
                        {card.key === 'margen' && <p className="text-[10px] text-muted mt-1">Meta: &gt; 15%</p>}
                        {card.key === 'u_real' && <p className="text-[10px] text-muted mt-1">Entregados confirmados</p>}
                        {card.key === 'u_proy' && <p className="text-[10px] text-muted mt-1">Incluye transito</p>}
                    </div>
                );
            })}
        </div>
    );
}

function WaterfallChart({ metadata }: { metadata: VegaReportMetadata }) {
    const k = metadata.kpis as any;
    const factNeto = k.fact_neto || 0;
    const ingReal = k.ing_real || 0;
    const costoProd = k.cpr || 0;
    const fletes = (k.fl_ent || 0) + (k.fl_dev || 0) + (k.fl_tra || 0);
    const gastoAds = k.g_ads || 0;
    const utilReal = k.u_real || 0;
    const utilProy = k.utilidad_proyectada || 0;
    const adminCosts = metadata.berryExpenses?.reduce((sum, e) => sum + e.amount, 0) || 0;
    const utilNeta = utilReal - adminCosts;

    if (factNeto === 0) return null;

    // Normalize to max bar height
    const maxVal = factNeto;
    const barH = (v: number) => Math.max(8, Math.round((Math.abs(v) / maxVal) * 160));

    const bars = [
        { label: 'Facturacion', value: factNeto, color: 'from-emerald-500 to-emerald-400', isPositive: true },
        { label: 'Ing. Real', value: ingReal, color: 'from-emerald-500 to-emerald-400', isPositive: true },
        { label: 'Costo Prod.', value: -costoProd, color: 'from-red-500 to-red-400', isPositive: false },
        { label: 'Fletes', value: -fletes, color: 'from-red-500 to-red-400', isPositive: false },
        { label: 'Gasto Ads', value: -gastoAds, color: 'from-red-500 to-red-400', isPositive: false },
        ...(adminCosts > 0 ? [{ label: 'G. Admin.', value: -adminCosts, color: 'from-purple-500 to-purple-400', isPositive: false }] : []),
        { label: 'Util. Real', value: utilReal, color: 'from-accent to-orange-400', isPositive: utilReal >= 0 },
        ...(adminCosts > 0 ? [{ label: 'Util. Neta', value: utilNeta, color: 'from-accent to-amber-600', isPositive: utilNeta >= 0 }] : []),
        { label: 'Util. Proy.', value: utilProy, color: 'from-accent to-amber-600', isPositive: utilProy >= 0 },
    ];

    return (
        <>
            <SectionHeader title="Cascada de Rentabilidad" icon="📊" iconBg="bg-accent/10" />
            <div className="rounded-2xl border border-card-border bg-card p-6 mb-6">
                <div className="flex items-end gap-2 h-52">
                    {bars.map((bar, i) => (
                        <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
                            <p className="text-[9px] font-bold font-mono text-muted mb-1 whitespace-nowrap">
                                {bar.value < 0 ? `-${fmt(Math.abs(bar.value)).slice(1)}` : fmt(bar.value)}
                            </p>
                            <div
                                className={`w-full rounded-t-md bg-gradient-to-b ${bar.color}`}
                                style={{ height: barH(bar.value) }}
                            />
                            <p className="text-[7px] font-bold text-muted uppercase tracking-wider mt-2 text-center whitespace-nowrap">{bar.label}</p>
                        </div>
                    ))}
                </div>
            </div>
        </>
    );
}

function MarginGauges({ metadata }: { metadata: VegaReportMetadata }) {
    const k = metadata.kpis as any;
    const ingReal = k.ing_real || 0;
    if (ingReal === 0) return null;

    const margenBruto = ingReal > 0 ? ((ingReal - (k.cpr || 0)) / ingReal * 100) : 0;
    const margenNeto = ingReal > 0 ? ((k.u_real || 0) / ingReal * 100) : 0;
    const pctAdsIng = k.fact_neto > 0 ? ((k.g_ads || 0) / k.fact_neto * 100) : 0;
    const pctFletes = ingReal > 0 ? (((k.fl_ent || 0) + (k.fl_dev || 0) + (k.fl_tra || 0)) / ingReal * 100) : 0;

    const gauges = [
        { title: 'Margen Bruto', value: margenBruto, color: 'from-emerald-500 to-emerald-400', textColor: 'text-emerald-400', detail: 'Ingreso - Costo de producto' },
        { title: 'Margen Neto Real', value: margenNeto, color: 'from-emerald-500 to-emerald-400', textColor: 'text-emerald-400', detail: `Meta: >15% • Saludable: ${margenNeto >= 15 ? 'Si' : 'No'}` },
        { title: '% Costo Ads / Ingreso', value: pctAdsIng, color: pctAdsIng <= 35 ? 'from-emerald-500 to-emerald-400' : pctAdsIng <= 40 ? 'from-orange-500 to-orange-400' : 'from-red-500 to-red-400', textColor: pctAdsIng <= 35 ? 'text-emerald-400' : pctAdsIng <= 40 ? 'text-orange-400' : 'text-red-400', detail: `Meta: <40% • ${pctAdsIng <= 40 ? 'En rango' : 'Excedido'}` },
        { title: '% Fletes / Ingreso', value: pctFletes, color: pctFletes <= 10 ? 'from-blue-500 to-blue-400' : pctFletes <= 12 ? 'from-orange-500 to-orange-400' : 'from-red-500 to-red-400', textColor: pctFletes <= 10 ? 'text-blue-400' : pctFletes <= 12 ? 'text-orange-400' : 'text-red-400', detail: `Meta: <12% • ${pctFletes <= 12 ? 'Saludable' : 'Revisar'}` },
    ];

    return (
        <>
            <SectionHeader title="Analisis de Margenes" icon="📐" iconBg="bg-emerald-500/10" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {gauges.map((g, i) => (
                    <div key={i} className="rounded-2xl border border-card-border bg-card p-5 text-center">
                        <p className="text-[9px] font-black uppercase tracking-[0.15em] text-muted mb-4">{g.title}</p>
                        <div className="w-full h-2.5 rounded-full bg-hover-bg overflow-hidden mb-3">
                            <div className={`h-full rounded-full bg-gradient-to-r ${g.color}`} style={{ width: `${Math.min(g.value, 100)}%` }} />
                        </div>
                        <p className={`text-2xl font-black font-mono mb-1 ${g.textColor}`}>{pct(g.value)}</p>
                        <p className="text-[10px] text-muted">{g.detail}</p>
                    </div>
                ))}
            </div>
        </>
    );
}

function PLByProduct({ metadata }: { metadata: VegaReportMetadata }) {
    const allProducts: any[] = [];
    metadata.metricsByCountry.forEach(c => {
        c.products.forEach(p => {
            // Avoid duplicates by checking if already added
            const existing = allProducts.find(e => e.id === p.id || e.name === p.name);
            if (existing) {
                existing.n_ord += p.n_ord || 0;
                existing.ads += p.ads || 0;
                existing.utilReal += p.utilReal || 0;
                existing.utilProy += p.utilProy || 0;
                existing.n_ent += p.n_ent || 0;
            } else {
                allProducts.push({ ...p });
            }
        });
    });

    if (allProducts.length === 0) return null;
    const sorted = [...allProducts].sort((a, b) => b.utilProy - a.utilProy);

    return (
        <>
            <SectionHeader title="P&L por Producto" icon="📋" iconBg="bg-blue-500/10" />
            <div className="overflow-x-auto rounded-2xl border border-card-border mb-6">
                <table className="w-full text-xs">
                    <thead>
                        <tr className="bg-foreground/[0.02]">
                            <th className="text-left px-4 py-3 text-[9px] font-black uppercase tracking-[0.15em] text-muted border-b border-card-border">Producto</th>
                            <th className="text-right px-3 py-3 text-[9px] font-black uppercase tracking-[0.15em] text-muted border-b border-card-border">Ordenes</th>
                            <th className="text-right px-3 py-3 text-[9px] font-black uppercase tracking-[0.15em] text-muted border-b border-card-border">Gasto Ads</th>
                            <th className="text-right px-3 py-3 text-[9px] font-black uppercase tracking-[0.15em] text-muted border-b border-card-border">Util. Proy.</th>
                            <th className="text-right px-4 py-3 text-[9px] font-black uppercase tracking-[0.15em] text-muted border-b border-card-border">Margen</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sorted.map((p, i) => {
                            // Estimate facturacion from utilProy + ads (simplified)
                            const estFact = (p.utilProy || 0) + (p.ads || 0) + ((p.ads || 0) * 0.3); // rough estimate
                            const margin = estFact > 0 ? ((p.utilProy || 0) / estFact * 100) : 0;
                            const isLoss = p.utilProy < 0;
                            return (
                                <tr key={i} className={`hover:bg-foreground/[0.02] transition-colors ${isLoss ? 'bg-red-500/[0.03]' : ''}`}>
                                    <td className={`px-4 py-3 border-b border-card-border/30 font-bold ${isLoss ? 'text-red-400' : 'text-foreground'}`}>{p.name}</td>
                                    <td className="px-3 py-3 border-b border-card-border/30 text-right font-mono font-semibold text-foreground">{p.n_ord}</td>
                                    <td className="px-3 py-3 border-b border-card-border/30 text-right font-mono font-semibold text-red-400">{fmt(p.ads || 0)}</td>
                                    <td className={`px-3 py-3 border-b border-card-border/30 text-right font-mono font-bold ${isLoss ? 'text-red-400' : 'text-emerald-400'}`}>{fmt(p.utilProy)}</td>
                                    <td className={`px-4 py-3 border-b border-card-border/30 text-right font-mono font-bold ${isLoss ? 'text-red-400' : margin >= 15 ? 'text-emerald-400' : 'text-orange-400'}`}>{pct(margin)}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </>
    );
}

const BERRY_CATEGORY_COLORS: Record<string, string> = {
    'Aplicaciones': '#8b5cf6',
    'Fullfilment': '#06b6d4',
    'Envíos': '#f59e0b',
    'Nómina': '#ef4444',
    'Servicios': '#10b981',
    'Gastos Bancarios': '#6366f1',
    'Otros Gastos': '#78716c',
    'Inversiones': '#ec4899',
    'Impuestos': '#d75c33',
    'Marketing': '#f97316',
    'Pendiente': '#94a3b8',
};

function AdminCostsPL({ metadata }: { metadata: VegaReportMetadata }) {
    const expenses = metadata.berryExpenses;
    if (!expenses || expenses.length === 0) return null;

    const totalAdmin = expenses.reduce((sum, e) => sum + e.amount, 0);
    const utilReal = metadata.kpis?.u_real || 0;
    const utilNeta = utilReal - totalAdmin;

    return (
        <>
            <SectionHeader title="Gastos Administrativos (Berry)" icon="🧾" iconBg="bg-purple-500/10" />
            <div className="rounded-2xl border border-card-border bg-card p-6 mb-6">
                <div className="grid grid-cols-3 gap-4 mb-5">
                    <div className="rounded-xl bg-hover-bg p-4 text-center border border-card-border/50">
                        <p className="text-[9px] font-black uppercase tracking-[0.12em] text-muted mb-2">Utilidad Real</p>
                        <p className={`text-xl font-black font-mono ${utilReal >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmt(utilReal)}</p>
                    </div>
                    <div className="rounded-xl bg-hover-bg p-4 text-center border border-red-500/20">
                        <p className="text-[9px] font-black uppercase tracking-[0.12em] text-muted mb-2">Gastos Admin.</p>
                        <p className="text-xl font-black font-mono text-red-400">-{fmt(totalAdmin)}</p>
                    </div>
                    <div className="rounded-xl bg-hover-bg p-4 text-center border border-accent/20">
                        <p className="text-[9px] font-black uppercase tracking-[0.12em] text-muted mb-2">Utilidad Neta</p>
                        <p className={`text-xl font-black font-mono ${utilNeta >= 0 ? 'text-accent' : 'text-red-400'}`}>{fmt(utilNeta)}</p>
                    </div>
                </div>
                <div className="overflow-x-auto rounded-xl border border-card-border">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="bg-foreground/[0.02]">
                                <th className="text-left px-4 py-2.5 text-[9px] font-black uppercase tracking-[0.15em] text-muted border-b border-card-border">Categoria</th>
                                <th className="text-right px-4 py-2.5 text-[9px] font-black uppercase tracking-[0.15em] text-muted border-b border-card-border">Monto</th>
                                <th className="text-right px-4 py-2.5 text-[9px] font-black uppercase tracking-[0.15em] text-muted border-b border-card-border">% del Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {[...expenses].sort((a, b) => b.amount - a.amount).map((e, i) => {
                                const pctVal = totalAdmin > 0 ? (e.amount / totalAdmin * 100) : 0;
                                const color = BERRY_CATEGORY_COLORS[e.category] || '#6366f1';
                                return (
                                    <tr key={i} className="hover:bg-foreground/[0.02] transition-colors">
                                        <td className="px-4 py-2.5 border-b border-card-border/30">
                                            <div className="flex items-center gap-2">
                                                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                                                <span className="font-semibold text-foreground">{e.category}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-2.5 border-b border-card-border/30 text-right font-mono font-bold text-red-400">-{fmt(e.amount)}</td>
                                        <td className="px-4 py-2.5 border-b border-card-border/30 text-right font-mono font-semibold text-muted">{pct(pctVal)}</td>
                                    </tr>
                                );
                            })}
                            <tr className="bg-foreground/[0.03]">
                                <td className="px-4 py-3 font-black text-foreground uppercase text-[10px] tracking-wider">Total</td>
                                <td className="px-4 py-3 text-right font-mono font-black text-red-400">-{fmt(totalAdmin)}</td>
                                <td className="px-4 py-3 text-right font-mono font-black text-muted">100%</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    );
}

function BerryDonutChart({ metadata }: { metadata: VegaReportMetadata }) {
    const expenses = metadata.berryExpenses;
    if (!expenses || expenses.length === 0) return null;

    const totalAdmin = expenses.reduce((sum, e) => sum + e.amount, 0);
    if (totalAdmin === 0) return null;

    const sorted = [...expenses].sort((a, b) => b.amount - a.amount);

    // Build conic gradient segments
    let cumPct = 0;
    const gradientStops: string[] = [];
    sorted.forEach(e => {
        const pctVal = (e.amount / totalAdmin) * 100;
        const color = BERRY_CATEGORY_COLORS[e.category] || '#6366f1';
        gradientStops.push(`${color} ${cumPct}% ${cumPct + pctVal}%`);
        cumPct += pctVal;
    });
    const conicGradient = `conic-gradient(${gradientStops.join(', ')})`;

    return (
        <>
            <SectionHeader title="Distribucion de Gastos Administrativos" icon="🍩" iconBg="bg-purple-500/10" />
            <div className="rounded-2xl border border-card-border bg-card p-6 mb-6">
                <div className="flex flex-col md:flex-row items-center gap-8">
                    {/* Donut */}
                    <div className="relative w-48 h-48 shrink-0">
                        <div
                            className="w-full h-full rounded-full"
                            style={{ background: conicGradient }}
                        />
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-28 h-28 rounded-full bg-card flex flex-col items-center justify-center">
                                <p className="text-[9px] font-black uppercase tracking-wider text-muted">Total</p>
                                <p className="text-lg font-black font-mono text-foreground">{fmt(totalAdmin)}</p>
                            </div>
                        </div>
                    </div>
                    {/* Legend */}
                    <div className="flex-1 grid grid-cols-2 gap-x-6 gap-y-2">
                        {sorted.map((e, i) => {
                            const pctVal = (e.amount / totalAdmin) * 100;
                            const color = BERRY_CATEGORY_COLORS[e.category] || '#6366f1';
                            return (
                                <div key={i} className="flex items-center gap-2 py-1">
                                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: color }} />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-semibold text-foreground truncate">{e.category}</p>
                                    </div>
                                    <p className="text-xs font-mono font-bold text-muted shrink-0">{pct(pctVal)}</p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </>
    );
}

function ReportFooter() {
    return (
        <div className="text-center py-8 border-t border-card-border mt-10">
            <img src="/logos/grandline-logo.png" alt="Grand Line" className="h-7 mx-auto mb-3 hidden dark:block" />
            <img src="/logos/grandline-logo-dark.png" alt="Grand Line" className="h-7 mx-auto mb-3 block dark:hidden" />
            <p className="text-[10px] font-black text-muted uppercase tracking-[0.1em]">Grand Line — Command Center</p>
            <p className="text-[9px] text-muted/50 mt-1">Generado por VEGA IA &bull; Vigilancia Estrategica y Gestion Analitica</p>
        </div>
    );
}

// --- Markdown rendering ---

function cleanInlineMarkdown(text: string): string {
    return text.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1').replace(/`(.*?)`/g, '$1').trim();
}

function renderActionTag(tag: string): React.ReactNode {
    const style = ACTION_TAG_STYLES[tag] || 'bg-muted/10 text-muted';
    return (
        <span className={`inline-block text-[8px] font-black px-1.5 py-0.5 rounded-md tracking-wider uppercase mr-1.5 ${style}`}>
            {tag}
        </span>
    );
}

function renderInlineMarkdown(text: string): React.ReactNode {
    const parts: React.ReactNode[] = [];
    let remaining = text;
    let key = 0;

    const actionMatch = remaining.match(/^\[(ESCALAR|PAUSAR|OPTIMIZAR|MONITOREAR|REASIGNAR|NEGOCIAR)\]\s*/);
    if (actionMatch) {
        parts.push(<React.Fragment key={key++}>{renderActionTag(actionMatch[1])}</React.Fragment>);
        remaining = remaining.slice(actionMatch[0].length);
    }

    while (remaining.length > 0) {
        const boldMatch = remaining.match(/\*\*(.*?)\*\*/);
        if (boldMatch && boldMatch.index !== undefined) {
            if (boldMatch.index > 0) parts.push(<span key={key++}>{remaining.slice(0, boldMatch.index)}</span>);
            parts.push(<strong key={key++} className="text-foreground font-bold">{boldMatch[1]}</strong>);
            remaining = remaining.slice(boldMatch.index + boldMatch[0].length);
            continue;
        }
        parts.push(<span key={key++}>{remaining}</span>);
        break;
    }

    return <>{parts}</>;
}

function MarkdownTable({ lines }: { lines: string[] }) {
    const rows = lines
        .filter(line => !line.match(/^\|[\s-:|]+\|$/))
        .map(line => line.split('|').slice(1, -1).map(cell => cell.trim()));

    if (rows.length === 0) return null;
    const header = rows[0];
    const body = rows.slice(1);

    return (
        <div className="overflow-x-auto rounded-2xl border border-card-border mb-4">
            <table className="w-full text-xs">
                <thead>
                    <tr className="bg-foreground/[0.02]">
                        {header.map((h, i) => (
                            <th key={i} className="text-left px-4 py-3 text-[9px] font-black uppercase tracking-[0.2em] text-muted border-b border-card-border">
                                {cleanInlineMarkdown(h)}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {body.map((row, ri) => (
                        <tr key={ri} className="hover:bg-foreground/[0.02] transition-colors">
                            {row.map((cell, ci) => {
                                let cellClass = 'text-foreground/85';
                                const ht = (header[ci] || '').toLowerCase();
                                if (ht.includes('estado') || ht.includes('status')) {
                                    if (cell.includes('BUENO')) cellClass = 'text-emerald-400 font-bold';
                                    if (cell.includes('ATENCION')) cellClass = 'text-orange-400 font-bold';
                                    if (cell.includes('CRITICO')) cellClass = 'text-red-400 font-bold';
                                }
                                if (ht.includes('cambio') || ht === 'δ%') {
                                    if (cell.includes('+')) cellClass = 'text-emerald-400';
                                    if (cell.includes('-')) cellClass = 'text-red-400';
                                }
                                return (
                                    <td key={ci} className={`px-4 py-3 border-b border-card-border/30 font-semibold ${ci === 0 ? 'text-muted font-medium' : ''} ${cellClass}`}>
                                        {cleanInlineMarkdown(cell)}
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

function NarrativeSection({ title, content, defaultOpen = true, forceOpen = false }: { title: string; content: string; defaultOpen?: boolean; forceOpen?: boolean }) {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    const effectiveOpen = forceOpen || isOpen;
    const Icon = effectiveOpen ? ChevronDown : ChevronRight;
    const elements = useMemo(() => parseMarkdownContent(content), [content]);

    // Check if this is a recommendations section
    const isRecommendation = title.toLowerCase().includes('recomend') || title.toLowerCase().includes('plan') || title.toLowerCase().includes('accion') || title.toLowerCase().includes('acción');

    if (isRecommendation) {
        return (
            <div className="rounded-2xl border border-accent/20 p-6 mb-6 relative overflow-hidden"
                style={{ background: 'linear-gradient(135deg, rgba(215,92,51,0.08) 0%, rgba(139,92,246,0.05) 100%)' }}>
                <div className="flex items-center gap-3 mb-4">
                    <img src="/logos/vega-isotipo.png" alt="VEGA" className="h-5 hidden dark:block" />
                    <img src="/logos/vega-isotipo-dark.png" alt="VEGA" className="h-5 block dark:hidden" />
                    <span className="text-[10px] font-black tracking-[0.2em] uppercase text-accent">{title}</span>
                </div>
                <div>{elements}</div>
            </div>
        );
    }

    return (
        <div className="mb-4">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center gap-3 mb-3"
            >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-base ${getSectionIconBg(title)}`}>
                    {getSectionIcon(title)}
                </div>
                <h2 className="text-sm font-black uppercase tracking-[0.08em] text-foreground">{cleanInlineMarkdown(title)}</h2>
                <div className="flex-1 h-px bg-card-border" />
                <Icon className="w-4 h-4 text-muted shrink-0" />
            </button>
            {effectiveOpen && <div className="pl-11">{elements}</div>}
        </div>
    );
}

function parseMarkdownContent(content: string): React.ReactNode[] {
    const lines = content.split('\n');
    const elements: React.ReactNode[] = [];
    let i = 0;

    while (i < lines.length) {
        const line = lines[i].trim();
        if (line === '') { i++; continue; }

        if (line.startsWith('|')) {
            const tableLines: string[] = [];
            while (i < lines.length && lines[i].trim().startsWith('|')) { tableLines.push(lines[i].trim()); i++; }
            elements.push(<MarkdownTable key={`table-${elements.length}`} lines={tableLines} />);
            continue;
        }

        if (line.startsWith('### ')) {
            elements.push(
                <h4 key={`h3-${i}`} className="text-[10px] font-bold uppercase tracking-widest text-foreground mt-3 mb-1.5">
                    {cleanInlineMarkdown(line.slice(4))}
                </h4>
            );
            i++; continue;
        }

        if (line.startsWith('**') && line.endsWith('**')) {
            elements.push(
                <p key={`bold-${i}`} className="text-[10px] font-black uppercase tracking-widest text-accent mt-3 mb-1">
                    {cleanInlineMarkdown(line)}
                </p>
            );
            i++; continue;
        }

        if (/^\d+\.\s/.test(line)) {
            const listItems: string[] = [];
            while (i < lines.length && /^\d+\.\s/.test(lines[i].trim())) {
                listItems.push(lines[i].trim().replace(/^\d+\.\s+/, ''));
                i++;
            }
            elements.push(
                <div key={`ol-${elements.length}`} className="space-y-2 mb-3">
                    {listItems.map((item, idx) => (
                        <div key={idx} className="flex items-start gap-2.5 rounded-xl bg-foreground/[0.03] border border-card-border px-4 py-3">
                            <span className="w-6 h-6 rounded-lg bg-accent text-white text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">
                                {idx + 1}
                            </span>
                            <p className="text-xs text-foreground/85 leading-relaxed">{renderInlineMarkdown(item)}</p>
                        </div>
                    ))}
                </div>
            );
            continue;
        }

        if (line.startsWith('- ') || line.startsWith('* ')) {
            const listItems: { text: string; indent: number }[] = [];
            while (i < lines.length && (lines[i].trimStart().startsWith('- ') || lines[i].trimStart().startsWith('* '))) {
                const raw = lines[i];
                const indent = raw.length - raw.trimStart().length;
                listItems.push({ text: raw.trimStart().replace(/^[-*]\s+/, ''), indent: indent >= 2 ? 1 : 0 });
                i++;
            }
            elements.push(
                <div key={`ul-${elements.length}`} className="space-y-1.5 mb-3">
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

        elements.push(
            <p key={`p-${i}`} className="text-xs text-foreground/80 leading-relaxed mb-2">
                {renderInlineMarkdown(line)}
            </p>
        );
        i++;
    }

    return elements;
}

// --- Main Component ---

export function VegaReportRenderer({ content, metadata, reportType, expandAll }: VegaReportRendererProps) {
    const parsed = useMemo(() => parseReport(content), [content]);
    const hasMetadata = !!metadata;
    const type = reportType || 'daily';

    // Type-aware visibility: generic components for standard reports
    const isGenericReport = ['daily', 'weekly', 'monthly', 'audit'].includes(type);
    const showGenericHeroKPIs = isGenericReport;
    const showGenericAds = isGenericReport;
    const showGenericProducts = isGenericReport;
    const showGenericCountries = isGenericReport;
    const showGenericPL = ['weekly', 'monthly', 'audit'].includes(type);

    // Specialized type flags
    const isEfficiency = type === 'efficiency';
    const isAds = type === 'ads';
    const isProfitability = type === 'profitability';

    return (
        <div>
            {/* Portada */}
            {hasMetadata && (
                <Portada reportType={type} healthLevel={metadata.healthScore?.level} />
            )}

            {/* Executive Summary */}
            {parsed.executiveSummary && <ExecutiveSummary text={parsed.executiveSummary} />}

            {/* Alerts — shown for ALL types */}
            <AlertsPanel alerts={parsed.alerts} />

            {/* ===== GENERIC REPORTS (daily, weekly, monthly, audit) ===== */}
            {hasMetadata && showGenericHeroKPIs && <HeroKPIs metadata={metadata} reportType={type} />}
            {hasMetadata && showGenericAds && <AdsSummaryCard metadata={metadata} />}
            {hasMetadata && showGenericProducts && <TwoColumnProducts metadata={metadata} reportType={type} />}
            {hasMetadata && showGenericCountries && <CountryBreakdown metadata={metadata} />}
            {hasMetadata && showGenericPL && <PLSection metadata={metadata} />}

            {/* ===== EFFICIENCY REPORT ===== */}
            {hasMetadata && isEfficiency && (
                <>
                    <EfficiencyKPIs metadata={metadata} />
                    <LogisticsFunnel metadata={metadata} />
                    <TopProductsByDelivery metadata={metadata} />
                    <EfficiencyCountryCards metadata={metadata} />
                </>
            )}

            {/* ===== ADS REPORT ===== */}
            {hasMetadata && isAds && (
                <>
                    <AdsDetailedKPIs metadata={metadata} />
                    <AdsDetailedPlatformCard metadata={metadata} />
                    <TopProductsByProfitability metadata={metadata} />
                </>
            )}

            {/* ===== PROFITABILITY REPORT ===== */}
            {hasMetadata && isProfitability && (
                <>
                    <ProfitabilityKPIs metadata={metadata} />
                    <WaterfallChart metadata={metadata} />
                    <AdminCostsPL metadata={metadata} />
                    <BerryDonutChart metadata={metadata} />
                    <PLSection metadata={metadata} />
                    <TwoColumnProducts metadata={metadata} reportType={type} />
                    <PLByProduct metadata={metadata} />
                    <MarginGauges metadata={metadata} />
                </>
            )}

            {/* Narrative Sections from AI */}
            {parsed.sections.map((section, i) => (
                <NarrativeSection
                    key={i}
                    title={section.title}
                    content={section.content}
                    defaultOpen={i < 4}
                    forceOpen={expandAll}
                />
            ))}

            {/* Footer */}
            <ReportFooter />
        </div>
    );
}
