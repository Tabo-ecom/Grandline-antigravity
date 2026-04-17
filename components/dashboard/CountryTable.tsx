import React, { useState, useMemo } from 'react';
import { Activity, ChevronDown, ChevronRight, Loader2, Check, Zap, Truck, Info, ArrowUpDown } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/currency';
import { evaluateHealth, getHealthColor, findTarget } from '@/lib/utils/health';
import InfoTooltip from '@/components/common/InfoTooltip';
import type { FreightAnalysisResult } from '@/lib/calculations/kpis';

// ─── Interfaces ──────────────────────────────────────────────────────

interface CancelReason { tag: string; count: number; pct: number; }

interface ProductMetric {
    id: string; name: string;
    orderCount: number; deliveredCount: number; cancelCount: number;
    cancelReasons: CancelReason[];
    transitCount: number; returnCount: number;
    deliveryRate: number; cancelRate: number; transitRate: number; returnRate: number;
    profit: number; adSpend: number; netSales: number;
    factDespachada: number; ingReal: number; cpr: number;
    flEnt: number; flDev: number; flTra: number;
    roas: number; cpa: number;
    projectedProfit: number; projectionConfig: number;
    pendingCancelConfig: number; pendingCount: number;
}

interface CountryMetric {
    name: string; currency: string;
    orderCount: number; deliveredCount: number; cancelCount: number;
    cancelReasons: CancelReason[];
    transitCount: number; returnCount: number;
    deliveryRate: number; cancelRate: number; transitRate: number; returnRate: number;
    pendingCount: number; pendingPercent: number; pendingCancelConfig: number;
    sales: number; factDespachada: number; ingReal: number; cpr: number;
    flEnt: number; flDev: number; flTra: number;
    adSpend: number; profit: number;
    projectedProfit: number; projectionConfig: number;
    products: ProductMetric[];
}

interface CountryTableProps {
    metricsByCountry: CountryMetric[];
    expandedCountry: string | null;
    setExpandedCountry: (country: string | null) => void;
    localOverrides: any;
    updateCountryOverride: (country: string, val: number) => void;
    updateProductOverride: (country: string, productId: string, val: number) => void;
    toggleReturnBuffer: (country: string, enabled: boolean) => void;
    updatePendingCancelOverride: (country: string, val: number) => void;
    updateProductPendingCancel: (country: string, productId: string, val: number) => void;
    freightAnalysis: Record<string, FreightAnalysisResult>;
    handleSaveProjections: () => void;
    isSavingProjections: boolean;
    saveSuccess: boolean;
    kpiTargets: any[];
}

// ─── Helpers ─────────────────────────────────────────────────────────

function getFlagCode(n: string) {
    const m: Record<string, string> = { 'Colombia': 'co', 'México': 'mx', 'Perú': 'pe', 'Ecuador': 'ec', 'Panamá': 'pa', 'Chile': 'cl', 'España': 'es', 'Guatemala': 'gt', 'Paraguay': 'py', 'Argentina': 'ar', 'Costa Rica': 'cr' };
    return m[n] || 'un';
}

function rateColor(rate: number, type: 'delivery' | 'cancel' | 'return'): string {
    if (type === 'delivery') return rate >= 80 ? 'text-emerald-400' : rate >= 60 ? 'text-yellow-400' : rate >= 40 ? 'text-orange-400' : 'text-red-400';
    if (type === 'cancel') return rate <= 10 ? 'text-emerald-400' : rate <= 15 ? 'text-yellow-400' : rate <= 20 ? 'text-orange-400' : 'text-red-400';
    return rate <= 10 ? 'text-emerald-400' : rate <= 15 ? 'text-yellow-400' : rate <= 20 ? 'text-orange-400' : 'text-red-400';
}

function rateBg(rate: number, type: 'delivery' | 'cancel' | 'return'): string {
    if (type === 'delivery') return rate >= 80 ? 'bg-emerald-500/10' : rate >= 60 ? 'bg-yellow-500/10' : rate >= 40 ? 'bg-orange-500/10' : 'bg-red-500/10';
    if (type === 'cancel') return rate <= 10 ? 'bg-emerald-500/10' : rate <= 15 ? 'bg-yellow-500/10' : rate <= 20 ? 'bg-orange-500/10' : 'bg-red-500/10';
    return rate <= 10 ? 'bg-emerald-500/10' : rate <= 15 ? 'bg-yellow-500/10' : rate <= 20 ? 'bg-orange-500/10' : 'bg-red-500/10';
}

