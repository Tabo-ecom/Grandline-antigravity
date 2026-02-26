'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/lib/context/AuthContext';
import { useDashboardData } from '@/lib/hooks/useDashboardData';
import { formatCurrency } from '@/lib/utils/currency';
import { isEntregado, isCancelado, isTransit } from '@/lib/utils/status';
import {
    TrendingUp,
    Zap,
    Target,
    Map as MapIcon,
    DollarSign,
    TrendingDown,
    ArrowUpRight,
    Activity,
    X,
    Search,
    Edit3,
    Loader2,
    AlertCircle,
    Bug,
    LayoutGrid,
    Package,
    Calendar,
    Maximize2,
    Minimize2,
    Bot,
    Sparkles,
    Trophy,
    AlertTriangle,
} from 'lucide-react';
import FilterHeader from '@/components/FilterHeader';
import InfoTooltip from '@/components/common/InfoTooltip';
import StatCard from '@/components/dashboard/StatCard';
import HealthBadge from '@/components/dashboard/HealthBadge';
import PlatformBar from '@/components/dashboard/PlatformBar';
import { useGlobalFilters } from '@/lib/context/FilterContext';
import dynamic from 'next/dynamic';

const CountryTable = dynamic(() => import('@/components/dashboard/CountryTable'));
import { useKPITargets } from '@/lib/hooks/useKPITargets';
import { buildDataContext } from '@/lib/services/vega/context-builder';
import { authFetch } from '@/lib/api/client';
import { VegaMarkdown } from '@/components/vega/VegaMarkdown';
import { evaluateHealth, getHealthColor, findTarget } from '@/lib/utils/health';
import {
    ComposedChart,
    Bar,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell,
    PieChart,
    Pie,
    ReferenceArea,
    ReferenceLine
} from 'recharts';

interface ProductMetric {
    id: string;
    name: string;
    orderCount: number;
    deliveryRate: number;
    cancelRate: number;
    transitRate: number;
    returnRate: number;
    profit: number;
    adSpend: number;
    netSales: number;
    roas: number;
    cpa: number;
    projectedProfit: number;
    projectionConfig: number;
}

interface CountryMetric {
    name: string;
    currency: string;
    orderCount: number;
    deliveryRate: number;
    cancelRate: number;
    transitRate: number;
    returnRate: number;
    cancelCount: number;
    sales: number;
    adSpend: number;
    profit: number;
    projectedProfit: number;
    projectionConfig: number;
    products: ProductMetric[];
}

