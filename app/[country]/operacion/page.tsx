'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useCountryData } from '@/lib/hooks/useCountryData';
import { useGlobalFilters } from '@/lib/context/FilterContext';
import FilterHeader from '@/components/FilterHeader';
import { formatDualCurrency, formatCurrency } from '@/lib/utils/currency';
import { DropiOrder } from '@/lib/calculations/kpis';
import { aggregateByDepartment, aggregateByCityInDepartment } from '@/lib/calculations/geo';
import { getCountryCode } from '@/lib/data/geo/departments';
import { CountryMap } from '@/components/territories/CountryMap';
import type { MetricType } from '@/components/territories/CountryMap';
import { listCarriers, saveCarrier, deleteCarrier, TerritoryCarrier } from '@/lib/firebase/firestore';
import {
    TrendingUp,
    Package,
    CheckCircle2,
    XCircle,
    Truck,
    RotateCcw,
    Loader2,
    MapPin,
    X,
    ChevronDown,
    ChevronRight,
    ChevronUp,
    BarChart3,
    Activity,
    AlertTriangle,
    Plus,
    Trash2,
    Save,
    Clock,
} from 'lucide-react';
import { isEntregado, isCancelado, isTransit, isDevolucion } from '@/lib/utils/status';
import { parseISO, subDays, startOfDay, endOfDay, startOfMonth, subMonths } from 'date-fns';

