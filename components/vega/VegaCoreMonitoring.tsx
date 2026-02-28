'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    Activity, Brain, FileText, TrendingUp, Loader2, Sparkles, Copy, Check,
    ChevronDown, ChevronUp, FileDown, Trash2, Clock, Calendar, BarChart3
} from 'lucide-react';
import { useDashboardData } from '@/lib/hooks/useDashboardData';
import { useAuth } from '@/lib/context/AuthContext';
import { authFetch } from '@/lib/api/client';
import { buildDataContext } from '@/lib/services/vega/context-builder';
import { useKPITargets } from '@/lib/hooks/useKPITargets';
import { calculateOverallHealth } from '@/lib/utils/health';
import { VegaReportRenderer } from './VegaReportRenderer';
import FilterHeader from '@/components/FilterHeader';
import type { VegaReportMetadata, VegaReport, ReportType } from '@/lib/types/vega';

// --- Report type definitions ---

const TIME_REPORTS = [
    { key: 'daily' as ReportType, label: 'Diario', icon: Calendar, color: 'from-blue-500 to-cyan-500', bgColor: 'bg-blue-500/10', textColor: 'text-blue-400', description: 'Resumen del dia' },
    { key: 'weekly' as ReportType, label: 'Semanal', icon: BarChart3, color: 'from-purple-500 to-violet-500', bgColor: 'bg-purple-500/10', textColor: 'text-purple-400', description: 'Analisis de la semana' },
    { key: 'monthly' as ReportType, label: 'Mensual', icon: TrendingUp, color: 'from-emerald-500 to-green-500', bgColor: 'bg-emerald-500/10', textColor: 'text-emerald-400', description: 'Vision del mes completo' },
];

const TOPIC_REPORTS = [
    { key: 'audit' as ReportType, label: 'Auditoria', icon: Brain, color: 'from-purple-500 to-violet-500', bgColor: 'bg-purple-500/10', textColor: 'text-purple-400', description: 'Evaluacion integral de la operacion' },
    { key: 'efficiency' as ReportType, label: 'Eficiencia', icon: Activity, color: 'from-blue-500 to-cyan-500', bgColor: 'bg-blue-500/10', textColor: 'text-blue-400', description: 'Tasas de entrega y logistica' },
    { key: 'ads' as ReportType, label: 'Ads', icon: TrendingUp, color: 'from-orange-500 to-amber-500', bgColor: 'bg-orange-500/10', textColor: 'text-orange-400', description: 'ROAS, CPA y campanas' },
    { key: 'profitability' as ReportType, label: 'Rentabilidad', icon: FileText, color: 'from-emerald-500 to-green-500', bgColor: 'bg-emerald-500/10', textColor: 'text-emerald-400', description: 'Margenes y P&L' },
];

const ALL_REPORT_TYPES = [...TIME_REPORTS, ...TOPIC_REPORTS];

const TYPE_BADGE_COLORS: Record<string, string> = {
    daily: 'text-blue-400 bg-blue-500/10',
    weekly: 'text-purple-400 bg-purple-500/10',
    monthly: 'text-emerald-400 bg-emerald-500/10',
    audit: 'text-purple-400 bg-purple-500/10',
    efficiency: 'text-blue-400 bg-blue-500/10',
    ads: 'text-orange-400 bg-orange-500/10',
    profitability: 'text-emerald-400 bg-emerald-500/10',
    custom: 'text-muted bg-muted/10',
};

const TYPE_LABELS: Record<string, string> = {
    daily: 'Diario',
    weekly: 'Semanal',
    monthly: 'Mensual',
    audit: 'Auditoria',
    efficiency: 'Eficiencia',
    ads: 'Ads',
    profitability: 'Rentabilidad',
    custom: 'Custom',
};