function StatCell({ count, rate, type }: { count: number; rate: number; type: 'delivery' | 'cancel' | 'return' | 'neutral' }) {
    const color = type === 'neutral' ? 'text-blue-400' : rateColor(rate, type as any);
    const bg = type === 'neutral' ? 'bg-blue-500/10' : rateBg(rate, type as any);
    return (
        <div className="flex items-center justify-center gap-1">
            <span className={`font-mono text-xs font-bold ${color}`}>{count}</span>
            <span className={`text-[9px] font-black px-1 py-0.5 rounded ${bg} ${color}`}>{rate.toFixed(1)}%</span>
        </div>
    );
}

/** Value + % badge */
function ValPct({ value, pct, warn }: { value: number; pct: number; warn?: number }) {
    const over = warn !== undefined && pct > warn;
    return (
        <div className="flex flex-col items-end gap-0.5">
            <span className="font-mono text-xs text-foreground/80">{formatCurrency(value)}</span>
            <span className={`text-[9px] font-bold px-1 py-0.5 rounded ${over ? 'bg-red-500/10 text-red-400' : 'bg-muted/10 text-muted'}`}>{pct.toFixed(1)}%</span>
        </div>
    );
}

function FreightTooltip({ analysis }: { analysis: FreightAnalysisResult }) {
    const [open, setOpen] = useState(false);
    return (
        <div className="relative inline-block">
            <button onClick={(e) => { e.stopPropagation(); setOpen(!open); }} className="p-0.5 rounded hover:bg-white/10 transition-colors">
                <Info className={`w-3 h-3 ${analysis.hasIncrease ? 'text-amber-400' : 'text-emerald-400'}`} />
            </button>
            {open && (
                <div className="absolute z-50 bottom-full mb-2 right-0 w-72 bg-card border border-card-border rounded-xl shadow-2xl p-3 text-left" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-2 mb-2">
                        <Truck className="w-4 h-4 text-muted" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-muted">Análisis de Flete</span>
                    </div>
                    <p className={`text-xs mb-2 ${analysis.hasIncrease ? 'text-amber-400' : 'text-emerald-400'}`}>{analysis.summary}</p>
                    {analysis.carriers.map(c => (
                        <div key={c.carrier} className="flex justify-between items-center text-[10px] py-0.5">
                            <span className="text-foreground/70 truncate max-w-[100px]">{c.carrier}</span>
                            <span className={`font-bold ${c.diffPercent > 5 ? 'text-amber-400' : 'text-foreground/50'}`}>{c.diffPercent > 0 ? '+' : ''}{c.diffPercent}%</span>
                        </div>
                    ))}
                    <div className="absolute bottom-0 right-6 translate-y-1/2 rotate-45 w-2 h-2 bg-card border-r border-b border-card-border" />
                </div>
            )}
        </div>
    );
}