export default function GlobalDashboard() {
    const { effectiveUid } = useAuth();

    const {
        loading,
        error,
        rawOrdersCount,
        invalidDatesCount,
        dateRange, setDateRange,
        country, setCountry,
        product, setProduct,
        availableCountries,
        availableProducts,
        filteredOrders,
        kpis,
        prevKpis,
        logisticStats,
        adPlatformMetrics,
        dailySalesData,
        productPerformanceData,
        projectedProfit,
        metricsByCountry,
        rawDatesSample,
        startDateCustom, setStartDateCustom,
        endDateCustom, setEndDateCustom,
        filteredAds,
        projectionSettings,
        saveProjectionSettings
    } = useDashboardData();

    const { targets: kpiTargets } = useKPITargets();
    const [expandedCountry, setExpandedCountry] = useState<string | null>(null);
    const [showDebug, setShowDebug] = useState(false);
    const [expandedTrends, setExpandedTrends] = useState(false);

    // Full product performance data (all products, not just top 10)
    const productPerformanceDataFull = useMemo(() => {
        const productMap = new Map<string, any>();
        metricsByCountry.forEach((ctry: any) => {
            ctry.products.forEach((p: any) => {
                const existing = productMap.get(p.name) || { name: p.name, label: p.name, sales: 0, profit: 0, ads: 0, projected_profit: 0, orderCount: 0 };
                productMap.set(p.name, {
                    ...existing,
                    sales: existing.sales + p.netSales,
                    profit: existing.profit + p.profit,
                    ads: existing.ads + p.adSpend,
                    projected_profit: existing.projected_profit + p.projectedProfit,
                    orderCount: existing.orderCount + p.orderCount,
                });
            });
        });
        return Array.from(productMap.values()).sort((a, b) => b.orderCount - a.orderCount);
    }, [metricsByCountry]);

    // Product rankings per country: profitable vs losing
    const { profitableProducts, losingProducts } = useMemo(() => {
        const FLAG_MAP: Record<string, string> = {
            'Colombia': 'co', 'México': 'mx', 'Perú': 'pe', 'Ecuador': 'ec',
            'Panamá': 'pa', 'Chile': 'cl', 'España': 'es', 'Guatemala': 'gt',
        };
        const all: { name: string; country: string; flag: string; orders: number; cancelRate: number; netSales: number; ads: number; projectedProfit: number; cpaDesp: number; utilPerOrder: number; roiPct: number }[] = [];
        metricsByCountry.forEach((ctry: any) => {
            ctry.products.forEach((p: ProductMetric) => {
                if (p.orderCount === 0 && p.adSpend === 0) return;
                const cancelRate = p.cancelRate;
                const cpaDesp = p.orderCount > 0 ? p.adSpend / p.orderCount : 0;
                const utilPerOrder = p.orderCount > 0 ? p.projectedProfit / p.orderCount : 0;
                const roiPct = p.adSpend > 0 ? (p.projectedProfit / p.adSpend) * 100 : 0;
                all.push({
                    name: p.name, country: ctry.name, flag: FLAG_MAP[ctry.name] || 'un',
                    orders: p.orderCount, cancelRate, netSales: p.netSales, ads: p.adSpend,
                    projectedProfit: p.projectedProfit, cpaDesp, utilPerOrder, roiPct,
                });
            });
        });
        const profitable = all.filter(p => p.projectedProfit >= 0).sort((a, b) => b.projectedProfit - a.projectedProfit);
        const losing = all.filter(p => p.projectedProfit < 0).sort((a, b) => a.projectedProfit - b.projectedProfit);
        return { profitableProducts: profitable, losingProducts: losing };
    }, [metricsByCountry]);
    const [showAllProfitable, setShowAllProfitable] = useState(false);
    const [showAllLosing, setShowAllLosing] = useState(false);

    // VEGA quick analysis
    const [vegaResponse, setVegaResponse] = useState<string | null>(null);
    const [vegaLoading, setVegaLoading] = useState(false);

    const [visibleLogistics, setVisibleLogistics] = useState({
        entregados: true,
        transito: true,
        devoluciones: true,
        cancelados: true
    });
    const [chartView, setChartView] = useState<'date' | 'product'>('date');
    const [localOverrides, setLocalOverrides] = useState<any>(null);
    const [isSavingProjections, setIsSavingProjections] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

    // Sync local overrides with server settings
    useEffect(() => {
        if (projectionSettings && !localOverrides) {
            setLocalOverrides(projectionSettings);
        }
    }, [projectionSettings, localOverrides]);

    const handleSaveProjections = async () => {
        if (!effectiveUid || !localOverrides) return;
        setIsSavingProjections(true);
        try {
            await saveProjectionSettings(localOverrides, effectiveUid);
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3000);
        } catch (err) {
            alert("Error al guardar proyecciones");
        } finally {
            setIsSavingProjections(false);
        }
    };

    const updateCountryOverride = (ctryName: string, val: number) => {
        setLocalOverrides((prev: any) => ({
            ...prev,
            countries: {
                ...(prev?.countries || {}),
                [ctryName]: {
                    ...(prev?.countries?.[ctryName] || {}),
                    delivery_percent: val
                }
            }
        }));
    };

    const updateProductOverride = (ctryName: string, prodId: string, val: number) => {
        setLocalOverrides((prev: any) => ({
            ...prev,
            products: {
                ...(prev?.products || {}),
                [ctryName]: {
                    ...(prev?.products?.[ctryName] || {}),
                    [prodId]: val
                }
            }
        }));
    };
    const [visibleTrends, setVisibleTrends] = useState({
        sales: true,
        profit: true,
        ads: true,
        projected_profit: true
    });

    // Drag-select state for chart
    const [dragStart, setDragStart] = useState<string | null>(null);
    const [dragEnd, setDragEnd] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [selectionData, setSelectionData] = useState<{ sales: number; ads: number; profit: number; projectedProfit: number; days: number; range: string } | null>(null);

    const handleChartMouseDown = (e: any) => {
        if (e?.activeLabel) {
            setDragStart(e.activeLabel);
            setDragEnd(e.activeLabel);
            setIsDragging(true);
            setSelectionData(null);
        }
    };

    const handleChartMouseMove = (e: any) => {
        if (isDragging && e?.activeLabel) {
            setDragEnd(e.activeLabel);
        }
    };

    const handleChartMouseUp = () => {
        const chartData = chartView === 'date' ? dailySalesData : (expandedTrends ? productPerformanceDataFull : productPerformanceData);
        if (isDragging && dragStart && dragEnd && chartData.length > 0) {
            setIsDragging(false);
            // Find indices
            const labels = chartData.map((d: any) => d.name);
            let startIdx = labels.indexOf(dragStart);
            let endIdx = labels.indexOf(dragEnd);
            if (startIdx > endIdx) [startIdx, endIdx] = [endIdx, startIdx];
            if (startIdx >= 0 && endIdx >= 0) {
                const selected = chartData.slice(startIdx, endIdx + 1);
                const totalSales = selected.reduce((s: number, d: any) => s + (d.sales || 0), 0);
                const totalAds = selected.reduce((s: number, d: any) => s + (d.ads || 0), 0);
                const totalProfit = selected.reduce((s: number, d: any) => s + (d.profit || 0), 0);
                const totalProj = selected.reduce((s: number, d: any) => s + (d.projected_profit || 0), 0);
                setSelectionData({
                    sales: totalSales,
                    ads: totalAds,
                    profit: totalProfit,
                    projectedProfit: totalProj,
                    days: chartView === 'date' ? selected.length : 0,
                    range: chartView === 'date'
                        ? `${selected[0]?.label} – ${selected[selected.length - 1]?.label}`
                        : `${selected.length} productos seleccionados`
                });
                // Normalize start/end order
                setDragStart(labels[startIdx]);
                setDragEnd(labels[endIdx]);
            }
        } else {
            setIsDragging(false);
        }
    };

    const clearSelection = () => {
        setDragStart(null);
        setDragEnd(null);
        setSelectionData(null);
    };

    // Clear selection on Escape
    React.useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') clearSelection(); };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, []);

    const runVegaAnalysis = async () => {
        if (vegaLoading) return;
        setVegaLoading(true);
        setVegaResponse(null);
        try {
            const dataContext = buildDataContext({
                kpis: kpis || null,
                prevKpis: prevKpis || null,
                orderCount: filteredOrders.length,
                countries: availableCountries,
                adPlatformMetrics,
                projectedProfit,
                metricsByCountry,
                dateRange,
                dailySalesData,
                filteredOrders,
                availableProducts,
                filteredAds,
                logisticStats,
            });
            const res = await authFetch('/api/vega/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: 'Dame un resumen ejecutivo corto de máximo 5 líneas con lo más importante del dashboard actual. Destaca alertas críticas y oportunidades. Sé directo y conciso.',
                    dataContext,
                    chatHistory: [],
                    kpiTargets,
                }),
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            setVegaResponse(data.response);
        } catch (err) {
            setVegaResponse(`Error: ${err instanceof Error ? err.message : 'No se pudo conectar con Vega AI'}`);
        } finally {
            setVegaLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-background">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 rounded-full border-4 border-accent/30 border-t-accent animate-spin" />
                    <p className="text-muted text-sm font-medium animate-pulse">Cargando Centro de Mando...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-background">
                <div className="p-8 bg-red-500/10 border border-red-500/20 rounded-2xl max-w-md text-center">
                    <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-foreground mb-2">Error de Carga</h3>
                    <p className="text-muted text-sm">{error}</p>
                    <button onClick={() => window.location.reload()} className="mt-4 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors">
                        Reintentar
                    </button>
                </div>
            </div>
        );
    }

    // Health indicators
    const cancelPctGlobal = (logisticStats.entregados + logisticStats.transito + logisticStats.devoluciones + logisticStats.cancelados) > 0
        ? (logisticStats.cancelados / (logisticStats.entregados + logisticStats.transito + logisticStats.devoluciones + logisticStats.cancelados)) * 100
        : 0;
    const roasValue = kpis?.roas || 0;
    const marginPct = kpis && kpis.ing_real > 0 ? (kpis.u_real / kpis.ing_real) * 100 : 0;

    return (
        <div className="min-h-screen bg-background text-foreground p-4 md:p-8 font-sans">
            <div className="max-w-[1600px] mx-auto space-y-6">

                {/* Debug Panel Toggle */}
                <div className="fixed bottom-4 right-4 z-50">
                    <button
                        onClick={() => setShowDebug(!showDebug)}
                        className={`p-3 rounded-full shadow-lg border transition-all ${showDebug ? 'bg-accent border-accent text-white' : 'bg-card border-card-border text-muted hover:text-foreground'}`}
                        title="Toggle Debug Panel"
                    >
                        <Bug size={20} />
                    </button>
                </div>

                {/* Debug Panel (includes ad spend debug) */}
                {showDebug && (
                    <div className="fixed bottom-20 right-4 w-96 max-h-[70vh] overflow-y-auto bg-card border border-card-border rounded-xl p-5 shadow-2xl z-50 text-xs">
                        <h4 className="font-bold text-accent mb-3 border-b border-card-border pb-2 text-sm">Diagnóstico de Datos</h4>
                        <div className="space-y-2 text-foreground/80 text-xs">
                            <div className="flex justify-between"><span>Total Órdenes (Raw):</span> <span className="text-foreground font-mono">{rawOrdersCount}</span></div>
                            <div className="flex justify-between"><span>Fechas Inválidas:</span> <span className={`font-mono ${invalidDatesCount > 0 ? 'text-red-400 font-bold' : 'text-green-400'}`}>{invalidDatesCount}</span></div>
                            <div className="flex justify-between"><span>Órdenes Filtradas:</span> <span className="text-foreground font-mono">{filteredOrders.length}</span></div>
                            <div className="flex justify-between"><span>Rango:</span> <span className="text-accent">{dateRange}</span></div>
                            <div className="flex justify-between"><span>País:</span> <span className="text-accent">{country}</span></div>
                        </div>

                        {/* Ad Spend Debug */}
                        <div className="mt-4 border-t border-card-border pt-3">
                            <h5 className="font-bold text-yellow-400 mb-2 text-xs">Gasto Publicitario ({filteredAds.length} entradas)</h5>
                            <div className="max-h-48 overflow-y-auto space-y-1">
                                {filteredAds.slice(0, 50).map((ad, idx) => (
                                    <div key={idx} className="flex justify-between text-[11px] py-0.5 border-b border-card-border">
                                        <span className="text-muted truncate max-w-[140px]">{ad.campaignName || 'N/A'}</span>
                                        <span className="text-foreground/70 font-mono">{ad.currency} {ad.amount.toLocaleString()}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="mt-3 border-t border-card-border pt-2">
                            <span className="text-[10px] text-muted mb-1 block uppercase tracking-widest font-black">Muestra de fechas originales:</span>
                            <div className="bg-hover-bg p-2 rounded max-h-24 overflow-y-auto font-mono text-xs text-accent/70 border border-card-border">
                                {rawDatesSample && rawDatesSample.length > 0 ? (
                                    rawDatesSample.map((d, i) => <div key={i} className="truncate border-b border-card-border py-0.5 last:border-0">{d || 'empty'}</div>)
                                ) : (
                                    <div className="text-muted italic">Sin datos de fecha</div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                <FilterHeader
                    availableCountries={availableCountries}
                    availableProducts={availableProducts}
                    title="Wheel"
                    icon={LayoutGrid}
                />

                {/* Health Semaphore Bar */}
                <div className="flex items-center gap-3 bg-card border border-card-border rounded-xl px-5 py-3">
                    <Activity className="w-4 h-4 text-muted" />
                    <span className="text-xs text-muted font-bold uppercase tracking-wider mr-2">Estado</span>
                    <div className="flex items-center gap-4 flex-1">
                        <HealthBadge
                            label="ROAS"
                            value={`${roasValue.toFixed(2)}x`}
                            status={findTarget(kpiTargets, 'roas_real') ? evaluateHealth(roasValue, findTarget(kpiTargets, 'roas_real')!) : roasValue > 4 ? 'good' : roasValue > 2 ? 'warning' : 'bad'}
                        />
                        <HealthBadge
                            label="Cancelación"
                            value={`${cancelPctGlobal.toFixed(1)}%`}
                            status={findTarget(kpiTargets, 'tasa_can') ? evaluateHealth(cancelPctGlobal, findTarget(kpiTargets, 'tasa_can')!) : cancelPctGlobal < 15 ? 'good' : cancelPctGlobal < 30 ? 'warning' : 'bad'}
                        />
                        <HealthBadge
                            label="Margen"
                            value={`${marginPct.toFixed(1)}%`}
                            status={findTarget(kpiTargets, 'margen_neto') ? evaluateHealth(marginPct, findTarget(kpiTargets, 'margen_neto')!) : marginPct > 20 ? 'good' : marginPct > 5 ? 'warning' : 'bad'}
                        />
                    </div>
                    <button
                        onClick={vegaResponse ? () => setVegaResponse(null) : runVegaAnalysis}
                        disabled={vegaLoading}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all border shrink-0 ${vegaResponse
                            ? 'bg-purple-500/10 text-purple-400 border-purple-500/20 hover:bg-purple-500/20'
                            : 'bg-purple-500/10 text-purple-400 border-purple-500/20 hover:bg-purple-500/20'
                            } disabled:opacity-50`}
                    >
                        {vegaLoading ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                            <Sparkles className="w-3.5 h-3.5" />
                        )}
                        {vegaLoading ? 'Analizando...' : vegaResponse ? 'Cerrar VEGA' : 'VEGA'}
                    </button>
                </div>

                {/* VEGA Quick Analysis Panel */}
                {(vegaResponse || vegaLoading) && (
                    <div className="bg-card border border-purple-500/20 rounded-2xl p-5 shadow-sm relative">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <Bot className="w-4 h-4 text-purple-400" />
                                <span className="text-[10px] font-black text-purple-400 uppercase tracking-widest">Análisis VEGA AI</span>
                            </div>
                            <button onClick={() => setVegaResponse(null)} className="w-6 h-6 rounded-md hover:bg-hover-bg flex items-center justify-center text-muted hover:text-foreground transition-colors">
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>
                        {vegaLoading ? (
                            <div className="flex items-center gap-3 py-4">
                                <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
                                <span className="text-sm text-muted animate-pulse">VEGA está analizando tu dashboard...</span>
                            </div>
                        ) : vegaResponse && (
                            <div className="text-sm text-foreground/90 leading-relaxed">
                                <VegaMarkdown content={vegaResponse} />
                            </div>
                        )}
                    </div>
                )}

                {/* Main Stats Grid - 4 cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Ventas Despachadas */}
                    {(() => {
                        const aov = (kpis?.n_nc || 0) > 0 ? (kpis?.fact_neto || 0) / (kpis?.n_nc || 1) : 0;
                        const growthPct = prevKpis && prevKpis.fact_neto > 0 ? (((kpis?.fact_neto || 0) - prevKpis.fact_neto) / Math.abs(prevKpis.fact_neto)) * 100 : null;
                        return (
                            <div className="bg-card border border-card-border rounded-2xl p-4 hover:border-accent/30 transition-all shadow-sm">
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-[10px] font-black text-muted uppercase tracking-widest flex items-center gap-1.5">Ventas Despachadas <InfoTooltip text="Total facturado de órdenes no canceladas. AOV = valor promedio por orden." /></span>
                                    <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-emerald-500/10">
                                        <DollarSign className="w-4 h-4 text-emerald-500" />
                                    </div>
                                </div>
                                <p className="text-2xl font-black tracking-tight text-emerald-500 font-mono">{formatCurrency(kpis?.fact_neto || 0)}</p>
                                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                    <span className="text-xs text-muted">Real: <span className="text-foreground/70 font-mono">{formatCurrency(kpis?.ing_real || 0)}</span></span>
                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">AOV {formatCurrency(aov)}</span>
                                </div>
                                {growthPct !== null && Math.abs(growthPct) >= 0.1 && (
                                    <div className={`flex items-center gap-1 mt-1.5 text-[10px] font-bold ${growthPct > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                        {growthPct > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                        {Math.abs(growthPct).toFixed(1)}% vs periodo anterior
                                    </div>
                                )}
                            </div>
                        );
                    })()}

                    {/* Órdenes Totales */}
                    {(() => {
                        const eficiencia = (kpis?.n_ord || 0) > 0 ? ((kpis?.n_nc || 0) / (kpis?.n_ord || 1)) * 100 : 0;
                        const growthPct = prevKpis && prevKpis.n_ord > 0 ? (((kpis?.n_ord || 0) - prevKpis.n_ord) / Math.abs(prevKpis.n_ord)) * 100 : null;
                        return (
                            <div className="bg-card border border-card-border rounded-2xl p-4 hover:border-accent/30 transition-all shadow-sm">
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-[10px] font-black text-muted uppercase tracking-widest flex items-center gap-1.5">Órdenes Totales <InfoTooltip text="Todas las órdenes del periodo. Eficiencia = % de órdenes despachadas vs total." /></span>
                                    <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-blue-500/10">
                                        <Package className="w-4 h-4 text-blue-400" />
                                    </div>
                                </div>
                                <p className="text-2xl font-black tracking-tight text-blue-400 font-mono">{kpis?.n_ord || 0}</p>
                                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                    <span className="text-xs text-muted">Despachadas: <span className="text-foreground/70 font-mono">{kpis?.n_nc || 0}</span></span>
                                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-black border font-mono ${eficiencia >= 80 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                        : eficiencia >= 60 ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                            : 'bg-red-500/10 text-red-400 border-red-500/20'
                                        }`}>{eficiencia.toFixed(1)}% EFIC.</span>
                                </div>
                                {growthPct !== null && Math.abs(growthPct) >= 0.1 && (
                                    <div className={`flex items-center gap-1 mt-1.5 text-[10px] font-bold ${growthPct > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                        {growthPct > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                        {Math.abs(growthPct).toFixed(1)}% vs periodo anterior
                                    </div>
                                )}
                            </div>
                        );
                    })()}

                    {/* CPA Despachado */}
                    {(() => {
                        const cpaDespachado = kpis?.n_nc && kpis.n_nc > 0 ? (kpis.g_ads || 0) / kpis.n_nc : 0;
                        const adsPctFacturado = kpis?.fact_neto && kpis.fact_neto > 0 ? ((kpis.g_ads / kpis.fact_neto) * 100) : 0;
                        const growthPct = prevKpis && prevKpis.n_nc > 0 ? ((cpaDespachado - (prevKpis.g_ads / prevKpis.n_nc)) / Math.abs(prevKpis.g_ads / prevKpis.n_nc)) * 100 : null;
                        return (
                            <div className="bg-card border border-card-border rounded-2xl p-4 hover:border-accent/30 transition-all shadow-sm">
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-[10px] font-black text-muted uppercase tracking-widest flex items-center gap-1.5">CPA Despachado <InfoTooltip text="Costo por adquisición: gasto en ads dividido entre órdenes despachadas. % FACT = proporción de ads sobre la venta." /></span>
                                    <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-purple-500/10">
                                        <TrendingDown className="w-4 h-4 text-purple-400" />
                                    </div>
                                </div>
                                <p className="text-2xl font-black tracking-tight text-purple-400 font-mono">{formatCurrency(cpaDespachado)}</p>
                                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                    <span className="text-xs text-muted">Ads / Desp.</span>
                                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-black border font-mono ${adsPctFacturado <= 20 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                        : adsPctFacturado <= 30 ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                                            : 'bg-red-500/10 text-red-400 border-red-500/20'
                                        }`}>{adsPctFacturado.toFixed(1)}% FACT.</span>
                                </div>
                                {growthPct !== null && Math.abs(growthPct) >= 0.1 && (
                                    <div className={`flex items-center gap-1 mt-1.5 text-[10px] font-bold ${growthPct < 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                        {growthPct < 0 ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
                                        {Math.abs(growthPct).toFixed(1)}% vs periodo anterior
                                    </div>
                                )}
                            </div>
                        );
                    })()}

                    {/* CPA Entregado (projected) */}
                    {(() => {
                        // CPA Entregado = Ads / (n_nc * avg_delivery_rate across countries)
                        const avgDeliveryRate = metricsByCountry.length > 0
                            ? metricsByCountry.reduce((s: number, c: any) => s + (c.projectionConfig / 100) * (c.orderCount), 0) /
                            Math.max(metricsByCountry.reduce((s: number, c: any) => s + c.orderCount, 0), 1)
                            : 0.8;
                        const projectedDelivered = (kpis?.n_nc || 0) * avgDeliveryRate;
                        const cpaEntregado = projectedDelivered > 0 ? (kpis?.g_ads || 0) / projectedDelivered : 0;
                        const aov = (kpis?.n_nc || 0) > 0 ? (kpis?.fact_neto || 0) / (kpis?.n_nc || 1) : 0;
                        const adsPctFacturado = aov > 0 ? (cpaEntregado / aov) * 100 : 0;
                        return (
                            <div className="bg-card border border-card-border rounded-2xl p-4 hover:border-accent/30 transition-all shadow-sm">
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-[10px] font-black text-muted uppercase tracking-widest flex items-center gap-1.5">CPA Entregado <InfoTooltip text="Costo por adquisición proyectado a entrega. Usa la tasa de entrega configurada para estimar el costo real por cliente." /></span>
                                    <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-indigo-500/10">
                                        <Target className="w-4 h-4 text-indigo-400" />
                                    </div>
                                </div>
                                <p className="text-2xl font-black tracking-tight text-indigo-400 font-mono">{formatCurrency(cpaEntregado)}</p>
                                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                    <span className="text-xs text-muted">Ads / Proy. Ent.</span>
                                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-black border font-mono ${adsPctFacturado <= 20 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                        : adsPctFacturado <= 30 ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                                            : 'bg-red-500/10 text-red-400 border-red-500/20'
                                        }`}>{adsPctFacturado.toFixed(1)}% FACT.</span>
                                </div>
                                <div className="flex items-center gap-1 mt-1.5 text-[10px] font-bold text-muted">
                                    <span>Tasa proj. {(avgDeliveryRate * 100).toFixed(0)}%</span>
                                </div>
                            </div>
                        );
                    })()}
                </div>

                {/* Ads + Ganancia Side by Side */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    {/* Inversión en Ads */}
                    <div className="bg-card border border-card-border rounded-2xl p-6 shadow-sm">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-[11px] font-black text-muted uppercase tracking-widest flex items-center gap-2">
                                <Zap className="w-4 h-4 text-rose-500" />
                                Inversión en Ads
                                <InfoTooltip text="Gasto publicitario por plataforma. ROAS = retorno sobre la inversión en ads (venta / gasto)." />
                            </h3>
                        </div>
                        <div className="space-y-5 mb-6">
                            <PlatformBar platform="Facebook Ads" value={adPlatformMetrics.fb} total={kpis?.g_ads || 1} color="from-blue-600 to-blue-400" />
                            <PlatformBar platform="TikTok Ads" value={adPlatformMetrics.tiktok} total={kpis?.g_ads || 1} color="from-pink-600 to-rose-400" />
                        </div>
                        <div className="flex items-center justify-between pt-5 border-t border-card-border">
                            <span className="text-[10px] text-muted font-black uppercase tracking-widest">Gasto Total</span>
                            <div className="flex items-center gap-3">
                                <span className="text-xl font-black text-foreground font-mono">{formatCurrency(kpis?.g_ads || 0)}</span>
                                <div className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-500 text-xs font-bold border border-emerald-500/20">
                                    ROAS: {(kpis?.roas || 0).toFixed(2)}x
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Ganancia */}
                    <div className="bg-card border border-card-border rounded-2xl p-6 relative shadow-sm">
                        <div className="flex justify-between items-center mb-6 relative z-10">
                            <h3 className="text-[11px] font-black text-muted uppercase tracking-widest flex items-center gap-2">
                                <Target className="w-4 h-4 text-emerald-500" />
                                Ganancia
                                <InfoTooltip text="Utilidad Real = Ingreso - Costos - Ads - Fletes. Proyectada estima la ganancia final según tasa de entrega." />
                            </h3>
                            <div className={`px-3 py-1 rounded-lg text-xs font-bold border ${projectedProfit >= 0
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : 'bg-red-500/10 text-red-400 border-red-500/20'
                                }`}>
                                {kpis && kpis.ing_real > 0 ? ((projectedProfit / kpis.ing_real) * 100).toFixed(1) : 0}% Margen Proy.
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-6 relative z-10">
                            {/* Utilidad Real */}
                            <div className="space-y-3">
                                <span className="text-[10px] text-muted font-black uppercase tracking-widest block">Utilidad Real</span>
                                <span className={`text-2xl font-black font-mono block ${(kpis?.u_real || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                    {formatCurrency(kpis?.u_real || 0)}
                                </span>
                                {(() => {
                                    const realMargin = kpis?.ing_real && kpis.ing_real > 0 ? ((kpis.u_real || 0) / kpis.ing_real) * 100 : 0;
                                    return (
                                        <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-black border font-mono ${realMargin >= 20 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                            : realMargin >= 0 ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                                                : 'bg-red-500/10 text-red-400 border-red-500/20'
                                            }`}>{realMargin.toFixed(1)}% MARGEN</span>
                                    );
                                })()}
                                <div className="text-xs text-muted space-y-1">
                                    <div className="flex justify-between">
                                        <span>Ingreso</span>
                                        <span className="text-foreground/70 font-mono">{formatCurrency(kpis?.ing_real || 0)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Costos</span>
                                        <span className="text-foreground/70 font-mono">-{formatCurrency((kpis?.cpr || 0) + (kpis?.fl_ent || 0) + (kpis?.fl_dev || 0))}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Ads</span>
                                        <span className="text-rose-400 font-mono">-{formatCurrency(kpis?.g_ads || 0)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Utilidad Proyectada */}
                            <div className="space-y-3 border-l border-card-border pl-6">
                                <span className="text-[10px] text-muted font-black uppercase tracking-widest block">Utilidad Proyectada</span>
                                <span className={`text-2xl font-black font-mono block ${projectedProfit >= 0 ? 'text-blue-400' : 'text-red-400'}`}>
                                    {formatCurrency(projectedProfit)}
                                </span>
                                {(() => {
                                    const projMargin = kpis?.ing_real && kpis.ing_real > 0 ? (projectedProfit / kpis.ing_real) * 100 : 0;
                                    return (
                                        <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-black border font-mono ${projMargin >= 20 ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                            : projMargin >= 0 ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                                                : 'bg-red-500/10 text-red-400 border-red-500/20'
                                            }`}>{projMargin.toFixed(1)}% MARGEN</span>
                                    );
                                })()}
                                <div className="mt-1">
                                    {projectedProfit > (kpis?.u_real || 0) ? (
                                        <div className="flex items-center gap-1.5 text-xs text-amber-400">
                                            <ArrowUpRight className="w-4 h-4" />
                                            <span className="font-bold">+{formatCurrency(projectedProfit - (kpis?.u_real || 0))} potencial</span>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-1.5 text-xs text-emerald-400">
                                            <TrendingUp className="w-4 h-4" />
                                            <span className="font-bold">Utilidad real supera proyección</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Trends & Logistics Side-by-Side */}
                <div className={`grid gap-5 ${expandedTrends ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-3'}`}>
                    {/* Charts & Trends (2/3) */}
                    <div className={`${expandedTrends ? '' : 'lg:col-span-2'} bg-card border border-card-border rounded-2xl p-5 md:p-6 shadow-sm relative group`}>

                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 relative z-10">
                            <div className="flex items-center gap-3">
                                <div>
                                    <h3 className="text-[11px] font-black text-muted uppercase tracking-widest flex items-center gap-2">
                                        <TrendingUp className="w-4 h-4 text-accent" />
                                        {chartView === 'date' ? 'Tendencias de Rendimiento' : 'Rendimiento por Producto'}
                                        <InfoTooltip text={chartView === 'date' ? 'Evolución diaria de ventas, utilidad y gasto en ads. Arrastra para seleccionar un rango.' : 'Comparativa de ventas, utilidad y ads por producto. Expande para ver todos.'} />
                                    </h3>
                                    <p className="text-muted text-xs mt-0.5">
                                        Ventas, publicidad y utilidad {chartView === 'date' ? 'por día' : 'por producto'}
                                        {chartView === 'product' && (
                                            <span className="ml-2 text-accent font-mono">
                                                ({expandedTrends ? productPerformanceDataFull.length : productPerformanceData.length}{!expandedTrends && productPerformanceDataFull.length > 10 ? ` de ${productPerformanceDataFull.length}` : ''})
                                            </span>
                                        )}
                                    </p>
                                </div>
                                <button onClick={() => setExpandedTrends(prev => !prev)} className="w-7 h-7 rounded-lg bg-hover-bg border border-card-border flex items-center justify-center text-muted hover:text-foreground transition-all shrink-0" title={expandedTrends ? 'Minimizar' : 'Expandir'}>
                                    {expandedTrends ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                                </button>
                            </div>

                            <div className="flex flex-col md:flex-row items-end md:items-center gap-4 relative z-10 mt-2 md:mt-0">
                                {/* View Toggle */}
                                <div className="flex bg-hover-bg rounded-lg p-1 border border-card-border">
                                    <button
                                        onClick={() => { setChartView('date'); clearSelection(); }}
                                        className={`px-3 py-1 text-[10px] font-black uppercase tracking-wider rounded-md transition-all ${chartView === 'date' ? 'bg-card text-accent shadow-sm' : 'text-muted hover:text-foreground'}`}
                                    >
                                        Fecha
                                    </button>
                                    <button
                                        onClick={() => { setChartView('product'); clearSelection(); }}
                                        className={`px-3 py-1 text-[10px] font-black uppercase tracking-wider rounded-md transition-all ${chartView === 'product' ? 'bg-card text-accent shadow-sm' : 'text-muted hover:text-foreground'}`}
                                    >
                                        Producto
                                    </button>
                                </div>
                                {[
                                    { key: 'sales', name: 'Ventas', color: '#6366f1' },
                                    { key: 'profit', name: 'Utilidad', color: '#10b981' },
                                    { key: 'ads', name: 'Ads', color: '#f43f5e' },
                                    { key: 'projected_profit', name: 'Utd. Proyectada', color: '#3b82f6' },
                                ].map(item => {
                                    const isVisible = visibleTrends[item.key as keyof typeof visibleTrends];
                                    return (
                                        <button
                                            key={item.key}
                                            onClick={() => setVisibleTrends(prev => ({ ...prev, [item.key]: !isVisible }))}
                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${isVisible
                                                ? 'bg-hover-bg border-card-border text-foreground shadow-sm'
                                                : 'bg-transparent border-card-border text-muted grayscale opacity-30 hover:opacity-60'
                                                }`}
                                        >
                                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                                            {item.name}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className={`${expandedTrends ? 'h-[500px]' : 'h-[300px]'} w-full relative z-10 transition-all duration-300`}>
                            {dailySalesData.length === 0 ? (
                                <div className="w-full h-full flex flex-col items-center justify-center text-muted gap-3">
                                    <div className="p-3 rounded-full bg-hover-bg">
                                        <Calendar className="w-6 h-6 opacity-40" />
                                    </div>
                                    <p className="text-sm">No hay datos para este periodo</p>
                                </div>
                            ) : (
                                <ResponsiveContainer width="100%" height="100%">
                                    <ComposedChart
                                        data={chartView === 'date' ? dailySalesData : (expandedTrends ? productPerformanceDataFull : productPerformanceData)}
                                        margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                                        onMouseDown={handleChartMouseDown}
                                        onMouseMove={handleChartMouseMove}
                                        onMouseUp={handleChartMouseUp}
                                        style={{ cursor: isDragging ? 'col-resize' : 'crosshair', userSelect: 'none' }}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" vertical={false} />
                                        <XAxis
                                            dataKey="name"
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fill: 'var(--muted)', fontSize: 10, fontWeight: 700 }}
                                            dy={10}
                                        />
                                        <YAxis
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fill: 'var(--muted)', fontSize: 10 }}
                                        />
                                        <Tooltip
                                            contentStyle={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 12, fontSize: 12, fontWeight: 700, color: 'var(--foreground)' }}
                                            itemStyle={{ color: 'var(--foreground)', padding: '3px 0' }}
                                            cursor={{ fill: 'var(--hover-bg)' }}
                                            formatter={(value: any) => formatCurrency(value)}
                                        />
                                        {/* Negative zone below 0 */}
                                        <ReferenceArea y1={-9999999} y2={0} fill="#ef4444" fillOpacity={0.08} ifOverflow="hidden" />
                                        <ReferenceLine y={0} stroke="#ef4444" strokeOpacity={0.6} strokeWidth={1} strokeDasharray="4 4" />
                                        {dragStart && dragEnd && (
                                            <ReferenceArea
                                                x1={dragStart}
                                                x2={dragEnd}
                                                fill="#6366f1"
                                                fillOpacity={0.15}
                                                stroke="#6366f1"
                                                strokeOpacity={0.4}
                                            />
                                        )}
                                        {visibleTrends.profit && <Bar dataKey="profit" name="Utilidad" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} barSize={chartView === 'date' ? 28 : undefined} />}
                                        {visibleTrends.ads && <Bar dataKey="ads" name="Ads" stackId="a" fill="#f43f5e" radius={[0, 0, 0, 0]} barSize={chartView === 'date' ? 28 : undefined} />}
                                        {visibleTrends.projected_profit && <Bar dataKey="projected_profit" name="Utd. Proyectada" stackId="a" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={chartView === 'date' ? 28 : undefined} />}
                                        {visibleTrends.sales && <Line type="monotone" dataKey="sales" name="Venta Total" stroke="#6366f1" strokeWidth={2} dot={false} strokeDasharray="5 5" />}
                                    </ComposedChart>
                                </ResponsiveContainer>
                            )}
                        </div>

                        {/* Selection Summary */}
                        {selectionData && (
                            <div className="relative z-10 mt-3 p-4 bg-accent/10 border border-accent/20 rounded-xl flex items-center justify-between gap-4">
                                <div className="flex items-center gap-1.5 text-[10px] font-black text-accent uppercase tracking-widest">
                                    <Activity className="w-3.5 h-3.5" />
                                    {selectionData.range} · {selectionData.days} {selectionData.days === 1 ? 'día' : 'días'}
                                </div>
                                <div className="flex items-center gap-5 text-xs font-mono">
                                    <span className="text-muted">Ventas: <span className="text-foreground font-bold">{formatCurrency(selectionData.sales)}</span></span>
                                    <span className="text-rose-400">Ads: <span className="text-foreground font-bold">{formatCurrency(selectionData.ads)}</span></span>
                                    <span className="text-emerald-400">Utilidad: <span className="text-foreground font-bold">{formatCurrency(selectionData.profit)}</span></span>
                                    <span className="text-blue-400">Proy: <span className="text-foreground font-bold">{formatCurrency(selectionData.projectedProfit)}</span></span>
                                </div>
                                <button onClick={clearSelection} className="w-6 h-6 rounded-md hover:bg-hover-bg flex items-center justify-center text-muted hover:text-foreground transition-colors">
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Logistics (1/3) */}
                    {!expandedTrends && (
                    <div className="lg:col-span-1 bg-card border border-card-border rounded-2xl p-5 flex flex-col relative group shadow-sm">

                        <div className="flex justify-between items-center w-full mb-3 relative z-10">
                            <h3 className="text-[11px] font-black text-muted uppercase tracking-widest flex items-center gap-2">
                                <Package className="w-4 h-4 text-blue-400" />
                                Estatus Logístico
                                <InfoTooltip text="Distribución de órdenes despachadas: entregadas, en tránsito y devoluciones. La tasa de cancelación incluye todas las órdenes." />
                            </h3>
                        </div>

                        {/* Cancellation Rate - Prominent */}
                        {(() => {
                            const totalOrders = logisticStats.entregados + logisticStats.transito + logisticStats.devoluciones + logisticStats.cancelados;
                            const cancelPct = totalOrders > 0 ? ((logisticStats.cancelados / totalOrders) * 100) : 0;
                            const cancelColor = cancelPct <= 10 ? { bg: 'rgba(16,185,129,0.05)', border: 'rgba(16,185,129,0.1)' } : cancelPct <= 15 ? { bg: 'rgba(245,158,11,0.05)', border: 'rgba(245,158,11,0.1)' } : { bg: 'rgba(239,68,68,0.05)', border: 'rgba(239,68,68,0.1)' };
                            return (
                                <div className="relative z-10 mb-4 p-4 rounded-xl" style={{ backgroundColor: cancelColor.bg, border: `1px solid ${cancelColor.border}` }}>
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-[10px] text-muted font-black uppercase tracking-widest">% Cancelación</span>
                                        <span className="text-2xl font-black font-mono" style={{ color: cancelPct <= 10 ? '#10b981' : cancelPct <= 15 ? '#f59e0b' : '#ef4444' }}>
                                            {cancelPct.toFixed(1)}%
                                        </span>
                                    </div>
                                    <div className="h-2 bg-card-border rounded-full overflow-hidden">
                                        <div
                                            className="h-full rounded-full transition-all"
                                            style={{ width: `${Math.min(cancelPct, 100)}%`, backgroundColor: cancelPct <= 10 ? '#10b981' : cancelPct <= 15 ? '#f59e0b' : '#ef4444' }}
                                        />
                                    </div>
                                    <div className="flex justify-between mt-1.5">
                                        <span className="text-xs text-muted font-mono">{logisticStats.cancelados} canceladas</span>
                                        <span className="text-xs text-muted font-mono">{totalOrders} total</span>
                                    </div>
                                </div>
                            );
                        })()}

                        {/* Donut Chart - Non-canceled */}
                        <div className="h-[160px] w-full relative z-10">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={[
                                            { name: 'Entregados', value: logisticStats.entregados, key: 'entregados', fill: '#10b981' },
                                            { name: 'Tránsito', value: logisticStats.transito, key: 'transito', fill: '#3b82f6' },
                                            { name: 'Devolución', value: logisticStats.devoluciones, key: 'devoluciones', fill: '#f59e0b' },
                                        ].filter(d => visibleLogistics[d.key as keyof typeof visibleLogistics] && d.value > 0)}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={48}
                                        outerRadius={66}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {[
                                            { key: 'entregados', color: '#10b981' },
                                            { key: 'transito', color: '#3b82f6' },
                                            { key: 'devoluciones', color: '#f59e0b' },
                                        ].filter(d => visibleLogistics[d.key as keyof typeof visibleLogistics]).map((d) => (
                                            <Cell key={d.key} fill={d.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip contentStyle={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 12, fontSize: 12, fontWeight: 700, color: 'var(--foreground)' }} itemStyle={{ color: 'var(--foreground)' }} />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                <span className="text-[10px] text-muted font-black uppercase tracking-widest">Despachadas</span>
                                <span className="text-xl font-black font-mono text-foreground leading-none">
                                    {logisticStats.entregados + logisticStats.transito + logisticStats.devoluciones}
                                </span>
                            </div>
                        </div>

                        {/* Legend */}
                        <div className="w-full grid grid-cols-1 gap-1.5 mt-2 relative z-10">
                            {[
                                { key: 'entregados', name: 'Entregados', value: logisticStats.entregados, color: 'bg-emerald-500' },
                                { key: 'transito', name: 'En Tránsito', value: logisticStats.transito, color: 'bg-blue-500' },
                                { key: 'devoluciones', name: 'Devolución', value: logisticStats.devoluciones, color: 'bg-amber-500' },
                            ].map((item) => {
                                const isVisible = visibleLogistics[item.key as keyof typeof visibleLogistics];
                                const dispatchedTotal = logisticStats.entregados + logisticStats.transito + logisticStats.devoluciones;

                                return (
                                    <button
                                        key={item.key}
                                        onClick={() => setVisibleLogistics(prev => ({ ...prev, [item.key]: !isVisible }))}
                                        className={`flex justify-between items-center px-3 py-2 rounded-lg text-xs transition-all ${isVisible ? 'bg-hover-bg text-foreground' : 'bg-transparent text-muted grayscale opacity-40'
                                            } hover:bg-hover-bg`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <div className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
                                            <span className={isVisible ? 'text-foreground' : 'text-muted'}>{item.name}</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="font-mono text-muted">{item.value}</span>
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono border ${item.key === 'entregados' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                                item.key === 'transito' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                                                    'bg-amber-500/10 text-amber-500 border-amber-500/20'
                                                }`}>
                                                {dispatchedTotal > 0 ? ((item.value / dispatchedTotal) * 100).toFixed(1) : 0}%
                                            </span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                    )}
                </div>


                {/* Profitable & Losing Product Rankings */}
                {!loading && (profitableProducts.length > 0 || losingProducts.length > 0) && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:grid-rows-[1fr]">
                        {/* Profitable products */}
                        <div className="bg-card border border-card-border rounded-2xl overflow-hidden flex flex-col">
                            <div className="flex items-center justify-between px-5 py-3.5 border-b border-card-border">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                                        <Trophy className="w-3.5 h-3.5 text-emerald-400" />
                                    </div>
                                    <h3 className="text-[11px] font-black uppercase tracking-widest text-foreground">Productos Rentables</h3>
                                    <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">{profitableProducts.length}</span>
                                </div>
                                {profitableProducts.length > 5 && (
                                    <button onClick={() => setShowAllProfitable(!showAllProfitable)} className="text-[10px] font-bold text-muted hover:text-foreground transition-colors">
                                        {showAllProfitable ? 'Ver menos' : `Ver todos (${profitableProducts.length})`}
                                    </button>
                                )}
                            </div>
                            <div className="overflow-x-auto flex-1">
                                <table className="w-full text-[11px]">
                                    <thead>
                                        <tr className="text-muted font-black uppercase tracking-wider border-b border-card-border">
                                            <th className="px-4 py-2.5 text-left">Producto</th>
                                            <th className="px-4 py-2.5 text-right">Ventas</th>
                                            <th className="px-4 py-2.5 text-right">CPA Desp.</th>
                                            <th className="px-4 py-2.5 text-right">Utd. Proy.</th>
                                            <th className="px-4 py-2.5 text-right">Utd/Orden</th>
                                            <th className="px-4 py-2.5 text-center">% Canc.</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-card-border">
                                        {(showAllProfitable ? profitableProducts : profitableProducts.slice(0, 5)).map((p, i) => (
                                            <tr key={`${p.name}-${p.country}`} className="hover:bg-hover-bg transition-colors">
                                                <td className="px-4 py-2.5 font-medium text-foreground" title={`${p.name} — ${p.country}`}>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] font-black text-emerald-400 w-4">{i + 1}</span>
                                                        <img src={`https://flagcdn.com/w20/${p.flag}.png`} alt={p.country} className="w-4 h-3 rounded-sm object-cover shrink-0" />
                                                        <span className="truncate max-w-[140px]">{p.name}</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-2.5 text-right font-mono text-foreground">{formatCurrency(p.netSales)}</td>
                                                <td className="px-4 py-2.5 text-right font-mono text-purple-400">{formatCurrency(p.cpaDesp)}</td>
                                                <td className="px-4 py-2.5 text-right font-mono">
                                                    <div className="flex flex-col items-end gap-0.5">
                                                        <span className="text-emerald-400">{formatCurrency(p.projectedProfit)}</span>
                                                        {p.ads > 0 && <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${p.roiPct >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>{p.roiPct >= 0 ? '+' : ''}{p.roiPct.toFixed(0)}% ROI</span>}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-2.5 text-right font-mono">
                                                    <span className={p.utilPerOrder >= 0 ? 'text-blue-400' : 'text-red-400'}>{formatCurrency(Math.round(p.utilPerOrder))}</span>
                                                </td>
                                                <td className="px-4 py-2.5 text-center">
                                                    <span className={`font-mono font-bold ${p.cancelRate > 30 ? 'text-red-400' : p.cancelRate > 20 ? 'text-amber-400' : 'text-foreground/70'}`}>{p.cancelRate.toFixed(1)}%</span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Losing products */}
                        <div className="bg-card border border-card-border rounded-2xl overflow-hidden flex flex-col">
                            <div className="flex items-center justify-between px-5 py-3.5 border-b border-card-border">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-7 h-7 rounded-lg bg-red-500/10 flex items-center justify-center">
                                        <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                                    </div>
                                    <h3 className="text-[11px] font-black uppercase tracking-widest text-foreground">Productos en Pérdida</h3>
                                    <span className="text-[10px] font-mono text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full">{losingProducts.length}</span>
                                </div>
                                {losingProducts.length > 5 && (
                                    <button onClick={() => setShowAllLosing(!showAllLosing)} className="text-[10px] font-bold text-muted hover:text-foreground transition-colors">
                                        {showAllLosing ? 'Ver menos' : `Ver todos (${losingProducts.length})`}
                                    </button>
                                )}
                            </div>
                            <div className="overflow-x-auto flex-1">
                                <table className="w-full text-[11px]">
                                    <thead>
                                        <tr className="text-muted font-black uppercase tracking-wider border-b border-card-border">
                                            <th className="px-4 py-2.5 text-left">Producto</th>
                                            <th className="px-4 py-2.5 text-right">Ventas</th>
                                            <th className="px-4 py-2.5 text-right">CPA Desp.</th>
                                            <th className="px-4 py-2.5 text-right">Utd. Proy.</th>
                                            <th className="px-4 py-2.5 text-right">Utd/Orden</th>
                                            <th className="px-4 py-2.5 text-center">% Canc.</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-card-border">
                                        {(showAllLosing ? losingProducts : losingProducts.slice(0, 5)).map((p, i) => (
                                            <tr key={`${p.name}-${p.country}`} className="hover:bg-hover-bg transition-colors">
                                                <td className="px-4 py-2.5 font-medium text-foreground" title={`${p.name} — ${p.country}`}>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] font-black text-red-400 w-4">{i + 1}</span>
                                                        <img src={`https://flagcdn.com/w20/${p.flag}.png`} alt={p.country} className="w-4 h-3 rounded-sm object-cover shrink-0" />
                                                        <span className="truncate max-w-[140px]">{p.name}</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-2.5 text-right font-mono text-foreground">{formatCurrency(p.netSales)}</td>
                                                <td className="px-4 py-2.5 text-right font-mono text-purple-400">{formatCurrency(p.cpaDesp)}</td>
                                                <td className="px-4 py-2.5 text-right font-mono">
                                                    <div className="flex flex-col items-end gap-0.5">
                                                        <span className="text-red-400">{formatCurrency(p.projectedProfit)}</span>
                                                        {p.ads > 0 && <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-red-500/10 text-red-400">{p.roiPct.toFixed(0)}% ROI</span>}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-2.5 text-right font-mono">
                                                    <span className={p.utilPerOrder >= 0 ? 'text-blue-400' : 'text-red-400'}>{formatCurrency(Math.round(p.utilPerOrder))}</span>
                                                </td>
                                                <td className="px-4 py-2.5 text-center">
                                                    <span className={`font-mono font-bold ${p.cancelRate > 30 ? 'text-red-400' : p.cancelRate > 20 ? 'text-amber-400' : 'text-foreground/70'}`}>{p.cancelRate.toFixed(1)}%</span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                <CountryTable
                    metricsByCountry={metricsByCountry}
                    expandedCountry={expandedCountry}
                    setExpandedCountry={setExpandedCountry}
                    localOverrides={localOverrides}
                    updateCountryOverride={updateCountryOverride}
                    updateProductOverride={updateProductOverride}
                    handleSaveProjections={handleSaveProjections}
                    isSavingProjections={isSavingProjections}
                    saveSuccess={saveSuccess}
                    kpiTargets={kpiTargets}
                />

            </div>
        </div>
    );
}

// --- Utility Helpers ---

