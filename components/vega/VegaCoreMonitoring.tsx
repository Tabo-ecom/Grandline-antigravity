'use client';

import React, { useState } from 'react';
import { Activity, Brain, FileText, TrendingUp, Loader2, Sparkles, Copy, Check } from 'lucide-react';
import { useDashboardData } from '@/lib/hooks/useDashboardData';
import { useAuth } from '@/lib/context/AuthContext';
import { authFetch } from '@/lib/api/client';
import { buildDataContext } from '@/lib/services/vega/context-builder';
import { formatCurrency } from '@/lib/utils/currency';
import { VegaMarkdown } from './VegaMarkdown';
import { useKPITargets } from '@/lib/hooks/useKPITargets';
import { evaluateHealth, getHealthColor as healthColor, getHealthBgClass, getHealthLabel, findTarget } from '@/lib/utils/health';
import { PDFExportButton } from '@/components/common/PDFExportButton';
import type { PDFReportData } from '@/lib/services/pdf/types';

const ANALYSIS_TYPES = [
    { key: 'audit', label: 'Auditoria Completa', icon: Brain, color: 'from-purple-500 to-violet-500', bgColor: 'bg-purple-500/10', textColor: 'text-purple-400', description: 'Evaluacion integral de la operacion' },
    { key: 'efficiency', label: 'Eficiencia Operativa', icon: Activity, color: 'from-blue-500 to-cyan-500', bgColor: 'bg-blue-500/10', textColor: 'text-blue-400', description: 'Tasas de entrega, cancelacion y logistica' },
    { key: 'ads', label: 'Rendimiento Ads', icon: TrendingUp, color: 'from-orange-500 to-amber-500', bgColor: 'bg-orange-500/10', textColor: 'text-orange-400', description: 'ROAS, CPA y optimizacion de campanas' },
    { key: 'profitability', label: 'Rentabilidad', icon: FileText, color: 'from-emerald-500 to-green-500', bgColor: 'bg-emerald-500/10', textColor: 'text-emerald-400', description: 'Margenes, costos y sostenibilidad' },
];