// Color scale helper for delivery rate
function deliveryColor(rate: number): string {
    if (rate >= 80) return 'text-emerald-400';
    if (rate >= 65) return 'text-amber-400';
    return 'text-red-400';
}
function deliveryBg(rate: number): string {
    if (rate >= 80) return 'bg-emerald-500/10 border-emerald-500/20';
    if (rate >= 65) return 'bg-amber-500/10 border-amber-500/20';
    return 'bg-red-500/10 border-red-500/20';
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

type SortKey = 'name' | 'totalOrders' | 'entregados' | 'devoluciones' | 'tasaEntrega' | 'fletePromedio';
type SortDir = 'asc' | 'desc';
type ProdSortKey = 'name' | 'total' | 'ent' | 'percEnt' | 'can' | 'facturado';

export default function CountryOperationPage() {
    const {
        loading, rates, countryOrders,
        localCurrency, countryName,
    } = useCountryData();

    const { dateRange, startDateCustom, endDateCustom, selectedProduct } = useGlobalFilters();

    // Map state
    const [activeMetric, setActiveMetric] = useState<MetricType>('tasaEntrega');
    const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);

    // Collapsible + sort state
    const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
    const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set());
    const [deptSort, setDeptSort] = useState<{ key: SortKey; dir: SortDir }>({ key: 'totalOrders', dir: 'desc' });
    const [prodSort, setProdSort] = useState<{ key: ProdSortKey; dir: SortDir }>({ key: 'total', dir: 'desc' });

    // Carrier state
    const [carriers, setCarriers] = useState<TerritoryCarrier[]>([]);
    const [loadingCarriers, setLoadingCarriers] = useState(true);
    const [showCarrierForm, setShowCarrierForm] = useState(false);
    const [editingCarrier, setEditingCarrier] = useState<TerritoryCarrier | null>(null);
    const [carrierForm, setCarrierForm] = useState({
        carrierName: '', coverageCities: '', avgDeliveryDays: 3, costPerKg: 0, isActive: true,
    });

    const countryCode = getCountryCode(countryName);

    // Load carriers
    useEffect(() => {
        listCarriers(countryCode).then(setCarriers).catch(console.error).finally(() => setLoadingCarriers(false));
    }, [countryCode]);

    async function handleSaveCarrier() {
        const carrier: TerritoryCarrier = {
            ...(editingCarrier?.id ? { id: editingCarrier.id } : {}),
            carrierName: carrierForm.carrierName,
            country: countryCode,
            coverageCities: carrierForm.coverageCities.split(',').map(c => c.trim()).filter(Boolean),
            avgDeliveryDays: carrierForm.avgDeliveryDays,
            costPerKg: carrierForm.costPerKg,
            isActive: carrierForm.isActive,
        };
        await saveCarrier(carrier);
        const data = await listCarriers(countryCode);
        setCarriers(data);
        resetCarrierForm();
    }

    async function handleDeleteCarrier(id: string) {
        await deleteCarrier(id);
        const data = await listCarriers(countryCode);
        setCarriers(data);
    }

    function resetCarrierForm() {
        setShowCarrierForm(false);
        setEditingCarrier(null);
        setCarrierForm({ carrierName: '', coverageCities: '', avgDeliveryDays: 3, costPerKg: 0, isActive: true });
    }

    function startEditCarrier(carrier: TerritoryCarrier) {
        setEditingCarrier(carrier);
        setCarrierForm({
            carrierName: carrier.carrierName,
            coverageCities: carrier.coverageCities.join(', '),
            avgDeliveryDays: carrier.avgDeliveryDays,
            costPerKg: carrier.costPerKg,
            isActive: carrier.isActive,
        });
        setShowCarrierForm(true);
    }

    // Apply global filters: date + product
    const filteredOrders = useMemo(() => {
        let orders = filterByGlobalDate(countryOrders, dateRange, startDateCustom, endDateCustom);
        if (selectedProduct && selectedProduct !== 'Todos') {
            orders = orders.filter(o => o.PRODUCTO === selectedProduct);
        }
        return orders;
    }, [countryOrders, dateRange, startDateCustom, endDateCustom, selectedProduct]);

    // Available products
    const availableProducts = useMemo(() => {
        const products = new Set<string>();
        countryOrders.forEach(o => { if (o.PRODUCTO) products.add(o.PRODUCTO); });
        return ['Todos', ...Array.from(products).sort()];
    }, [countryOrders]);

    // Status stats (cancelado separate from the 100%)
    const statusStats = useMemo(() => {
        const entregados = filteredOrders.filter(o => isEntregado(o.ESTATUS)).length;
        const cancelados = filteredOrders.filter(o => isCancelado(o.ESTATUS)).length;
        const transito = filteredOrders.filter(o => isTransit(o.ESTATUS)).length;
        const devoluciones = filteredOrders.filter(o => isDevolucion(o.ESTATUS)).length;
        const total = filteredOrders.length || 1;
        const noCancelados = total - cancelados || 1;
        return {
            entregados, cancelados, transito, devoluciones, total, noCancelados,
            percents: {
                entregados: (entregados / noCancelados) * 100,
                transito: (transito / noCancelados) * 100,
                devoluciones: (devoluciones / noCancelados) * 100,
                cancelados: (cancelados / total) * 100,
            }
        };
    }, [filteredOrders]);

    // Recaudo stats
    const recaudoStats = useMemo(() => {
        const total = filteredOrders.length || 1;
        const conRecaudo = filteredOrders.filter(o => {
            const r = (o.RECAUDO || '').toLowerCase().trim();
            return r && r !== '' && r !== 'sin recaudo' && r !== 'no' && r !== 'undefined' && r !== 'null';
        }).length;
        const sinRecaudo = total - conRecaudo;
        return {
            conRecaudo,
            sinRecaudo,
            percConRecaudo: (conRecaudo / total) * 100,
            percSinRecaudo: (sinRecaudo / total) * 100,
        };
    }, [filteredOrders]);

    // Auto-detect transportadoras from order data
    const autoCarrierKpis = useMemo(() => {
        const carrierMap = new Map<string, DropiOrder[]>();
        for (const o of filteredOrders) {
            const t = (o.TRANSPORTADORA || '').trim();
            if (!t || t === 'undefined' || t === 'null') continue;
            const key = t.toUpperCase();
            if (!carrierMap.has(key)) carrierMap.set(key, []);
            carrierMap.get(key)!.push(o);
        }
        return Array.from(carrierMap.entries()).map(([name, orders]) => {
            const total = orders.length;
            const ent = orders.filter(o => isEntregado(o.ESTATUS)).length;
            const dev = orders.filter(o => isDevolucion(o.ESTATUS)).length;
            const tra = orders.filter(o => isTransit(o.ESTATUS)).length;
            const can = orders.filter(o => isCancelado(o.ESTATUS)).length;
            const nc = total - can || 1;
            const flete = orders.reduce((s, o) => s + (o['PRECIO FLETE'] || 0), 0);
            return {
                name,
                total,
                ent,
                dev,
                tra,
                can,
                tasaEntrega: (ent / nc) * 100,
                tasaDevolucion: nc > 0 ? (dev / nc) * 100 : 0,
                fleteProm: total > 0 ? flete / total : 0,
            };
        }).sort((a, b) => b.total - a.total);
    }, [filteredOrders]);

    // Department metrics
    const departmentMetrics = useMemo(() => {
        if (filteredOrders.length === 0) return [];
        return aggregateByDepartment(filteredOrders, countryCode);
    }, [filteredOrders, countryCode]);

    // City breakdown for selected dept
    const cityBreakdown = useMemo(() => {
        if (!selectedDepartment || filteredOrders.length === 0) return [];
        return aggregateByCityInDepartment(filteredOrders, selectedDepartment, countryCode);
    }, [selectedDepartment, filteredOrders, countryCode]);

    const selectedDeptMetrics = selectedDepartment
        ? departmentMetrics.find(d => d.code === selectedDepartment)
        : null;

    // Global city stats for default panel
    const globalCityStats = useMemo(() => {
        const cityMap = new Map<string, DropiOrder[]>();
        for (const o of filteredOrders) {
            const city = (o.CIUDAD || o['CIUDAD DESTINO'] || '').trim();
            if (!city) continue;
            const key = city.toLowerCase();
            if (!cityMap.has(key)) cityMap.set(key, []);
            cityMap.get(key)!.push(o);
        }
        const all = Array.from(cityMap.entries()).map(([, orders]) => {
            const name = orders[0].CIUDAD || orders[0]['CIUDAD DESTINO'] || 'Desconocida';
            const total = orders.length;
            const ent = orders.filter(o => isEntregado(o.ESTATUS)).length;
            const can = orders.filter(o => isCancelado(o.ESTATUS)).length;
            const nc = total - can || 1;
            return { city: name, total, ent, can, tasaEntrega: (ent / nc) * 100 };
        }).filter(c => c.total >= 3); // minimum 3 orders to be relevant
        const bestDelivery = [...all].sort((a, b) => b.tasaEntrega - a.tasaEntrega).slice(0, 5);
        const worstDelivery = [...all].sort((a, b) => a.tasaEntrega - b.tasaEntrega).slice(0, 5);
        const mostCancelled = [...all].sort((a, b) => b.can - a.can).slice(0, 5);
        return { bestDelivery, worstDelivery, mostCancelled };
    }, [filteredOrders]);

    // Product breakdown
    const productBreakdown = useMemo(() => {
        const productsMap: Record<string, DropiOrder[]> = {};
        filteredOrders.forEach(o => {
            const p = o.PRODUCTO || 'Desconocido';
            if (!productsMap[p]) productsMap[p] = [];
            productsMap[p].push(o);
        });
        return Object.entries(productsMap).map(([name, orders]) => {
            const ent = orders.filter(o => isEntregado(o.ESTATUS)).length;
            const can = orders.filter(o => isCancelado(o.ESTATUS)).length;
            const tra = orders.filter(o => isTransit(o.ESTATUS)).length;
            const dev = orders.filter(o => isDevolucion(o.ESTATUS)).length;
            const nc = orders.length - can || 1;
            const percEnt = (ent / nc) * 100;
            const facturado = orders.filter(o => isEntregado(o.ESTATUS)).reduce((sum, o) => sum + (o["TOTAL DE LA ORDEN"] || 0), 0);
            const fleteTotal = orders.reduce((sum, o) => sum + (o["PRECIO FLETE"] || 0), 0);
            return { name, total: orders.length, ent, can, tra, dev, percEnt, facturado, fleteTotal, orders };
        });
    }, [filteredOrders]);

    // Sorted department metrics
    const sortedDepts = useMemo(() => {
        const sorted = [...departmentMetrics];
        sorted.sort((a, b) => {
            const av = a[deptSort.key] as number | string;
            const bv = b[deptSort.key] as number | string;
            if (typeof av === 'string') return deptSort.dir === 'asc' ? (av as string).localeCompare(bv as string) : (bv as string).localeCompare(av as string);
            return deptSort.dir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number);
        });
        return sorted;
    }, [departmentMetrics, deptSort]);

    // Sorted products
    const sortedProducts = useMemo(() => {
        const sorted = [...productBreakdown];
        sorted.sort((a, b) => {
            const av = a[prodSort.key] as number | string;
            const bv = b[prodSort.key] as number | string;
            if (typeof av === 'string') return prodSort.dir === 'asc' ? (av as string).localeCompare(bv as string) : (bv as string).localeCompare(av as string);
            return prodSort.dir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number);
        });
        return sorted;
    }, [productBreakdown, prodSort]);

    // Carrier KPIs from orders
    const carrierKpis = useMemo(() => {
        // We match carrier coverage cities to order cities
        return carriers.map(carrier => {
            const coverageSet = new Set(carrier.coverageCities.map(c => c.toLowerCase().trim()));
            const matchingOrders = filteredOrders.filter(o => {
                const city = (o.CIUDAD || o['CIUDAD DESTINO'] || '').toLowerCase().trim();
                return coverageSet.has(city);
            });
            const total = matchingOrders.length;
            const ent = matchingOrders.filter(o => isEntregado(o.ESTATUS)).length;
            const dev = matchingOrders.filter(o => isDevolucion(o.ESTATUS)).length;
            const tra = matchingOrders.filter(o => isTransit(o.ESTATUS)).length;
            const can = matchingOrders.filter(o => isCancelado(o.ESTATUS)).length;
            const nc = total - can || 1;
            const flete = matchingOrders.reduce((s, o) => s + (o['PRECIO FLETE'] || 0), 0);
            return {
                ...carrier,
                kpi: {
                    total, ent, dev, tra,
                    tasaEntrega: (ent / nc) * 100,
                    tasaDevolucion: nc > 0 ? (dev / nc) * 100 : 0,
                    fleteProm: total > 0 ? flete / total : 0,
                }
            };
        });
    }, [carriers, filteredOrders]);

    const totalFacturado = useMemo(() =>
        filteredOrders.filter(o => isEntregado(o.ESTATUS)).reduce((sum, o) => sum + (o["TOTAL DE LA ORDEN"] || 0), 0),
    [filteredOrders]);

    const avgFlete = useMemo(() => {
        if (filteredOrders.length === 0) return 0;
        return filteredOrders.reduce((sum, o) => sum + (o["PRECIO FLETE"] || 0), 0) / filteredOrders.length;
    }, [filteredOrders]);

    const toggleProduct = (name: string) => {
        setExpandedProducts(prev => { const n = new Set(prev); if (n.has(name)) n.delete(name); else n.add(name); return n; });
    };
    const toggleDept = (code: string) => {
        setExpandedDepts(prev => { const n = new Set(prev); if (n.has(code)) n.delete(code); else n.add(code); return n; });
    };

    function toggleDeptSort(key: SortKey) {
        setDeptSort(prev => prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' });
    }
    function toggleProdSort(key: ProdSortKey) {
        setProdSort(prev => prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' });
    }

    function SortIcon({ sortKey, currentSort }: { sortKey: string; currentSort: { key: string; dir: SortDir } }) {
        if (currentSort.key !== sortKey) return <ChevronDown className="w-3 h-3 text-muted/30 inline ml-1" />;
        return currentSort.dir === 'desc'
            ? <ChevronDown className="w-3 h-3 text-accent inline ml-1" />
            : <ChevronUp className="w-3 h-3 text-accent inline ml-1" />;
    }

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4">
                <Loader2 className="w-8 h-8 text-accent animate-spin" />
                <p className="text-muted font-mono text-[10px] tracking-widest uppercase">Cargando Operación...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-700">
            {/* Floating Filter Header */}
            <FilterHeader
                availableProducts={availableProducts}
                availableCountries={[countryName]}
                title={countryName}
                icon={Activity}
            />

            {/* === ROW 1: Unified — Status Bar + City Summary (ABOVE map) === */}
            <div className="bg-card rounded-2xl border border-card-border shadow-lg overflow-hidden">
                {/* Status Distribution Bar */}
                <div className="p-5 border-b border-card-border">
                    <p className="text-xs font-bold text-muted uppercase tracking-widest mb-3">Distribución de Estados <span className="text-muted/50">(sin cancelados)</span></p>
                    <div className="flex h-9 rounded-lg overflow-hidden gap-0.5 mb-3">
                        {[
                            { label: 'Entregado', count: statusStats.entregados, perc: statusStats.percents.entregados, bg: 'bg-emerald-500' },
                            { label: 'En Tránsito', count: statusStats.transito, perc: statusStats.percents.transito, bg: 'bg-blue-500' },
                            { label: 'Devolución', count: statusStats.devoluciones, perc: statusStats.percents.devoluciones, bg: 'bg-orange-500' },
                        ].map((s, i) => {
                            const width = Math.max(s.perc, s.count > 0 ? 3 : 0);
                            return (
                                <div key={i} className={`${s.bg} relative transition-all hover:brightness-110`}
                                    style={{ width: `${width}%` }}
                                    title={`${s.label}: ${s.count} (${s.perc.toFixed(1)}%)`}>
                                    {width > 10 && (
                                        <span className="absolute inset-0 flex items-center justify-center text-xs font-black text-white/90">
                                            {s.perc.toFixed(0)}%
                                        </span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                    <div className="flex flex-wrap items-center gap-5">
                        {[
                            { label: 'Entregado', count: statusStats.entregados, perc: statusStats.percents.entregados, color: 'bg-emerald-500', textColor: deliveryColor(statusStats.percents.entregados) },
                            { label: 'En Tránsito', count: statusStats.transito, perc: statusStats.percents.transito, color: 'bg-blue-500', textColor: 'text-blue-400' },
                            { label: 'Devolución', count: statusStats.devoluciones, perc: statusStats.percents.devoluciones, color: 'bg-orange-500', textColor: statusStats.percents.devoluciones > 15 ? 'text-red-400' : 'text-orange-400' },
                        ].map((s, i) => (
                            <div key={i} className="flex items-center gap-2">
                                <div className={`w-2.5 h-2.5 rounded-full ${s.color}`} />
                                <span className="text-xs text-muted font-semibold">{s.label}:</span>
                                <span className={`text-xs font-black font-mono ${s.textColor}`}>{s.count.toLocaleString()}</span>
                                <span className={`text-xs font-semibold font-mono ${s.textColor}`}>({s.perc.toFixed(1)}%)</span>
                            </div>
                        ))}
                        <div className="flex items-center gap-2 ml-auto pl-4 border-l border-card-border">
                            <XCircle className="w-3.5 h-3.5 text-red-400" />
                            <span className="text-xs text-muted font-semibold">Cancelados:</span>
                            <span className="text-xs font-black font-mono text-red-400">{statusStats.cancelados.toLocaleString()}</span>
                            <span className="text-xs font-semibold font-mono text-red-400/70">({statusStats.percents.cancelados.toFixed(1)}% del total)</span>
                        </div>
                    </div>
                </div>

                {/* Department Detail OR City Summary — same card */}
                <div className="p-5 max-h-[340px] overflow-y-auto custom-scrollbar">
                    {selectedDeptMetrics ? (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-base font-black text-foreground uppercase tracking-tight">{selectedDeptMetrics.name}</h3>
                                    <p className="text-xs text-muted font-mono uppercase tracking-widest">{selectedDeptMetrics.code}</p>
                                </div>
                                <button onClick={() => setSelectedDepartment(null)} className="p-1.5 rounded-lg bg-hover-bg text-muted hover:text-foreground transition-colors">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="grid grid-cols-4 gap-3">
                                {[
                                    { label: 'Órdenes', value: selectedDeptMetrics.totalOrders.toLocaleString(), color: 'text-foreground' },
                                    { label: '% Entrega', value: `${selectedDeptMetrics.tasaEntrega.toFixed(1)}%`, color: deliveryColor(selectedDeptMetrics.tasaEntrega) },
                                    { label: '% Devolución', value: `${selectedDeptMetrics.tasaDevolucion.toFixed(1)}%`, color: selectedDeptMetrics.tasaDevolucion <= 10 ? 'text-emerald-400' : 'text-orange-400' },
                                    { label: 'Flete Prom', value: formatCurrency(selectedDeptMetrics.fletePromedio, 'COP'), color: 'text-cyan-400' },
                                ].map((stat, i) => (
                                    <div key={i} className="bg-hover-bg rounded-lg p-3">
                                        <p className="text-xs font-bold text-muted uppercase tracking-widest">{stat.label}</p>
                                        <p className={`text-base font-black font-mono ${stat.color}`}>{stat.value}</p>
                                    </div>
                                ))}
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                {cityBreakdown.map((city, i) => (
                                    <div key={i} className="flex items-center justify-between p-2.5 bg-hover-bg rounded-lg">
                                        <div className="min-w-0 flex-1">
                                            <p className="text-xs font-bold text-foreground/80 uppercase truncate">{city.city}</p>
                                            <p className="text-xs text-muted font-mono">{city.totalOrders} órd</p>
                                        </div>
                                        <span className={`text-sm font-black font-mono ${deliveryColor(city.tasaEntrega)} shrink-0 ml-2`}>{city.tasaEntrega.toFixed(0)}%</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {/* Worst delivery */}
                            <div>
                                <div className="flex items-center gap-2 mb-3">
                                    <AlertTriangle className="w-4 h-4 text-red-400" />
                                    <p className="text-xs font-bold text-red-400 uppercase tracking-widest">Peor Entrega</p>
                                </div>
                                {globalCityStats.worstDelivery.map((c, i) => (
                                    <div key={i} className="flex items-center justify-between py-1.5 border-b border-card-border/50 last:border-0">
                                        <span className="text-xs font-medium text-foreground/70 uppercase truncate max-w-[140px]">{c.city}</span>
                                        <div className="flex items-center gap-2">
                                            <span className={`text-xs font-black font-mono ${deliveryColor(c.tasaEntrega)}`}>{c.tasaEntrega.toFixed(0)}%</span>
                                            <span className="text-xs text-muted font-mono">({c.total})</span>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Best delivery */}
                            <div>
                                <div className="flex items-center gap-2 mb-3">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                    <p className="text-xs font-bold text-emerald-400 uppercase tracking-widest">Mejor Entrega</p>
                                </div>
                                {globalCityStats.bestDelivery.map((c, i) => (
                                    <div key={i} className="flex items-center justify-between py-1.5 border-b border-card-border/50 last:border-0">
                                        <span className="text-xs font-medium text-foreground/70 uppercase truncate max-w-[140px]">{c.city}</span>
                                        <div className="flex items-center gap-2">
                                            <span className={`text-xs font-black font-mono ${deliveryColor(c.tasaEntrega)}`}>{c.tasaEntrega.toFixed(0)}%</span>
                                            <span className="text-xs text-muted font-mono">({c.total})</span>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Most cancelled */}
                            <div>
                                <div className="flex items-center gap-2 mb-3">
                                    <XCircle className="w-4 h-4 text-red-400" />
                                    <p className="text-xs font-bold text-red-400/80 uppercase tracking-widest">Más Cancelados</p>
                                </div>
                                {globalCityStats.mostCancelled.map((c, i) => (
                                    <div key={i} className="flex items-center justify-between py-1.5 border-b border-card-border/50 last:border-0">
                                        <span className="text-xs font-medium text-foreground/70 uppercase truncate max-w-[140px]">{c.city}</span>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-black font-mono text-red-400">{c.can}</span>
                                            <span className="text-xs text-muted font-mono">({c.total} total)</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* === ROW 2: KPIs lateral + Map === */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                {/* KPI Sidebar */}
                <div className="lg:col-span-1 grid grid-cols-3 lg:grid-cols-2 gap-2.5">
                    {[
                        { label: 'Órdenes', value: statusStats.total.toLocaleString(), icon: Package, gradient: 'from-blue-500/20 to-blue-600/5', text: 'text-blue-400', border: 'border-blue-500/20' },
                        { label: 'Facturación', value: rates ? formatDualCurrency(totalFacturado, localCurrency, rates).primary : '—', icon: TrendingUp, gradient: 'from-emerald-500/20 to-emerald-600/5', text: 'text-emerald-400', border: 'border-emerald-500/20' },
                        { label: 'Entrega', value: `${statusStats.percents.entregados.toFixed(1)}%`, icon: CheckCircle2, gradient: deliveryBg(statusStats.percents.entregados).replace('bg-', 'from-').replace('/10', '/20').split(' ')[0] + ' to-transparent', text: deliveryColor(statusStats.percents.entregados), border: deliveryBg(statusStats.percents.entregados).split(' ')[1] || 'border-card-border' },
                        { label: 'Devolución', value: `${statusStats.percents.devoluciones.toFixed(1)}%`, icon: RotateCcw, gradient: 'from-orange-500/20 to-orange-600/5', text: 'text-orange-400', border: 'border-orange-500/20' },
                        { label: 'Con Recaudo', value: `${recaudoStats.percConRecaudo.toFixed(1)}%`, icon: CheckCircle2, gradient: 'from-violet-500/20 to-violet-600/5', text: 'text-violet-400', border: 'border-violet-500/20' },
                        { label: 'Sin Recaudo', value: `${recaudoStats.percSinRecaudo.toFixed(1)}%`, icon: XCircle, gradient: 'from-rose-500/20 to-rose-600/5', text: 'text-rose-400', border: 'border-rose-500/20' },
                        { label: 'Tránsito', value: statusStats.transito.toLocaleString(), icon: Truck, gradient: 'from-indigo-500/20 to-indigo-600/5', text: 'text-indigo-400', border: 'border-indigo-500/20' },
                        { label: 'Flete Prom', value: formatCurrency(avgFlete, 'COP'), icon: BarChart3, gradient: 'from-cyan-500/20 to-cyan-600/5', text: 'text-cyan-400', border: 'border-cyan-500/20' },
                    ].map((stat, i) => (
                        <div key={i} className={`relative overflow-hidden bg-gradient-to-br ${stat.gradient} px-3 py-3 rounded-xl border ${stat.border}`}>
                            <stat.icon className={`absolute -right-1 -top-1 w-10 h-10 ${stat.text} opacity-[0.07]`} />
                            <p className="text-xs font-bold text-muted uppercase tracking-widest">{stat.label}</p>
                            <p className={`text-base font-black font-mono ${stat.text} tracking-tight`}>{stat.value}</p>
                        </div>
                    ))}
                </div>

                {/* Map */}
                <div className="lg:col-span-4 bg-card rounded-2xl border border-card-border p-5 shadow-xl">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-accent" />
                            <h3 className="text-xs font-black text-foreground uppercase tracking-widest">Mapa Logístico</h3>
                        </div>
                        <div className="flex items-center gap-1 bg-hover-bg p-1 rounded-lg border border-card-border">
                            {([
                                { key: 'tasaEntrega' as MetricType, label: 'Entrega' },
                                { key: 'fletePromedio' as MetricType, label: 'Flete' },
                                { key: 'tasaDevolucion' as MetricType, label: 'Devolución' },
                            ]).map(({ key, label }) => (
                                <button key={key} onClick={() => setActiveMetric(key)}
                                    className={`px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all ${activeMetric === key ? 'bg-accent text-white shadow-sm' : 'text-muted hover:text-foreground'}`}>
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="max-h-[480px] overflow-hidden flex items-center justify-center">
                        <CountryMap
                            countryCode={countryCode}
                            departments={departmentMetrics}
                            activeMetric={activeMetric}
                            selectedDepartment={selectedDepartment}
                            onSelectDepartment={setSelectedDepartment}
                        />
                    </div>
                </div>
            </div>

            {/* === ROW 3: Transportadoras (auto-detected from orders) === */}
            <div className="bg-card rounded-2xl border border-card-border overflow-hidden shadow-xl">
                <div className="px-5 py-3 border-b border-card-border bg-hover-bg flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Truck className="w-4 h-4 text-accent" />
                        <h3 className="text-xs font-black text-foreground uppercase tracking-widest">Transportadoras</h3>
                        <span className="text-xs font-mono text-muted ml-2">{autoCarrierKpis.length} detectadas</span>
                    </div>
                </div>

                {autoCarrierKpis.length === 0 ? (
                    <div className="p-8 text-center space-y-2">
                        <Truck className="w-10 h-10 text-muted/20 mx-auto" />
                        <p className="text-sm text-muted">No se encontraron transportadoras en los datos</p>
                        <p className="text-xs text-muted/60">El campo &quot;TRANSPORTADORA&quot; no está presente en los reportes importados. Reimporta tu archivo de Dropi para incluir esta columna.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-table-header-bg">
                                    <th className="px-5 py-3 text-xs font-bold text-muted uppercase tracking-widest border-b border-card-border">Transportadora</th>
                                    <th className="px-4 py-3 text-xs font-bold text-muted uppercase tracking-widest border-b border-card-border text-center">Órdenes</th>
                                    <th className="px-4 py-3 text-xs font-bold text-muted uppercase tracking-widest border-b border-card-border text-center">% Entrega</th>
                                    <th className="px-4 py-3 text-xs font-bold text-muted uppercase tracking-widest border-b border-card-border text-center">% Devolución</th>
                                    <th className="px-4 py-3 text-xs font-bold text-muted uppercase tracking-widest border-b border-card-border text-center">Tránsito</th>
                                    <th className="px-4 py-3 text-xs font-bold text-muted uppercase tracking-widest border-b border-card-border text-right">Flete Prom</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-card-border">
                                {autoCarrierKpis.map((c, i) => (
                                    <tr key={i} className="hover:bg-hover-bg transition-colors">
                                        <td className="px-5 py-3">
                                            <p className="text-sm font-bold text-foreground uppercase">{c.name}</p>
                                        </td>
                                        <td className="px-4 py-3 text-center font-mono text-sm text-muted font-bold">{c.total}</td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`text-sm font-black font-mono ${deliveryColor(c.tasaEntrega)}`}>{c.tasaEntrega.toFixed(1)}%</span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className="text-sm font-bold font-mono text-orange-400">{c.tasaDevolucion.toFixed(1)}%</span>
                                        </td>
                                        <td className="px-4 py-3 text-center font-mono text-sm text-blue-400 font-bold">{c.tra}</td>
                                        <td className="px-4 py-3 text-right font-mono text-sm text-cyan-400 font-bold">{formatCurrency(c.fleteProm, 'COP')}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* === ROW 4: Department Ranking Table (sortable + collapsible) === */}
            <div className="bg-card rounded-2xl border border-card-border overflow-hidden shadow-xl">
                <div className="p-5 border-b border-card-border bg-hover-bg flex items-center justify-between">
                    <h3 className="text-xs font-black text-foreground uppercase tracking-widest">Ranking de Departamentos</h3>
                    <span className="text-xs font-bold text-muted uppercase tracking-widest">{departmentMetrics.length} regiones</span>
                </div>
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse min-w-[750px]">
                        <thead>
                            <tr className="bg-table-header-bg">
                                <th className="px-5 py-3 border-b border-card-border w-8"></th>
                                <th className="px-3 py-3 text-xs font-bold text-muted uppercase tracking-widest border-b border-card-border cursor-pointer select-none" onClick={() => toggleDeptSort('name')}>
                                    Departamento <SortIcon sortKey="name" currentSort={deptSort} />
                                </th>
                                <th className="px-3 py-3 text-xs font-bold text-muted uppercase tracking-widest border-b border-card-border text-center cursor-pointer select-none" onClick={() => toggleDeptSort('totalOrders')}>
                                    Órdenes <SortIcon sortKey="totalOrders" currentSort={deptSort} />
                                </th>
                                <th className="px-3 py-3 text-xs font-bold text-muted uppercase tracking-widest border-b border-card-border text-center cursor-pointer select-none" onClick={() => toggleDeptSort('entregados')}>
                                    Ent <SortIcon sortKey="entregados" currentSort={deptSort} />
                                </th>
                                <th className="px-3 py-3 text-xs font-bold text-muted uppercase tracking-widest border-b border-card-border text-center cursor-pointer select-none" onClick={() => toggleDeptSort('devoluciones')}>
                                    Dev <SortIcon sortKey="devoluciones" currentSort={deptSort} />
                                </th>
                                <th className="px-3 py-3 text-xs font-bold text-muted uppercase tracking-widest border-b border-card-border text-center cursor-pointer select-none" onClick={() => toggleDeptSort('tasaEntrega')}>
                                    % Entrega <SortIcon sortKey="tasaEntrega" currentSort={deptSort} />
                                </th>
                                <th className="px-3 py-3 text-xs font-bold text-muted uppercase tracking-widest border-b border-card-border text-right cursor-pointer select-none" onClick={() => toggleDeptSort('fletePromedio')}>
                                    Flete Prom <SortIcon sortKey="fletePromedio" currentSort={deptSort} />
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-card-border">
                            {sortedDepts.map((dept) => {
                                const isExpanded = expandedDepts.has(dept.code);
                                const deptCities = isExpanded ? aggregateByCityInDepartment(filteredOrders, dept.code, countryCode) : [];
                                return (
                                    <React.Fragment key={dept.code}>
                                        <tr className={`hover:bg-hover-bg transition-colors cursor-pointer ${selectedDepartment === dept.code ? 'bg-accent/5' : ''}`} onClick={() => toggleDept(dept.code)}>
                                            <td className="px-5 py-3">
                                                {isExpanded ? <ChevronDown className="w-4 h-4 text-accent" /> : <ChevronRight className="w-4 h-4 text-muted" />}
                                            </td>
                                            <td className="px-3 py-3"><p className="text-sm font-bold text-foreground/80 uppercase">{dept.name}</p></td>
                                            <td className="px-3 py-3 text-center font-mono text-sm text-muted font-bold">{dept.totalOrders}</td>
                                            <td className="px-3 py-3 text-center font-mono text-sm text-emerald-400/80 font-bold">{dept.entregados}</td>
                                            <td className="px-3 py-3 text-center font-mono text-sm text-orange-400/80 font-bold">{dept.devoluciones}</td>
                                            <td className="px-3 py-3 text-center">
                                                <span className={`text-sm font-black font-mono ${deliveryColor(dept.tasaEntrega)}`}>{dept.tasaEntrega.toFixed(1)}%</span>
                                            </td>
                                            <td className="px-3 py-3 text-right font-mono text-sm text-cyan-400 font-bold">{formatCurrency(dept.fletePromedio, 'COP')}</td>
                                        </tr>
                                        {isExpanded && deptCities.map((city, ci) => (
                                            <tr key={`${dept.code}-${ci}`} className="bg-hover-bg/50">
                                                <td className="px-5 py-2"></td>
                                                <td className="px-3 py-2 pl-10"><p className="text-xs text-muted/80 font-medium uppercase">{city.city}</p></td>
                                                <td className="px-3 py-2 text-center font-mono text-xs text-muted/70">{city.totalOrders}</td>
                                                <td className="px-3 py-2 text-center font-mono text-xs text-emerald-400/60">{city.entregados}</td>
                                                <td className="px-3 py-2 text-center font-mono text-xs text-orange-400/60">{city.devoluciones}</td>
                                                <td className="px-3 py-2 text-center"><span className={`text-xs font-bold font-mono ${deliveryColor(city.tasaEntrega)}`}>{city.tasaEntrega.toFixed(1)}%</span></td>
                                                <td className="px-3 py-2 text-right font-mono text-xs text-cyan-400/70">{formatCurrency(city.fletePromedio, 'COP')}</td>
                                            </tr>
                                        ))}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* === ROW 5: Product Summary Table (sortable + collapsible) === */}
            <div className="bg-card rounded-2xl border border-card-border overflow-hidden shadow-xl">
                <div className="p-5 border-b border-card-border bg-hover-bg flex items-center justify-between">
                    <h3 className="text-xs font-black text-foreground uppercase tracking-widest">Resumen por Producto</h3>
                    <span className="text-xs font-bold text-muted uppercase tracking-widest">{productBreakdown.length} productos</span>
                </div>
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse min-w-[850px]">
                        <thead>
                            <tr className="bg-table-header-bg">
                                <th className="px-5 py-3 border-b border-card-border w-8"></th>
                                <th className="px-3 py-3 text-xs font-bold text-muted uppercase tracking-widest border-b border-card-border cursor-pointer select-none" onClick={() => toggleProdSort('name')}>
                                    Producto <SortIcon sortKey="name" currentSort={prodSort} />
                                </th>
                                <th className="px-3 py-3 text-xs font-bold text-muted uppercase tracking-widest border-b border-card-border text-center cursor-pointer select-none" onClick={() => toggleProdSort('total')}>
                                    Pedidos <SortIcon sortKey="total" currentSort={prodSort} />
                                </th>
                                <th className="px-3 py-3 text-xs font-bold text-muted uppercase tracking-widest border-b border-card-border text-center cursor-pointer select-none" onClick={() => toggleProdSort('ent')}>
                                    Ent <SortIcon sortKey="ent" currentSort={prodSort} />
                                </th>
                                <th className="px-3 py-3 text-xs font-bold text-muted uppercase tracking-widest border-b border-card-border text-center cursor-pointer select-none" onClick={() => toggleProdSort('percEnt')}>
                                    % Ent <SortIcon sortKey="percEnt" currentSort={prodSort} />
                                </th>
                                <th className="px-3 py-3 text-xs font-bold text-muted uppercase tracking-widest border-b border-card-border text-center cursor-pointer select-none" onClick={() => toggleProdSort('can')}>
                                    Can <SortIcon sortKey="can" currentSort={prodSort} />
                                </th>
                                <th className="px-3 py-3 text-xs font-bold text-muted uppercase tracking-widest border-b border-card-border text-center">Trá</th>
                                <th className="px-3 py-3 text-xs font-bold text-muted uppercase tracking-widest border-b border-card-border text-right cursor-pointer select-none" onClick={() => toggleProdSort('facturado')}>
                                    Facturado <SortIcon sortKey="facturado" currentSort={prodSort} />
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-card-border">
                            {sortedProducts.map((prod) => {
                                const isExpanded = expandedProducts.has(prod.name);
                                const statusBreakdown = isExpanded ? [
                                    { label: 'Entregado', count: prod.ent, color: 'text-emerald-400', bg: 'bg-emerald-500' },
                                    { label: 'En Tránsito', count: prod.tra, color: 'text-blue-400', bg: 'bg-blue-500' },
                                    { label: 'Devolución', count: prod.dev, color: 'text-orange-400', bg: 'bg-orange-500' },
                                    { label: 'Cancelado', count: prod.can, color: 'text-red-400', bg: 'bg-red-500' },
                                ] : [];
                                const topCities = isExpanded ? (() => {
                                    const cityMap: Record<string, number> = {};
                                    prod.orders.forEach(o => { const c = o.CIUDAD || o['CIUDAD DESTINO'] || 'Desconocida'; cityMap[c] = (cityMap[c] || 0) + 1; });
                                    return Object.entries(cityMap).sort((a, b) => b[1] - a[1]).slice(0, 5);
                                })() : [];

                                return (
                                    <React.Fragment key={prod.name}>
                                        <tr className="hover:bg-hover-bg transition-colors cursor-pointer" onClick={() => toggleProduct(prod.name)}>
                                            <td className="px-5 py-3">
                                                {isExpanded ? <ChevronDown className="w-4 h-4 text-accent" /> : <ChevronRight className="w-4 h-4 text-muted" />}
                                            </td>
                                            <td className="px-3 py-3"><p className="text-sm font-bold text-foreground/80 uppercase truncate max-w-[280px]" title={prod.name}>{prod.name}</p></td>
                                            <td className="px-3 py-3 text-center font-mono text-sm text-muted font-bold">{prod.total}</td>
                                            <td className="px-3 py-3 text-center font-mono text-sm text-emerald-400/80 font-bold">{prod.ent}</td>
                                            <td className="px-3 py-3 text-center">
                                                <span className={`text-sm font-black font-mono ${deliveryColor(prod.percEnt)}`}>{prod.percEnt.toFixed(0)}%</span>
                                            </td>
                                            <td className="px-3 py-3 text-center font-mono text-sm text-red-400/80 font-bold">{prod.can}</td>
                                            <td className="px-3 py-3 text-center font-mono text-sm text-blue-400/80 font-bold">{prod.tra}</td>
                                            <td className="px-3 py-3 text-right font-mono text-sm text-foreground font-bold">
                                                {rates ? formatDualCurrency(prod.facturado, localCurrency, rates).primary : '—'}
                                            </td>
                                        </tr>
                                        {isExpanded && (
                                            <tr className="bg-hover-bg/50">
                                                <td colSpan={8} className="px-8 py-4">
                                                    <div className="flex flex-col md:flex-row gap-6">
                                                        <div className="flex-1 space-y-2">
                                                            <p className="text-xs font-bold text-muted uppercase tracking-widest mb-2">Desglose de Estados</p>
                                                            {statusBreakdown.map((s, si) => (
                                                                <div key={si} className="flex items-center gap-3">
                                                                    <span className={`text-xs font-bold ${s.color} w-24 uppercase`}>{s.label}</span>
                                                                    <div className="flex-1 h-2.5 bg-card rounded-full overflow-hidden">
                                                                        <div className={`h-full ${s.bg} rounded-full`} style={{ width: `${prod.total > 0 ? (s.count / prod.total) * 100 : 0}%` }} />
                                                                    </div>
                                                                    <span className="text-xs font-mono text-muted font-bold w-10 text-right">{s.count}</span>
                                                                </div>
                                                            ))}
                                                            <div className="flex items-center gap-3 mt-2 pt-2 border-t border-card-border">
                                                                <span className="text-xs font-bold text-muted w-24 uppercase">Flete Total</span>
                                                                <span className="text-sm font-mono font-bold text-cyan-400">{formatCurrency(prod.fleteTotal, 'COP')}</span>
                                                            </div>
                                                        </div>
                                                        <div className="flex-1 space-y-2">
                                                            <p className="text-xs font-bold text-muted uppercase tracking-widest mb-2">Top Ciudades</p>
                                                            {topCities.map(([city, count], ci) => (
                                                                <div key={ci} className="flex items-center justify-between">
                                                                    <span className="text-sm text-foreground/70 uppercase font-medium truncate max-w-[200px]">{city}</span>
                                                                    <span className="text-xs font-mono text-muted font-bold">{count}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

function Settings2Icon({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M20 7h-9" /><path d="M14 17H5" /><circle cx="17" cy="17" r="3" /><circle cx="7" cy="7" r="3" />
        </svg>
    );
}