export const VegaCoreMonitoring: React.FC = () => {
    const dashData = useDashboardData();
    const { effectiveUid } = useAuth();
    const { targets: kpiTargets } = useKPITargets();

    // Generation state
    const [generating, setGenerating] = useState(false);
    const [generatingType, setGeneratingType] = useState<string | null>(null);
    const [generateError, setGenerateError] = useState<string | null>(null);

    // Current report view
    const [currentReport, setCurrentReport] = useState<VegaReport | null>(null);
    const [copied, setCopied] = useState(false);

    // Report history
    const [reports, setReports] = useState<VegaReport[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(true);
    const [historyOpen, setHistoryOpen] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    // PDF export
    const [exportingPDF, setExportingPDF] = useState(false);
    const [expandAllSections, setExpandAllSections] = useState(false);
    const reportContentRef = useRef<HTMLDivElement>(null);

    // Build metadata from dashboard data
    const metadata = useMemo((): VegaReportMetadata | undefined => {
        const kpis = dashData.kpis;
        if (!kpis) return undefined;

        const healthScore = calculateOverallHealth(kpis, kpiTargets);
        const metricsByCountry = (dashData.metricsByCountry || []).map((c: any) => ({
            countryName: c.name,
            kpis: {
                n_ord: c.orderCount || 0,
                n_ent: Math.round((c.deliveryRate || 0) * (c.orderCount || 0) / 100),
                n_can: c.cancelCount || 0,
                n_dev: 0,
                n_tra: Math.round(((c.transitRate || 0) * (c.orderCount || 0)) / 100),
                tasa_ent: c.deliveryRate || 0,
                tasa_can: c.cancelRate || 0,
                g_ads: c.adSpend || 0,
                roas_real: c.adSpend > 0 ? (c.sales || 0) / c.adSpend : 0,
                u_real: c.profit || 0,
                fact_neto: c.sales || 0,
            },
            products: (c.products || []).map((p: any) => ({
                id: p.id,
                name: p.name,
                n_ord: p.orderCount || 0,
                n_ent: Math.round((p.deliveryRate || 0) * (p.orderCount || 0) / 100),
                n_can: Math.round((p.cancelRate || 0) * (p.orderCount || 0) / 100),
                n_dev: 0,
                n_tra: Math.round((p.transitRate || 0) * (p.orderCount || 0) / 100),
                tasa_ent: p.deliveryRate || 0,
                ads: p.adSpend || 0,
                cpa: p.cpa || 0,
                cpaDesp: p.cpa || 0,
                utilReal: p.profit || 0,
                utilProy: p.projectedProfit || 0,
            })),
        }));

        return {
            healthScore,
            kpis: kpis as unknown as Record<string, number>,
            metricsByCountry,
            adPlatformMetrics: dashData.adPlatformMetrics,
            prevKpis: (dashData.prevKpis as unknown as Record<string, number>) || undefined,
        };
    }, [dashData.kpis, dashData.metricsByCountry, dashData.adPlatformMetrics, dashData.prevKpis, kpiTargets]);

    // Fetch report history
    useEffect(() => {
        const fetchReports = async () => {
            try {
                const res = await authFetch('/api/vega/reports');
                const data = await res.json();
                setReports(data.reports || []);
            } catch {
                // silent
            } finally {
                setLoadingHistory(false);
            }
        };
        fetchReports();
    }, []);

    // Unified generation handler
    const handleGenerate = async (type: ReportType) => {
        if (dashData.loading || !dashData.kpis) {
            setGenerateError('Espera a que los datos carguen antes de generar.');
            return;
        }

        setGenerating(true);
        setGeneratingType(type);
        setGenerateError(null);
        setCurrentReport(null);

        try {
            let berryExpenses: { category: string; amount: number }[] = [];
            let berryExpenseTotal = 0;
            try {
                const { getExpenses, totalByCategory } = await import('@/lib/services/expenses');
                const expenses = await getExpenses(effectiveUid || '');
                const now = new Date();
                const monthExp = expenses.filter((e: any) => e.month === (now.getMonth() + 1) && e.year === now.getFullYear());
                const byCategory = totalByCategory(monthExp);
                berryExpenses = Object.entries(byCategory).map(([category, amount]) => ({ category, amount }));
                berryExpenseTotal = berryExpenses.reduce((s, e) => s + e.amount, 0);
            } catch { /* Berry expenses optional */ }

            const campaignNames = [...new Set(dashData.filteredAds.map(h => h.campaignName).filter((n): n is string => !!n))];

            const dataContext = buildDataContext({
                kpis: dashData.kpis,
                prevKpis: dashData.prevKpis,
                orderCount: dashData.filteredOrders.length,
                countries: dashData.availableCountries,
                adPlatformMetrics: dashData.adPlatformMetrics,
                projectedProfit: dashData.projectedProfit,
                metricsByCountry: dashData.metricsByCountry,
                dateRange: dashData.dateRange,
                dailySalesData: dashData.dailySalesData,
                filteredOrders: dashData.filteredOrders,
                availableProducts: dashData.availableProducts,
                filteredAds: dashData.filteredAds,
                logisticStats: dashData.logisticStats,
                berryExpenses,
                berryExpenseTotal,
                campaignNames,
            });

            // Time-based reports go to /api/vega/reports, topic-based to /api/vega/analyze
            const isTimeReport = ['daily', 'weekly', 'monthly'].includes(type);
            const endpoint = isTimeReport ? '/api/vega/reports' : '/api/vega/analyze';

            const res = await authFetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type,
                    dataContext,
                    period: dashData.dateRange,
                    kpiTargets,
                    kpis: dashData.kpis,
                    metricsByCountry: dashData.metricsByCountry,
                    adPlatformMetrics: dashData.adPlatformMetrics,
                    prevKpis: dashData.prevKpis,
                    berryExpenses,
                }),
            });

            if (!res.ok) {
                let errorMsg = `Error ${res.status}`;
                try {
                    const errData = await res.json();
                    errorMsg = errData.error || errorMsg;
                } catch {
                    errorMsg = `Error del servidor (${res.status}). Intenta de nuevo.`;
                }
                setGenerateError(errorMsg);
                return;
            }

            const data = await res.json();
            if (data.error) {
                setGenerateError(data.error);
            } else if (data.report) {
                setCurrentReport(data.report);
                setReports(prev => [data.report, ...prev]);
            } else {
                setGenerateError('No se recibio respuesta del servidor.');
            }
        } catch (err: any) {
            console.error('Error generating:', err);
            setGenerateError(err?.message || 'Error al generar. Intenta de nuevo.');
        } finally {
            setGenerating(false);
            setGeneratingType(null);
        }
    };

    // Delete handler
    const handleDelete = async (reportId: string) => {
        setDeletingId(reportId);
        try {
            const res = await authFetch('/api/vega/reports', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reportId }),
            });
            if (res.ok) {
                setReports(prev => prev.filter(r => r.id !== reportId));
                if (currentReport?.id === reportId) setCurrentReport(null);
            }
        } catch {
            // silent
        } finally {
            setDeletingId(null);
        }
    };

    // Copy handler
    const handleCopy = () => {
        if (currentReport?.content) {
            navigator.clipboard.writeText(currentReport.content);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    // PDF export handler
    const handleExportPDF = async () => {
        if (!reportContentRef.current || exportingPDF || !currentReport) return;
        setExportingPDF(true);
        try {
            setExpandAllSections(true);
            await new Promise(r => setTimeout(r, 300));
            const { captureElementToPDF } = await import('@/lib/services/pdf/capture');
            const filename = `Grand_Line_${currentReport.title.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`;
            await captureElementToPDF(reportContentRef.current!, filename);
        } catch (err) {
            console.error('Error exporting PDF:', err);
        } finally {
            setExpandAllSections(false);
            setExportingPDF(false);
        }
    };

    const activeType = ALL_REPORT_TYPES.find(a => a.key === generatingType);

    return (
        <div className="space-y-6">
            {/* Filter Header */}
            <FilterHeader
                availableCountries={dashData.availableCountries}
                availableProducts={dashData.availableProducts}
            />

            {/* Report Type Buttons */}
            <div className="bg-card border border-card-border rounded-2xl p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    <h3 className="text-xs font-bold text-muted uppercase tracking-widest">Generar Reporte o Analisis</h3>
                </div>

                {/* Time-based reports */}
                <p className="text-[9px] font-black text-muted uppercase tracking-[0.2em] mb-2">Reportes por periodo</p>
                <div className="grid grid-cols-3 gap-3 mb-4">
                    {TIME_REPORTS.map(a => {
                        const Icon = a.icon;
                        const isActive = generatingType === a.key;
                        return (
                            <button
                                key={a.key}
                                onClick={() => handleGenerate(a.key)}
                                disabled={generating || dashData.loading || !dashData.kpis}
                                className={`p-4 rounded-xl border text-left transition-all group relative overflow-hidden ${isActive
                                    ? `${a.bgColor} border-transparent`
                                    : 'bg-hover-bg border-card-border hover:border-foreground/15'
                                } disabled:opacity-50`}
                            >
                                {isActive && <div className={`absolute inset-0 bg-gradient-to-br ${a.color} opacity-[0.08]`} />}
                                <div className="relative">
                                    <div className={`w-9 h-9 rounded-xl ${a.bgColor} flex items-center justify-center mb-3`}>
                                        {generating && isActive
                                            ? <Loader2 className={`w-4 h-4 ${a.textColor} animate-spin`} />
                                            : <Icon className={`w-4 h-4 ${a.textColor}`} />
                                        }
                                    </div>
                                    <p className="text-xs font-bold text-foreground mb-0.5">{a.label}</p>
                                    <p className="text-[10px] text-muted leading-tight">{a.description}</p>
                                </div>
                            </button>
                        );
                    })}
                </div>

                {/* Topic-based analyses */}
                <p className="text-[9px] font-black text-muted uppercase tracking-[0.2em] mb-2">Analisis por tema</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {TOPIC_REPORTS.map(a => {
                        const Icon = a.icon;
                        const isActive = generatingType === a.key;
                        return (
                            <button
                                key={a.key}
                                onClick={() => handleGenerate(a.key)}
                                disabled={generating || dashData.loading || !dashData.kpis}
                                className={`p-4 rounded-xl border text-left transition-all group relative overflow-hidden ${isActive
                                    ? `${a.bgColor} border-transparent`
                                    : 'bg-hover-bg border-card-border hover:border-foreground/15'
                                } disabled:opacity-50`}
                            >
                                {isActive && <div className={`absolute inset-0 bg-gradient-to-br ${a.color} opacity-[0.08]`} />}
                                <div className="relative">
                                    <div className={`w-9 h-9 rounded-xl ${a.bgColor} flex items-center justify-center mb-3`}>
                                        {generating && isActive
                                            ? <Loader2 className={`w-4 h-4 ${a.textColor} animate-spin`} />
                                            : <Icon className={`w-4 h-4 ${a.textColor}`} />
                                        }
                                    </div>
                                    <p className="text-xs font-bold text-foreground mb-0.5">{a.label}</p>
                                    <p className="text-[10px] text-muted leading-tight">{a.description}</p>
                                </div>
                            </button>
                        );
                    })}
                </div>

                {/* Error message */}
                {generateError && (
                    <div className="flex items-center gap-2 px-3 py-2 mt-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                        <p className="text-[10px] text-red-400">{generateError}</p>
                    </div>
                )}

                {/* Loading data indicator */}
                {dashData.loading && (
                    <div className="flex items-center gap-2 px-3 py-2 mt-3 bg-accent/5 border border-accent/10 rounded-xl">
                        <Loader2 className="w-3.5 h-3.5 text-accent animate-spin shrink-0" />
                        <p className="text-[10px] text-muted">Cargando datos del dashboard...</p>
                    </div>
                )}
            </div>

            {/* Loading State */}
            {generating && (
                <div className="bg-card border border-card-border rounded-2xl p-8 shadow-sm">
                    <div className="flex flex-col items-center justify-center gap-4">
                        <div className="relative">
                            <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${activeType?.color || 'from-purple-500 to-violet-500'} flex items-center justify-center shadow-lg`}>
                                <Loader2 className="w-6 h-6 text-white animate-spin" />
                            </div>
                            <div className={`absolute -inset-2 bg-gradient-to-br ${activeType?.color || 'from-purple-500 to-violet-500'} opacity-20 rounded-3xl blur-xl animate-pulse`} />
                        </div>
                        <div className="text-center">
                            <p className="text-sm font-semibold text-foreground">Vega esta generando...</p>
                            <p className="text-xs text-muted mt-1">{activeType?.description}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Current Report Result */}
            {currentReport && !generating && (
                <div className="bg-card border border-card-border rounded-2xl shadow-sm overflow-hidden">
                    {/* Result header */}
                    <div className="relative px-5 py-4 border-b border-card-border">
                        <div className={`absolute inset-0 bg-gradient-to-r ${ALL_REPORT_TYPES.find(a => a.key === currentReport.type)?.color || 'from-purple-500 to-violet-500'} opacity-[0.06]`} />
                        <div className="relative flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${ALL_REPORT_TYPES.find(a => a.key === currentReport.type)?.color || 'from-purple-500 to-violet-500'} flex items-center justify-center shadow-md`}>
                                    {(() => {
                                        const found = ALL_REPORT_TYPES.find(a => a.key === currentReport.type);
                                        const Icon = found?.icon || Brain;
                                        return <Icon className="w-4 h-4 text-white" />;
                                    })()}
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-foreground">{currentReport.title}</h3>
                                    <p className="text-[10px] text-muted">
                                        Generado por Vega IA &bull; {new Date(currentReport.generatedAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={handleExportPDF}
                                    disabled={exportingPDF}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-muted hover:text-foreground hover:bg-foreground/5 transition-colors disabled:opacity-40"
                                >
                                    {exportingPDF ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
                                    PDF
                                </button>
                                <button
                                    onClick={handleCopy}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-muted hover:text-foreground hover:bg-foreground/5 transition-colors"
                                >
                                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                                    {copied ? 'Copiado' : 'Copiar'}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Result body */}
                    <div className="px-5 py-5">
                        <div ref={reportContentRef}>
                            <VegaReportRenderer
                                content={currentReport.content}
                                metadata={currentReport.metadata || metadata}
                                reportType={currentReport.type}
                                expandAll={expandAllSections}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Report History — Collapsible */}
            <div className="bg-card border border-card-border rounded-2xl shadow-sm overflow-hidden">
                <button
                    onClick={() => setHistoryOpen(!historyOpen)}
                    className="w-full flex items-center justify-between px-5 py-4 hover:bg-hover-bg transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <Clock className="w-4 h-4 text-muted" />
                        <div className="text-left">
                            <h3 className="text-[11px] font-black text-muted uppercase tracking-widest">Historial de Reportes</h3>
                            <p className="text-[9px] text-muted mt-0.5">{reports.length} reportes generados</p>
                        </div>
                    </div>
                    {historyOpen ? <ChevronUp className="w-4 h-4 text-muted" /> : <ChevronDown className="w-4 h-4 text-muted" />}
                </button>

                {historyOpen && (
                    <div className="border-t border-card-border">
                        {loadingHistory ? (
                            <div className="text-center py-6">
                                <p className="text-[10px] text-muted font-mono uppercase tracking-widest animate-pulse">Cargando...</p>
                            </div>
                        ) : reports.length === 0 ? (
                            <div className="text-center py-8 px-5">
                                <FileText className="w-6 h-6 text-muted mx-auto mb-2" />
                                <p className="text-[10px] font-black text-muted uppercase tracking-widest">Sin reportes</p>
                            </div>
                        ) : (
                            <div className="max-h-[500px] overflow-y-auto">
                                {reports.map(report => (
                                    <div key={report.id} className="border-b border-card-border/50 last:border-b-0">
                                        <div className="flex items-center justify-between px-5 py-3 hover:bg-hover-bg transition-colors">
                                            <button
                                                onClick={() => {
                                                    setCurrentReport(report);
                                                    setHistoryOpen(false);
                                                }}
                                                className="flex items-center gap-3 flex-1 text-left min-w-0"
                                            >
                                                <FileText className="w-3.5 h-3.5 text-muted shrink-0" />
                                                <div className="min-w-0">
                                                    <p className="text-[10px] font-bold text-foreground truncate">{report.title}</p>
                                                    <p className="text-[9px] text-muted font-mono mt-0.5">
                                                        {new Date(report.generatedAt).toLocaleString('es-CO')}
                                                    </p>
                                                </div>
                                            </button>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded uppercase ${TYPE_BADGE_COLORS[report.type] || TYPE_BADGE_COLORS.custom}`}>
                                                    {TYPE_LABELS[report.type] || report.type}
                                                </span>
                                                {report.automated && (
                                                    <span className="text-[7px] font-bold px-1 py-0.5 rounded bg-accent/10 text-accent uppercase">Auto</span>
                                                )}
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDelete(report.id);
                                                    }}
                                                    disabled={deletingId === report.id}
                                                    className="p-1.5 rounded-lg text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40"
                                                    title="Eliminar reporte"
                                                >
                                                    {deletingId === report.id
                                                        ? <Loader2 className="w-3 h-3 animate-spin" />
                                                        : <Trash2 className="w-3 h-3" />
                                                    }
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