function CancelReasonsTooltip({ reasons }: { reasons: CancelReason[] }) {
    const [open, setOpen] = useState(false);
    if (!reasons || reasons.length === 0) return null;
    return (
        <div className="relative inline-block">
            <button onClick={(e) => { e.stopPropagation(); setOpen(!open); }} className="p-0.5 rounded hover:bg-white/10 transition-colors">
                <Info className="w-3 h-3 text-red-400/60" />
            </button>
            {open && (
                <div className="absolute z-50 bottom-full mb-2 left-1/2 -translate-x-1/2 w-64 bg-card border border-card-border rounded-xl shadow-2xl p-3 text-left" onClick={(e) => e.stopPropagation()}>
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted block mb-2">Razones de Cancelación</span>
                    <div className="space-y-1.5">
                        {reasons.map((r, i) => (
                            <div key={i} className="flex items-center justify-between gap-2">
                                <span className="text-[10px] text-foreground/70 truncate max-w-[150px]">{r.tag}</span>
                                <div className="flex items-center gap-1.5 shrink-0">
                                    <span className="font-mono text-[10px] font-bold text-red-400">{r.count}</span>
                                    <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-red-500/10 text-red-400">{r.pct.toFixed(1)}%</span>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 rotate-45 w-2 h-2 bg-card border-r border-b border-card-border" />
                </div>
            )}
        </div>
    );
}

function ExpandBtn({ label, expanded, onClick }: { label: string; expanded: boolean; onClick: () => void }) {
    return (
        <button onClick={onClick}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border ${expanded ? 'bg-white/5 border-card-border text-foreground' : 'bg-transparent border-transparent text-muted hover:text-foreground hover:border-card-border'}`}>
            <ChevronRight className={`w-3 h-3 transition-transform ${expanded ? 'rotate-90' : ''}`} />
            {label}
        </button>
    );
}

type SortKey = 'name' | 'orderCount' | 'deliveredCount' | 'cancelCount' | 'transitCount' | 'returnCount' | 'pendingCount' | 'deliveryRate' | 'cancelRate' | 'transitRate' | 'returnRate' | 'adSpend' | 'cpr' | 'flEnt' | 'flTra' | 'flDev' | 'factDespachada' | 'ingReal' | 'profit' | 'projectedProfit';

function SortHeader({ label, sortKey, currentSort, onSort, className = '' }: { label: string; sortKey: SortKey; currentSort: { key: SortKey; asc: boolean } | null; onSort: (k: SortKey) => void; className?: string }) {
    const active = currentSort?.key === sortKey;
    return (
        <th className={`px-3 py-3 cursor-pointer select-none hover:text-foreground transition-colors ${className}`}
            onClick={() => onSort(sortKey)}>
            <div className="flex items-center justify-end gap-1">
                <span>{label}</span>
                <ArrowUpDown className={`w-2.5 h-2.5 ${active ? 'text-foreground' : 'text-muted/40'}`} />
            </div>
        </th>
    );
}

// ─── Main Component ──────────────────────────────────────────────────

export default function CountryTable({
    metricsByCountry, expandedCountry, setExpandedCountry,
    localOverrides, updateCountryOverride, updateProductOverride,
    toggleReturnBuffer, updatePendingCancelOverride, updateProductPendingCancel,
    freightAnalysis, handleSaveProjections, isSavingProjections, saveSuccess, kpiTargets,
}: CountryTableProps) {
    const [showAjustes, setShowAjustes] = useState(false);
    const [showLogistics, setShowLogistics] = useState(true);
    const [showFinancial, setShowFinancial] = useState(false);
    const [sort, setSort] = useState<{ key: SortKey; asc: boolean } | null>(null);

    const handleSort = (key: SortKey) => {
        setSort(prev => prev?.key === key ? { key, asc: !prev.asc } : { key, asc: false });
    };

    const sortedCountries = useMemo(() => {
        if (!sort) return metricsByCountry;
        const arr = [...metricsByCountry];
        arr.sort((a, b) => {
            const va = (a as any)[sort.key] ?? 0;
            const vb = (b as any)[sort.key] ?? 0;
            if (typeof va === 'string') return sort.asc ? va.localeCompare(vb) : vb.localeCompare(va);
            return sort.asc ? va - vb : vb - va;
        });
        return arr;
    }, [metricsByCountry, sort]);

    const ajustesCols = showAjustes ? 3 : 1;
    const logCols = showLogistics ? 6 : 1;
    const finCols = showFinancial ? 7 : 1; // Ads, Merc, FlEnt, FlTra, FlDev, VtaDesp, IngReal + UtdReal at end = 8 total
    const finColsTotal = showFinancial ? 8 : 1;

    return (
        <div className="bg-card border border-card-border rounded-2xl shadow-sm">
            {/* Header */}
            <div className="p-5 border-b border-card-border">
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-xl font-black uppercase tracking-tighter flex items-center gap-3">
                        <Activity className="w-6 h-6 text-indigo-500" />
                        Operación Global
                    </h2>
                    {localOverrides && (
                        <button onClick={handleSaveProjections} disabled={isSavingProjections}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${saveSuccess ? 'bg-emerald-500 text-white' : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'} disabled:opacity-50`}>
                            {isSavingProjections ? <Loader2 className="w-3 h-3 animate-spin" /> : saveSuccess ? <Check className="w-3 h-3" /> : <Zap className="w-3 h-3" />}
                            {saveSuccess ? 'Guardado' : isSavingProjections ? 'Guardando...' : 'Guardar'}
                        </button>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <ExpandBtn label="Ajustes" expanded={showAjustes} onClick={() => setShowAjustes(!showAjustes)} />
                    <ExpandBtn label="Logística" expanded={showLogistics} onClick={() => setShowLogistics(!showLogistics)} />
                    <ExpandBtn label="Financiero" expanded={showFinancial} onClick={() => setShowFinancial(!showFinancial)} />
                </div>
            </div>

            <div className="overflow-x-auto max-h-[700px] overflow-y-auto">
                <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 z-20">
                        <tr className="bg-card border-b border-card-border">
                            <th className="px-4 py-2 border-r border-card-border bg-card min-w-[120px]"></th>
                            <th colSpan={ajustesCols} className="px-3 py-2 text-center text-[10px] font-black uppercase text-indigo-400 tracking-widest border-r border-card-border bg-indigo-500/5">Ajustes</th>
                            <th colSpan={logCols} className="px-3 py-2 text-center text-[10px] font-black uppercase text-blue-400 tracking-widest border-r border-card-border bg-blue-500/5">Logística</th>
                            <th colSpan={finColsTotal} className="px-3 py-2 text-center text-[10px] font-black uppercase text-emerald-400 tracking-widest border-r border-card-border bg-emerald-500/5">Financiero</th>
                            <th className="px-3 py-2 text-center text-[10px] font-black uppercase text-cyan-400 tracking-widest bg-cyan-500/5">Proyección</th>
                            <th className="px-1 py-2 bg-card w-[32px]"></th>
                        </tr>
                        <tr className="bg-card text-muted uppercase text-[9px] font-black tracking-widest border-b border-card-border">
                            <th className="px-4 py-3 border-r border-card-border sticky left-0 z-30 bg-card min-w-[120px] cursor-pointer" onClick={() => handleSort('name')}>
                                <div className="flex items-center gap-1">País <ArrowUpDown className={`w-2.5 h-2.5 ${sort?.key === 'name' ? 'text-foreground' : 'text-muted/40'}`} /></div>
                            </th>
                            {/* Ajustes */}
                            {!showAjustes
                                ? <th className="px-3 py-3 text-center bg-indigo-500/5 border-r border-card-border min-w-[70px]">% Entr.</th>
                                : <>
                                    <th className="px-3 py-3 text-center bg-indigo-500/5 min-w-[70px]">% Entr.</th>
                                    <th className="px-3 py-3 text-center bg-indigo-500/5 min-w-[70px]">% Canc.P</th>
                                    <th className="px-3 py-3 text-center bg-indigo-500/5 border-r border-card-border min-w-[65px]">Fl. Dev.</th>
                                </>
                            }
                            {/* Logística */}
                            {!showLogistics
                                ? <SortHeader label="Órd." sortKey="orderCount" currentSort={sort} onSort={handleSort} className="text-center bg-blue-500/5 border-r border-card-border min-w-[60px]" />
                                : <>
                                    <SortHeader label="Órd." sortKey="orderCount" currentSort={sort} onSort={handleSort} className="text-center bg-blue-500/5 min-w-[60px]" />
                                    <SortHeader label="Entreg." sortKey="deliveredCount" currentSort={sort} onSort={handleSort} className="text-center bg-blue-500/5 min-w-[85px]" />
                                    <SortHeader label="Cancel." sortKey="cancelCount" currentSort={sort} onSort={handleSort} className="text-center bg-blue-500/5 min-w-[85px]" />
                                    <SortHeader label="Tránsito" sortKey="transitCount" currentSort={sort} onSort={handleSort} className="text-center bg-blue-500/5 min-w-[80px]" />
                                    <SortHeader label="Devol." sortKey="returnCount" currentSort={sort} onSort={handleSort} className="text-center bg-blue-500/5 min-w-[80px]" />
                                    <SortHeader label="Pend." sortKey="pendingCount" currentSort={sort} onSort={handleSort} className="text-center bg-violet-500/5 border-r border-card-border min-w-[75px]" />
                                </>
                            }
                            {/* Financiero: collapsed = Utd.Real only; expanded = details then Utd.Real last */}
                            {!showFinancial
                                ? <SortHeader label="Utd. Real" sortKey="profit" currentSort={sort} onSort={handleSort} className="text-right bg-emerald-500/5 border-r border-card-border min-w-[110px]" />
                                : <>
                                    <SortHeader label="Ads" sortKey="adSpend" currentSort={sort} onSort={handleSort} className="text-right bg-emerald-500/5 min-w-[90px]" />
                                    <SortHeader label="Mercancía" sortKey="cpr" currentSort={sort} onSort={handleSort} className="text-right bg-emerald-500/5 min-w-[90px]" />
                                    <SortHeader label="Fl. Ent." sortKey="flEnt" currentSort={sort} onSort={handleSort} className="text-right bg-emerald-500/5 min-w-[85px]" />
                                    <SortHeader label="Fl. Trán." sortKey="flTra" currentSort={sort} onSort={handleSort} className="text-right bg-emerald-500/5 min-w-[85px]" />
                                    <SortHeader label="Fl. Dev." sortKey="flDev" currentSort={sort} onSort={handleSort} className="text-right bg-emerald-500/5 min-w-[85px]" />
                                    <SortHeader label="Vta.Desp." sortKey="factDespachada" currentSort={sort} onSort={handleSort} className="text-right bg-emerald-500/5 min-w-[95px]" />
                                    <SortHeader label="Ing.Real" sortKey="ingReal" currentSort={sort} onSort={handleSort} className="text-right bg-emerald-500/5 min-w-[95px]" />
                                    <SortHeader label="Utd. Real" sortKey="profit" currentSort={sort} onSort={handleSort} className="text-right bg-emerald-500/5 border-r border-card-border min-w-[110px]" />
                                </>
                            }
                            {/* Proyección — single column with value+margin */}
                            <SortHeader label="Utd. Proy." sortKey="projectedProfit" currentSort={sort} onSort={handleSort} className="text-right bg-cyan-500/5 min-w-[120px]" />
                            <th className="px-1 py-3 bg-card w-[32px]"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-card-border">
                        {sortedCountries.map((ctry) => {
                            const margin = ctry.sales > 0 ? (ctry.profit / ctry.sales) * 100 : 0;
                            const projMargin = ctry.sales > 0 ? (ctry.projectedProfit / ctry.sales) * 100 : 0;
                            const returnBufferOn = localOverrides?.countries?.[ctry.name]?.return_buffer_enabled !== false;
                            const factDesp = ctry.factDespachada || ctry.sales;
                            const ingR = ctry.ingReal || 1;

                            // Utility cell (reused in both states)
                            const utdRealCell = (border: boolean) => (
                                <td className={`px-3 py-3 text-right bg-emerald-500/5 ${border ? 'border-r border-card-border' : ''}`}>
                                    <div className="flex flex-col items-end gap-0.5">
                                        <span className={`font-mono font-bold text-sm ${ctry.profit >= 0 ? 'text-foreground' : 'text-red-400'}`}>{formatCurrency(ctry.profit)}</span>
                                        <span className={`text-[9px] font-black px-1 py-0.5 rounded ${margin >= 10 ? 'bg-emerald-500/10 text-emerald-500' : margin >= 0 ? 'bg-amber-500/10 text-amber-400' : 'bg-red-500/10 text-red-400'}`}>{margin.toFixed(1)}%</span>
                                    </div>
                                </td>
                            );

                            return (
                                <React.Fragment key={ctry.name}>
                                    <tr className="hover:bg-hover-bg transition-colors group cursor-pointer" onClick={() => setExpandedCountry(expandedCountry === ctry.name ? null : ctry.name)}>
                                        <td className="px-4 py-3 font-bold text-foreground border-r border-card-border sticky left-0 z-20 bg-card group-hover:bg-hover-bg">
                                            <div className="flex items-center gap-2 text-sm">
                                                <img src={`https://flagcdn.com/w20/${getFlagCode(ctry.name)}.png`} alt={ctry.name} className="w-5 h-3 rounded-sm object-cover" />
                                                {ctry.name}
                                            </div>
                                        </td>
                                        {/* Ajustes */}
                                        {!showAjustes ? (
                                            <td className="px-3 py-3 text-center bg-indigo-500/5 border-r border-card-border" onClick={(e) => e.stopPropagation()}>
                                                <div className="flex items-center justify-center gap-0.5">
                                                    <input type="number" value={localOverrides?.countries?.[ctry.name]?.delivery_percent ?? ctry.projectionConfig}
                                                        onChange={(e) => updateCountryOverride(ctry.name, parseFloat(e.target.value))}
                                                        className="w-10 bg-transparent border-b border-transparent hover:border-muted focus:border-indigo-500 focus:outline-none text-center font-mono text-sm text-indigo-400 transition-colors" />
                                                    <span className="text-[10px] text-muted">%</span>
                                                </div>
                                            </td>
                                        ) : <>
                                            <td className="px-3 py-3 text-center bg-indigo-500/5" onClick={(e) => e.stopPropagation()}>
                                                <div className="flex items-center justify-center gap-0.5">
                                                    <input type="number" value={localOverrides?.countries?.[ctry.name]?.delivery_percent ?? ctry.projectionConfig}
                                                        onChange={(e) => updateCountryOverride(ctry.name, parseFloat(e.target.value))}
                                                        className="w-10 bg-transparent border-b border-transparent hover:border-muted focus:border-indigo-500 focus:outline-none text-center font-mono text-sm text-indigo-400 transition-colors" />
                                                    <span className="text-[10px] text-muted">%</span>
                                                </div>
                                            </td>
                                            <td className="px-3 py-3 text-center bg-indigo-500/5" onClick={(e) => e.stopPropagation()}>
                                                {ctry.pendingCount > 0 ? (
                                                    <div className="flex items-center justify-center gap-0.5">
                                                        <input type="number" min={0} max={100}
                                                            value={localOverrides?.countries?.[ctry.name]?.pending_cancel_percent ?? ctry.pendingCancelConfig}
                                                            onChange={(e) => updatePendingCancelOverride(ctry.name, parseFloat(e.target.value) || 0)}
                                                            className="w-10 bg-transparent border-b border-transparent hover:border-muted focus:border-violet-500 focus:outline-none text-center font-mono text-sm text-violet-400 transition-colors" />
                                                        <span className="text-[10px] text-muted">%</span>
                                                    </div>
                                                ) : <span className="text-xs text-muted">-</span>}
                                            </td>
                                            <td className="px-3 py-3 text-center bg-indigo-500/5 border-r border-card-border" onClick={(e) => e.stopPropagation()}>
                                                <div className="flex items-center justify-center gap-1">
                                                    <div className={`relative w-7 h-3.5 rounded-full transition-colors cursor-pointer ${returnBufferOn ? 'bg-amber-500' : 'bg-gray-600'}`}
                                                        onClick={() => toggleReturnBuffer(ctry.name, !returnBufferOn)}>
                                                        <div className={`absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white shadow transition-transform ${returnBufferOn ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                                                    </div>
                                                    {freightAnalysis[ctry.name] && <FreightTooltip analysis={freightAnalysis[ctry.name]} />}
                                                </div>
                                            </td>
                                        </>}
                                        {/* Logística */}
                                        {!showLogistics ? (
                                            <td className="px-3 py-3 text-center font-mono text-sm font-bold text-foreground/80 bg-blue-500/5 border-r border-card-border">{ctry.orderCount}</td>
                                        ) : <>
                                            <td className="px-3 py-3 text-center font-mono text-sm font-bold text-foreground/80 bg-blue-500/5">{ctry.orderCount}</td>
                                            <td className="px-3 py-3 text-center bg-blue-500/5"><StatCell count={ctry.deliveredCount} rate={ctry.deliveryRate} type="delivery" /></td>
                                            <td className="px-3 py-3 text-center bg-blue-500/5">
                                                <div className="flex items-center justify-center gap-0.5">
                                                    <StatCell count={ctry.cancelCount} rate={ctry.cancelRate} type="cancel" />
                                                    <CancelReasonsTooltip reasons={ctry.cancelReasons} />
                                                </div>
                                            </td>
                                            <td className="px-3 py-3 text-center bg-blue-500/5"><StatCell count={ctry.transitCount} rate={ctry.transitRate} type="neutral" /></td>
                                            <td className="px-3 py-3 text-center bg-blue-500/5"><StatCell count={ctry.returnCount} rate={ctry.returnRate} type="return" /></td>
                                            <td className="px-3 py-3 text-center bg-violet-500/5 border-r border-card-border">
                                                {ctry.pendingCount > 0 ? <StatCell count={ctry.pendingCount} rate={ctry.pendingPercent} type="neutral" /> : <span className="text-xs text-muted">-</span>}
                                            </td>
                                        </>}
                                        {/* Financiero */}
                                        {!showFinancial
                                            ? utdRealCell(true)
                                            : <>
                                                {/* Ads → % sobre facturado despachado */}
                                                <td className="px-3 py-3 text-right bg-emerald-500/5"><ValPct value={ctry.adSpend} pct={factDesp > 0 ? (ctry.adSpend / factDesp) * 100 : 0} warn={25} /></td>
                                                {/* Mercancía → % sobre ingreso real */}
                                                <td className="px-3 py-3 text-right bg-emerald-500/5"><ValPct value={ctry.cpr} pct={ingR > 0 ? (ctry.cpr / ingR) * 100 : 0} warn={30} /></td>
                                                {/* Fl.Ent → % sobre ingreso real */}
                                                <td className="px-3 py-3 text-right bg-emerald-500/5"><ValPct value={ctry.flEnt} pct={ingR > 0 ? (ctry.flEnt / ingR) * 100 : 0} /></td>
                                                {/* Fl.Trán → % sobre facturado */}
                                                <td className="px-3 py-3 text-right bg-emerald-500/5"><ValPct value={ctry.flTra} pct={factDesp > 0 ? (ctry.flTra / factDesp) * 100 : 0} /></td>
                                                {/* Fl.Dev → % sobre ingreso real */}
                                                <td className="px-3 py-3 text-right bg-emerald-500/5"><ValPct value={ctry.flDev} pct={ingR > 0 ? (ctry.flDev / ingR) * 100 : 0} /></td>
                                                <td className="px-3 py-3 text-right font-mono text-xs text-foreground/80 bg-emerald-500/5">{formatCurrency(factDesp)}</td>
                                                <td className="px-3 py-3 text-right font-mono text-xs text-foreground/80 bg-emerald-500/5">{formatCurrency(ctry.ingReal)}</td>
                                                {utdRealCell(true)}
                                            </>
                                        }
                                        {/* Proyección: value + margin badge in one cell */}
                                        <td className="px-3 py-3 text-right bg-cyan-500/5">
                                            <div className="flex flex-col items-end gap-0.5">
                                                <span className={`font-mono text-sm font-bold ${ctry.projectedProfit >= 0 ? 'text-cyan-400' : 'text-red-400'}`}>{formatCurrency(ctry.projectedProfit)}</span>
                                                <span className={`text-[9px] font-black px-1 py-0.5 rounded ${projMargin >= 10 ? 'bg-cyan-500/10 text-cyan-400' : projMargin >= 0 ? 'bg-amber-500/10 text-amber-400' : 'bg-red-500/10 text-red-400'}`}>{projMargin.toFixed(1)}%</span>
                                            </div>
                                        </td>
                                        <td className="px-1 py-3 text-center">
                                            <ChevronDown className={`w-4 h-4 text-muted transition-transform ${expandedCountry === ctry.name ? 'rotate-180' : ''}`} />
                                        </td>
                                    </tr>

                                    {/* Product rows */}
                                    {expandedCountry === ctry.name && <>
                                        <tr className="bg-hover-bg/30">
                                            <td colSpan={99} className="px-6 py-2 text-[10px] font-black uppercase text-muted tracking-widest border-b border-card-border">
                                                Productos: {ctry.name}
                                            </td>
                                        </tr>
                                        {ctry.products.map((p, idx) => {
                                            const pMargin = p.netSales > 0 ? (p.profit / p.netSales) * 100 : 0;
                                            const pProjMargin = p.netSales > 0 ? (p.projectedProfit / p.netSales) * 100 : 0;
                                            const pFactDesp = p.factDespachada || p.netSales;
                                            const pIngR = p.ingReal || 1;

                                            const pUtdCell = (border: boolean) => (
                                                <td className={`px-3 py-2.5 text-right bg-emerald-500/5 ${border ? 'border-r border-card-border' : ''}`}>
                                                    <div className="flex flex-col items-end gap-0.5">
                                                        <span className={`font-mono text-sm ${p.profit >= 0 ? 'text-foreground' : 'text-red-400'}`}>{formatCurrency(p.profit)}</span>
                                                        <span className={`text-[9px] font-bold ${pMargin >= 10 ? 'text-emerald-400' : pMargin >= 0 ? 'text-amber-400' : 'text-red-400'}`}>{pMargin.toFixed(1)}%</span>
                                                    </div>
                                                </td>
                                            );

                                            return (
                                                <tr key={idx} className="border-b border-card-border last:border-0 hover:bg-white/5 transition-colors bg-card/40">
                                                    <td className="px-4 py-2.5 sticky left-0 z-20 bg-card overflow-hidden whitespace-nowrap pl-7 border-r border-card-border" title={p.name}>
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-1 h-3 rounded-full bg-border shrink-0" />
                                                            <span className="truncate max-w-[180px] text-[10px] text-foreground/80">{p.name}</span>
                                                        </div>
                                                    </td>
                                                    {/* Ajustes */}
                                                    {!showAjustes ? (
                                                        <td className="px-3 py-2.5 text-center bg-indigo-500/5 border-r border-card-border">
                                                            <div className="flex items-center justify-center gap-0.5">
                                                                <input type="number" value={localOverrides?.products?.[ctry.name]?.[p.id] ?? p.projectionConfig}
                                                                    onChange={(e) => updateProductOverride(ctry.name, p.id, parseFloat(e.target.value))}
                                                                    className="w-9 bg-transparent border-b border-transparent hover:border-muted focus:border-indigo-500 focus:outline-none text-center font-mono text-xs text-indigo-400 transition-colors" />
                                                                <span className="text-[9px] text-muted">%</span>
                                                            </div>
                                                        </td>
                                                    ) : <>
                                                        <td className="px-3 py-2.5 text-center bg-indigo-500/5">
                                                            <div className="flex items-center justify-center gap-0.5">
                                                                <input type="number" value={localOverrides?.products?.[ctry.name]?.[p.id] ?? p.projectionConfig}
                                                                    onChange={(e) => updateProductOverride(ctry.name, p.id, parseFloat(e.target.value))}
                                                                    className="w-9 bg-transparent border-b border-transparent hover:border-muted focus:border-indigo-500 focus:outline-none text-center font-mono text-xs text-indigo-400 transition-colors" />
                                                                <span className="text-[9px] text-muted">%</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-3 py-2.5 text-center bg-indigo-500/5">
                                                            {p.pendingCount > 0 ? (
                                                                <div className="flex items-center justify-center gap-0.5">
                                                                    <input type="number" min={0} max={100}
                                                                        value={localOverrides?.products?.[ctry.name]?.[`${p.id}_pend_cancel`] ?? p.pendingCancelConfig}
                                                                        onChange={(e) => updateProductPendingCancel(ctry.name, p.id, parseFloat(e.target.value) || 0)}
                                                                        className="w-9 bg-transparent border-b border-transparent hover:border-muted focus:border-violet-500 focus:outline-none text-center font-mono text-xs text-violet-400 transition-colors" />
                                                                    <span className="text-[9px] text-muted">%</span>
                                                                </div>
                                                            ) : <span className="text-xs text-muted">-</span>}
                                                        </td>
                                                        <td className="px-3 py-2.5 text-center text-[10px] text-muted bg-indigo-500/5 border-r border-card-border">—</td>
                                                    </>}
                                                    {/* Logística */}
                                                    {!showLogistics ? (
                                                        <td className="px-3 py-2.5 text-center font-mono text-sm text-foreground/70 bg-blue-500/5 border-r border-card-border">{p.orderCount}</td>
                                                    ) : <>
                                                        <td className="px-3 py-2.5 text-center font-mono text-sm text-foreground/70 bg-blue-500/5">{p.orderCount}</td>
                                                        <td className="px-3 py-2.5 text-center bg-blue-500/5"><StatCell count={p.deliveredCount} rate={p.deliveryRate} type="delivery" /></td>
                                                        <td className="px-3 py-2.5 text-center bg-blue-500/5">
                                                            <div className="flex items-center justify-center gap-0.5">
                                                                <StatCell count={p.cancelCount} rate={p.cancelRate} type="cancel" />
                                                                <CancelReasonsTooltip reasons={p.cancelReasons} />
                                                            </div>
                                                        </td>
                                                        <td className="px-3 py-2.5 text-center bg-blue-500/5"><StatCell count={p.transitCount} rate={p.transitRate} type="neutral" /></td>
                                                        <td className="px-3 py-2.5 text-center bg-blue-500/5"><StatCell count={p.returnCount} rate={p.returnRate} type="return" /></td>
                                                        <td className="px-3 py-2.5 text-center bg-violet-500/5 border-r border-card-border">
                                                            {p.pendingCount > 0 ? <span className="font-mono text-xs text-violet-400">{p.pendingCount}</span> : <span className="text-xs text-muted">-</span>}
                                                        </td>
                                                    </>}
                                                    {/* Financiero */}
                                                    {!showFinancial
                                                        ? pUtdCell(true)
                                                        : <>
                                                            <td className="px-3 py-2.5 text-right bg-emerald-500/5"><ValPct value={p.adSpend} pct={pFactDesp > 0 ? (p.adSpend / pFactDesp) * 100 : 0} warn={25} /></td>
                                                            <td className="px-3 py-2.5 text-right bg-emerald-500/5"><ValPct value={p.cpr} pct={pIngR > 0 ? (p.cpr / pIngR) * 100 : 0} warn={30} /></td>
                                                            <td className="px-3 py-2.5 text-right bg-emerald-500/5"><ValPct value={p.flEnt} pct={pIngR > 0 ? (p.flEnt / pIngR) * 100 : 0} /></td>
                                                            <td className="px-3 py-2.5 text-right bg-emerald-500/5"><ValPct value={p.flTra} pct={pFactDesp > 0 ? (p.flTra / pFactDesp) * 100 : 0} /></td>
                                                            <td className="px-3 py-2.5 text-right bg-emerald-500/5"><ValPct value={p.flDev} pct={pIngR > 0 ? (p.flDev / pIngR) * 100 : 0} /></td>
                                                            <td className="px-3 py-2.5 text-right font-mono text-[11px] text-foreground/70 bg-emerald-500/5">{formatCurrency(pFactDesp)}</td>
                                                            <td className="px-3 py-2.5 text-right font-mono text-[11px] text-foreground/70 bg-emerald-500/5">{formatCurrency(p.ingReal)}</td>
                                                            {pUtdCell(true)}
                                                        </>
                                                    }
                                                    {/* Proyección */}
                                                    <td className="px-3 py-2.5 text-right bg-cyan-500/5">
                                                        <div className="flex flex-col items-end gap-0.5">
                                                            <span className={`font-mono font-bold text-sm ${p.projectedProfit >= 0 ? 'text-cyan-400' : 'text-red-400'}`}>{formatCurrency(p.projectedProfit)}</span>
                                                            <span className={`text-[9px] font-bold ${pProjMargin >= 10 ? 'text-cyan-400' : pProjMargin >= 0 ? 'text-amber-400' : 'text-red-400'}`}>{pProjMargin.toFixed(1)}%</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-1 py-2.5"></td>
                                                </tr>
                                            );
                                        })}
                                    </>}
                                </React.Fragment>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
