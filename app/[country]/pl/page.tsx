'use client';

import React, { useMemo } from 'react';
import { useCountryData } from '@/lib/hooks/useCountryData';
import { useGlobalFilters } from '@/lib/context/FilterContext';
import FilterHeader from '@/components/FilterHeader';
import { formatCurrency, formatDualCurrency } from '@/lib/utils/currency';
import { DropiOrder, calculateKPIs } from '@/lib/calculations/kpis';
import InfoTooltip from '@/components/common/InfoTooltip';
import {
    CircleDollarSign,
    TrendingUp,
    Receipt,
    Loader2,
    Info,
    BarChart3,
    Target,
    Percent,
    RotateCcw,
    AlertTriangle,
    CheckCircle2,
    Minus,
} from 'lucide-react';
import { isEntregado, isDevolucion } from '@/lib/utils/status';
import { parseISO, subDays, startOfDay, endOfDay, startOfMonth, subMonths } from 'date-fns';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell,
    PieChart,
    Pie,
    ReferenceLine,
} from 'recharts';

// Compact number formatting for chart axes
function fmtCompact(value: number): string {
    const abs = Math.abs(value);
    if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
    return `$${value.toFixed(0)}`;
}

function filterByGlobalDate(
    orders: DropiOrder[],
    dateRange: string,
    startCustom: string,
    endCustom: string
): DropiOrder[] {
    const now = new Date();
    let start: Date | null = null;
    let end: Date | null = null;

    switch (dateRange) {
        case 'Hoy':
            start = startOfDay(now); end = endOfDay(now); break;
        case 'Ayer':
            start = startOfDay(subDays(now, 1)); end = endOfDay(subDays(now, 1)); break;
        case 'Últimos 3 Días':
            start = startOfDay(subDays(now, 3)); break;
        case 'Últimos 7 Días':
            start = startOfDay(subDays(now, 7)); break;
        case 'Últimos 30 Días':
            start = startOfDay(subDays(now, 30)); break;
        case 'Este Mes':
            start = startOfMonth(now); break;
        case 'Mes Pasado': {
            const lastMonth = subMonths(now, 1);
            start = startOfMonth(lastMonth); end = startOfMonth(now); break;
        }
        case 'Personalizado':
            if (startCustom) start = parseISO(startCustom);
            if (endCustom) end = endOfDay(parseISO(endCustom));
            break;
        case 'Todos': default: return orders;
    }

    return orders.filter(o => {
        const dateStr = o.FECHA;
        if (!dateStr) return false;
        let d: Date;
        if (typeof dateStr === 'string' && dateStr.includes('/')) {
            const parts = dateStr.split(' ')[0].split('/');
            if (parts.length === 3) {
                const [day, m, y] = parts;
                d = new Date(parseInt(y), parseInt(m) - 1, parseInt(day));
            } else return false;
        } else { d = new Date(dateStr); }
        if (isNaN(d.getTime())) return false;
        if (start && d < start) return false;
        if (end && d > end) return false;
        return true;
    });
}

