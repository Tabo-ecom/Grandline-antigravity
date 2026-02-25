'use client';

import React, { useMemo } from 'react';
import { useCountryData } from '@/lib/hooks/useCountryData';
import { useGlobalFilters } from '@/lib/context/FilterContext';
import FilterHeader from '@/components/FilterHeader';
import { formatCurrency, formatDualCurrency } from '@/lib/utils/currency';
import { DropiOrder } from '@/lib/calculations/kpis';
import { calculateKPIs } from '@/lib/calculations/kpis';
import InfoTooltip from '@/components/common/InfoTooltip';
import {
    CircleDollarSign,
    TrendingUp,
    Receipt,
    Truck,
    Scale,
    Loader2,
    Info,
    ArrowUpRight,
    BarChart3,
} from 'lucide-react';
import { isEntregado, isDevolucion } from '@/lib/utils/status';
import { parseISO, subDays, startOfDay, endOfDay, startOfMonth, subMonths } from 'date-fns';

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

export default function CountryPLPage() {
    const {
        loading, rates, countryOrders,
        localCurrency, countryName,
        calculatedAdSpend,
    } = useCountryData();

    const { dateRange, startDateCustom, endDateCustom, selectedProduct } = useGlobalFilters();

    // Apply global filters
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

    if (loading || !rates) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4">
                <Loader2 className="w-8 h-8 text-accent animate-spin" />
                <p className="text-muted font-mono text-[10px] tracking-widest uppercase">Analizando P&L Territorial...</p>
            </div>
        );
    }

    const dualReal = formatDualCurrency(kpis?.ing_real || 0, localCurrency, rates);
    const dualCost = formatDualCurrency(kpis?.cpr || 0, localCurrency, rates);
    const dualFlEnt = formatDualCurrency(kpis?.fl_ent || 0, localCurrency, rates);
    const dualFlDev = formatDualCurrency(kpis?.fl_dev || 0, localCurrency, rates);
    const dualFlTra = formatDualCurrency(kpis?.fl_tra || 0, localCurrency, rates);
    const dualAds = formatDualCurrency(kpis?.g_ads || 0, localCurrency, rates);
    const dualProfit = formatDualCurrency(kpis?.u_real || 0, localCurrency, rates);

    const marginPerc = kpis?.ing_real ? (kpis.u_real / kpis.ing_real) * 100 : 0;

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Floating Filter Header */}
            <FilterHeader
                availableProducts={availableProducts}
                availableCountries={[countryName]}
                title={`${countryName} — P&L`}
                icon={BarChart3}
            />

            {/* P&L Breakdown Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Gross Income Card */}
                <div className="bg-card p-8 rounded-3xl border border-card-border relative overflow-hidden group shadow-xl">
                    <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                        <TrendingUp className="w-32 h-32" />
                    </div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                                <Receipt className="w-5 h-5 text-emerald-400" />
                            </div>
                            <h3 className="text-xs font-bold text-muted uppercase tracking-widest flex items-center gap-1.5">Ingresos Entregados <InfoTooltip text="Total facturado de órdenes con estado 'Entregado'. Es el flujo de caja efectivamente realizado." /></h3>
                        </div>
                        <div className="space-y-2">
                            <h2 className="text-4xl font-black text-foreground font-mono tracking-tight">{dualReal.primary}</h2>
                            <p className="text-sm font-bold text-muted font-mono italic">{dualReal.secondary}</p>
                        </div>
                        <div className="mt-6 pt-6 border-t border-card-border flex items-center gap-2">
                            <ArrowUpRight className="w-4 h-4 text-emerald-400" />
                            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wide">Flujo de Caja Realizado</span>
                        </div>
                    </div>
                </div>

                {/* Logistics Cost Card */}
                <div className="bg-card p-8 rounded-3xl border border-card-border relative overflow-hidden group shadow-xl">
                    <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                        <Truck className="w-32 h-32" />
                    </div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                                <Truck className="w-5 h-5 text-blue-400" />
                            </div>
                            <h3 className="text-xs font-bold text-muted uppercase tracking-widest flex items-center gap-1.5">Costo Logístico Total <InfoTooltip text="Suma de fletes de entregas, devoluciones y órdenes en tránsito. Incluye todos los costos de transporte." /></h3>
                        </div>
                        <div className="space-y-2">
                            <h2 className="text-4xl font-black text-foreground font-mono tracking-tight">{formatCurrency((kpis?.fl_ent || 0) + (kpis?.fl_dev || 0) + (kpis?.fl_tra || 0), 'COP')}</h2>
                            <p className="text-sm font-bold text-muted font-mono italic">Entregas + Devoluciones + Tránsito</p>
                        </div>
                        <div className="mt-6 space-y-3">
                            <div className="flex justify-between text-xs font-bold">
                                <span className="text-muted">ENTREGAS</span>
                                <span className="text-foreground/70 font-mono">{dualFlEnt.secondary}</span>
                            </div>
                            <div className="flex justify-between text-xs font-bold">
                                <span className="text-muted">DEVOLUCIONES</span>
                                <span className="text-orange-400/80 font-mono">{dualFlDev.secondary}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Net Profit Card */}
                <div className="bg-card p-8 rounded-3xl border border-card-border relative overflow-hidden group border-l-4 border-l-accent shadow-xl">
                    <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                        <CircleDollarSign className="w-32 h-32" />
                    </div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center border border-accent/20">
                                <CircleDollarSign className="w-5 h-5 text-accent" />
                            </div>
                            <h3 className="text-xs font-bold text-muted uppercase tracking-widest flex items-center gap-1.5">Utilidad Real (EBITDA) <InfoTooltip text="Ganancia real: ingreso entregado menos costo de producto, fletes y publicidad. No incluye impuestos ni depreciación." /></h3>
                        </div>
                        <div className="space-y-2">
                            <h2 className={`text-4xl font-black font-mono tracking-tight ${kpis?.u_real! >= 0 ? 'text-emerald-400' : 'text-red-500'}`}>
                                {dualProfit.primary}
                            </h2>
                            <p className="text-sm font-bold text-muted font-mono italic">{dualProfit.secondary}</p>
                        </div>
                        <div className="mt-6 pt-6 border-t border-card-border flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Scale className="w-4 h-4 text-muted" />
                                <span className="text-xs font-bold text-muted uppercase tracking-wide">Margen</span>
                            </div>
                            <span className={`text-lg font-black font-mono ${marginPerc >= 20 ? 'text-emerald-400' : marginPerc >= 10 ? 'text-amber-400' : 'text-red-400'}`}>
                                {marginPerc.toFixed(1)}%
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Detailed Financial List */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Waterfall Analysis */}
                <div className="bg-card rounded-3xl border border-card-border p-8 space-y-8 shadow-xl">
                    <h3 className="text-xs font-bold text-foreground uppercase tracking-[0.2em] mb-4 flex items-center gap-1.5">Cascada de Gastos ({localCurrency}) <InfoTooltip text="Descomposición visual de cómo se distribuye el ingreso bruto entre los diferentes costos operativos." /></h3>
                    <div className="space-y-8">
                        {[
                            { label: 'Ingreso Bruto', val: dualReal.secondary, perc: 100, color: 'bg-emerald-500' },
                            { label: 'Costo Producto', val: `-${dualCost.secondary}`, perc: (kpis?.cpr! / kpis?.ing_real!) * 100, color: 'bg-red-400' },
                            { label: 'Fletes Entrega', val: `-${dualFlEnt.secondary}`, perc: (kpis?.fl_ent! / kpis?.ing_real!) * 100, color: 'bg-blue-400' },
                            { label: 'Fletes Devolución', val: `-${dualFlDev.secondary}`, perc: (kpis?.fl_dev! / kpis?.ing_real!) * 100, color: 'bg-orange-400' },
                            { label: 'Fletes en Tránsito', val: `-${dualFlTra.secondary}`, perc: (kpis?.fl_tra! / kpis?.ing_real!) * 100, color: 'bg-cyan-400' },
                            { label: 'Publicidad (Ads)', val: `-${dualAds.secondary}`, perc: (kpis?.g_ads! / kpis?.ing_real!) * 100, color: 'bg-accent' },
                        ].map((item, i) => (
                            <div key={i} className="space-y-3">
                                <div className="flex justify-between items-end">
                                    <div className="space-y-1">
                                        <p className="text-xs font-bold text-muted uppercase tracking-wide">{item.label}</p>
                                        <p className="text-lg font-bold text-foreground font-mono">{item.val}</p>
                                    </div>
                                    <span className="text-xs font-bold text-muted font-mono bg-hover-bg px-2 py-1 rounded-lg">
                                        {i === 0 ? 'BASE' : `${item.perc.toFixed(1)}%`}
                                    </span>
                                </div>
                                <div className="h-2 bg-hover-bg rounded-full overflow-hidden">
                                    <div className={`h-full ${item.color} opacity-80`} style={{ width: `${Math.min(100, item.perc)}%` }}></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Top Products by Profit Margin */}
                <div className="bg-card rounded-xl border border-card-border p-8 relative overflow-hidden">
                    <h3 className="text-xs font-bold text-muted uppercase tracking-widest mb-6 flex items-center gap-1.5">Eficiencia por Producto <InfoTooltip text="Top 5 productos por margen de ganancia. Muestra qué productos son más rentables después de todos los costos." /></h3>
                    <div className="space-y-4">
                        {(() => {
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
                                    const count = orders.length;

                                    return { name, margin, profit, count, income };
                                })
                                .filter(p => p.income > 0)
                                .sort((a, b) => b.margin - a.margin)
                                .slice(0, 5)
                                .map((p, i) => (
                                    <div key={i} className="flex items-center justify-between p-4 bg-hover-bg rounded-xl border border-card-border hover:border-muted/30 transition-all group">
                                        <div className="space-y-1 overflow-hidden">
                                            <p className="text-sm font-bold text-foreground truncate tracking-tight group-hover:text-emerald-400 transition-colors">
                                                {p.name}
                                            </p>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold text-muted bg-table-header-bg px-2 py-1 rounded uppercase tracking-wider">
                                                    {p.count} Pedidos
                                                </span>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className={`text-sm font-black font-mono ${p.margin >= 20 ? 'text-emerald-400' : 'text-amber-400'}`}>
                                                {p.margin.toFixed(1)}%
                                            </p>
                                            <p className="text-[10px] font-bold text-muted font-mono uppercase tracking-wider">Margen</p>
                                        </div>
                                    </div>
                                ));
                        })()}
                    </div>
                </div>
            </div>

            {/* Note about TRM */}
            <div className="bg-blue-500/5 border border-blue-500/10 p-4 rounded-xl flex gap-3 items-center">
                <Info className="w-5 h-5 text-blue-400 shrink-0" />
                <p className="text-xs text-blue-400/80 leading-relaxed font-bold uppercase tracking-wider">
                    Los valores en COP son calculados basados en la TRM del día:
                    <span className="text-foreground ml-2">1 USD ≈ {formatCurrency(rates.COP_USD, 'COP')}</span>
                    <span className="mx-2 text-muted">|</span>
                    <span className="text-foreground">1 GTQ ≈ {formatCurrency(rates.COP_GTQ, 'COP')}</span>
                </p>
            </div>
        </div>
    );
}