export const VegaCoreMonitoring: React.FC = () => {
    const dashData = useDashboardData();
    const { effectiveUid } = useAuth();
    const { targets: kpiTargets } = useKPITargets();
    const [analyzing, setAnalyzing] = useState(false);
    const [analysisType, setAnalysisType] = useState<string | null>(null);
    const [analysisResult, setAnalysisResult] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    const kpis = dashData.kpis;

    const handleAnalyze = async (type: string) => {
        setAnalyzing(true);
        setAnalysisType(type);
        setAnalysisResult(null);

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

            const res = await authFetch('/api/vega/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type, dataContext, kpiTargets }),
            });

            const data = await res.json();
            setAnalysisResult(data.response || data.error || 'Sin respuesta');
        } catch {
            setAnalysisResult('Error al conectar con Vega AI');
        } finally {
            setAnalyzing(false);
        }
    };

    const handleCopy = () => {
        if (analysisResult) {
            navigator.clipboard.writeText(analysisResult);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const activeAnalysis = ANALYSIS_TYPES.find(a => a.key === analysisType);

    const evalKpi = (value: number, key: string) => {
        const t = findTarget(kpiTargets, key);
        if (!t) return { color: 'text-foreground', bg: 'bg-card border-card-border', label: '' };
        const status = evaluateHealth(value, t);
        return { color: healthColor(status), bg: getHealthBgClass(status), label: getHealthLabel(status, key) };
    };

    return (
        <div className="space-y-6">
            {/* Health Status Cards */}
            {kpis && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {(() => { const h = evalKpi(kpis.roas_real, 'roas_real'); return (
                    <div className={`rounded-2xl p-4 border transition-colors ${h.bg}`}>
                        <p className="text-[10px] font-bold text-muted uppercase tracking-widest mb-2">ROAS Real</p>
                        <p className={`text-2xl font-black tracking-tight ${h.color}`}>
                            {kpis.roas_real.toFixed(2)}x
                        </p>
                        <p className="text-[10px] text-muted mt-1">{h.label}</p>
                    </div>
                    ); })()}
                    {(() => { const h = evalKpi(kpis.tasa_ent, 'tasa_ent'); return (
                    <div className={`rounded-2xl p-4 border transition-colors ${h.bg}`}>
                        <p className="text-[10px] font-bold text-muted uppercase tracking-widest mb-2">Tasa Entrega</p>
                        <p className={`text-2xl font-black tracking-tight ${h.color}`}>
                            {kpis.tasa_ent.toFixed(1)}%
                        </p>
                        <p className="text-[10px] text-muted mt-1">{h.label}</p>
                    </div>
                    ); })()}
                    {(() => { const h = evalKpi(kpis.perc_ads_revenue, 'perc_ads_revenue'); return (
                    <div className={`rounded-2xl p-4 border transition-colors ${h.bg}`}>
                        <p className="text-[10px] font-bold text-muted uppercase tracking-widest mb-2">% Ads/Revenue</p>
                        <p className={`text-2xl font-black tracking-tight ${h.color}`}>
                            {kpis.perc_ads_revenue.toFixed(1)}%
                        </p>
                        <p className="text-[10px] text-muted mt-1">{h.label}</p>
                    </div>
                    ); })()}
                    <div className={`rounded-2xl p-4 border transition-colors ${kpis.u_real >= 0 ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
                        <p className="text-[10px] font-bold text-muted uppercase tracking-widest mb-2">Utilidad Real</p>
                        <p className={`text-2xl font-black tracking-tight ${kpis.u_real >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {formatCurrency(kpis.u_real)}
                        </p>
                        <p className="text-[10px] text-muted mt-1">
                            {kpis.u_real >= 0 ? 'Rentable' : 'En perdida'}
                        </p>
                    </div>
                </div>
            )}

            {/* Analysis Actions */}
            <div className="bg-card border border-card-border rounded-2xl p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    <h3 className="text-xs font-bold text-muted uppercase tracking-widest">Analisis con IA</h3>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {ANALYSIS_TYPES.map(a => {
                        const Icon = a.icon;
                        const isActive = analysisType === a.key;
                        return (
                            <button
                                key={a.key}
                                onClick={() => handleAnalyze(a.key)}
                                disabled={analyzing}
                                className={`p-4 rounded-xl border text-left transition-all group relative overflow-hidden ${isActive
                                    ? `${a.bgColor} border-transparent`
                                    : 'bg-hover-bg border-card-border hover:border-foreground/15'
                                    } disabled:opacity-50`}
                            >
                                {isActive && (
                                    <div className={`absolute inset-0 bg-gradient-to-br ${a.color} opacity-[0.08]`} />
                                )}
                                <div className="relative">
                                    <div className={`w-9 h-9 rounded-xl ${a.bgColor} flex items-center justify-center mb-3`}>
                                        {analyzing && isActive
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
            </div>

            {/* Loading State */}
            {analyzing && (
                <div className="bg-card border border-card-border rounded-2xl p-8 shadow-sm">
                    <div className="flex flex-col items-center justify-center gap-4">
                        <div className="relative">
                            <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${activeAnalysis?.color || 'from-purple-500 to-violet-500'} flex items-center justify-center shadow-lg`}>
                                <Loader2 className="w-6 h-6 text-white animate-spin" />
                            </div>
                            <div className={`absolute -inset-2 bg-gradient-to-br ${activeAnalysis?.color || 'from-purple-500 to-violet-500'} opacity-20 rounded-3xl blur-xl animate-pulse`} />
                        </div>
                        <div className="text-center">
                            <p className="text-sm font-semibold text-foreground">Vega esta analizando...</p>
                            <p className="text-xs text-muted mt-1">{activeAnalysis?.description}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Analysis Result */}
            {analysisResult && !analyzing && (
                <div className="bg-card border border-card-border rounded-2xl shadow-sm overflow-hidden">
                    {/* Result header */}
                    <div className="relative px-5 py-4 border-b border-card-border">
                        <div className={`absolute inset-0 bg-gradient-to-r ${activeAnalysis?.color || 'from-purple-500 to-violet-500'} opacity-[0.06]`} />
                        <div className="relative flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${activeAnalysis?.color || 'from-purple-500 to-violet-500'} flex items-center justify-center shadow-md`}>
                                    {activeAnalysis ? <activeAnalysis.icon className="w-4 h-4 text-white" /> : <Brain className="w-4 h-4 text-white" />}
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-foreground">
                                        {activeAnalysis?.label || 'Resultado del Analisis'}
                                    </h3>
                                    <p className="text-[10px] text-muted">
                                        Generado por Vega IA &bull; {new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-1">
                                <PDFExportButton
                                    compact
                                    getData={() => ({
                                        title: activeAnalysis?.label || 'Analisis',
                                        period: dashData.dateRange,
                                        generatedAt: Date.now(),
                                        kpis: dashData.kpis,
                                        kpiTargets,
                                        metricsByCountry: dashData.metricsByCountry,
                                        logisticStats: dashData.logisticStats,
                                        vegaAnalysis: analysisResult || undefined,
                                    } as PDFReportData)}
                                />
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

                    {/* Result body with rich markdown */}
                    <div className="px-5 py-5 max-h-[600px] overflow-y-auto">
                        <VegaMarkdown content={analysisResult} />
                    </div>
                </div>
            )}
        </div>
    );
};