// Custom waterfall tooltip
function WaterfallTooltip({ active, payload }: any) {
    if (!active || !payload?.[0]) return null;
    const data = payload[0].payload;
    return (
        <div style={{
            background: 'var(--card-bg)',
            border: '1px solid var(--card-border)',
            borderRadius: 12,
            padding: '10px 14px',
            fontSize: 12,
            fontWeight: 700,
            color: 'var(--foreground)',
        }}>
            <p style={{ marginBottom: 4, color: 'var(--muted)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {data.name}
            </p>
            <p style={{ fontFamily: 'monospace', fontSize: 14, color: data.displayValue >= 0 ? '#10b981' : '#ef4444' }}>
                {data.displayValue >= 0 ? '' : '-'}{formatCurrency(Math.abs(data.displayValue), 'COP')}
            </p>
            {data.percOfRevenue !== undefined && (
                <p style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>
                    {data.percOfRevenue.toFixed(1)}% del ingreso
                </p>
            )}
        </div>
    );
}

export default function CountryPLPage() {
    const {
        loading, rates, countryOrders,
        localCurrency, countryName,
        calculatedAdSpend,
    } = useCountryData();

    const { dateRange, startDateCustom, endDateCustom, selectedProduct } = useGlobalFilters();

    const filteredOrders = useMemo(() => {
        let orders = filterByGlobalDate(countryOrders, dateRange, startDateCustom, endDateCustom);
        if (selectedProduct && selectedProduct !== 'Todos') {
            orders = orders.filter(o => o.PRODUCTO === selectedProduct);
        }
        return orders;
    }, [countryOrders, dateRange, startDateCustom, endDateCustom, selectedProduct]);

    const availableProducts = useMemo(() => {
        const products = new Set<string>();
        countryOrders.forEach(o => { if (o.PRODUCTO) products.add(o.PRODUCTO); });
        return ['Todos', ...Array.from(products).sort()];
    }, [countryOrders]);

    const kpis = useMemo(() => {
        if (filteredOrders.length === 0 || !rates) return null;
        return calculateKPIs(filteredOrders, calculatedAdSpend);
    }, [filteredOrders, rates, calculatedAdSpend]);

    // Waterfall chart data
    const waterfallData = useMemo(() => {
        if (!kpis || kpis.ing_real === 0) return [];

        const ing = kpis.ing_real;
        const items = [
            { name: 'Ingreso', value: ing, fill: '#10b981', isTotal: true },
            { name: 'COGS', value: -kpis.cpr, fill: '#ef4444' },
            { name: 'Flete Ent.', value: -kpis.fl_ent, fill: '#3b82f6' },
            { name: 'Flete Dev.', value: -kpis.fl_dev, fill: '#f97316' },
            { name: 'Flete Trán.', value: -kpis.fl_tra, fill: '#06b6d4' },
            { name: 'Ads', value: -kpis.g_ads, fill: '#a855f7' },
            { name: 'Utilidad', value: kpis.u_real, fill: kpis.u_real >= 0 ? '#10b981' : '#ef4444', isTotal: true },
        ];

        let runningTotal = 0;
        return items.map((item, idx) => {
            if (idx === 0) {
                runningTotal = item.value;
                return {
                    name: item.name,
                    base: 0,
                    value: item.value,
                    fill: item.fill,
                    displayValue: item.value,
                    percOfRevenue: 100,
                };
            }
            if (idx === items.length - 1) {
                return {
                    name: item.name,
                    base: item.value >= 0 ? 0 : item.value,
                    value: Math.abs(item.value),
                    fill: item.fill,
                    displayValue: item.value,
                    percOfRevenue: ing > 0 ? (item.value / ing) * 100 : 0,
                };
            }
            const absVal = Math.abs(item.value);
            const newTotal = runningTotal + item.value;
            const entry = {
                name: item.name,
                base: newTotal,
                value: absVal,
                fill: item.fill,
                displayValue: item.value,
                percOfRevenue: ing > 0 ? (absVal / ing) * 100 : 0,
            };
            runningTotal = newTotal;
            return entry;
        });
    }, [kpis]);

    // Cost breakdown for donut
    const costBreakdownData = useMemo(() => {
        if (!kpis) return [];
        return [
            { name: 'Costo Producto', value: kpis.cpr, color: '#ef4444' },
            { name: 'Flete Entrega', value: kpis.fl_ent, color: '#3b82f6' },
            { name: 'Flete Devolución', value: kpis.fl_dev, color: '#f97316' },
            { name: 'Flete Tránsito', value: kpis.fl_tra, color: '#06b6d4' },
            { name: 'Publicidad', value: kpis.g_ads, color: '#a855f7' },
        ].filter(d => d.value > 0);
    }, [kpis]);

    const totalCosts = useMemo(() => {
        if (!kpis) return 0;
        return kpis.cpr + kpis.fl_ent + kpis.fl_dev + kpis.fl_tra + kpis.g_ads;
    }, [kpis]);

    // Product metrics computation
    const productMetrics = useMemo(() => {
        const products: Record<string, DropiOrder[]> = {};
        filteredOrders.forEach(o => {
            const p = o.PRODUCTO || 'Desconocido';
            if (!products[p]) products[p] = [];
            products[p].push(o);
        });

        return Object.entries(products)
            .map(([name, orders]) => {
                const entOrders = orders.filter(o => isEntregado(o.ESTATUS));
                const income = entOrders.reduce((s, o) => s + (o["TOTAL DE LA ORDEN"] || 0), 0);
                const cost = entOrders.reduce((s, o) => s + (o["PRECIO PROVEEDOR X CANTIDAD"] || 0), 0);
                const flete = entOrders.reduce((s, o) => s + (o["PRECIO FLETE"] || 0), 0);
                const devOrders = orders.filter(o => isDevolucion(o.ESTATUS));
                const fleteDev = devOrders.reduce((s, o) => s + (o["COSTO DEVOLUCION FLETE"] || o["PRECIO FLETE"] || 0), 0);
                const profit = income - cost - flete - fleteDev;
                const margin = income > 0 ? (profit / income) * 100 : 0;
                return { name, margin, profit, count: orders.length, income };
            })
            .filter(p => p.income > 0);
    }, [filteredOrders]);

    const topProducts = useMemo(() =>
        [...productMetrics].sort((a, b) => b.margin - a.margin).slice(0, 5),
        [productMetrics]
    );

    const bottomProducts = useMemo(() =>
        [...productMetrics].sort((a, b) => a.margin - b.margin).slice(0, 5),
        [productMetrics]
    );

    if (loading || !rates) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4">
                <Loader2 className="w-8 h-8 text-accent animate-spin" />
                <p className="text-muted font-mono text-[10px] tracking-widest uppercase">Analizando P&L Territorial...</p>
            </div>
        );
    }

    const marginPerc = kpis?.ing_real ? (kpis.u_real / kpis.ing_real) * 100 : 0;
    const marginColor = marginPerc >= 20 ? 'emerald' : marginPerc >= 10 ? 'amber' : 'red';

    return (
        <div className="space-y-6 animate-in fade-in duration-700">
            {/* FilterHeader */}
            <FilterHeader
                availableProducts={availableProducts}
                availableCountries={[countryName]}
                title={`${countryName} — P&L`}
                icon={BarChart3}
            />

            {/* ===== SECTION 1: Hero KPI Strip ===== */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {/* Facturación Neta */}
                <div className="bg-card border border-card-border rounded-2xl p-4 hover:border-accent/30 transition-all shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] font-black text-muted uppercase tracking-widest flex items-center gap-1.5">
                            Fact. Neta <InfoTooltip text="Total facturado de órdenes no canceladas. Incluye entregadas, en tránsito y devoluciones." />
                        </span>
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-emerald-500/10">
                            <Receipt className="w-4 h-4 text-emerald-500" />
                        </div>
                    </div>
                    <p className="text-2xl font-black tracking-tight text-emerald-500 font-mono">{formatCurrency(kpis?.fact_neto || 0, 'COP')}</p>
                    <p className="text-xs text-muted mt-1 font-mono">{kpis?.n_nc || 0} despachadas</p>
                </div>

                {/* Ingreso Real */}
                <div className="bg-card border border-card-border rounded-2xl p-4 hover:border-accent/30 transition-all shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] font-black text-muted uppercase tracking-widest flex items-center gap-1.5">
                            Ingreso Real <InfoTooltip text="Ingresos de órdenes con estado Entregado. Es el flujo de caja efectivamente realizado." />
                        </span>
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-blue-500/10">
                            <TrendingUp className="w-4 h-4 text-blue-400" />
                        </div>
                    </div>
                    <p className="text-2xl font-black tracking-tight text-blue-400 font-mono">{formatCurrency(kpis?.ing_real || 0, 'COP')}</p>
                    <p className="text-xs text-muted mt-1 font-mono">{kpis?.n_ent || 0} entregadas</p>
                </div>

                {/* Costo Total */}
                <div className="bg-card border border-card-border rounded-2xl p-4 hover:border-accent/30 transition-all shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] font-black text-muted uppercase tracking-widest flex items-center gap-1.5">
                            Costo Total <InfoTooltip text="Suma de todos los costos: producto, fletes (entrega + devolución + tránsito) y publicidad." />
                        </span>
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-red-500/10">
                            <Minus className="w-4 h-4 text-red-400" />
                        </div>
                    </div>
                    <p className="text-2xl font-black tracking-tight text-red-400 font-mono">{formatCurrency(totalCosts, 'COP')}</p>
                    <p className="text-xs text-muted mt-1 font-mono">{kpis?.ing_real ? ((totalCosts / kpis.ing_real) * 100).toFixed(1) : 0}% del ingreso</p>
                </div>

                {/* Utilidad Real */}
                <div className="bg-card border border-card-border rounded-2xl p-4 hover:border-accent/30 transition-all shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] font-black text-muted uppercase tracking-widest flex items-center gap-1.5">
                            Utilidad Real <InfoTooltip text="Ganancia real: ingreso entregado menos costo de producto, fletes y publicidad." />
                        </span>
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${(kpis?.u_real || 0) >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
                            <CircleDollarSign className={`w-4 h-4 ${(kpis?.u_real || 0) >= 0 ? 'text-emerald-500' : 'text-red-400'}`} />
                        </div>
                    </div>
                    <p className={`text-2xl font-black tracking-tight font-mono ${(kpis?.u_real || 0) >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>
                        {formatCurrency(kpis?.u_real || 0, 'COP')}
                    </p>
                    {localCurrency !== 'COP' && rates && (
                        <p className="text-xs text-muted mt-1 font-mono italic">{formatDualCurrency(kpis?.u_real || 0, localCurrency, rates).secondary}</p>
                    )}
                </div>

                {/* Margen Neto */}
                <div className="bg-card border border-card-border rounded-2xl p-4 hover:border-accent/30 transition-all shadow-sm col-span-2 md:col-span-1">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] font-black text-muted uppercase tracking-widest flex items-center gap-1.5">
                            Margen Neto <InfoTooltip text="Porcentaje de utilidad sobre el ingreso real. Verde >= 20%, Amarillo >= 10%, Rojo < 10%." />
                        </span>
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center bg-${marginColor}-500/10`}>
                            <Percent className={`w-4 h-4 text-${marginColor}-400`} />
                        </div>
                    </div>
                    <p className={`text-3xl font-black tracking-tight font-mono text-${marginColor}-400`}>
                        {marginPerc.toFixed(1)}%
                    </p>
                    <div className="w-full h-2 bg-hover-bg rounded-full overflow-hidden mt-2">
                        <div
                            className={`h-full rounded-full bg-${marginColor}-500 transition-all`}
                            style={{ width: `${Math.max(0, Math.min(100, marginPerc))}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* ===== SECTION 2: Waterfall Chart (Vertical) ===== */}
            {waterfallData.length > 0 && (
                <div className="bg-card border border-card-border rounded-2xl p-5 shadow-sm">
                    <h3 className="text-[11px] font-black text-muted uppercase tracking-widest mb-1 flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-accent" />
                        Cascada P&L
                        <InfoTooltip text="Visualización de cómo el ingreso se distribuye entre los costos hasta llegar a la utilidad final." />
                    </h3>
                    <p className="text-muted text-xs mb-4">Del ingreso bruto a la utilidad neta</p>

                    <div className="h-[420px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={waterfallData} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" horizontal={false} />
                                <YAxis
                                    type="category"
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: 'var(--muted)', fontSize: 11, fontWeight: 700 }}
                                    width={90}
                                />
                                <XAxis
                                    type="number"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: 'var(--muted)', fontSize: 10 }}
                                    tickFormatter={fmtCompact}
                                />
                                <Tooltip content={<WaterfallTooltip />} cursor={{ fill: 'var(--hover-bg)' }} />
                                <ReferenceLine x={0} stroke="#ef4444" strokeOpacity={0.3} strokeDasharray="4 4" />
                                {/* Invisible base */}
                                <Bar dataKey="base" stackId="waterfall" fill="transparent" isAnimationActive={false} />
                                {/* Visible value */}
                                <Bar dataKey="value" stackId="waterfall" radius={[0, 4, 4, 0]} barSize={32}>
                                    {waterfallData.map((entry, idx) => (
                                        <Cell key={idx} fill={entry.fill} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Summary line */}
                    <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-card-border flex-wrap">
                        <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                            <span className="text-xs text-muted">Ingreso</span>
                            <span className="text-xs font-black font-mono text-foreground">{formatCurrency(kpis?.ing_real || 0, 'COP')}</span>
                        </div>
                        <span className="text-muted text-xs">-</span>
                        <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                            <span className="text-xs text-muted">Costos</span>
                            <span className="text-xs font-black font-mono text-foreground">{formatCurrency(totalCosts, 'COP')}</span>
                        </div>
                        <span className="text-muted text-xs">=</span>
                        <div className="flex items-center gap-2">
                            <div className={`w-2.5 h-2.5 rounded-full ${(kpis?.u_real || 0) >= 0 ? 'bg-emerald-500' : 'bg-red-500'}`} />
                            <span className="text-xs text-muted">Utilidad</span>
                            <span className={`text-xs font-black font-mono ${(kpis?.u_real || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {formatCurrency(kpis?.u_real || 0, 'COP')}
                            </span>
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-black border font-mono bg-${marginColor}-500/10 text-${marginColor}-400 border-${marginColor}-500/20`}>
                                {marginPerc.toFixed(1)}%
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* ===== SECTION 3: Cost Breakdown — Full Width ===== */}
            {costBreakdownData.length > 0 && (
                <div className="bg-card border border-card-border rounded-2xl p-6 shadow-sm">
                    <h3 className="text-[11px] font-black text-muted uppercase tracking-widest mb-6 flex items-center gap-2">
                        <CircleDollarSign className="w-4 h-4 text-red-400" />
                        Distribución de Costos
                        <InfoTooltip text="Proporción de cada tipo de costo sobre el total de costos operativos." />
                    </h3>

                    <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-8 items-center">
                        {/* Donut Chart - Larger */}
                        <div className="h-[300px] w-full relative">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={costBreakdownData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={80}
                                        outerRadius={120}
                                        paddingAngle={3}
                                        dataKey="value"
                                        stroke="none"
                                    >
                                        {costBreakdownData.map((entry, idx) => (
                                            <Cell key={idx} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{
                                            background: '#1a1a1a',
                                            border: '1px solid rgba(255,255,255,0.15)',
                                            borderRadius: 12,
                                            fontSize: 12,
                                            fontWeight: 700,
                                            color: '#ededed',
                                            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                                        }}
                                        itemStyle={{ color: '#ededed', padding: '2px 0' }}
                                        labelStyle={{ color: '#888', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}
                                        formatter={(value: any, name: any) => [formatCurrency(value as number, 'COP'), name]}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                <span className="text-[10px] text-muted font-black uppercase tracking-widest">Costo Total</span>
                                <span className="text-xl font-black font-mono text-foreground leading-none mt-1">
                                    {formatCurrency(totalCosts, 'COP')}
                                </span>
                                <span className="text-[10px] text-muted font-mono mt-1">
                                    {kpis?.ing_real ? ((totalCosts / kpis.ing_real) * 100).toFixed(1) : 0}% del ingreso
                                </span>
                            </div>
                        </div>

                        {/* Detailed cost line items */}
                        <div className="space-y-3">
                            {costBreakdownData.map((item, idx) => {
                                const percOfRevenue = kpis?.ing_real && kpis.ing_real > 0 ? (item.value / kpis.ing_real) * 100 : 0;
                                const percOfTotal = totalCosts > 0 ? (item.value / totalCosts) * 100 : 0;
                                return (
                                    <div key={idx} className="p-3 bg-hover-bg rounded-xl border border-card-border">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-3">
                                                <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                                                <span className="text-xs font-bold text-foreground uppercase tracking-wide">{item.name}</span>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="text-sm font-black font-mono text-foreground">{formatCurrency(item.value, 'COP')}</span>
                                                <span className="text-[10px] font-bold font-mono text-muted px-1.5 py-0.5 bg-card rounded border border-card-border">
                                                    {percOfTotal.toFixed(0)}%
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="flex-1 h-2.5 bg-card rounded-full overflow-hidden">
                                                <div
                                                    className="h-full rounded-full transition-all"
                                                    style={{ width: `${Math.min(100, percOfRevenue)}%`, backgroundColor: item.color, opacity: 0.8 }}
                                                />
                                            </div>
                                            <span className="text-xs font-bold font-mono text-muted w-16 text-right">{percOfRevenue.toFixed(1)}%</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* ===== SECTION 4: Performance Metrics Grid ===== */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {/* ROAS Real */}
                {(() => {
                    const val = kpis?.roas_real || 0;
                    const color = val >= 3 ? 'emerald' : val >= 1.5 ? 'amber' : 'red';
                    return (
                        <div className="bg-card border border-card-border rounded-2xl p-4 hover:border-accent/30 transition-all shadow-sm">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] font-black text-muted uppercase tracking-widest">ROAS Real</span>
                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center bg-${color}-500/10`}>
                                    <TrendingUp className={`w-3.5 h-3.5 text-${color}-400`} />
                                </div>
                            </div>
                            <p className={`text-xl font-black tracking-tight font-mono text-${color}-400`}>{val.toFixed(2)}x</p>
                            <p className="text-[10px] text-muted mt-1 uppercase tracking-wider">Ing. Real / Ads</p>
                        </div>
                    );
                })()}

                {/* CPA */}
                {(() => {
                    const val = kpis?.cpa || 0;
                    const color = val <= 20000 ? 'emerald' : val <= 35000 ? 'amber' : 'red';
                    return (
                        <div className="bg-card border border-card-border rounded-2xl p-4 hover:border-accent/30 transition-all shadow-sm">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] font-black text-muted uppercase tracking-widest">CPA</span>
                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center bg-${color}-500/10`}>
                                    <Target className={`w-3.5 h-3.5 text-${color}-400`} />
                                </div>
                            </div>
                            <p className={`text-xl font-black tracking-tight font-mono text-${color}-400`}>{formatCurrency(val, 'COP')}</p>
                            <p className="text-[10px] text-muted mt-1 uppercase tracking-wider">Ads / Órdenes</p>
                        </div>
                    );
                })()}

                {/* CPE */}
                {(() => {
                    const val = kpis?.cpe || 0;
                    const color = val <= 30000 ? 'emerald' : val <= 50000 ? 'amber' : 'red';
                    return (
                        <div className="bg-card border border-card-border rounded-2xl p-4 hover:border-accent/30 transition-all shadow-sm">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] font-black text-muted uppercase tracking-widest">CPE</span>
                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center bg-${color}-500/10`}>
                                    <Target className={`w-3.5 h-3.5 text-${color}-400`} />
                                </div>
                            </div>
                            <p className={`text-xl font-black tracking-tight font-mono text-${color}-400`}>{formatCurrency(val, 'COP')}</p>
                            <p className="text-[10px] text-muted mt-1 uppercase tracking-wider">Ads / Entregadas</p>
                        </div>
                    );
                })()}

                {/* % Ads / Revenue */}
                {(() => {
                    const val = kpis?.perc_ads_revenue || 0;
                    const color = val <= 20 ? 'emerald' : val <= 30 ? 'amber' : 'red';
                    return (
                        <div className="bg-card border border-card-border rounded-2xl p-4 hover:border-accent/30 transition-all shadow-sm">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] font-black text-muted uppercase tracking-widest">% Ads/Rev</span>
                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center bg-${color}-500/10`}>
                                    <Percent className={`w-3.5 h-3.5 text-${color}-400`} />
                                </div>
                            </div>
                            <p className={`text-xl font-black tracking-tight font-mono text-${color}-400`}>{val.toFixed(1)}%</p>
                            <p className="text-[10px] text-muted mt-1 uppercase tracking-wider">Ads / Facturación</p>
                        </div>
                    );
                })()}

                {/* Utilidad por Entrega */}
                {(() => {
                    const val = kpis?.utilidad_por_entrega || 0;
                    const color = val > 10000 ? 'emerald' : val > 0 ? 'amber' : 'red';
                    return (
                        <div className="bg-card border border-card-border rounded-2xl p-4 hover:border-accent/30 transition-all shadow-sm">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] font-black text-muted uppercase tracking-widest">Util/Ent.</span>
                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center bg-${color}-500/10`}>
                                    <CircleDollarSign className={`w-3.5 h-3.5 text-${color}-400`} />
                                </div>
                            </div>
                            <p className={`text-xl font-black tracking-tight font-mono text-${color}-400`}>{formatCurrency(val, 'COP')}</p>
                            <p className="text-[10px] text-muted mt-1 uppercase tracking-wider">Ganancia / Entrega</p>
                        </div>
                    );
                })()}

                {/* Costo Devolución por Orden */}
                {(() => {
                    const val = kpis?.costo_dev_orden || 0;
                    const color = val <= 3000 ? 'emerald' : val <= 6000 ? 'amber' : 'red';
                    return (
                        <div className="bg-card border border-card-border rounded-2xl p-4 hover:border-accent/30 transition-all shadow-sm">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] font-black text-muted uppercase tracking-widest">Cost Dev/Ord</span>
                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center bg-${color}-500/10`}>
                                    <RotateCcw className={`w-3.5 h-3.5 text-${color}-400`} />
                                </div>
                            </div>
                            <p className={`text-xl font-black tracking-tight font-mono text-${color}-400`}>{formatCurrency(val, 'COP')}</p>
                            <p className="text-[10px] text-muted mt-1 uppercase tracking-wider">Flete Dev / Órdenes</p>
                        </div>
                    );
                })()}
            </div>

            {/* ===== SECTION 5: Top & Bottom Products ===== */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Top 5 Products */}
                <div className="bg-card border border-card-border rounded-2xl p-5 shadow-sm">
                    <h3 className="text-[11px] font-black text-muted uppercase tracking-widest mb-4 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        Top 5 Productos por Margen
                        <InfoTooltip text="Productos más rentables por margen de ganancia. Margen = (Ingreso - Costos) / Ingreso." />
                    </h3>
                    <div className="space-y-3">
                        {topProducts.length === 0 ? (
                            <p className="text-xs text-muted text-center py-8">Sin datos de productos</p>
                        ) : topProducts.map((p, i) => (
                            <div key={i} className="flex items-center justify-between p-3 bg-hover-bg rounded-xl border border-card-border hover:border-emerald-500/30 transition-all group">
                                <div className="space-y-1.5 overflow-hidden flex-1 min-w-0">
                                    <p className="text-sm font-bold text-foreground truncate tracking-tight group-hover:text-emerald-400 transition-colors" title={p.name}>
                                        {p.name}
                                    </p>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-[10px] font-bold text-muted bg-table-header-bg px-2 py-0.5 rounded uppercase tracking-wider font-mono">
                                            {p.count} pedidos
                                        </span>
                                    </div>
                                    <div className="w-full h-1.5 bg-card-border rounded-full overflow-hidden">
                                        <div
                                            className="h-full rounded-full bg-emerald-500 transition-all"
                                            style={{ width: `${Math.max(0, Math.min(100, p.margin))}%` }}
                                        />
                                    </div>
                                </div>
                                <div className="text-right ml-3 shrink-0">
                                    <p className={`text-lg font-black font-mono ${p.margin >= 20 ? 'text-emerald-400' : 'text-amber-400'}`}>
                                        {p.margin.toFixed(1)}%
                                    </p>
                                    <p className={`text-xs font-black font-mono ${p.profit >= 0 ? 'text-emerald-400/80' : 'text-red-400/80'}`}>
                                        {formatCurrency(p.profit, 'COP')}
                                    </p>
                                    <p className="text-[10px] font-bold text-muted uppercase tracking-wider">Ganancia</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Bottom 5 Products */}
                <div className="bg-card border border-card-border rounded-2xl p-5 shadow-sm">
                    <h3 className="text-[11px] font-black text-muted uppercase tracking-widest mb-4 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-400" />
                        5 Productos Menos Rentables
                        <InfoTooltip text="Productos con menor margen de ganancia. Identifica productos que podrían estar generando pérdidas." />
                    </h3>
                    <div className="space-y-3">
                        {bottomProducts.length === 0 ? (
                            <p className="text-xs text-muted text-center py-8">Sin datos de productos</p>
                        ) : bottomProducts.map((p, i) => (
                            <div key={i} className="flex items-center justify-between p-3 bg-hover-bg rounded-xl border border-card-border hover:border-red-500/30 transition-all group">
                                <div className="space-y-1.5 overflow-hidden flex-1 min-w-0">
                                    <p className="text-sm font-bold text-foreground truncate tracking-tight group-hover:text-red-400 transition-colors" title={p.name}>
                                        {p.name}
                                    </p>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-[10px] font-bold text-muted bg-table-header-bg px-2 py-0.5 rounded uppercase tracking-wider font-mono">
                                            {p.count} pedidos
                                        </span>
                                    </div>
                                    <div className="w-full h-1.5 bg-card-border rounded-full overflow-hidden">
                                        <div
                                            className="h-full rounded-full bg-red-500 transition-all"
                                            style={{ width: `${Math.max(0, Math.min(100, p.margin))}%` }}
                                        />
                                    </div>
                                </div>
                                <div className="text-right ml-3 shrink-0">
                                    <p className={`text-lg font-black font-mono ${p.margin < 0 ? 'text-red-400' : p.margin < 10 ? 'text-amber-400' : 'text-foreground'}`}>
                                        {p.margin.toFixed(1)}%
                                    </p>
                                    <p className={`text-xs font-black font-mono ${p.profit >= 0 ? 'text-amber-400/80' : 'text-red-400/80'}`}>
                                        {formatCurrency(p.profit, 'COP')}
                                    </p>
                                    <p className="text-[10px] font-bold text-muted uppercase tracking-wider">{p.profit >= 0 ? 'Ganancia' : 'Pérdida'}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ===== SECTION 6: Exchange Rate Footer ===== */}
            <div className="bg-blue-500/5 border border-blue-500/10 p-4 rounded-xl flex gap-3 items-center">
                <Info className="w-5 h-5 text-blue-400 shrink-0" />
                <p className="text-xs text-blue-400/80 leading-relaxed font-bold uppercase tracking-wider">
                    Valores en COP — TRM:
                    <span className="text-foreground ml-2">1 USD ≈ {formatCurrency(rates.COP_USD, 'COP')}</span>
                    {rates.COP_GTQ > 0 && (
                        <>
                            <span className="mx-2 text-muted">|</span>
                            <span className="text-foreground">1 GTQ ≈ {formatCurrency(rates.COP_GTQ, 'COP')}</span>
                        </>
                    )}
                </p>
            </div>
        </div>
    );
}
