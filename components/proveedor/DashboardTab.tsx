'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    Loader2, Plus, ChevronDown, ChevronRight, ChevronLeft,
    TrendingUp, DollarSign, Package, AlertTriangle, CheckCircle,
    Clock, ShoppingCart, Percent, Store, Calendar as CalendarIcon
} from 'lucide-react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import {
    format, addMonths, subMonths, startOfMonth, endOfMonth,
    startOfWeek, endOfWeek, isSameMonth, isSameDay, addDays,
    isWithinInterval, parseISO
} from 'date-fns';
import { es } from 'date-fns/locale';
import { fmtCOP, fmtFull, fmtPct, fmtNum } from './formatters';
import ProductGananciaTable from './ProductGananciaTable';
import type { useSupplierData } from '@/lib/hooks/useSupplierData';

export default function DashboardTab({ data, startDate, endDate, onStartDate, onEndDate, dateRangeLabel, onDatePreset, onDateRangeLabel, selectedProduct, onProduct, selectedStore, onStore, deliveryPercent, onDeliveryPercent, onGoToInventario, onQuickAddToInventory }: {
    data: ReturnType<typeof useSupplierData>;
    startDate: string; endDate: string; onStartDate: (v: string) => void; onEndDate: (v: string) => void;
    dateRangeLabel: string; onDatePreset: (preset: string) => void; onDateRangeLabel: (v: string) => void;
    selectedProduct: string; onProduct: (v: string) => void;
    selectedStore: string; onStore: (v: string) => void;
    deliveryPercent: number; onDeliveryPercent: (v: number) => void;
    onGoToInventario: () => void;
    onQuickAddToInventory: (products: { id: string; name: string; variacionId: string; variacion: string; precioProveedor: number }[]) => Promise<void>;
}) {
    const { kpis, filteredOrders, availableProducts, availableStores, stockAlerts, inventory } = data;

    // Chart series visibility toggles
    const [visibleSeries, setVisibleSeries] = useState({
        ingreso: true,
        ganancia: true,
        unidades: true,
    });

    // Quick-add to inventory state
    const [addingToInventory, setAddingToInventory] = useState(false);
    const [addingProductId, setAddingProductId] = useState<string | null>(null);

    // Calendar popover state
    const [isCalendarOpen, setIsCalendarOpen] = useState(false);
    const [viewDate, setViewDate] = useState(new Date());
    const calendarRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (calendarRef.current && !calendarRef.current.contains(event.target as Node)) {
                setIsCalendarOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleDateSelect = (date: Date) => {
        const dateStr = format(date, 'yyyy-MM-dd');
        if (dateRangeLabel !== 'Personalizado') onDateRangeLabel('Personalizado');
        if (!startDate || (startDate && endDate && dateRangeLabel === 'Personalizado')) {
            onStartDate(dateStr);
            onEndDate('');
        } else if (dateRangeLabel === 'Personalizado' && !endDate) {
            const start = parseISO(startDate);
            if (date < start) {
                onEndDate(startDate);
                onStartDate(dateStr);
            } else {
                onEndDate(dateStr);
            }
        } else {
            onStartDate(dateStr);
            onEndDate('');
            onDateRangeLabel('Personalizado');
        }
    };

    const renderCalendar = () => {
        const monthStartDate = startOfMonth(viewDate);
        const monthEnd = endOfMonth(monthStartDate);
        const calStart = startOfWeek(monthStartDate);
        const calEnd = endOfWeek(monthEnd);
        const rows = [];
        let days = [];
        let day = calStart;
        const formattedMonth = format(viewDate, 'MMMM yyyy', { locale: es });

        while (day <= calEnd) {
            for (let i = 0; i < 7; i++) {
                const currentDay = day;
                const isSelected = (startDate && isSameDay(currentDay, parseISO(startDate))) ||
                    (endDate && isSameDay(currentDay, parseISO(endDate)));
                const isInRange = startDate && endDate &&
                    isWithinInterval(currentDay, { start: parseISO(startDate), end: parseISO(endDate) });
                const isToday = isSameDay(currentDay, new Date());
                const isCurrentMonth = isSameMonth(currentDay, monthStartDate);

                days.push(
                    <div key={day.toString()} onClick={() => handleDateSelect(currentDay)}
                        className={`relative h-10 w-10 flex items-center justify-center text-xs font-bold cursor-pointer rounded-xl transition-all
                            ${!isCurrentMonth ? 'text-gray-700 opacity-20' : 'text-gray-300'}
                            ${isSelected ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/40 z-10' : 'hover:bg-white/5'}
                            ${isInRange && !isSelected ? 'bg-orange-600/10 text-orange-400' : ''}
                            ${isToday && !isSelected ? 'border border-orange-500/30' : ''}
                        `}
                    >
                        {format(currentDay, 'd')}
                        {isToday && <div className="absolute bottom-1 w-1 h-1 bg-orange-500 rounded-full" />}
                    </div>
                );
                day = addDays(day, 1);
            }
            rows.push(<div key={day.toString()} className="grid grid-cols-7 gap-1">{days}</div>);
            days = [];
        }

        return (
            <div className="p-5 space-y-4">
                <div className="flex items-center justify-between px-1">
                    <h4 className="text-sm font-black text-white uppercase tracking-widest">{formattedMonth}</h4>
                    <div className="flex gap-1">
                        <button onClick={() => setViewDate(subMonths(viewDate, 1))} className="p-1.5 hover:bg-white/5 rounded-lg text-gray-500 hover:text-white transition-colors"><ChevronLeft className="w-4 h-4" /></button>
                        <button onClick={() => setViewDate(addMonths(viewDate, 1))} className="p-1.5 hover:bg-white/5 rounded-lg text-gray-500 hover:text-white transition-colors"><ChevronRight className="w-4 h-4" /></button>
                    </div>
                </div>
                <div className="grid grid-cols-7 gap-1 px-1">
                    {['D', 'L', 'M', 'M', 'J', 'V', 'S'].map((d, i) => (
                        <div key={i} className="h-8 w-10 flex items-center justify-center text-[10px] font-black text-gray-600 uppercase">{d}</div>
                    ))}
                </div>
                <div className="space-y-1">{rows}</div>
            </div>
        );
    };

    // Deduplicate products by productoId for the dropdown
    const uniqueProducts = useMemo(() => {
        const seen = new Map<string, string>();
        for (const p of availableProducts) {
            if (!seen.has(p.id)) seen.set(p.id, p.name);
        }
        return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
    }, [availableProducts]);

    return (
        <div className="space-y-6">
            {/* Filters — matches FilterHeader aesthetic */}
            <header className="sticky top-4 z-[100] bg-[#0a0a0f]/80 backdrop-blur-xl border border-white/[0.08] py-3 px-6 shadow-2xl shadow-black/40 rounded-2xl">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex items-center gap-3">
                        <Package className="w-5 h-5 text-[#d75c33]" />
                        <div>
                            <h2 className="text-sm font-black text-white">Proveedor</h2>
                            <p className="text-[10px] text-gray-500">Dashboard de proveeduría</p>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 md:gap-3 bg-white/[0.03] p-2 rounded-2xl border border-white/[0.05]">
                        {/* Date Selector with Calendar Popover */}
                        <div className="relative" ref={calendarRef}>
                            <div onClick={() => setIsCalendarOpen(!isCalendarOpen)}
                                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl hover:bg-white/5 transition-colors cursor-pointer group ${isCalendarOpen ? 'bg-white/5 ring-1 ring-white/10' : ''}`}>
                                <CalendarIcon className="w-4 h-4 text-emerald-400" />
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-black text-gray-500 uppercase leading-none mb-0.5">Rango de Fechas</span>
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-xs font-bold text-gray-300">
                                            {dateRangeLabel === 'Personalizado' && startDate
                                                ? endDate
                                                    ? `${format(parseISO(startDate), 'dd MMM', { locale: es })} - ${format(parseISO(endDate), 'dd MMM', { locale: es })}`
                                                    : format(parseISO(startDate), 'dd MMM', { locale: es })
                                                : dateRangeLabel}
                                        </span>
                                        <ChevronDown className={`w-3 h-3 text-gray-600 transition-transform ${isCalendarOpen ? 'rotate-180' : ''}`} />
                                    </div>
                                </div>
                            </div>
                            {isCalendarOpen && (
                                <div className="absolute top-full left-0 mt-3 bg-[#0c0f16] border border-gray-800 rounded-[2.5rem] shadow-2xl z-[100] w-[320px] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                                    <div className="grid grid-cols-2 gap-1 p-2 border-b border-white/5 bg-black/20">
                                        {['Hoy', 'Ayer', 'Últimos 7 Días', 'Últimos 30 Días', 'Este Mes', 'Mes Pasado', 'Todos'].map(preset => (
                                            <button key={preset} onClick={() => { onDatePreset(preset); setIsCalendarOpen(false); }}
                                                className={`px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest text-left transition-all ${
                                                    dateRangeLabel === preset ? 'bg-orange-600/20 text-orange-400 border border-orange-500/30' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                                                }`}>{preset}</button>
                                        ))}
                                    </div>
                                    {renderCalendar()}
                                    <div className="p-4 bg-black/40 border-t border-white/5 flex items-center justify-between">
                                        <button onClick={() => { onDatePreset('Este Mes'); setIsCalendarOpen(false); }}
                                            className="text-[9px] font-black text-gray-500 hover:text-red-400 uppercase tracking-widest transition-colors">Limpiar</button>
                                        <button onClick={() => setIsCalendarOpen(false)}
                                            className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white text-[9px] font-black uppercase tracking-widest rounded-xl transition-all">Aplicar</button>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="w-px h-5 bg-white/10" />

                        {/* Product — deduplicated by productoId */}
                        <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl hover:bg-white/5 transition-colors group max-w-[220px]">
                            <Package className="w-4 h-4 text-amber-400" />
                            <select value={selectedProduct} onChange={e => onProduct(e.target.value)}
                                className="bg-transparent text-sm font-bold text-gray-300 outline-none cursor-pointer appearance-none truncate flex-1">
                                <option value="Todos" className="bg-[#0a0c10] text-gray-300">Producto: Todos</option>
                                {uniqueProducts.map(p => (
                                    <option key={p.id} value={p.id} className="bg-[#0a0c10] text-gray-300">{p.name}</option>
                                ))}
                            </select>
                            <ChevronDown className="w-3.5 h-3.5 text-gray-600 group-hover:text-gray-400 transition-colors" />
                        </div>

                        <div className="w-px h-5 bg-white/10" />

                        {/* Store */}
                        <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl hover:bg-white/5 transition-colors group max-w-[200px]">
                            <Store className="w-4 h-4 text-indigo-400" />
                            <select value={selectedStore} onChange={e => onStore(e.target.value)}
                                className="bg-transparent text-sm font-bold text-gray-300 outline-none cursor-pointer appearance-none truncate flex-1">
                                <option value="Todos" className="bg-[#0a0c10] text-gray-300">Tienda: Todas</option>
                                {availableStores.map(s => (
                                    <option key={s} value={s} className="bg-[#0a0c10] text-gray-300">{s}</option>
                                ))}
                            </select>
                            <ChevronDown className="w-3.5 h-3.5 text-gray-600 group-hover:text-gray-400 transition-colors" />
                        </div>

                        <div className="w-px h-5 bg-white/10" />

                        {/* Delivery % */}
                        <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl hover:bg-white/5 transition-colors">
                            <Percent className="w-4 h-4 text-purple-400" />
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black text-gray-500 uppercase leading-none mb-0.5">Entrega</span>
                                <input type="number" min={10} max={100} value={deliveryPercent}
                                    onChange={e => onDeliveryPercent(Number(e.target.value))}
                                    className="bg-transparent text-xs font-bold text-gray-300 outline-none w-[40px]" />
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            {/* KPI Cards — 4 detailed cards matching main dashboard */}
            {kpis && (
                <>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* Card 1: Ganancia Real */}
                        <div className="bg-card border border-card-border rounded-xl p-4 hover:border-accent/30 transition-all shadow-sm">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-[10px] font-black text-muted uppercase tracking-widest">Ganancia Real</span>
                                <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-emerald-500/10">
                                    <DollarSign className="w-4 h-4 text-emerald-500" />
                                </div>
                            </div>
                            <p className={`text-2xl font-black tracking-tight font-mono ${kpis.ganancia_real >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>
                                {fmtCOP(kpis.ganancia_real)}
                            </p>
                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                <span className="text-xs text-muted">
                                    <span className="text-foreground/70 font-mono">{fmtCOP(kpis.ingreso_proveedor)}</span>
                                    {' - '}<span className="text-foreground/70 font-mono">{fmtCOP(kpis.costo_interno)}</span>
                                </span>
                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-black border font-mono ${
                                    kpis.margen >= 30 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                    : kpis.margen >= 15 ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                    : 'bg-red-500/10 text-red-400 border-red-500/20'
                                }`}>
                                    {fmtPct(kpis.margen)} MARGEN
                                </span>
                            </div>
                        </div>

                        {/* Card 2: Ventas & Despachos */}
                        <div className="bg-card border border-card-border rounded-xl p-4 hover:border-accent/30 transition-all shadow-sm">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-[10px] font-black text-muted uppercase tracking-widest">Ventas & Despachos</span>
                                <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-blue-500/10">
                                    <ShoppingCart className="w-4 h-4 text-blue-400" />
                                </div>
                            </div>
                            <p className="text-2xl font-black tracking-tight text-blue-400 font-mono">{fmtCOP(kpis.ingreso_proveedor)}</p>
                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                <span className="text-xs text-muted">
                                    <span className="text-foreground/70 font-mono">{fmtNum(kpis.unidades_vendidas)}</span> uds vendidas
                                </span>
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono">
                                    {fmtNum(kpis.n_desp)} DESPACHADOS
                                </span>
                            </div>
                        </div>

                        {/* Card 3: Tasas */}
                        <div className="bg-card border border-card-border rounded-xl p-4 hover:border-accent/30 transition-all shadow-sm">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-[10px] font-black text-muted uppercase tracking-widest">Tasas</span>
                                <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-purple-500/10">
                                    <CheckCircle className="w-4 h-4 text-purple-400" />
                                </div>
                            </div>
                            <p className={`text-2xl font-black tracking-tight font-mono ${
                                kpis.tasa_entrega >= 70 ? 'text-purple-400' : kpis.tasa_entrega >= 50 ? 'text-amber-400' : 'text-red-400'
                            }`}>
                                {fmtPct(kpis.tasa_entrega)}
                            </p>
                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                <span className="text-xs text-muted">
                                    <span className="text-foreground/70 font-mono">{fmtNum(kpis.n_ent)}</span> de {fmtNum(kpis.n_ord - kpis.n_can)} entregadas
                                </span>
                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-black border font-mono ${
                                    kpis.tasa_devolucion <= 5 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                    : kpis.tasa_devolucion <= 10 ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                    : 'bg-red-500/10 text-red-400 border-red-500/20'
                                }`}>
                                    {fmtPct(kpis.tasa_devolucion)} DEV.
                                </span>
                            </div>
                        </div>

                        {/* Card 4: En Tránsito */}
                        <div className="bg-card border border-card-border rounded-xl p-4 hover:border-accent/30 transition-all shadow-sm">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-[10px] font-black text-muted uppercase tracking-widest">En Tránsito</span>
                                <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-amber-500/10">
                                    <Clock className="w-4 h-4 text-amber-400" />
                                </div>
                            </div>
                            <p className="text-2xl font-black tracking-tight text-amber-400 font-mono">{fmtNum(kpis.ordenes_transito)}</p>
                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                <span className="text-xs text-muted">
                                    <span className="text-foreground/70 font-mono">{kpis.n_ord > 0 ? fmtPct((kpis.ordenes_transito / kpis.n_ord) * 100) : '0%'}</span> del total
                                </span>
                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-black border font-mono ${
                                    kpis.ganancia_proyectada >= 0 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'
                                }`}>
                                    Proy. {fmtCOP(kpis.ganancia_proyectada)}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Stock Alerts */}
                    {stockAlerts.length > 0 && (
                        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
                            <h3 className="text-sm font-bold text-amber-400 flex items-center gap-2 mb-2">
                                <AlertTriangle className="w-4 h-4" /> Alertas de Stock
                            </h3>
                            <div className="space-y-1">
                                {stockAlerts.map((alert, i) => (
                                    <p key={i} className={`text-sm ${alert.nivel === '7dias' ? 'text-red-400' : 'text-amber-400'}`}>
                                        <strong>{alert.product.nombre}</strong>
                                        {alert.product.variacion ? ` (${alert.product.variacion})` : ''}: {alert.stockActual} unidades restantes (~{Math.round(alert.diasRestantes)} días)
                                    </p>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Unsynchronized Products Alert — Quick Add to Inventory */}
                    {(() => {
                        const invKeys = new Set(inventory.map(p => `${p.productoId}_${p.variacionId}`));
                        const unsyncProducts = availableProducts.filter(p => !invKeys.has(`${p.id}_${p.variacionId}`));
                        if (unsyncProducts.length === 0) return null;

                        // Group by productoId
                        const grouped = new Map<string, { name: string; items: typeof unsyncProducts }>();
                        for (const p of unsyncProducts) {
                            if (!grouped.has(p.id)) grouped.set(p.id, { name: p.name, items: [] });
                            grouped.get(p.id)!.items.push(p);
                        }
                        const groups = Array.from(grouped.entries());

                        const handleAddGroup = async (productoId: string) => {
                            const group = grouped.get(productoId);
                            if (!group) return;
                            setAddingProductId(productoId);
                            try {
                                await onQuickAddToInventory(group.items);
                            } finally { setAddingProductId(null); }
                        };

                        const handleAddAll = async () => {
                            setAddingToInventory(true);
                            try {
                                await onQuickAddToInventory(unsyncProducts);
                            } finally { setAddingToInventory(false); }
                        };

                        return (
                            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="text-sm font-bold text-blue-400 flex items-center gap-2">
                                        <Package className="w-4 h-4" /> {unsyncProducts.length} productos sin inventario
                                    </h3>
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={handleAddAll}
                                            disabled={addingToInventory}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 transition-all disabled:opacity-50"
                                        >
                                            {addingToInventory ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                                            Agregar todos
                                        </button>
                                        <button onClick={onGoToInventario} className="text-xs text-blue-400 hover:text-blue-300 underline">
                                            Ir a Inventario →
                                        </button>
                                    </div>
                                </div>
                                <p className="text-xs text-muted mb-3">
                                    Se agregarán con ID, precio proveedor y variaciones. Luego edita el costo interno en Inventario.
                                </p>
                                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                                    {groups.map(([productoId, group]) => {
                                        const isAdding = addingProductId === productoId;
                                        const hasVariations = group.items.length > 1 || group.items.some(i => i.variacionId);
                                        return (
                                            <div key={productoId} className="flex items-center gap-2 bg-blue-500/5 border border-blue-500/10 rounded-lg px-3 py-2">
                                                <div className="flex-1 min-w-0">
                                                    <span className="text-xs font-bold text-blue-300 truncate block">{group.name}</span>
                                                    {hasVariations && (
                                                        <span className="text-[10px] text-muted">
                                                            {group.items.map(i => i.variacion || i.variacionId || 'Sin var.').join(' · ')}
                                                        </span>
                                                    )}
                                                </div>
                                                <span className="text-[10px] text-muted shrink-0 font-mono">
                                                    {fmtCOP(group.items[0].precioProveedor)}
                                                </span>
                                                <button
                                                    onClick={() => handleAddGroup(productoId)}
                                                    disabled={isAdding || addingToInventory}
                                                    className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 transition-all disabled:opacity-50"
                                                    title="Agregar al inventario"
                                                >
                                                    {isAdding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })()}

                    {/* Daily Trend Chart — Wheel-style */}
                    {kpis.datos_diarios.length > 1 && (
                        <div className="bg-card border border-card-border rounded-xl p-5 md:p-6 shadow-sm">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
                                <div>
                                    <h3 className="text-[11px] font-black text-muted uppercase tracking-widest flex items-center gap-2">
                                        <TrendingUp className="w-4 h-4 text-[#d75c33]" />
                                        Tendencias de Rendimiento
                                    </h3>
                                    <p className="text-muted text-xs mt-0.5">Ingreso, ganancia y unidades por día</p>
                                </div>
                                <div className="flex flex-wrap gap-2 mt-3 md:mt-0">
                                    {([
                                        { key: 'ingreso' as const, name: 'Ingreso', color: '#6366f1' },
                                        { key: 'ganancia' as const, name: 'Ganancia', color: '#10b981' },
                                        { key: 'unidades' as const, name: 'Unidades', color: '#f59e0b' },
                                    ]).map(item => {
                                        const isVisible = visibleSeries[item.key];
                                        return (
                                            <button key={item.key}
                                                onClick={() => setVisibleSeries(prev => ({ ...prev, [item.key]: !isVisible }))}
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
                            <div className="h-[300px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={kpis.datos_diarios} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" vertical={false} />
                                        <XAxis dataKey="fecha" axisLine={false} tickLine={false} tick={{ fill: 'var(--muted)', fontSize: 10, fontWeight: 700 }} dy={10} />
                                        <YAxis yAxisId="money" axisLine={false} tickLine={false} tick={{ fill: 'var(--muted)', fontSize: 10 }} tickFormatter={v => fmtCOP(v)} />
                                        <YAxis yAxisId="units" orientation="right" axisLine={false} tickLine={false} tick={{ fill: 'var(--muted)', fontSize: 10 }} tickFormatter={v => `${v}`} />
                                        <Tooltip
                                            contentStyle={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 12, fontSize: 12, fontWeight: 700, color: 'var(--foreground)' }}
                                            itemStyle={{ color: 'var(--foreground)', padding: '3px 0' }}
                                            cursor={{ fill: 'var(--hover-bg)' }}
                                            formatter={(v: number | undefined, name: string | undefined) => {
                                                const val = v ?? 0;
                                                const n = name ?? '';
                                                return [n === 'Unidades' ? `${fmtNum(val)} uds` : fmtFull(val), n];
                                            }}
                                        />
                                        {visibleSeries.ingreso && <Area yAxisId="money" type="monotone" dataKey="ingreso" name="Ingreso" stroke="#6366f1" fill="#6366f1" fillOpacity={0.1} strokeWidth={2} />}
                                        {visibleSeries.ganancia && <Area yAxisId="money" type="monotone" dataKey="ganancia" name="Ganancia" stroke="#10b981" fill="#10b981" fillOpacity={0.15} strokeWidth={2} />}
                                        {visibleSeries.unidades && <Area yAxisId="units" type="monotone" dataKey="unidades" name="Unidades" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.1} strokeWidth={2} strokeDasharray="4 2" />}
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}

                    {/* By Product Table — grouped by product, expand for variations */}
                    {kpis.por_producto.length > 0 && (
                        <ProductGananciaTable products={kpis.por_producto} onGoToInventario={onGoToInventario} />
                    )}

                    {/* By Store Table */}
                    {kpis.por_tienda.length > 0 && (
                        <div className="bg-card border border-sidebar-border rounded-xl p-4">
                            <h3 className="text-sm font-bold text-foreground mb-4">Ganancia por Tienda</h3>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-sidebar-border bg-hover-bg/30">
                                            <th className="text-left py-2 px-3 text-[10px] font-bold text-muted uppercase">Tienda</th>
                                            <th className="text-right py-2 px-3 text-[10px] font-bold text-muted uppercase">Órdenes</th>
                                            <th className="text-right py-2 px-3 text-[10px] font-bold text-muted uppercase">Unidades</th>
                                            <th className="text-right py-2 px-3 text-[10px] font-bold text-muted uppercase">Ingreso</th>
                                            <th className="text-right py-2 px-3 text-[10px] font-bold text-muted uppercase">Ganancia</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {kpis.por_tienda.map((s, i) => (
                                            <tr key={i} className="border-b border-sidebar-border/50 hover:bg-hover-bg/50">
                                                <td className="py-2 px-3 text-foreground font-medium">{s.tienda}</td>
                                                <td className="py-2 px-3 text-right text-foreground">{fmtNum(s.ordenes)}</td>
                                                <td className="py-2 px-3 text-right text-foreground">{fmtNum(s.unidades)}</td>
                                                <td className="py-2 px-3 text-right text-foreground">{fmtCOP(s.ingreso)}</td>
                                                <td className={`py-2 px-3 text-right font-medium ${s.ganancia > 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmtCOP(s.ganancia)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </>
            )}

            {!kpis && filteredOrders.length === 0 && (
                <div className="text-center py-16">
                    <Package className="w-12 h-12 text-muted/30 mx-auto mb-4" />
                    <p className="text-muted text-sm">No hay datos de proveedor. Importa un reporte en la pestaña Importar.</p>
                </div>
            )}
        </div>
    );
}
