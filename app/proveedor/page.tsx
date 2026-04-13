'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    Loader2, Plus, Trash2, Edit3, Upload, ChevronDown, ChevronRight, ChevronLeft,
    TrendingUp, DollarSign, Package, BarChart3, AlertTriangle,
    CheckCircle, Clock, ShoppingCart, RefreshCw, Check, X,
    ArrowUpCircle, Ticket, Calendar as CalendarIcon, Store, Percent,
    Ship, Users, FileText, Download, Eye, CreditCard, Anchor
} from 'lucide-react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import {
    format, addMonths, subMonths, startOfMonth, endOfMonth,
    startOfWeek, endOfWeek, isSameMonth, isSameDay, addDays,
    isWithinInterval, parseISO,
} from 'date-fns';
import { es } from 'date-fns/locale';
import { getStartDateForRange, getEndDateForRange } from '@/lib/utils/date-parsers';
import { useAuth } from '@/lib/context/AuthContext';
import { useSupplierData, invalidateSupplierCache } from '@/lib/hooks/useSupplierData';
import { parseSupplierFile, parseReturnsFile, parseTicketsSheet, parseInventoryFile } from '@/lib/utils/supplierParser';
import type { ParsedInventoryProduct } from '@/lib/utils/supplierParser';
import type { SupplierOrder } from '@/lib/utils/supplierParser';
import {
    saveSupplierOrderFile, deleteSupplierImportLog, findOverlappingSupplierImports,
    getSupplierImportHistory
} from '@/lib/firebase/firestore';
import {
    InventoryProduct, InventoryMovement,
    saveInventoryProduct, deleteInventoryProduct, getInventory, getMovements,
    addMovement, bulkAddMovements, bulkSaveInventory, clearAllInventory
} from '@/lib/services/supplierInventory';
import {
    SupplierReturn, resolveReturnProducts, bulkImportReturns
} from '@/lib/services/supplierReturns';
import { SupplierTicket, saveTicket, deleteTicket, bulkImportTickets, getTickets } from '@/lib/services/supplierTickets';
import { isDespachado } from '@/lib/calculations/supplierKpis';
import {
    Supplier, getSuppliers, saveSupplier, deleteSupplier, generateSupplierId
} from '@/lib/services/supplierDirectory';
import {
    PurchaseOrder, PurchaseOrderLine, LandedCost, Payment, PurchaseDocument,
    PurchaseEstado, PurchaseTipo,
    getPurchases, savePurchase, deletePurchase,
    computePurchaseTotals, computeLandedCostPerUnit,
    generatePurchaseId, generateLineId, generatePaymentId, generateCostId, generateDocId,
    LANDED_COST_CONCEPTS, PRODUCTION_COST_CONCEPTS, ESTADO_LABELS, TIPO_LABELS, DOC_TYPE_LABELS,
} from '@/lib/services/supplierPurchases';
import { uploadPurchaseDocument, deletePurchaseDocument } from '@/lib/services/supplierStorage';
import { receiveFromPurchase } from '@/lib/services/supplierInventory';

// ── Formatters ──────────────────────────────────────────────────────────────
const fmtCOP = (v: number) => {
    if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
    if (Math.abs(v) >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
    return `$${v.toLocaleString('es-CO')}`;
};
const fmtFull = (v: number) => `$${v.toLocaleString('es-CO', { maximumFractionDigits: 0 })}`;
const fmtPct = (v: number) => `${v.toFixed(1)}%`;
const fmtNum = (v: number) => v.toLocaleString('es-CO');

// ── Tab type ────────────────────────────────────────────────────────────────
type TabId = 'dashboard' | 'inventario' | 'importaciones' | 'proveedores' | 'devoluciones' | 'importar' | 'tickets';

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'inventario', label: 'Inventario', icon: Package },
    { id: 'importaciones', label: 'Importaciones', icon: Ship },
    { id: 'proveedores', label: 'Proveedores', icon: Users },
    { id: 'devoluciones', label: 'Devoluciones', icon: RefreshCw },
    { id: 'importar', label: 'Importar', icon: Upload },
    { id: 'tickets', label: 'Tickets', icon: Ticket },
];

// ── Main Page ───────────────────────────────────────────────────────────────
export default function ProveedorPage() {
    const { effectiveUid } = useAuth();
    const [activeTab, setActiveTab] = useState<TabId>('dashboard');

    // Date filters
    const now = new Date();
    const [startDate, setStartDate] = useState(() => {
        const d = new Date(now.getFullYear(), now.getMonth(), 1);
        return d.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(now.toISOString().split('T')[0]);
    const [selectedProduct, setSelectedProduct] = useState('Todos');
    const [selectedStore, setSelectedStore] = useState('Todos');
    const [deliveryPercent, setDeliveryPercent] = useState(70);
    const [dateRangeLabel, setDateRangeLabel] = useState('Este Mes');

    const applyDatePreset = (preset: string) => {
        if (preset === 'Todos') {
            setStartDate('2020-01-01');
            setEndDate(new Date().toISOString().split('T')[0]);
        } else {
            const s = getStartDateForRange(preset);
            const e = getEndDateForRange(preset);
            setStartDate(s.toISOString().split('T')[0]);
            setEndDate(e.toISOString().split('T')[0]);
        }
        setDateRangeLabel(preset);
    };

    const dateRange = useMemo(() => ({
        start: new Date(startDate + 'T00:00:00'),
        end: new Date(endDate + 'T23:59:59'),
    }), [startDate, endDate]);

    const supplierData = useSupplierData(
        dateRange,
        selectedProduct,
        selectedStore,
        deliveryPercent
    );

    if (supplierData.loading) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <Loader2 className="w-8 h-8 animate-spin text-[#d75c33]" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Proveedor</h1>
                    <p className="text-sm text-muted mt-1">Gestión de proveeduría, inventario y devoluciones</p>
                </div>
                <button
                    onClick={supplierData.refresh}
                    className="flex items-center gap-2 px-3 py-2 text-sm rounded-xl border border-sidebar-border hover:bg-hover-bg text-muted hover:text-foreground transition-all"
                >
                    <RefreshCw className="w-4 h-4" />
                    Actualizar
                </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-card/50 border border-sidebar-border rounded-xl p-1">
                {TABS.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                            activeTab === tab.id
                                ? 'bg-[#d75c33]/10 text-[#d75c33] border border-[#d75c33]/20'
                                : 'text-muted hover:text-foreground hover:bg-hover-bg border border-transparent'
                        }`}
                    >
                        <tab.icon className="w-4 h-4" />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Error */}
            {supplierData.error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400 text-sm">
                    {supplierData.error}
                </div>
            )}

            {/* Tab Content */}
            {activeTab === 'dashboard' && (
                <DashboardTab
                    data={supplierData}
                    startDate={startDate}
                    endDate={endDate}
                    onStartDate={setStartDate}
                    onEndDate={setEndDate}
                    dateRangeLabel={dateRangeLabel}
                    onDatePreset={applyDatePreset}
                    onDateRangeLabel={setDateRangeLabel}
                    selectedProduct={selectedProduct}
                    onProduct={setSelectedProduct}
                    selectedStore={selectedStore}
                    onStore={setSelectedStore}
                    deliveryPercent={deliveryPercent}
                    onDeliveryPercent={setDeliveryPercent}
                    onGoToInventario={() => setActiveTab('inventario')}
                    onQuickAddToInventory={async (products) => {
                        if (!effectiveUid) return;
                        const now = Date.now();
                        const inventoryProducts: InventoryProduct[] = products.map((p, i) => ({
                            id: `inv_quick_${now}_${i}_${Math.random().toString(36).slice(2, 6)}`,
                            productoId: p.id,
                            nombre: p.name,
                            variacionId: p.variacionId,
                            variacion: p.variacion,
                            costoInterno: 0,
                            precioProveedor: p.precioProveedor,
                            stockInicial: 0,
                            stockActual: 0,
                            alertaStock30: true,
                            alertaStock7: true,
                            createdAt: now,
                            updatedAt: now,
                        }));
                        await bulkSaveInventory(inventoryProducts, effectiveUid);
                        supplierData.refresh();
                    }}
                />
            )}
            {activeTab === 'inventario' && (
                <InventarioTab data={supplierData} userId={effectiveUid || ''} />
            )}
            {activeTab === 'importaciones' && (
                <ImportacionesTab userId={effectiveUid || ''} inventory={supplierData.inventory} onRefresh={supplierData.refresh} />
            )}
            {activeTab === 'proveedores' && (
                <ProveedoresTab userId={effectiveUid || ''} />
            )}
            {activeTab === 'devoluciones' && (
                <DevolucionesTab data={supplierData} userId={effectiveUid || ''} />
            )}
            {activeTab === 'importar' && (
                <ImportarTab userId={effectiveUid || ''} onImported={supplierData.refresh} />
            )}
            {activeTab === 'tickets' && (
                <TicketsTab userId={effectiveUid || ''} />
            )}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// PRODUCT GANANCIA TABLE — Groups variations, expands on click
// ═══════════════════════════════════════════════════════════════════════════
function ProductGananciaTable({ products, onGoToInventario }: { products: import('@/lib/calculations/supplierKpis').ProductSupplierKPI[]; onGoToInventario: () => void }) {
    const [expandedProduct, setExpandedProduct] = useState<string | null>(null);

    // Group by productoId (name), aggregate totals
    const grouped = useMemo(() => {
        const map = new Map<string, {
            nombre: string;
            productoId: string;
            unidades: number; ingreso: number; costoInterno: number; ganancia: number; ordenes: number;
            variations: typeof products;
        }>();
        for (const p of products) {
            const key = p.productoId || p.nombre;
            const existing = map.get(key);
            if (existing) {
                existing.unidades += p.unidades;
                existing.ingreso += p.ingreso;
                existing.costoInterno += p.costoInterno;
                existing.ganancia += p.ganancia;
                existing.ordenes += p.ordenes;
                existing.variations.push(p);
            } else {
                map.set(key, {
                    nombre: p.nombre,
                    productoId: key,
                    unidades: p.unidades, ingreso: p.ingreso, costoInterno: p.costoInterno, ganancia: p.ganancia, ordenes: p.ordenes,
                    variations: [p],
                });
            }
        }
        return Array.from(map.values()).sort((a, b) => b.ganancia - a.ganancia);
    }, [products]);

    return (
        <div className="bg-card border border-sidebar-border rounded-xl p-4">
            <h3 className="text-sm font-bold text-foreground mb-4">Ganancia por Producto</h3>
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-sidebar-border bg-hover-bg/30">
                            <th className="text-left py-2 px-3 text-[10px] font-bold text-muted uppercase">Producto</th>
                            <th className="text-right py-2 px-3 text-[10px] font-bold text-muted uppercase">Uds</th>
                            <th className="text-right py-2 px-3 text-[10px] font-bold text-muted uppercase">Ingreso</th>
                            <th className="text-right py-2 px-3 text-[10px] font-bold text-muted uppercase">Costo</th>
                            <th className="text-right py-2 px-3 text-[10px] font-bold text-muted uppercase">Ganancia</th>
                            <th className="text-right py-2 px-3 text-[10px] font-bold text-muted uppercase">Gan/Ud</th>
                            <th className="text-right py-2 px-3 text-[10px] font-bold text-muted uppercase">Margen</th>
                            <th className="text-center py-2 px-3 text-[10px] font-bold text-muted uppercase"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {grouped.map(g => {
                            const isExpanded = expandedProduct === g.productoId;
                            const hasVariations = g.variations.length > 1;
                            const margen = g.ingreso > 0 ? (g.ganancia / g.ingreso) * 100 : 0;
                            const gananciaUnit = g.unidades > 0 ? g.ganancia / g.unidades : 0;

                            return (
                                <React.Fragment key={g.productoId}>
                                    <tr
                                        className={`border-b border-sidebar-border/50 hover:bg-hover-bg/50 ${hasVariations ? 'cursor-pointer' : ''}`}
                                        onClick={() => hasVariations && setExpandedProduct(isExpanded ? null : g.productoId)}
                                    >
                                        <td className="py-2 px-3 text-foreground font-medium flex items-center gap-1.5">
                                            {hasVariations && (isExpanded ? <ChevronDown className="w-3 h-3 text-muted" /> : <ChevronRight className="w-3 h-3 text-muted" />)}
                                            {g.nombre}
                                            {hasVariations && <span className="text-[10px] text-muted ml-1">({g.variations.length} var.)</span>}
                                        </td>
                                        <td className="py-2 px-3 text-right text-foreground">{fmtNum(g.unidades)}</td>
                                        <td className="py-2 px-3 text-right text-foreground">{fmtCOP(g.ingreso)}</td>
                                        <td className="py-2 px-3 text-right text-muted">{fmtCOP(g.costoInterno)}</td>
                                        <td className={`py-2 px-3 text-right font-medium ${g.ganancia > 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmtCOP(g.ganancia)}</td>
                                        <td className={`py-2 px-3 text-right font-medium ${gananciaUnit > 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmtFull(gananciaUnit)}</td>
                                        <td className="py-2 px-3 text-right text-muted">{fmtPct(margen)}</td>
                                        <td className="py-2 px-3 text-center" onClick={e => e.stopPropagation()}>
                                            <button onClick={onGoToInventario} className="text-muted hover:text-blue-400 transition-colors" title="Editar en Inventario">
                                                <Edit3 className="w-3.5 h-3.5" />
                                            </button>
                                        </td>
                                    </tr>
                                    {isExpanded && g.variations.map((v, vi) => {
                                        const vGanUnit = v.unidades > 0 ? v.ganancia / v.unidades : 0;
                                        return (
                                            <tr key={vi} className="border-b border-sidebar-border/30 bg-hover-bg/20">
                                                <td className="py-1.5 px-3 pl-8 text-muted text-xs">{v.variacion || 'Sin variación'}</td>
                                                <td className="py-1.5 px-3 text-right text-muted text-xs">{fmtNum(v.unidades)}</td>
                                                <td className="py-1.5 px-3 text-right text-muted text-xs">{fmtCOP(v.ingreso)}</td>
                                                <td className="py-1.5 px-3 text-right text-muted text-xs">{fmtCOP(v.costoInterno)}</td>
                                                <td className={`py-1.5 px-3 text-right text-xs font-medium ${v.ganancia > 0 ? 'text-emerald-400/70' : 'text-red-400/70'}`}>{fmtCOP(v.ganancia)}</td>
                                                <td className={`py-1.5 px-3 text-right text-xs ${vGanUnit > 0 ? 'text-emerald-400/70' : 'text-red-400/70'}`}>{fmtFull(vGanUnit)}</td>
                                                <td className="py-1.5 px-3 text-right text-muted text-xs">{fmtPct(v.margen)}</td>
                                                <td></td>
                                            </tr>
                                        );
                                    })}
                                </React.Fragment>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// DASHBOARD TAB
// ═══════════════════════════════════════════════════════════════════════════
function DashboardTab({ data, startDate, endDate, onStartDate, onEndDate, dateRangeLabel, onDatePreset, onDateRangeLabel, selectedProduct, onProduct, selectedStore, onStore, deliveryPercent, onDeliveryPercent, onGoToInventario, onQuickAddToInventory }: {
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

// ═══════════════════════════════════════════════════════════════════════════
// INVENTORY TABLE — Groups by productoId, expands to show variations
// ═══════════════════════════════════════════════════════════════════════════
function InventoryTable({ inventory, movements, expandedProduct, setExpandedProduct, onSave, onBulkSave, onDelete }: {
    inventory: InventoryProduct[];
    movements: InventoryMovement[];
    expandedProduct: string | null;
    setExpandedProduct: (id: string | null) => void;
    onSave: (p: InventoryProduct) => Promise<void>;
    onBulkSave: (products: InventoryProduct[]) => Promise<void>;
    onDelete: (id: string) => void;
}) {
    // Single item editing
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editValues, setEditValues] = useState<{ variacion: string; costoInterno: string; precioProveedor: string; stockInicial: string }>({ variacion: '', costoInterno: '', precioProveedor: '', stockInicial: '' });
    // Group editing
    const [editingGroup, setEditingGroup] = useState<string | null>(null);
    const [groupEditValues, setGroupEditValues] = useState<Map<string, { variacion: string; costoInterno: string; precioProveedor: string; stockInicial: string }>>(new Map());
    const [groupShared, setGroupShared] = useState<{ costoInterno: string; precioProveedor: string }>({ costoInterno: '', precioProveedor: '' });
    const [saving, setSaving] = useState(false);
    // Sorting & filtering
    const [searchTerm, setSearchTerm] = useState('');
    const [sortBy, setSortBy] = useState<'nombre' | 'stock' | 'precio' | 'totalInv'>('nombre');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

    const toggleSort = (col: typeof sortBy) => {
        if (sortBy === col) { setSortDir(d => d === 'asc' ? 'desc' : 'asc'); }
        else { setSortBy(col); setSortDir(col === 'nombre' ? 'asc' : 'desc'); }
    };

    const SortIcon = ({ col }: { col: typeof sortBy }) => (
        sortBy === col
            ? <span className="text-blue-400 ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>
            : <span className="text-muted/40 ml-1">↕</span>
    );

    const startEdit = (p: InventoryProduct) => {
        setEditingGroup(null);
        setEditingId(p.id);
        setEditValues({
            variacion: p.variacion,
            costoInterno: String(p.costoInterno),
            precioProveedor: String(p.precioProveedor),
            stockInicial: String(p.stockInicial),
        });
    };

    const startGroupEdit = (items: InventoryProduct[], productoId: string) => {
        setEditingId(null);
        setEditingGroup(productoId);
        setExpandedProduct(productoId);
        const map = new Map<string, { variacion: string; costoInterno: string; precioProveedor: string; stockInicial: string }>();
        for (const p of items) {
            map.set(p.id, {
                variacion: p.variacion,
                costoInterno: String(p.costoInterno),
                precioProveedor: String(p.precioProveedor),
                stockInicial: String(p.stockInicial),
            });
        }
        setGroupEditValues(map);
        // Pre-fill shared fields if all variations have the same value
        const costos = new Set(items.map(p => p.costoInterno));
        const precios = new Set(items.map(p => p.precioProveedor));
        setGroupShared({
            costoInterno: costos.size === 1 ? String(items[0].costoInterno) : '',
            precioProveedor: precios.size === 1 ? String(items[0].precioProveedor) : '',
        });
    };

    const cancelEdit = () => { setEditingId(null); setEditingGroup(null); };

    const saveEdit = async (p: InventoryProduct) => {
        setSaving(true);
        try {
            await onSave({
                ...p,
                variacion: editValues.variacion,
                costoInterno: Number(editValues.costoInterno) || 0,
                precioProveedor: Number(editValues.precioProveedor) || 0,
                stockInicial: Number(editValues.stockInicial) || 0,
                updatedAt: Date.now(),
            });
            setEditingId(null);
        } finally { setSaving(false); }
    };

    const saveGroupEdit = async (items: InventoryProduct[]) => {
        setSaving(true);
        try {
            const updated = items.map(p => {
                const vals = groupEditValues.get(p.id);
                if (!vals) return p;
                return {
                    ...p,
                    variacion: vals.variacion,
                    costoInterno: Number(vals.costoInterno) || 0,
                    precioProveedor: Number(vals.precioProveedor) || 0,
                    stockInicial: Number(vals.stockInicial) || 0,
                    updatedAt: Date.now(),
                };
            });
            await onBulkSave(updated);
            setEditingGroup(null);
        } finally { setSaving(false); }
    };

    // Apply shared field to all variations in group
    const applySharedToAll = (field: 'costoInterno' | 'precioProveedor', value: string) => {
        setGroupShared(prev => ({ ...prev, [field]: value }));
        setGroupEditValues(prev => {
            const next = new Map(prev);
            for (const [id, vals] of next) {
                next.set(id, { ...vals, [field]: value });
            }
            return next;
        });
    };

    const updateGroupItem = (id: string, field: string, value: string) => {
        setGroupEditValues(prev => {
            const next = new Map(prev);
            const vals = next.get(id);
            if (vals) next.set(id, { ...vals, [field]: value });
            return next;
        });
    };

    const inputClass = "bg-hover-bg/50 border border-sidebar-border rounded px-1.5 py-0.5 text-xs text-foreground w-full text-right focus:outline-none focus:border-blue-500/50";

    // Group inventory by productoId, then filter & sort
    const grouped = useMemo(() => {
        const map = new Map<string, { nombre: string; productoId: string; items: InventoryProduct[] }>();
        for (const p of inventory) {
            const key = p.productoId || p.id;
            const existing = map.get(key);
            if (existing) {
                existing.items.push(p);
            } else {
                map.set(key, { nombre: p.nombre, productoId: p.productoId, items: [p] });
            }
        }
        let arr = Array.from(map.values());
        // Filter by search
        if (searchTerm) {
            const q = searchTerm.toUpperCase();
            arr = arr.filter(g => g.nombre.toUpperCase().includes(q) || g.productoId.includes(q) || g.items.some(p => p.variacionId.includes(q)));
        }
        // Sort
        arr.sort((a, b) => {
            let cmp = 0;
            if (sortBy === 'nombre') {
                cmp = a.nombre.localeCompare(b.nombre);
            } else if (sortBy === 'stock') {
                cmp = a.items.reduce((s, p) => s + p.stockActual, 0) - b.items.reduce((s, p) => s + p.stockActual, 0);
            } else if (sortBy === 'precio') {
                const ap = a.items.reduce((s, p) => s + p.precioProveedor, 0) / a.items.length;
                const bp = b.items.reduce((s, p) => s + p.precioProveedor, 0) / b.items.length;
                cmp = ap - bp;
            } else if (sortBy === 'totalInv') {
                const at = a.items.reduce((s, p) => s + p.stockActual * (p.costoInterno || p.precioProveedor), 0);
                const bt = b.items.reduce((s, p) => s + p.stockActual * (p.costoInterno || p.precioProveedor), 0);
                cmp = at - bt;
            }
            return sortDir === 'asc' ? cmp : -cmp;
        });
        return arr;
    }, [inventory, searchTerm, sortBy, sortDir]);

    // Grand total & max stock (for mini bar)
    const grandTotalInv = useMemo(() => inventory.reduce((s, p) => s + p.stockActual * (p.costoInterno || p.precioProveedor), 0), [inventory]);
    const grandTotalStock = useMemo(() => inventory.reduce((s, p) => s + p.stockActual, 0), [inventory]);
    const maxStock = useMemo(() => {
        // For grouped rows, compute max stock per group
        const groupStocks: number[] = [];
        const map = new Map<string, number>();
        for (const p of inventory) {
            const key = p.productoId || p.id;
            map.set(key, (map.get(key) || 0) + p.stockActual);
        }
        for (const v of map.values()) groupStocks.push(v);
        return Math.max(...groupStocks, 1);
    }, [inventory]);

    const fmtCompact = (v: number) => {
        const abs = Math.abs(v);
        if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
        if (abs >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
        return fmtNum(Math.round(v));
    };

    const MargenBadge = ({ precio, costo, isEditing }: { precio: number; costo: number; isEditing?: boolean }) => {
        if (isEditing || costo <= 0) return <span className="text-muted text-xs">—</span>;
        const margen = precio - costo;
        const pct = (margen / precio) * 100;
        const isPositive = margen >= 0;
        return (
            <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold ${isPositive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                {isPositive ? '+' : ''}${fmtCompact(margen)} ({pct.toFixed(0)}%)
            </span>
        );
    };

    const StockBar = ({ stock }: { stock: number }) => {
        const pct = Math.min(100, (stock / maxStock) * 100);
        return (
            <div className="w-full h-1 bg-gray-800 rounded-full mt-1">
                <div style={{ width: `${pct}%` }} className={`h-full rounded-full ${stock <= 0 ? 'bg-red-500/60' : 'bg-emerald-500/60'}`} />
            </div>
        );
    };

    const renderSingleRow = (p: InventoryProduct) => {
        const isEditing = editingId === p.id;
        const margen = p.precioProveedor - p.costoInterno;
        const prodMovements = movements.filter(
            m => m.productoId === p.productoId && m.variacionId === p.variacionId
        ).sort((a, b) => b.createdAt - a.createdAt);
        const isExp = expandedProduct === p.id;

        return (
            <React.Fragment key={p.id}>
                <tr className={`border-b border-sidebar-border/50 hover:bg-hover-bg/30 ${isEditing ? 'bg-blue-500/5' : ''} cursor-pointer`}
                    onClick={() => !isEditing && setExpandedProduct(isExp ? null : p.id)}>
                    <td className="py-2.5 px-4 text-foreground font-medium">
                        <div className="flex items-center gap-2">
                            {prodMovements.length > 0 && (isExp ? <ChevronDown className="w-3 h-3 text-muted" /> : <ChevronRight className="w-3 h-3 text-muted" />)}
                            {p.nombre}
                        </div>
                    </td>
                    <td className="py-2.5 px-3 text-emerald-400 text-xs font-mono">{p.productoId || '—'}</td>
                    <td className="py-2.5 px-3 text-blue-400 text-xs font-mono">{p.variacionId || '—'}</td>
                    <td className="py-2.5 px-4 text-right" onClick={e => isEditing && e.stopPropagation()}>
                        {isEditing ? <input type="number" value={editValues.stockInicial} onChange={e => setEditValues(v => ({ ...v, stockInicial: e.target.value }))} className={inputClass} />
                            : <div><span className={`font-bold ${p.stockActual <= 0 ? 'text-red-400' : 'text-foreground'}`}>{fmtNum(p.stockActual)}</span><StockBar stock={p.stockActual} /></div>}
                    </td>
                    <td className="py-2.5 px-4 text-right" onClick={e => isEditing && e.stopPropagation()}>
                        {isEditing ? <input type="number" value={editValues.costoInterno} onChange={e => setEditValues(v => ({ ...v, costoInterno: e.target.value }))} className={inputClass} placeholder="$0" />
                            : <span className="text-muted">{p.costoInterno > 0 ? fmtFull(p.costoInterno) : '—'}</span>}
                    </td>
                    <td className="py-2.5 px-4 text-right" onClick={e => isEditing && e.stopPropagation()}>
                        {isEditing ? <input type="number" value={editValues.precioProveedor} onChange={e => setEditValues(v => ({ ...v, precioProveedor: e.target.value }))} className={inputClass} />
                            : <span className="text-foreground">{fmtFull(p.precioProveedor)}</span>}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                        <MargenBadge precio={p.precioProveedor} costo={p.costoInterno} isEditing={isEditing} />
                    </td>
                    <td className="py-2.5 px-4 text-right">
                        <span className="text-amber-400 font-medium">{fmtFull(p.stockActual * (p.costoInterno || p.precioProveedor))}</span>
                    </td>
                    <td className="py-2.5 px-4 text-center" onClick={e => e.stopPropagation()}>
                        {isEditing ? (
                            <div className="flex items-center justify-center gap-1">
                                <button onClick={() => saveEdit(p)} disabled={saving} className="text-emerald-400 hover:text-emerald-300 disabled:opacity-50"><Check className="w-4 h-4" /></button>
                                <button onClick={cancelEdit} className="text-muted hover:text-foreground"><X className="w-4 h-4" /></button>
                            </div>
                        ) : (
                            <div className="flex items-center justify-center gap-2">
                                <button onClick={() => startEdit(p)} className="text-muted hover:text-foreground"><Edit3 className="w-3.5 h-3.5" /></button>
                                <button onClick={() => onDelete(p.id)} className="text-muted hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                        )}
                    </td>
                </tr>
                {isExp && prodMovements.length > 0 && (
                    <tr><td colSpan={9} className="bg-hover-bg/20 px-8 py-3">
                        <p className="text-[10px] font-bold text-muted uppercase mb-2">Historial de Movimientos</p>
                        <div className="space-y-1">
                            {prodMovements.slice(0, 20).map(m => (
                                <div key={m.id} className="flex items-center gap-3 text-xs">
                                    <span className="text-muted w-20">{m.fecha}</span>
                                    <span className={`font-medium w-20 ${m.tipo === 'despacho' ? 'text-red-400' : 'text-emerald-400'}`}>
                                        {m.tipo === 'compra' ? 'Compra' : m.tipo === 'devolucion' ? 'Devolución' : m.tipo === 'despacho' ? 'Despacho' : 'Ajuste'}
                                    </span>
                                    <span className={`font-mono ${m.cantidad > 0 ? 'text-emerald-400' : 'text-red-400'}`}>{m.cantidad > 0 ? '+' : ''}{m.cantidad}</span>
                                    {m.notas && <span className="text-muted truncate">{m.notas}</span>}
                                </div>
                            ))}
                        </div>
                    </td></tr>
                )}
            </React.Fragment>
        );
    };

    return (
        <div className="bg-card border border-sidebar-border rounded-xl overflow-hidden">
            {/* Search bar */}
            <div className="px-4 py-3 border-b border-sidebar-border bg-hover-bg/20 flex items-center gap-3">
                <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                    placeholder="Buscar por nombre o ID..."
                    className="bg-hover-bg/50 border border-sidebar-border rounded-lg px-3 py-1.5 text-sm text-foreground flex-1 focus:outline-none focus:border-blue-500/50" />
                <span className="text-[10px] text-muted whitespace-nowrap">{grouped.length} productos</span>
            </div>
            <table className="w-full text-sm">
                <thead>
                    <tr className="border-b border-sidebar-border bg-hover-bg/30">
                        <th className="text-left py-3 px-4 text-[10px] font-bold text-muted uppercase cursor-pointer select-none" onClick={() => toggleSort('nombre')}>
                            Producto<SortIcon col="nombre" />
                        </th>
                        <th className="text-left py-3 px-3 text-[10px] font-bold text-muted uppercase">ID Prod.</th>
                        <th className="text-left py-3 px-3 text-[10px] font-bold text-muted uppercase">ID Var.</th>
                        <th className="text-right py-3 px-4 text-[10px] font-bold text-muted uppercase cursor-pointer select-none" onClick={() => toggleSort('stock')}>
                            Stock<SortIcon col="stock" />
                        </th>
                        <th className="text-right py-3 px-4 text-[10px] font-bold text-muted uppercase">Costo Int.</th>
                        <th className="text-right py-3 px-4 text-[10px] font-bold text-muted uppercase cursor-pointer select-none" onClick={() => toggleSort('precio')}>
                            Precio Prov.<SortIcon col="precio" />
                        </th>
                        <th className="text-right py-3 px-4 text-[10px] font-bold text-muted uppercase">Margen</th>
                        <th className="text-right py-3 px-4 text-[10px] font-bold text-muted uppercase cursor-pointer select-none" onClick={() => toggleSort('totalInv')}>
                            Total $ Inv.<SortIcon col="totalInv" />
                        </th>
                        <th className="text-center py-3 px-4 text-[10px] font-bold text-muted uppercase">Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    {grouped.map(g => {
                        const hasVariations = g.items.length > 1;
                        const isExpanded = expandedProduct === g.productoId;
                        const isGroupEditing = editingGroup === g.productoId;

                        if (!hasVariations) {
                            return renderSingleRow(g.items[0]);
                        }

                        // Multiple variations — grouped row
                        const totalStock = g.items.reduce((s, p) => s + p.stockActual, 0);
                        const avgPrecio = g.items.reduce((s, p) => s + p.precioProveedor, 0) / g.items.length;
                        const avgCosto = g.items.reduce((s, p) => s + p.costoInterno, 0) / g.items.length;

                        return (
                            <React.Fragment key={g.productoId}>
                                <tr className={`border-b border-sidebar-border/50 hover:bg-hover-bg/30 cursor-pointer ${isGroupEditing ? 'bg-blue-500/5' : ''}`}
                                    onClick={() => !isGroupEditing && setExpandedProduct(isExpanded ? null : g.productoId)}>
                                    <td className="py-2.5 px-4 text-foreground font-medium">
                                        <div className="flex items-center gap-2">
                                            {(isExpanded || isGroupEditing) ? <ChevronDown className="w-3 h-3 text-muted" /> : <ChevronRight className="w-3 h-3 text-muted" />}
                                            {g.nombre}
                                            <span className="text-[10px] text-muted">({g.items.length} var.)</span>
                                        </div>
                                    </td>
                                    <td className="py-2.5 px-3 text-emerald-400 text-xs font-mono">{g.productoId}</td>
                                    <td className="py-2.5 px-3 text-muted text-xs">—</td>
                                    <td className="py-2.5 px-4 text-right">
                                        <div><span className={`font-bold ${totalStock <= 0 ? 'text-red-400' : 'text-foreground'}`}>{fmtNum(totalStock)}</span><StockBar stock={totalStock} /></div>
                                    </td>
                                    <td className="py-2.5 px-4 text-right" onClick={e => isGroupEditing && e.stopPropagation()}>
                                        {isGroupEditing ? (
                                            <input type="number" value={groupShared.costoInterno} onChange={e => applySharedToAll('costoInterno', e.target.value)}
                                                className={inputClass} placeholder="Aplicar a todas" />
                                        ) : (
                                            <span className="text-muted">{avgCosto > 0 ? fmtFull(avgCosto) : '—'}</span>
                                        )}
                                    </td>
                                    <td className="py-2.5 px-4 text-right" onClick={e => isGroupEditing && e.stopPropagation()}>
                                        {isGroupEditing ? (
                                            <input type="number" value={groupShared.precioProveedor} onChange={e => applySharedToAll('precioProveedor', e.target.value)}
                                                className={inputClass} placeholder="Aplicar a todas" />
                                        ) : (
                                            <span className="text-foreground">{fmtFull(avgPrecio)}</span>
                                        )}
                                    </td>
                                    <td className="py-2.5 px-4 text-right">
                                        <MargenBadge precio={avgPrecio} costo={avgCosto} />
                                    </td>
                                    <td className="py-2.5 px-4 text-right">
                                        <span className="text-amber-400 font-medium">{fmtFull(g.items.reduce((s, p) => s + p.stockActual * (p.costoInterno || p.precioProveedor), 0))}</span>
                                    </td>
                                    <td className="py-2.5 px-4 text-center" onClick={e => e.stopPropagation()}>
                                        {isGroupEditing ? (
                                            <div className="flex items-center justify-center gap-1">
                                                <button onClick={() => saveGroupEdit(g.items)} disabled={saving}
                                                    className="text-emerald-400 hover:text-emerald-300 disabled:opacity-50"><Check className="w-4 h-4" /></button>
                                                <button onClick={cancelEdit} className="text-muted hover:text-foreground"><X className="w-4 h-4" /></button>
                                            </div>
                                        ) : (
                                            <button onClick={() => startGroupEdit(g.items, g.productoId)} className="text-muted hover:text-foreground">
                                                <Edit3 className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                                {(isExpanded || isGroupEditing) && g.items.map(p => {
                                    const vals = groupEditValues.get(p.id);
                                    const margen = p.precioProveedor - p.costoInterno;
                                    return (
                                        <tr key={p.id} className={`border-b border-sidebar-border/30 bg-hover-bg/20 ${isGroupEditing ? 'bg-blue-500/5' : ''}`}>
                                            <td className="py-2 px-4 pl-10 text-xs">
                                                {isGroupEditing && vals ? (
                                                    <input value={vals.variacion} onChange={e => updateGroupItem(p.id, 'variacion', e.target.value)}
                                                        className={`${inputClass} !text-left`} placeholder="Nombre variación" />
                                                ) : p.variacion ? (
                                                    <span className="text-foreground/80">{p.variacion}</span>
                                                ) : p.variacionId ? (
                                                    <span className="text-muted italic">ID: {p.variacionId}</span>
                                                ) : (
                                                    <span className="text-muted">Sin variación</span>
                                                )}
                                            </td>
                                            <td className="py-2 px-3 text-emerald-400/60 text-[10px] font-mono">{p.productoId}</td>
                                            <td className="py-2 px-3 text-blue-400 text-xs font-mono">{p.variacionId || '—'}</td>
                                            <td className="py-2 px-4 text-right">
                                                {isGroupEditing && vals ? (
                                                    <input type="number" value={vals.stockInicial} onChange={e => updateGroupItem(p.id, 'stockInicial', e.target.value)}
                                                        className={inputClass} />
                                                ) : (
                                                    <span className={`text-xs font-bold ${p.stockActual <= 0 ? 'text-red-400' : 'text-foreground'}`}>{fmtNum(p.stockActual)}</span>
                                                )}
                                            </td>
                                            <td className="py-2 px-4 text-right">
                                                {isGroupEditing && vals ? (
                                                    <input type="number" value={vals.costoInterno} onChange={e => updateGroupItem(p.id, 'costoInterno', e.target.value)}
                                                        className={inputClass} placeholder="$0" />
                                                ) : (
                                                    <span className="text-muted text-xs">{p.costoInterno > 0 ? fmtFull(p.costoInterno) : '—'}</span>
                                                )}
                                            </td>
                                            <td className="py-2 px-4 text-right">
                                                {isGroupEditing && vals ? (
                                                    <input type="number" value={vals.precioProveedor} onChange={e => updateGroupItem(p.id, 'precioProveedor', e.target.value)}
                                                        className={inputClass} />
                                                ) : (
                                                    <span className="text-foreground text-xs">{fmtFull(p.precioProveedor)}</span>
                                                )}
                                            </td>
                                            <td className="py-2 px-4 text-right">
                                                <MargenBadge precio={p.precioProveedor} costo={p.costoInterno} isEditing={isGroupEditing} />
                                            </td>
                                            <td className="py-2 px-4 text-right">
                                                <span className="text-amber-400/70 text-xs">{fmtFull(p.stockActual * (p.costoInterno || p.precioProveedor))}</span>
                                            </td>
                                            <td className="py-2 px-4 text-center">
                                                {!isGroupEditing && (
                                                    <div className="flex items-center justify-center gap-2">
                                                        <button onClick={() => startEdit(p)} className="text-muted hover:text-foreground"><Edit3 className="w-3 h-3" /></button>
                                                        <button onClick={() => onDelete(p.id)} className="text-muted hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </React.Fragment>
                        );
                    })}
                </tbody>
                <tfoot>
                    <tr className="border-t border-sidebar-border bg-hover-bg/40">
                        <td className="py-3 px-4 text-foreground font-bold text-xs" colSpan={3}>TOTAL INVENTARIO</td>
                        <td className="py-3 px-4 text-right font-bold text-foreground">{fmtNum(grandTotalStock)}</td>
                        <td className="py-3 px-4" colSpan={3}></td>
                        <td className="py-3 px-4 text-right font-bold text-amber-400">{fmtFull(grandTotalInv)}</td>
                        <td className="py-3 px-4"></td>
                    </tr>
                </tfoot>
            </table>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// INVENTARIO TAB
// ═══════════════════════════════════════════════════════════════════════════
function InventarioTab({ data, userId }: { data: ReturnType<typeof useSupplierData>; userId: string }) {
    const { inventory, movements, availableProducts, stockAlerts, orders } = data;
    const [showForm, setShowForm] = useState(false);
    const [editingProduct, setEditingProduct] = useState<InventoryProduct | null>(null);
    const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    // Import inventory file state
    const [importing, setImporting] = useState(false);
    const [importPreview, setImportPreview] = useState<ParsedInventoryProduct[] | null>(null);

    // Sync panel state
    const [showSync, setShowSync] = useState(false);
    const [syncSaving, setSyncSaving] = useState<string | null>(null); // id of product being linked

    // Form state
    const [formProductoId, setFormProductoId] = useState('');
    const [formNombre, setFormNombre] = useState('');
    const [formVariacionId, setFormVariacionId] = useState('');
    const [formVariacion, setFormVariacion] = useState('');
    const [formCostoInterno, setFormCostoInterno] = useState('');
    const [formPrecioProveedor, setFormPrecioProveedor] = useState('');
    const [formStockInicial, setFormStockInicial] = useState('');

    const resetForm = () => {
        setFormProductoId(''); setFormNombre(''); setFormVariacionId(''); setFormVariacion('');
        setFormCostoInterno(''); setFormPrecioProveedor(''); setFormStockInicial('');
        setEditingProduct(null); setShowForm(false);
    };

    const handleEdit = (p: InventoryProduct) => {
        setEditingProduct(p);
        setFormProductoId(p.productoId); setFormNombre(p.nombre);
        setFormVariacionId(p.variacionId); setFormVariacion(p.variacion);
        setFormCostoInterno(String(p.costoInterno)); setFormPrecioProveedor(String(p.precioProveedor));
        setFormStockInicial(String(p.stockInicial));
        setShowForm(true);
    };

    const handleSave = async () => {
        if (!formProductoId || !formNombre) return;
        setSaving(true);
        try {
            const now = Date.now();
            const product: InventoryProduct = {
                id: editingProduct?.id || `inv_${now}`,
                productoId: formProductoId,
                nombre: formNombre,
                variacionId: formVariacionId,
                variacion: formVariacion,
                costoInterno: Number(formCostoInterno) || 0,
                precioProveedor: Number(formPrecioProveedor) || 0,
                stockInicial: Number(formStockInicial) || 0,
                stockActual: 0,
                alertaStock30: true,
                alertaStock7: true,
                createdAt: editingProduct?.createdAt || now,
                updatedAt: now,
            };
            await saveInventoryProduct(product, userId);
            resetForm();
            data.refresh();
        } finally { setSaving(false); }
    };

    const handleDelete = async (id: string) => {
        await deleteInventoryProduct(id, userId);
        data.refresh();
    };

    // Select product from Dropi catalog — key is "PRODUCTO_ID_VARIACION_ID"
    const handleSelectFromCatalog = (catalogKey: string) => {
        if (!catalogKey) return;
        const prod = availableProducts.find(p => `${p.id}_${p.variacionId}` === catalogKey);
        if (prod) {
            setFormProductoId(prod.id);
            // When editing, keep original name; when creating, use Dropi name
            if (!editingProduct) setFormNombre(prod.name);
            setFormVariacionId(prod.variacionId);
            setFormVariacion(prod.variacion);
            setFormPrecioProveedor(prod.precioProveedor > 0 ? String(prod.precioProveedor) : '');
        }
    };

    // Import inventory file
    const handleInventoryFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setImporting(true);
        try {
            const parsed = await parseInventoryFile(file);
            setImportPreview(parsed);
        } catch (err: any) {
            alert(err.message || 'Error al parsear inventario');
        } finally {
            setImporting(false);
            e.target.value = '';
        }
    };

    // Build a lookup map: productoId_variacionId → variation name from supplier orders
    const variationNameMap = useMemo(() => {
        const map = new Map<string, string>();
        for (const o of orders) {
            if (o.PRODUCTO_ID && o.VARIACION && o.VARIACION_ID) {
                const key = `${o.PRODUCTO_ID}_${o.VARIACION_ID}`;
                if (!map.has(key)) map.set(key, o.VARIACION);
            }
        }
        return map;
    }, [orders]);

    const handleImportConfirm = async () => {
        if (!importPreview) return;
        setSaving(true);
        try {
            const now = Date.now();
            const products: InventoryProduct[] = importPreview.map(p => {
                // Try to get variation name from supplier orders
                const nameFromOrders = p.variacionId ? variationNameMap.get(`${p.productoId}_${p.variacionId}`) : '';
                return {
                    id: `inv_import_${now}_${Math.random().toString(36).slice(2, 8)}`,
                    productoId: p.productoId,
                    nombre: p.nombre,
                    variacionId: p.variacionId,
                    variacion: nameFromOrders || '',
                    costoInterno: 0, // No viene en el reporte de Dropi
                    precioProveedor: p.precio, // PRECIO = precio proveedor
                    stockInicial: p.stock,
                    stockActual: 0,
                    alertaStock30: true,
                    alertaStock7: true,
                    createdAt: now,
                    updatedAt: now,
                };
            });
            await bulkSaveInventory(products, userId);
            setImportPreview(null);
            data.refresh();
        } finally { setSaving(false); }
    };

    // Sync variation names from supplier orders into existing inventory
    const handleSyncVariationNames = async () => {
        if (variationNameMap.size === 0) return;
        setSaving(true);
        try {
            let updated = 0;
            const updatedProducts: InventoryProduct[] = inventory.map(p => {
                if (!p.variacionId) return p;
                const name = variationNameMap.get(`${p.productoId}_${p.variacionId}`);
                if (name && name !== p.variacion) {
                    updated++;
                    return { ...p, variacion: name, updatedAt: Date.now() };
                }
                return p;
            });
            if (updated > 0) {
                await bulkSaveInventory(updatedProducts, userId);
                data.refresh();
                alert(`Se actualizaron ${updated} nombres de variación desde las órdenes.`);
            } else {
                alert('Todos los nombres de variación ya están sincronizados.');
            }
        } finally { setSaving(false); }
    };

    // Delete all inventory
    const handleClearAll = async () => {
        if (!confirm('¿Estás seguro? Se eliminará TODO el inventario y movimientos. Esta acción no se puede deshacer.')) return;
        setSaving(true);
        try {
            await clearAllInventory(userId);
            data.refresh();
        } finally { setSaving(false); }
    };

    // ── Sync helpers ────────────────────────────────────────────────────────
    // Simple word-overlap scoring for fuzzy name matching
    const scoreMatch = (invName: string, dropiName: string): number => {
        const a = invName.toUpperCase().replace(/[^A-Z0-9\s]/g, '').split(/\s+/).filter(Boolean);
        const b = dropiName.toUpperCase().replace(/[^A-Z0-9\s]/g, '').split(/\s+/).filter(Boolean);
        if (a.length === 0 || b.length === 0) return 0;
        let matches = 0;
        for (const word of a) {
            if (b.some(w => w.includes(word) || word.includes(w))) matches++;
        }
        return matches / Math.max(a.length, b.length);
    };

    // Compute sync recommendations
    const unlinkedProducts = inventory.filter(p => !p.productoId);
    const linkedCount = inventory.length - unlinkedProducts.length;

    const syncRecommendations = useMemo(() => {
        if (!showSync) return [];
        return unlinkedProducts.map(invProd => {
            // Score every Dropi catalog product against this inventory product
            const scored = availableProducts.map(dp => ({
                ...dp,
                score: scoreMatch(invProd.nombre, dp.name + (dp.variacion ? ` ${dp.variacion}` : '')),
            })).filter(s => s.score > 0).sort((a, b) => b.score - a.score);
            return {
                inventoryProduct: invProd,
                suggestions: scored.slice(0, 3), // top 3
            };
        });
    }, [showSync, unlinkedProducts.length, availableProducts.length]);

    const handleLink = async (invProduct: InventoryProduct, dropiProduct: { id: string; variacionId: string; variacion: string; precioProveedor: number }) => {
        setSyncSaving(invProduct.id);
        try {
            const updated: InventoryProduct = {
                ...invProduct,
                productoId: dropiProduct.id,
                variacionId: dropiProduct.variacionId,
                variacion: dropiProduct.variacion,
                precioProveedor: dropiProduct.precioProveedor || invProduct.precioProveedor,
                updatedAt: Date.now(),
            };
            await saveInventoryProduct(updated, userId);
            data.refresh();
        } finally { setSyncSaving(null); }
    };

    const handleLinkAll = async () => {
        // Auto-link all products that have a high-confidence match (score >= 0.5)
        setSaving(true);
        try {
            const toUpdate: InventoryProduct[] = [];
            for (const rec of syncRecommendations) {
                if (rec.suggestions.length > 0 && rec.suggestions[0].score >= 0.5) {
                    const best = rec.suggestions[0];
                    toUpdate.push({
                        ...rec.inventoryProduct,
                        productoId: best.id,
                        variacionId: best.variacionId,
                        variacion: best.variacion,
                        precioProveedor: best.precioProveedor || rec.inventoryProduct.precioProveedor,
                        updatedAt: Date.now(),
                    });
                }
            }
            if (toUpdate.length > 0) {
                await bulkSaveInventory(toUpdate, userId);
                data.refresh();
            }
        } finally { setSaving(false); }
    };

    // KPI computations
    const kpiProductCount = useMemo(() => {
        const groups = new Set(inventory.map(p => p.productoId));
        return groups.size;
    }, [inventory]);
    const kpiTotalStock = useMemo(() => inventory.reduce((s, p) => s + p.stockActual, 0), [inventory]);
    const kpiValorInventario = useMemo(() => inventory.reduce((s, p) => s + p.stockActual * (p.costoInterno || p.precioProveedor), 0), [inventory]);
    const kpiMargenPromedio = useMemo(() => {
        const items = inventory.filter(p => p.precioProveedor > 0 && p.costoInterno > 0);
        if (items.length === 0) return 0;
        const totalMargen = items.reduce((s, p) => s + ((p.precioProveedor - p.costoInterno) / p.precioProveedor) * 100, 0);
        return totalMargen / items.length;
    }, [inventory]);

    return (
        <div className="space-y-6">
            {/* KPI Summary Cards */}
            {inventory.length > 0 && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="bg-card border border-card-border rounded-xl p-3">
                        <div className="flex items-center gap-2 mb-1">
                            <Package className="w-3.5 h-3.5 text-muted" />
                            <span className="text-[10px] font-bold text-muted uppercase">Productos</span>
                        </div>
                        <p className="text-xl font-bold text-foreground">{fmtNum(kpiProductCount)}</p>
                        <p className="text-[10px] text-muted">{fmtNum(inventory.length)} variaciones</p>
                    </div>
                    <div className="bg-card border border-card-border rounded-xl p-3">
                        <div className="flex items-center gap-2 mb-1">
                            <BarChart3 className="w-3.5 h-3.5 text-muted" />
                            <span className="text-[10px] font-bold text-muted uppercase">Stock Total</span>
                        </div>
                        <p className="text-xl font-bold text-foreground">{fmtNum(kpiTotalStock)}</p>
                        <p className="text-[10px] text-muted">unidades</p>
                    </div>
                    <div className="bg-card border border-card-border rounded-xl p-3">
                        <div className="flex items-center gap-2 mb-1">
                            <DollarSign className="w-3.5 h-3.5 text-amber-400" />
                            <span className="text-[10px] font-bold text-muted uppercase">Valor Inventario</span>
                        </div>
                        <p className="text-xl font-bold text-amber-400">{fmtFull(kpiValorInventario)}</p>
                        <p className="text-[10px] text-muted">costo interno</p>
                    </div>
                    <div className="bg-card border border-card-border rounded-xl p-3">
                        <div className="flex items-center gap-2 mb-1">
                            <TrendingUp className={`w-3.5 h-3.5 ${kpiMargenPromedio >= 0 ? 'text-emerald-400' : 'text-red-400'}`} />
                            <span className="text-[10px] font-bold text-muted uppercase">Margen Promedio</span>
                        </div>
                        <p className={`text-xl font-bold ${kpiMargenPromedio >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{kpiMargenPromedio.toFixed(1)}%</p>
                        <p className="text-[10px] text-muted">proveedor vs costo</p>
                    </div>
                </div>
            )}

            {/* Action Bar */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <button onClick={() => { resetForm(); setShowForm(true); }}
                    className="flex items-center gap-2 px-4 py-2 bg-[#d75c33] text-white rounded-xl text-sm font-medium hover:bg-[#d75c33]/90 transition-all">
                    <Plus className="w-4 h-4" /> Agregar Producto
                </button>
                <div className="flex items-center gap-2 flex-wrap">
                    <label className="flex items-center gap-2 px-3 py-2 border border-sidebar-border rounded-xl text-xs font-medium text-muted hover:text-foreground hover:bg-hover-bg transition-all cursor-pointer">
                        {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                        Importar Excel
                        <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleInventoryFile} />
                    </label>
                    {inventory.length > 0 && (
                        <button onClick={() => setShowSync(!showSync)}
                            className={`flex items-center gap-2 px-3 py-2 border rounded-xl text-xs font-medium transition-all ${showSync ? 'border-purple-500/50 text-purple-400 bg-purple-500/10' : 'border-sidebar-border text-muted hover:text-foreground hover:bg-hover-bg'}`}>
                            <RefreshCw className="w-3.5 h-3.5" />
                            Sync Dropi
                            {unlinkedProducts.length > 0 && (
                                <span className="bg-amber-500/20 text-amber-400 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{unlinkedProducts.length}</span>
                            )}
                        </button>
                    )}
                    {inventory.length > 0 && variationNameMap.size > 0 && (() => {
                        const unnamed = inventory.filter(p => p.variacionId && !p.variacion).length;
                        return unnamed > 0 ? (
                            <button onClick={handleSyncVariationNames} disabled={saving}
                                className="flex items-center gap-2 px-3 py-2 border border-blue-500/30 rounded-xl text-xs font-medium text-blue-400 hover:bg-blue-500/10 transition-all disabled:opacity-50">
                                <RefreshCw className="w-3.5 h-3.5" /> Sync nombres
                                <span className="bg-blue-500/20 text-blue-400 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{unnamed}</span>
                            </button>
                        ) : null;
                    })()}
                    {inventory.length > 0 && (
                        <button onClick={handleClearAll} disabled={saving}
                            className="flex items-center gap-2 px-3 py-2 border border-red-500/30 rounded-xl text-xs font-medium text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-50"
                            title="Eliminar todo el inventario">
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
            </div>

            {/* Sync Status Bar */}
            {inventory.length > 0 && (
                <div className="flex items-center gap-4 text-xs text-muted">
                    <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                        {linkedCount} enlazados con Dropi
                    </span>
                    {unlinkedProducts.length > 0 && (
                        <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                            {unlinkedProducts.length} sin enlazar
                        </span>
                    )}
                </div>
            )}

            {/* Import Preview */}
            {importPreview && (
                <div className="bg-card border border-blue-500/20 rounded-xl p-4 space-y-4">
                    <h3 className="text-sm font-bold text-blue-400">Vista previa — {importPreview.length} productos</h3>
                    <p className="text-xs text-muted">Producto ID y Variación ID se importan automáticamente desde el archivo de Dropi.</p>
                    <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                        <table className="w-full text-sm">
                            <thead className="sticky top-0 bg-card">
                                <tr className="border-b border-sidebar-border">
                                    <th className="text-left py-2 px-2 text-[10px] font-bold text-muted uppercase">Producto</th>
                                    <th className="text-left py-2 px-2 text-[10px] font-bold text-muted uppercase">ID Prod.</th>
                                    <th className="text-left py-2 px-2 text-[10px] font-bold text-muted uppercase">ID Var.</th>
                                    <th className="text-right py-2 px-2 text-[10px] font-bold text-muted uppercase">Stock</th>
                                    <th className="text-right py-2 px-2 text-[10px] font-bold text-muted uppercase">Precio</th>
                                    <th className="text-right py-2 px-2 text-[10px] font-bold text-muted uppercase">P. Sugerido</th>
                                </tr>
                            </thead>
                            <tbody>
                                {importPreview.map((p, i) => (
                                    <tr key={i} className="border-b border-sidebar-border/50">
                                        <td className="py-1.5 px-2 text-foreground">{p.nombre}</td>
                                        <td className="py-1.5 px-2 text-emerald-400 text-xs">{p.productoId}</td>
                                        <td className="py-1.5 px-2 text-blue-400 text-xs">{p.variacionId}</td>
                                        <td className="py-1.5 px-2 text-right text-foreground">{fmtNum(p.stock)}</td>
                                        <td className="py-1.5 px-2 text-right text-foreground">{fmtFull(p.precio)}</td>
                                        <td className="py-1.5 px-2 text-right text-muted">{p.precioSugerido > 0 ? fmtFull(p.precioSugerido) : '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={handleImportConfirm} disabled={saving}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                            Importar {importPreview.length} productos
                        </button>
                        <button onClick={() => setImportPreview(null)} className="px-4 py-2 text-sm text-muted">Cancelar</button>
                    </div>
                </div>
            )}

            {/* Sync Panel */}
            {showSync && (
                <div className="bg-card border border-purple-500/20 rounded-xl p-4 space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-purple-400 flex items-center gap-2">
                            <RefreshCw className="w-4 h-4" /> Sincronizar Inventario con Dropi
                        </h3>
                        {syncRecommendations.some(r => r.suggestions.length > 0 && r.suggestions[0].score >= 0.5) && (
                            <button onClick={handleLinkAll} disabled={saving}
                                className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-medium disabled:opacity-50">
                                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                                Enlazar todos (auto)
                            </button>
                        )}
                    </div>

                    {availableProducts.length === 0 ? (
                        <p className="text-xs text-amber-400">Primero importa un reporte de Dropi Proveedor en la pestaña Importar para poder sincronizar.</p>
                    ) : unlinkedProducts.length === 0 ? (
                        <p className="text-xs text-emerald-400">Todos los productos del inventario están enlazados con Dropi.</p>
                    ) : (
                        <div className="space-y-3 max-h-[500px] overflow-y-auto">
                            {syncRecommendations.map(rec => (
                                <div key={rec.inventoryProduct.id} className="border border-sidebar-border/50 rounded-lg p-3">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm font-medium text-foreground">{rec.inventoryProduct.nombre}</span>
                                        <span className="text-[10px] text-muted">Stock: {fmtNum(rec.inventoryProduct.stockActual)} | Costo: {fmtFull(rec.inventoryProduct.costoInterno)}</span>
                                    </div>
                                    {rec.suggestions.length > 0 ? (
                                        <div className="space-y-1.5">
                                            <p className="text-[10px] text-muted uppercase font-bold">Recomendaciones de Dropi:</p>
                                            {rec.suggestions.map((sug, i) => (
                                                <div key={`${sug.id}_${sug.variacionId}`} className="flex items-center justify-between bg-hover-bg/30 rounded-lg px-3 py-1.5">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${sug.score >= 0.5 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                                                            {Math.round(sug.score * 100)}%
                                                        </span>
                                                        <span className="text-sm text-foreground">{sug.name}</span>
                                                        {sug.variacion && <span className="text-xs text-muted">({sug.variacion})</span>}
                                                        <span className="text-[10px] text-muted">ID: {sug.id}</span>
                                                    </div>
                                                    <button
                                                        onClick={() => handleLink(rec.inventoryProduct, sug)}
                                                        disabled={syncSaving === rec.inventoryProduct.id}
                                                        className="flex items-center gap-1 px-2 py-1 bg-purple-600/80 text-white rounded text-xs font-medium hover:bg-purple-600 disabled:opacity-50">
                                                        {syncSaving === rec.inventoryProduct.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                                                        Enlazar
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-between">
                                            <p className="text-xs text-muted">No se encontraron coincidencias en Dropi</p>
                                            <select
                                                onChange={e => {
                                                    const prod = availableProducts.find(p => `${p.id}_${p.variacionId}` === e.target.value);
                                                    if (prod) handleLink(rec.inventoryProduct, prod);
                                                }}
                                                className="bg-card border border-sidebar-border rounded-lg px-2 py-1 text-xs text-foreground">
                                                <option value="">Enlazar manualmente...</option>
                                                {availableProducts.map(p => (
                                                    <option key={`${p.id}_${p.variacionId}`} value={`${p.id}_${p.variacionId}`}>
                                                        {p.name}{p.variacion ? ` - ${p.variacion}` : ''} (ID: {p.id})
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Add/Edit Product Form */}
            {showForm && (
                <div className="bg-card border border-sidebar-border rounded-xl p-4 space-y-4">
                    <h3 className="text-sm font-bold text-foreground">{editingProduct ? 'Editar Producto' : 'Nuevo Producto'}</h3>

                    {/* Quick select / link from Dropi catalog */}
                    {availableProducts.length > 0 && (
                        <div>
                            <label className="text-[10px] font-bold text-muted uppercase block mb-1">
                                {editingProduct ? 'Enlazar con producto Dropi' : 'Seleccionar de catálogo Dropi'}
                            </label>
                            <select onChange={e => handleSelectFromCatalog(e.target.value)} value="" className="bg-card border border-sidebar-border rounded-lg px-3 py-2 text-sm text-foreground w-full">
                                <option value="">— Buscar producto de Dropi —</option>
                                {availableProducts.map(p => {
                                    const key = `${p.id}_${p.variacionId}`;
                                    return <option key={key} value={key}>{p.name}{p.variacion ? ` - ${p.variacion}` : ''} (ID: {p.id})</option>;
                                })}
                            </select>
                            {editingProduct && formProductoId && (
                                <p className="text-[10px] text-emerald-400 mt-1">Enlazado: ID {formProductoId}{formVariacionId ? ` / Var: ${formVariacionId}` : ''}</p>
                            )}
                        </div>
                    )}

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div>
                            <label className="text-[10px] font-bold text-muted uppercase block mb-1">Producto ID *</label>
                            <input value={formProductoId} onChange={e => setFormProductoId(e.target.value)}
                                className="bg-card border border-sidebar-border rounded-lg px-3 py-2 text-sm text-foreground w-full" />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-muted uppercase block mb-1">Nombre *</label>
                            <input value={formNombre} onChange={e => setFormNombre(e.target.value)}
                                className="bg-card border border-sidebar-border rounded-lg px-3 py-2 text-sm text-foreground w-full" />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-muted uppercase block mb-1">Variación ID</label>
                            <input value={formVariacionId} onChange={e => setFormVariacionId(e.target.value)}
                                className="bg-card border border-sidebar-border rounded-lg px-3 py-2 text-sm text-foreground w-full" />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-muted uppercase block mb-1">Variación</label>
                            <input value={formVariacion} onChange={e => setFormVariacion(e.target.value)}
                                className="bg-card border border-sidebar-border rounded-lg px-3 py-2 text-sm text-foreground w-full" />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-muted uppercase block mb-1">Costo Interno</label>
                            <input type="number" value={formCostoInterno} onChange={e => setFormCostoInterno(e.target.value)}
                                className="bg-card border border-sidebar-border rounded-lg px-3 py-2 text-sm text-foreground w-full" placeholder="$0" />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-muted uppercase block mb-1">Precio Proveedor</label>
                            <input type="number" value={formPrecioProveedor} onChange={e => setFormPrecioProveedor(e.target.value)}
                                className="bg-card border border-sidebar-border rounded-lg px-3 py-2 text-sm text-foreground w-full" placeholder="$0" />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-muted uppercase block mb-1">Stock Inicial</label>
                            <input type="number" value={formStockInicial} onChange={e => setFormStockInicial(e.target.value)}
                                className="bg-card border border-sidebar-border rounded-lg px-3 py-2 text-sm text-foreground w-full" placeholder="0" />
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={handleSave} disabled={saving}
                            className="flex items-center gap-2 px-4 py-2 bg-[#d75c33] text-white rounded-lg text-sm font-medium disabled:opacity-50">
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                            {editingProduct ? 'Actualizar' : 'Guardar'}
                        </button>
                        <button onClick={resetForm} className="px-4 py-2 text-sm text-muted hover:text-foreground">Cancelar</button>
                    </div>
                </div>
            )}

            {/* Stock Alerts */}
            {stockAlerts.length > 0 && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
                    <h3 className="text-sm font-bold text-amber-400 flex items-center gap-2 mb-2">
                        <AlertTriangle className="w-4 h-4" /> Alertas de Stock
                    </h3>
                    {stockAlerts.map((alert, i) => (
                        <p key={i} className={`text-sm ${alert.nivel === '7dias' ? 'text-red-400' : 'text-amber-400'}`}>
                            <strong>{alert.product.nombre}</strong>{alert.product.variacion ? ` (${alert.product.variacion})` : ''}:
                            {' '}{alert.stockActual} unidades (~{Math.round(alert.diasRestantes)} días) — Promedio: {alert.promedioDespachosDiarios.toFixed(1)}/día
                        </p>
                    ))}
                </div>
            )}

            {/* Inventory Table — grouped by productoId */}
            {inventory.length > 0 ? (
                <InventoryTable
                    inventory={inventory}
                    movements={movements}
                    expandedProduct={expandedProduct}
                    setExpandedProduct={setExpandedProduct}
                    onSave={async (p) => { await saveInventoryProduct(p, userId); data.refresh(); }}
                    onBulkSave={async (products) => { await bulkSaveInventory(products, userId); data.refresh(); }}
                    onDelete={handleDelete}
                />
            ) : (
                <div className="text-center py-16">
                    <Package className="w-12 h-12 text-muted/30 mx-auto mb-4" />
                    <p className="text-muted text-sm">No hay productos en inventario. Agrega tu primer producto.</p>
                </div>
            )}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// DEVOLUCIONES TAB
// ═══════════════════════════════════════════════════════════════════════════
function DevolucionesTab({ data, userId }: { data: ReturnType<typeof useSupplierData>; userId: string }) {
    const { returns, unreportedReturns, orders } = data;
    const [uploading, setUploading] = useState(false);
    const [uploadResult, setUploadResult] = useState<{ imported: number; skipped: number } | null>(null);

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !userId) return;
        setUploading(true);
        setUploadResult(null);
        try {
            const rawReturns = await parseReturnsFile(file);
            const resolved = resolveReturnProducts(rawReturns, orders);
            const result = await bulkImportReturns(resolved, userId);

            // Create inventory movements for resolved returns
            if (result.imported > 0) {
                const { bulkAddMovements } = await import('@/lib/services/supplierInventory');
                const movements = resolved
                    .filter(r => r.productoId && r.addedToInventory === false)
                    .map((r, i) => ({
                        id: `ret_mov_${Date.now()}_${i}`,
                        productoId: r.productoId!,
                        variacionId: r.variacionId || '',
                        tipo: 'devolucion' as const,
                        cantidad: r.cantidad,
                        referencia: r.idDropi,
                        fecha: r.fechaRecibido,
                        notas: `Devolución orden #${r.idDropi}`,
                        createdAt: Date.now(),
                    }));
                await bulkAddMovements(movements, userId);
            }

            setUploadResult(result);
            data.refresh();
        } catch (err: any) {
            alert(err.message || 'Error al procesar el archivo');
        } finally {
            setUploading(false);
            e.target.value = '';
        }
    };

    return (
        <div className="space-y-6">
            {/* Upload */}
            <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 px-4 py-2 bg-[#d75c33] text-white rounded-xl text-sm font-medium hover:bg-[#d75c33]/90 transition-all cursor-pointer">
                    {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    Subir CONTROL TICKETS
                    <input type="file" accept=".xlsx,.xls" onChange={handleUpload} className="hidden" disabled={uploading} />
                </label>
                {uploadResult && (
                    <p className="text-sm text-emerald-400">
                        {uploadResult.imported} importadas, {uploadResult.skipped} omitidas (ya existían)
                    </p>
                )}
            </div>

            {/* Unreported Returns Alert */}
            {unreportedReturns.length > 0 && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                    <h3 className="text-sm font-bold text-red-400 flex items-center gap-2 mb-3">
                        <AlertTriangle className="w-4 h-4" /> Devoluciones sin reportar en bodega ({unreportedReturns.length})
                    </h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-red-500/20">
                                    <th className="text-left py-2 px-3 text-[10px] font-bold text-muted uppercase">ID Dropi</th>
                                    <th className="text-left py-2 px-3 text-[10px] font-bold text-muted uppercase">Producto</th>
                                    <th className="text-left py-2 px-3 text-[10px] font-bold text-muted uppercase">Variación</th>
                                    <th className="text-right py-2 px-3 text-[10px] font-bold text-muted uppercase">Cant.</th>
                                    <th className="text-left py-2 px-3 text-[10px] font-bold text-muted uppercase">Fecha</th>
                                    <th className="text-left py-2 px-3 text-[10px] font-bold text-muted uppercase">Transportadora</th>
                                </tr>
                            </thead>
                            <tbody>
                                {unreportedReturns.slice(0, 50).map((r, i) => (
                                    <tr key={i} className="border-b border-red-500/10">
                                        <td className="py-2 px-3 text-foreground font-mono text-xs">{r.orderId}</td>
                                        <td className="py-2 px-3 text-foreground">{r.producto}</td>
                                        <td className="py-2 px-3 text-muted">{r.variacion || '—'}</td>
                                        <td className="py-2 px-3 text-right text-foreground">{r.cantidad}</td>
                                        <td className="py-2 px-3 text-muted">{r.fecha}</td>
                                        <td className="py-2 px-3 text-muted">{r.transportadora}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Returns History */}
            <div className="bg-card border border-sidebar-border rounded-xl p-4">
                <h3 className="text-sm font-bold text-foreground mb-4">Historial de Devoluciones Recibidas ({returns.length})</h3>
                {returns.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-sidebar-border">
                                    <th className="text-left py-2 px-3 text-[10px] font-bold text-muted uppercase">Fecha</th>
                                    <th className="text-left py-2 px-3 text-[10px] font-bold text-muted uppercase">ID Dropi</th>
                                    <th className="text-left py-2 px-3 text-[10px] font-bold text-muted uppercase">Producto</th>
                                    <th className="text-left py-2 px-3 text-[10px] font-bold text-muted uppercase">Variación</th>
                                    <th className="text-right py-2 px-3 text-[10px] font-bold text-muted uppercase">Cant.</th>
                                    <th className="text-left py-2 px-3 text-[10px] font-bold text-muted uppercase">Transportadora</th>
                                    <th className="text-left py-2 px-3 text-[10px] font-bold text-muted uppercase">Guía</th>
                                </tr>
                            </thead>
                            <tbody>
                                {returns.sort((a, b) => b.createdAt - a.createdAt).slice(0, 100).map((r, i) => (
                                    <tr key={i} className="border-b border-sidebar-border/50 hover:bg-hover-bg/30">
                                        <td className="py-2 px-3 text-muted">{r.fechaRecibido}</td>
                                        <td className="py-2 px-3 text-foreground font-mono text-xs">{r.idDropi}</td>
                                        <td className="py-2 px-3 text-foreground">{r.producto}</td>
                                        <td className="py-2 px-3 text-muted">{r.variacion || '—'}</td>
                                        <td className="py-2 px-3 text-right text-foreground">{r.cantidad}</td>
                                        <td className="py-2 px-3 text-muted">{r.transportadora}</td>
                                        <td className="py-2 px-3 text-muted font-mono text-xs">{r.guiaInicial}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <p className="text-muted text-sm text-center py-8">No hay devoluciones registradas.</p>
                )}
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// IMPORTAR TAB
// ═══════════════════════════════════════════════════════════════════════════
function ImportarTab({ userId, onImported }: { userId: string; onImported: () => void }) {
    const [uploading, setUploading] = useState(false);
    const [importHistory, setImportHistory] = useState<any[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(true);
    const [parsedData, setParsedData] = useState<{ orders: SupplierOrder[]; country: string; fileName: string } | null>(null);
    const [conflict, setConflict] = useState<any>(null);
    const [status, setStatus] = useState<string>('');

    useEffect(() => {
        loadHistory();
    }, [userId]);

    const loadHistory = async () => {
        if (!userId) return;
        setLoadingHistory(true);
        try {
            const history = await getSupplierImportHistory(userId);
            setImportHistory(history);
        } finally {
            setLoadingHistory(false);
        }
    };

    const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !userId) return;
        setUploading(true);
        setStatus('Parseando archivo...');
        setParsedData(null);
        setConflict(null);

        try {
            const parsed = await parseSupplierFile(file);
            setParsedData(parsed);

            // Check for conflicts
            const orderIds = parsed.orders.map(o => o.ID);
            const overlap = await findOverlappingSupplierImports(userId, parsed.country, orderIds);

            if (overlap.superseded.length > 0 || overlap.conflicts.length > 0) {
                setConflict(overlap);
                setStatus(`${parsed.orders.length} órdenes parseadas. Se encontraron conflictos.`);
            } else if (overlap.isSubset) {
                setStatus(`Este archivo ya está contenido en "${overlap.isSubset}". No se importará.`);
                setParsedData(null);
            } else {
                // No conflicts — save directly
                await saveImport(parsed, []);
            }
        } catch (err: any) {
            setStatus(err.message || 'Error al parsear');
        } finally {
            setUploading(false);
            e.target.value = '';
        }
    };

    const saveImport = async (parsed: typeof parsedData, toDelete: string[]) => {
        if (!parsed || !userId) return;
        setUploading(true);
        setStatus('Guardando...');
        try {
            // Delete superseded files
            for (const id of toDelete) {
                await deleteSupplierImportLog(id);
            }

            await saveSupplierOrderFile({
                userId,
                fileName: parsed.fileName,
                country: parsed.country,
                orderCount: parsed.orders.length,
                orders: parsed.orders,
            });

            // Process inventory movements for dispatched orders
            await processDispatchMovements(parsed.orders, userId);

            // Auto-create inventory if empty
            const currentInv = await getInventory(userId);
            if (currentInv.length === 0) {
                const now = Date.now();
                const productMap = new Map<string, InventoryProduct>();
                for (const order of parsed.orders) {
                    const key = `${order.PRODUCTO_ID}_${order.VARIACION_ID || ''}`;
                    if (!productMap.has(key) && order.PRODUCTO_ID) {
                        productMap.set(key, {
                            id: `inv_auto_${now}_${Math.random().toString(36).slice(2, 8)}`,
                            productoId: order.PRODUCTO_ID,
                            nombre: order.PRODUCTO,
                            variacionId: order.VARIACION_ID || '',
                            variacion: order.VARIACION || '',
                            costoInterno: 0,
                            precioProveedor: order.PRECIO_PROVEEDOR || 0,
                            stockInicial: 0,
                            stockActual: 0,
                            alertaStock30: true,
                            alertaStock7: true,
                            createdAt: now,
                            updatedAt: now,
                        });
                    }
                }
                if (productMap.size > 0) {
                    await bulkSaveInventory(Array.from(productMap.values()), userId);
                    setStatus(`✓ ${parsed.orders.length} órdenes importadas. Se crearon ${productMap.size} productos en inventario automáticamente.`);
                } else {
                    setStatus(`✓ ${parsed.orders.length} órdenes importadas exitosamente.`);
                }
            } else {
                setStatus(`✓ ${parsed.orders.length} órdenes importadas exitosamente.`);
            }
            setParsedData(null);
            setConflict(null);
            invalidateSupplierCache();
            onImported();
            loadHistory();
        } catch (err: any) {
            setStatus(`Error: ${err.message}`);
        } finally {
            setUploading(false);
        }
    };

    const handleReplace = () => {
        if (!parsedData || !conflict) return;
        const idsToDelete = [
            ...conflict.superseded.map((s: any) => s.id),
            ...conflict.conflicts.map((c: any) => c.id),
        ];
        saveImport(parsedData, idsToDelete);
    };

    const handleKeep = () => {
        if (!parsedData) return;
        saveImport(parsedData, conflict?.superseded?.map((s: any) => s.id) || []);
    };

    const handleDeleteImport = async (logId: string) => {
        await deleteSupplierImportLog(logId);
        invalidateSupplierCache();
        onImported();
        loadHistory();
    };

    return (
        <div className="space-y-6">
            {/* Upload */}
            <div className="bg-card border border-dashed border-sidebar-border rounded-xl p-8 text-center">
                <Upload className="w-10 h-10 text-muted/30 mx-auto mb-3" />
                <p className="text-sm text-muted mb-4">Sube el reporte de proveedor de Dropi (ordenes_productos_*.xlsx)</p>
                <label className="inline-flex items-center gap-2 px-6 py-3 bg-[#d75c33] text-white rounded-xl text-sm font-medium hover:bg-[#d75c33]/90 transition-all cursor-pointer">
                    {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    Seleccionar Archivo
                    <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="hidden" disabled={uploading} />
                </label>
            </div>

            {/* Status */}
            {status && (
                <div className={`rounded-xl p-4 text-sm ${status.startsWith('✓') ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : status.startsWith('Error') ? 'bg-red-500/10 border border-red-500/20 text-red-400' : 'bg-blue-500/10 border border-blue-500/20 text-blue-400'}`}>
                    {status}
                </div>
            )}

            {/* Conflict Resolution */}
            {conflict && parsedData && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 space-y-3">
                    <h3 className="text-sm font-bold text-amber-400">Se encontraron archivos con datos superpuestos</h3>
                    {conflict.superseded.length > 0 && (
                        <p className="text-sm text-muted">
                            Archivos que serán reemplazados: {conflict.superseded.map((s: any) => s.fileName).join(', ')}
                        </p>
                    )}
                    {conflict.conflicts.length > 0 && (
                        <p className="text-sm text-muted">
                            Conflictos parciales: {conflict.conflicts.map((c: any) => `${c.fileName} (${c.commonCount} en común)`).join(', ')}
                        </p>
                    )}
                    <div className="flex gap-3">
                        <button onClick={handleReplace} className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium">Reemplazar</button>
                        <button onClick={handleKeep} className="px-4 py-2 border border-sidebar-border rounded-lg text-sm text-muted hover:text-foreground">Mantener ambos</button>
                        <button onClick={() => { setParsedData(null); setConflict(null); setStatus(''); }}
                            className="px-4 py-2 text-sm text-muted">Cancelar</button>
                    </div>
                </div>
            )}

            {/* Import History */}
            <div className="bg-card border border-sidebar-border rounded-xl p-4">
                <h3 className="text-sm font-bold text-foreground mb-4">Historial de Importaciones</h3>
                {loadingHistory ? (
                    <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-muted" /></div>
                ) : importHistory.length > 0 ? (
                    <div className="space-y-2">
                        {importHistory.map((log: any) => (
                            <div key={log.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-hover-bg/30">
                                <div>
                                    <p className="text-sm text-foreground font-medium">{log.fileName}</p>
                                    <p className="text-xs text-muted">
                                        {log.orderCount} órdenes · {log.country} · {log.uploaded_at instanceof Date ? log.uploaded_at.toLocaleDateString('es-CO') : ''}
                                    </p>
                                </div>
                                <button onClick={() => handleDeleteImport(log.id)}
                                    className="text-muted hover:text-red-400 transition-colors">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-sm text-muted text-center py-4">No hay importaciones de proveedor.</p>
                )}
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// TICKETS TAB
// ═══════════════════════════════════════════════════════════════════════════
function TicketsTab({ userId }: { userId: string }) {
    const [tickets, setTickets] = useState<SupplierTicket[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editingTicket, setEditingTicket] = useState<SupplierTicket | null>(null);
    const [uploadResult, setUploadResult] = useState<{ imported: number; skipped: number } | null>(null);

    // Form
    const [formTicket, setFormTicket] = useState('');
    const [formGuia, setFormGuia] = useState('');
    const [formTransp, setFormTransp] = useState('');
    const [formFecha, setFormFecha] = useState(new Date().toISOString().split('T')[0]);
    const [formSeguimiento, setFormSeguimiento] = useState('');
    const [formResuelto, setFormResuelto] = useState(false);
    const [formSolucion, setFormSolucion] = useState('');

    useEffect(() => { loadTickets(); }, [userId]);

    const loadTickets = async () => {
        if (!userId) return;
        setLoading(true);
        try {
            const data = await getTickets(userId);
            setTickets(data);
        } finally { setLoading(false); }
    };

    const resetForm = () => {
        setFormTicket(''); setFormGuia(''); setFormTransp(''); setFormFecha(new Date().toISOString().split('T')[0]);
        setFormSeguimiento(''); setFormResuelto(false); setFormSolucion('');
        setEditingTicket(null); setShowForm(false);
    };

    const handleSave = async () => {
        if (!formTicket && !formGuia) return;
        setSaving(true);
        try {
            const now = Date.now();
            const ticket: SupplierTicket = {
                id: editingTicket?.id || `ticket_${now}`,
                fechaTicket: formFecha,
                ticketNumber: formTicket,
                numeroGuia: formGuia,
                transportadora: formTransp,
                fechaSeguimiento: formSeguimiento || undefined,
                resuelto: formResuelto,
                solucion: formSolucion || undefined,
                createdAt: editingTicket?.createdAt || now,
                updatedAt: now,
            };
            await saveTicket(ticket, userId);
            resetForm();
            loadTickets();
        } finally { setSaving(false); }
    };

    const handleEdit = (t: SupplierTicket) => {
        setEditingTicket(t);
        setFormTicket(t.ticketNumber); setFormGuia(t.numeroGuia); setFormTransp(t.transportadora);
        setFormFecha(t.fechaTicket); setFormSeguimiento(t.fechaSeguimiento || '');
        setFormResuelto(t.resuelto); setFormSolucion(t.solucion || '');
        setShowForm(true);
    };

    const handleDelete = async (id: string) => {
        await deleteTicket(id, userId);
        loadTickets();
    };

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !userId) return;
        setSaving(true);
        try {
            const rawTickets = await parseTicketsSheet(file);
            const result = await bulkImportTickets(rawTickets, userId);
            setUploadResult(result);
            loadTickets();
        } catch (err: any) {
            alert(err.message);
        } finally {
            setSaving(false);
            e.target.value = '';
        }
    };

    if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted" /></div>;

    return (
        <div className="space-y-6">
            {/* Actions */}
            <div className="flex gap-3 items-center">
                <button onClick={() => { resetForm(); setShowForm(true); }}
                    className="flex items-center gap-2 px-4 py-2 bg-[#d75c33] text-white rounded-xl text-sm font-medium hover:bg-[#d75c33]/90 transition-all">
                    <Plus className="w-4 h-4" /> Nuevo Ticket
                </button>
                <label className="flex items-center gap-2 px-4 py-2 border border-sidebar-border rounded-xl text-sm font-medium text-muted hover:text-foreground hover:bg-hover-bg transition-all cursor-pointer">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    Importar desde Excel
                    <input type="file" accept=".xlsx,.xls" onChange={handleUpload} className="hidden" disabled={saving} />
                </label>
                {uploadResult && (
                    <p className="text-sm text-emerald-400">{uploadResult.imported} importados, {uploadResult.skipped} omitidos</p>
                )}
            </div>

            {/* Form */}
            {showForm && (
                <div className="bg-card border border-sidebar-border rounded-xl p-4 space-y-4">
                    <h3 className="text-sm font-bold text-foreground">{editingTicket ? 'Editar Ticket' : 'Nuevo Ticket'}</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div>
                            <label className="text-[10px] font-bold text-muted uppercase block mb-1">Ticket #</label>
                            <input value={formTicket} onChange={e => setFormTicket(e.target.value)}
                                className="bg-card border border-sidebar-border rounded-lg px-3 py-2 text-sm text-foreground w-full" />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-muted uppercase block mb-1">Número de Guía</label>
                            <input value={formGuia} onChange={e => setFormGuia(e.target.value)}
                                className="bg-card border border-sidebar-border rounded-lg px-3 py-2 text-sm text-foreground w-full" />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-muted uppercase block mb-1">Transportadora</label>
                            <input value={formTransp} onChange={e => setFormTransp(e.target.value)}
                                className="bg-card border border-sidebar-border rounded-lg px-3 py-2 text-sm text-foreground w-full" />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-muted uppercase block mb-1">Fecha Ticket</label>
                            <input type="date" value={formFecha} onChange={e => setFormFecha(e.target.value)}
                                className="bg-card border border-sidebar-border rounded-lg px-3 py-2 text-sm text-foreground w-full" />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-muted uppercase block mb-1">Fecha Seguimiento</label>
                            <input type="date" value={formSeguimiento} onChange={e => setFormSeguimiento(e.target.value)}
                                className="bg-card border border-sidebar-border rounded-lg px-3 py-2 text-sm text-foreground w-full" />
                        </div>
                        <div className="flex items-center gap-2 pt-5">
                            <input type="checkbox" checked={formResuelto} onChange={e => setFormResuelto(e.target.checked)}
                                className="rounded" id="resuelto-check" />
                            <label htmlFor="resuelto-check" className="text-sm text-foreground">Resuelto</label>
                        </div>
                        <div className="col-span-2">
                            <label className="text-[10px] font-bold text-muted uppercase block mb-1">Solución / Razón</label>
                            <input value={formSolucion} onChange={e => setFormSolucion(e.target.value)}
                                className="bg-card border border-sidebar-border rounded-lg px-3 py-2 text-sm text-foreground w-full" />
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={handleSave} disabled={saving}
                            className="flex items-center gap-2 px-4 py-2 bg-[#d75c33] text-white rounded-lg text-sm font-medium disabled:opacity-50">
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                            {editingTicket ? 'Actualizar' : 'Guardar'}
                        </button>
                        <button onClick={resetForm} className="px-4 py-2 text-sm text-muted">Cancelar</button>
                    </div>
                </div>
            )}

            {/* Tickets Table */}
            {tickets.length > 0 ? (
                <div className="bg-card border border-sidebar-border rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-sidebar-border bg-hover-bg/30">
                                <th className="text-left py-3 px-4 text-[10px] font-bold text-muted uppercase">Ticket</th>
                                <th className="text-left py-3 px-4 text-[10px] font-bold text-muted uppercase">Guía</th>
                                <th className="text-left py-3 px-4 text-[10px] font-bold text-muted uppercase">Transportadora</th>
                                <th className="text-left py-3 px-4 text-[10px] font-bold text-muted uppercase">Fecha</th>
                                <th className="text-left py-3 px-4 text-[10px] font-bold text-muted uppercase">Seguimiento</th>
                                <th className="text-center py-3 px-4 text-[10px] font-bold text-muted uppercase">Estado</th>
                                <th className="text-left py-3 px-4 text-[10px] font-bold text-muted uppercase">Solución</th>
                                <th className="text-center py-3 px-4 text-[10px] font-bold text-muted uppercase">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {tickets.sort((a, b) => b.createdAt - a.createdAt).map(t => (
                                <tr key={t.id} className="border-b border-sidebar-border/50 hover:bg-hover-bg/30">
                                    <td className="py-2 px-4 text-foreground font-mono">{t.ticketNumber}</td>
                                    <td className="py-2 px-4 text-muted font-mono text-xs">{t.numeroGuia}</td>
                                    <td className="py-2 px-4 text-muted">{t.transportadora}</td>
                                    <td className="py-2 px-4 text-muted">{t.fechaTicket}</td>
                                    <td className="py-2 px-4 text-muted">{t.fechaSeguimiento || '—'}</td>
                                    <td className="py-2 px-4 text-center">
                                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${t.resuelto ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                                            {t.resuelto ? 'RESUELTO' : 'PENDIENTE'}
                                        </span>
                                    </td>
                                    <td className="py-2 px-4 text-muted text-xs truncate max-w-[200px]">{t.solucion || '—'}</td>
                                    <td className="py-2 px-4 text-center">
                                        <div className="flex items-center justify-center gap-2">
                                            <button onClick={() => handleEdit(t)} className="text-muted hover:text-foreground"><Edit3 className="w-3.5 h-3.5" /></button>
                                            <button onClick={() => handleDelete(t.id)} className="text-muted hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="text-center py-16">
                    <Ticket className="w-12 h-12 text-muted/30 mx-auto mb-4" />
                    <p className="text-muted text-sm">No hay tickets registrados.</p>
                </div>
            )}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// PROVEEDORES TAB — Supplier Directory
// ═══════════════════════════════════════════════════════════════════════════
function ProveedoresTab({ userId }: { userId: string }) {
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [purchases, setPurchases] = useState<PurchaseOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    // Form fields
    const [fNombre, setFNombre] = useState('');
    const [fContacto, setFContacto] = useState('');
    const [fTelefono, setFTelefono] = useState('');
    const [fWhatsapp, setFWhatsapp] = useState('');
    const [fEmail, setFEmail] = useState('');
    const [fPais, setFPais] = useState('China');
    const [fMoneda, setFMoneda] = useState<'USD' | 'COP'>('USD');
    const [fCondiciones, setFCondiciones] = useState('');
    const [fNotas, setFNotas] = useState('');

    useEffect(() => {
        if (!userId) return;
        (async () => {
            setLoading(true);
            const [s, p] = await Promise.all([getSuppliers(userId), getPurchases(userId)]);
            setSuppliers(s);
            setPurchases(p);
            setLoading(false);
        })();
    }, [userId]);

    const resetForm = () => {
        setFNombre(''); setFContacto(''); setFTelefono(''); setFWhatsapp('');
        setFEmail(''); setFPais('China'); setFMoneda('USD'); setFCondiciones(''); setFNotas('');
        setEditingId(null); setShowForm(false);
    };

    const handleEdit = (s: Supplier) => {
        setEditingId(s.id);
        setFNombre(s.nombre); setFContacto(s.contacto); setFTelefono(s.telefono);
        setFWhatsapp(s.whatsapp || ''); setFEmail(s.email || ''); setFPais(s.pais);
        setFMoneda(s.moneda); setFCondiciones(s.condicionesPago); setFNotas(s.notas);
        setShowForm(true);
    };

    const handleSave = async () => {
        if (!fNombre.trim()) return;
        setSaving(true);
        const now = Date.now();
        const supplier: Supplier = {
            id: editingId || generateSupplierId(),
            nombre: fNombre.trim(),
            contacto: fContacto.trim(),
            telefono: fTelefono.trim(),
            whatsapp: fWhatsapp.trim() || undefined,
            email: fEmail.trim() || undefined,
            pais: fPais,
            moneda: fMoneda,
            condicionesPago: fCondiciones.trim(),
            notas: fNotas.trim(),
            createdAt: editingId ? (suppliers.find(s => s.id === editingId)?.createdAt || now) : now,
            updatedAt: now,
        };
        await saveSupplier(supplier, userId);
        const updated = await getSuppliers(userId);
        setSuppliers(updated);
        resetForm();
        setSaving(false);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('¿Eliminar este proveedor?')) return;
        await deleteSupplier(id, userId);
        setSuppliers(prev => prev.filter(s => s.id !== id));
    };

    const getSupplierStats = (supplierId: string) => {
        const sups = purchases.filter(p => p.proveedorId === supplierId);
        const totalCOP = sups.reduce((sum, p) => sum + computePurchaseTotals(p).totalCOP, 0);
        const saldo = sups.filter(p => p.estado !== 'cerrada').reduce((sum, p) => sum + computePurchaseTotals(p).saldoPendienteCOP, 0);
        return { count: sups.length, totalCOP, saldo };
    };

    if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted" /></div>;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-foreground">Directorio de Proveedores</h2>
                <button onClick={() => { resetForm(); setShowForm(true); }} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#d75c33] text-white text-sm font-bold hover:bg-[#c04f2a] transition-colors">
                    <Plus className="w-4 h-4" /> Nuevo Proveedor
                </button>
            </div>

            {showForm && (
                <div className="bg-card border border-sidebar-border rounded-xl p-4 space-y-4">
                    <h3 className="text-sm font-bold text-foreground">{editingId ? 'Editar Proveedor' : 'Nuevo Proveedor'}</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        <div>
                            <label className="text-[10px] font-bold text-muted uppercase block mb-1">Nombre *</label>
                            <input value={fNombre} onChange={e => setFNombre(e.target.value)} className="bg-card border border-sidebar-border rounded-lg px-3 py-2 text-sm text-foreground w-full" placeholder="Nombre del proveedor" />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-muted uppercase block mb-1">Contacto</label>
                            <input value={fContacto} onChange={e => setFContacto(e.target.value)} className="bg-card border border-sidebar-border rounded-lg px-3 py-2 text-sm text-foreground w-full" placeholder="Persona de contacto" />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-muted uppercase block mb-1">Teléfono</label>
                            <input value={fTelefono} onChange={e => setFTelefono(e.target.value)} className="bg-card border border-sidebar-border rounded-lg px-3 py-2 text-sm text-foreground w-full" placeholder="+86..." />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-muted uppercase block mb-1">WhatsApp</label>
                            <input value={fWhatsapp} onChange={e => setFWhatsapp(e.target.value)} className="bg-card border border-sidebar-border rounded-lg px-3 py-2 text-sm text-foreground w-full" placeholder="+57..." />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-muted uppercase block mb-1">Email</label>
                            <input value={fEmail} onChange={e => setFEmail(e.target.value)} className="bg-card border border-sidebar-border rounded-lg px-3 py-2 text-sm text-foreground w-full" placeholder="email@proveedor.com" />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-muted uppercase block mb-1">País</label>
                            <select value={fPais} onChange={e => setFPais(e.target.value)} className="bg-card border border-sidebar-border rounded-lg px-3 py-2 text-sm text-foreground w-full">
                                {['China', 'Colombia', 'Estados Unidos', 'Panamá', 'México', 'Otro'].map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-muted uppercase block mb-1">Moneda</label>
                            <select value={fMoneda} onChange={e => setFMoneda(e.target.value as 'USD' | 'COP')} className="bg-card border border-sidebar-border rounded-lg px-3 py-2 text-sm text-foreground w-full">
                                <option value="USD">USD</option>
                                <option value="COP">COP</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-muted uppercase block mb-1">Condiciones de Pago</label>
                            <input value={fCondiciones} onChange={e => setFCondiciones(e.target.value)} className="bg-card border border-sidebar-border rounded-lg px-3 py-2 text-sm text-foreground w-full" placeholder="50% anticipo, 50% contra entrega" />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-muted uppercase block mb-1">Notas</label>
                            <input value={fNotas} onChange={e => setFNotas(e.target.value)} className="bg-card border border-sidebar-border rounded-lg px-3 py-2 text-sm text-foreground w-full" placeholder="Observaciones..." />
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={handleSave} disabled={saving || !fNombre.trim()} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#d75c33] text-white text-sm font-bold hover:bg-[#c04f2a] disabled:opacity-50 transition-colors">
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} {editingId ? 'Actualizar' : 'Guardar'}
                        </button>
                        <button onClick={resetForm} className="px-4 py-2 rounded-lg text-sm font-bold text-muted hover:text-foreground transition-colors">Cancelar</button>
                    </div>
                </div>
            )}

            {suppliers.length === 0 ? (
                <div className="text-center py-16">
                    <Users className="w-12 h-12 text-muted/30 mx-auto mb-4" />
                    <p className="text-muted text-sm">No hay proveedores registrados.</p>
                </div>
            ) : (
                <div className="bg-card border border-sidebar-border rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-sidebar-border bg-hover-bg/30">
                                <th className="text-left py-3 px-4 text-[10px] font-bold text-muted uppercase">Nombre</th>
                                <th className="text-left py-3 px-4 text-[10px] font-bold text-muted uppercase">País</th>
                                <th className="text-left py-3 px-4 text-[10px] font-bold text-muted uppercase">Moneda</th>
                                <th className="text-left py-3 px-4 text-[10px] font-bold text-muted uppercase">Condiciones</th>
                                <th className="text-right py-3 px-4 text-[10px] font-bold text-muted uppercase">Importaciones</th>
                                <th className="text-right py-3 px-4 text-[10px] font-bold text-muted uppercase">Total COP</th>
                                <th className="text-right py-3 px-4 text-[10px] font-bold text-muted uppercase">Saldo</th>
                                <th className="text-right py-3 px-4 text-[10px] font-bold text-muted uppercase">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {suppliers.sort((a, b) => b.updatedAt - a.updatedAt).map(s => {
                                const stats = getSupplierStats(s.id);
                                return (
                                    <tr key={s.id} className="border-b border-sidebar-border/50 hover:bg-hover-bg/50">
                                        <td className="py-3 px-4">
                                            <div className="font-medium text-foreground">{s.nombre}</div>
                                            {s.contacto && <div className="text-[10px] text-muted">{s.contacto}</div>}
                                        </td>
                                        <td className="py-3 px-4 text-muted">{s.pais}</td>
                                        <td className="py-3 px-4"><span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">{s.moneda}</span></td>
                                        <td className="py-3 px-4 text-muted text-xs">{s.condicionesPago || '—'}</td>
                                        <td className="py-3 px-4 text-right font-mono text-foreground">{stats.count}</td>
                                        <td className="py-3 px-4 text-right font-mono text-foreground">{fmtCOP(stats.totalCOP)}</td>
                                        <td className="py-3 px-4 text-right font-mono">{stats.saldo > 0 ? <span className="text-amber-400">{fmtCOP(stats.saldo)}</span> : <span className="text-emerald-400">$0</span>}</td>
                                        <td className="py-3 px-4 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <button onClick={() => handleEdit(s)} className="p-1.5 rounded-lg hover:bg-white/5 text-muted hover:text-foreground"><Edit3 className="w-3.5 h-3.5" /></button>
                                                <button onClick={() => handleDelete(s.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// IMPORTACIONES TAB — Purchase Orders / Imports
// ═══════════════════════════════════════════════════════════════════════════
function ImportacionesTab({ userId, inventory, onRefresh }: { userId: string; inventory: InventoryProduct[]; onRefresh: () => void }) {
    const [purchases, setPurchases] = useState<PurchaseOrder[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // View state
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [editingPO, setEditingPO] = useState<PurchaseOrder | null>(null);

    // Filters
    const [filterEstado, setFilterEstado] = useState<PurchaseEstado | 'todos'>('todos');
    const [filterProveedor, setFilterProveedor] = useState('todos');
    const [filterTipo, setFilterTipo] = useState<'todos' | 'importacion' | 'desarrollo'>('todos');

    // Payment form
    const [showPayForm, setShowPayForm] = useState<string | null>(null);
    const [payFecha, setPayFecha] = useState(new Date().toISOString().split('T')[0]);
    const [payMonto, setPayMonto] = useState('');
    const [payMetodo, setPayMetodo] = useState<Payment['metodo']>('transferencia');
    const [payRef, setPayRef] = useState('');
    const [payNotas, setPayNotas] = useState('');

    // Doc upload
    const [uploadingDoc, setUploadingDoc] = useState(false);
    const [docTipo, setDocTipo] = useState<PurchaseDocument['tipo']>('factura');

    // Receive
    const [showReceive, setShowReceive] = useState<string | null>(null);
    const [receiveQtys, setReceiveQtys] = useState<Record<string, number>>({});
    const [receiving, setReceiving] = useState(false);

    // PO Form fields
    const [fRef, setFRef] = useState('');
    const [fProvId, setFProvId] = useState('');
    const [fTipo, setFTipo] = useState<PurchaseTipo>('maritima');
    const [fEstado, setFEstado] = useState<PurchaseEstado>('borrador');
    const [fFechaOrden, setFFechaOrden] = useState(new Date().toISOString().split('T')[0]);
    const [fFechaEst, setFFechaEst] = useState('');
    const [fMoneda, setFMoneda] = useState<'USD' | 'COP'>('USD');
    const [fTasa, setFTasa] = useState('4200');
    const [fNotas, setFNotas] = useState('');
    const [fLineas, setFLineas] = useState<PurchaseOrderLine[]>([]);
    const [fCostos, setFCostos] = useState<LandedCost[]>([]);

    useEffect(() => {
        if (!userId) return;
        (async () => {
            setLoading(true);
            const [p, s] = await Promise.all([getPurchases(userId), getSuppliers(userId)]);
            setPurchases(p);
            setSuppliers(s);
            setLoading(false);
        })();
    }, [userId]);

    const reload = async () => {
        const [p, s] = await Promise.all([getPurchases(userId), getSuppliers(userId)]);
        setPurchases(p);
        setSuppliers(s);
    };

    // ── PO Form Helpers ─────────────────────────────────────────────────────
    const resetPOForm = () => {
        setFRef(''); setFProvId(''); setFTipo('maritima'); setFEstado('borrador');
        setFFechaOrden(new Date().toISOString().split('T')[0]); setFFechaEst('');
        setFMoneda('USD'); setFTasa('4200'); setFNotas('');
        setFLineas([]); setFCostos([]);
        setEditingPO(null); setShowForm(false);
    };

    const handleEditPO = (po: PurchaseOrder) => {
        setEditingPO(po);
        setFRef(po.referencia); setFProvId(po.proveedorId); setFTipo(po.tipo); setFEstado(po.estado);
        setFFechaOrden(po.fechaOrden); setFFechaEst(po.fechaEstimadaLlegada);
        setFMoneda(po.moneda); setFTasa(String(po.tasaCambio)); setFNotas(po.notas);
        setFLineas([...po.lineas]); setFCostos([...po.costosAdicionales]);
        setShowForm(true);
    };

    const addLine = () => {
        setFLineas(prev => [...prev, {
            id: generateLineId(prev.length),
            productoId: '', variacionId: '', nombre: '', variacion: '',
            cantidad: 0, cantidadRecibida: 0, costoUnitario: 0, costoTotal: 0,
        }]);
    };

    const updateLine = (idx: number, field: string, value: string | number) => {
        setFLineas(prev => {
            const updated = [...prev];
            const line = { ...updated[idx], [field]: value };
            if (field === 'cantidad' || field === 'costoUnitario') {
                line.costoTotal = line.cantidad * line.costoUnitario;
            }
            updated[idx] = line;
            return updated;
        });
    };

    const selectProduct = (idx: number, key: string) => {
        if (!key) return;
        const [productoId, variacionId = ''] = key.split('||');
        const inv = inventory.find(p => p.productoId === productoId && (p.variacionId || '') === variacionId);
        if (inv) {
            updateLine(idx, 'productoId', productoId);
            setFLineas(prev => {
                const updated = [...prev];
                updated[idx] = { ...updated[idx], productoId, variacionId, nombre: inv.nombre, variacion: inv.variacion };
                return updated;
            });
        }
    };

    const removeLine = (idx: number) => setFLineas(prev => prev.filter((_, i) => i !== idx));

    const addCost = () => {
        const defaultConcept = fTipo === 'desarrollo_local' ? 'Materia Prima' : 'Flete Internacional';
        setFCostos(prev => [...prev, { id: generateCostId(), concepto: defaultConcept, monto: 0, moneda: 'COP' }]);
    };

    const updateCost = (idx: number, field: string, value: string | number) => {
        setFCostos(prev => {
            const updated = [...prev];
            updated[idx] = { ...updated[idx], [field]: value };
            return updated;
        });
    };

    const removeCost = (idx: number) => setFCostos(prev => prev.filter((_, i) => i !== idx));

    const handleSavePO = async () => {
        if (!fRef.trim() || !fProvId) return;
        setSaving(true);
        const provNombre = suppliers.find(s => s.id === fProvId)?.nombre || '';
        const now = Date.now();
        const po: PurchaseOrder = {
            id: editingPO?.id || generatePurchaseId(),
            referencia: fRef.trim(),
            proveedorId: fProvId,
            proveedorNombre: provNombre,
            tipo: fTipo,
            estado: fEstado,
            fechaOrden: fFechaOrden,
            fechaEstimadaLlegada: fFechaEst,
            fechaRealLlegada: editingPO?.fechaRealLlegada,
            moneda: fMoneda,
            tasaCambio: fMoneda === 'COP' ? 1 : (Number(fTasa) || 4200),
            notas: fNotas.trim(),
            lineas: fLineas,
            costosAdicionales: fCostos,
            pagos: editingPO?.pagos || [],
            documentos: editingPO?.documentos || [],
            createdAt: editingPO?.createdAt || now,
            updatedAt: now,
        };
        await savePurchase(po, userId);
        await reload();
        resetPOForm();
        setSaving(false);
    };

    const handleDeletePO = async (id: string) => {
        if (!confirm('¿Eliminar esta importación?')) return;
        await deletePurchase(id, userId);
        setPurchases(prev => prev.filter(p => p.id !== id));
        if (expandedId === id) setExpandedId(null);
    };

    // ── Payment ─────────────────────────────────────────────────────────────
    const handleAddPayment = async (poId: string) => {
        const po = purchases.find(p => p.id === poId);
        if (!po || !payMonto) return;
        setSaving(true);
        const monto = Number(payMonto) || 0;
        const montoCOP = po.moneda === 'USD' ? monto * po.tasaCambio : monto;
        const payment: Payment = {
            id: generatePaymentId(),
            fecha: payFecha,
            monto,
            montoCOP,
            metodo: payMetodo,
            referencia: payRef.trim(),
            notas: payNotas.trim() || undefined,
            createdAt: Date.now(),
        };
        const updated = { ...po, pagos: [...po.pagos, payment] };
        await savePurchase(updated, userId);
        await reload();
        setShowPayForm(null);
        setPayMonto(''); setPayRef(''); setPayNotas('');
        setSaving(false);
    };

    const handleDeletePayment = async (poId: string, payId: string) => {
        const po = purchases.find(p => p.id === poId);
        if (!po) return;
        const updated = { ...po, pagos: po.pagos.filter(p => p.id !== payId) };
        await savePurchase(updated, userId);
        await reload();
    };

    // ── Documents ───────────────────────────────────────────────────────────
    const handleUploadDoc = async (poId: string, file: File) => {
        const po = purchases.find(p => p.id === poId);
        if (!po) return;
        setUploadingDoc(true);
        try {
            const { storagePath, downloadUrl } = await uploadPurchaseDocument(file, userId, poId);
            const doc: PurchaseDocument = {
                id: generateDocId(),
                nombre: file.name,
                tipo: docTipo,
                storagePath,
                downloadUrl,
                createdAt: Date.now(),
            };
            const updated = { ...po, documentos: [...po.documentos, doc] };
            await savePurchase(updated, userId);
            await reload();
        } finally {
            setUploadingDoc(false);
        }
    };

    const handleDeleteDoc = async (poId: string, doc: PurchaseDocument) => {
        const po = purchases.find(p => p.id === poId);
        if (!po) return;
        try { await deletePurchaseDocument(doc.storagePath); } catch { /* ignore if already deleted */ }
        const updated = { ...po, documentos: po.documentos.filter(d => d.id !== doc.id) };
        await savePurchase(updated, userId);
        await reload();
    };

    // ── Receive ─────────────────────────────────────────────────────────────
    const handleReceive = async (poId: string) => {
        const po = purchases.find(p => p.id === poId);
        if (!po) return;
        setReceiving(true);
        try {
            const landedMap = computeLandedCostPerUnit(po);
            const items: { productoId: string; variacionId: string; cantidad: number; landedCostUnitCOP: number; purchaseRef: string }[] = [];
            const updatedLineas = po.lineas.map(l => {
                const qty = receiveQtys[l.id] || 0;
                if (qty > 0) {
                    const key = `${l.productoId}_${l.variacionId || 'NO_VAR'}`;
                    items.push({
                        productoId: l.productoId,
                        variacionId: l.variacionId,
                        cantidad: qty,
                        landedCostUnitCOP: landedMap.get(key) || 0,
                        purchaseRef: po.referencia,
                    });
                }
                return { ...l, cantidadRecibida: l.cantidadRecibida + qty };
            });

            if (items.length > 0) {
                await receiveFromPurchase(items, userId);
            }

            const allReceived = updatedLineas.every(l => l.cantidadRecibida >= l.cantidad);
            const anyReceived = updatedLineas.some(l => l.cantidadRecibida > 0);
            const newEstado: PurchaseEstado = allReceived ? 'recibida' : anyReceived ? 'recibida_parcial' : po.estado;
            const updated: PurchaseOrder = {
                ...po,
                lineas: updatedLineas,
                estado: newEstado,
                fechaRealLlegada: po.fechaRealLlegada || new Date().toISOString().split('T')[0],
            };
            await savePurchase(updated, userId);
            await reload();
            onRefresh();
            setShowReceive(null);
            setReceiveQtys({});
        } finally {
            setReceiving(false);
        }
    };

    // ── Computed ─────────────────────────────────────────────────────────────
    const filtered = purchases
        .filter(p => filterEstado === 'todos' || p.estado === filterEstado)
        .filter(p => filterProveedor === 'todos' || p.proveedorId === filterProveedor)
        .filter(p => filterTipo === 'todos' || (filterTipo === 'desarrollo' ? p.tipo === 'desarrollo_local' : p.tipo !== 'desarrollo_local'))
        .sort((a, b) => b.updatedAt - a.updatedAt);

    const kpiActive = purchases.filter(p => !['cerrada'].includes(p.estado));
    const totalInversionCOP = kpiActive.reduce((s, p) => s + computePurchaseTotals(p).totalCOP, 0);
    const totalSaldoCOP = kpiActive.reduce((s, p) => s + computePurchaseTotals(p).saldoPendienteCOP, 0);
    const enTransito = purchases.filter(p => ['en_transito', 'en_aduana'].includes(p.estado)).length;
    const enProduccion = purchases.filter(p => ['en_produccion', 'control_calidad'].includes(p.estado)).length;

    // Conditional form helpers based on tipo
    const isDesarrollo = fTipo === 'desarrollo_local';
    const estadosDisponibles = isDesarrollo
        ? (['borrador', 'en_produccion', 'control_calidad', 'recibida_parcial', 'recibida', 'cerrada'] as PurchaseEstado[])
        : (['borrador', 'confirmada', 'en_transito', 'en_aduana', 'recibida_parcial', 'recibida', 'cerrada'] as PurchaseEstado[]);
    const costConcepts = isDesarrollo ? PRODUCTION_COST_CONCEPTS : LANDED_COST_CONCEPTS;

    const estadoColor: Record<PurchaseEstado, string> = {
        borrador: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
        confirmada: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
        en_transito: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
        en_aduana: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
        en_produccion: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
        control_calidad: 'bg-pink-500/10 text-pink-400 border-pink-500/20',
        recibida_parcial: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
        recibida: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
        cerrada: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
    };

    if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted" /></div>;

    // ── Form Subtotals ──────────────────────────────────────────────────────
    const formSubtotal = fLineas.reduce((s, l) => s + l.costoTotal, 0);
    const formCostosTotal = fCostos.reduce((s, c) => s + (c.moneda === 'COP' ? c.monto : c.monto * (Number(fTasa) || 1)), 0);
    const formTasa = fMoneda === 'USD' ? (Number(fTasa) || 4200) : 1;
    const formTotalCOP = formSubtotal * formTasa + formCostosTotal;

    return (
        <div className="space-y-4">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-card border border-card-border rounded-xl p-4">
                    <span className="text-[10px] font-black text-muted uppercase tracking-widest">Inversión Activa</span>
                    <p className="text-2xl font-black tracking-tight text-foreground font-mono mt-1">{fmtCOP(totalInversionCOP)}</p>
                </div>
                <div className="bg-card border border-card-border rounded-xl p-4">
                    <span className="text-[10px] font-black text-muted uppercase tracking-widest">Saldo Pendiente</span>
                    <p className={`text-2xl font-black tracking-tight font-mono mt-1 ${totalSaldoCOP > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>{fmtCOP(totalSaldoCOP)}</p>
                </div>
                <div className="bg-card border border-card-border rounded-xl p-4">
                    <span className="text-[10px] font-black text-muted uppercase tracking-widest">En Tránsito / Aduana</span>
                    <p className="text-2xl font-black tracking-tight text-amber-400 font-mono mt-1">{enTransito}</p>
                </div>
                <div className="bg-card border border-card-border rounded-xl p-4">
                    <span className="text-[10px] font-black text-muted uppercase tracking-widest">En Producción</span>
                    <p className="text-2xl font-black tracking-tight text-cyan-400 font-mono mt-1">{enProduccion}</p>
                </div>
            </div>

            {/* Header + Filters */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <select value={filterTipo} onChange={e => setFilterTipo(e.target.value as typeof filterTipo)} className="bg-card border border-sidebar-border rounded-lg px-3 py-2 text-sm text-foreground">
                        <option value="todos">Tipo: Todos</option>
                        <option value="importacion">Importaciones</option>
                        <option value="desarrollo">Desarrollos Locales</option>
                    </select>
                    <select value={filterEstado} onChange={e => setFilterEstado(e.target.value as PurchaseEstado | 'todos')} className="bg-card border border-sidebar-border rounded-lg px-3 py-2 text-sm text-foreground">
                        <option value="todos">Estado: Todos</option>
                        {(Object.entries(ESTADO_LABELS) as [PurchaseEstado, string][]).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                    <select value={filterProveedor} onChange={e => setFilterProveedor(e.target.value)} className="bg-card border border-sidebar-border rounded-lg px-3 py-2 text-sm text-foreground">
                        <option value="todos">Proveedor: Todos</option>
                        {suppliers.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                    </select>
                </div>
                <button onClick={() => { resetPOForm(); setShowForm(true); }} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#d75c33] text-white text-sm font-bold hover:bg-[#c04f2a] transition-colors">
                    <Plus className="w-4 h-4" /> Nueva Orden
                </button>
            </div>

            {/* PO Form */}
            {showForm && (
                <div className="bg-card border border-sidebar-border rounded-xl p-5 space-y-5">
                    <h3 className="text-sm font-bold text-foreground">{editingPO ? (isDesarrollo ? 'Editar Desarrollo' : 'Editar Importación') : (isDesarrollo ? 'Nuevo Desarrollo Local' : 'Nueva Importación')}</h3>

                    {/* General Data */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="col-span-2">
                            <label className="text-[10px] font-bold text-muted uppercase block mb-1">Referencia *</label>
                            <input value={fRef} onChange={e => setFRef(e.target.value)} className="bg-card border border-sidebar-border rounded-lg px-3 py-2 text-sm text-foreground w-full" placeholder={isDesarrollo ? 'Desarrollo Lab Marzo 2026' : 'Import China Marzo 2026'} />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-muted uppercase block mb-1">{isDesarrollo ? 'Laboratorio / Taller *' : 'Proveedor *'}</label>
                            <select value={fProvId} onChange={e => setFProvId(e.target.value)} className="bg-card border border-sidebar-border rounded-lg px-3 py-2 text-sm text-foreground w-full">
                                <option value="">— Seleccionar —</option>
                                {suppliers.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-muted uppercase block mb-1">Tipo</label>
                            <select value={fTipo} onChange={e => {
                                const newTipo = e.target.value as PurchaseTipo;
                                setFTipo(newTipo);
                                if (newTipo === 'desarrollo_local') {
                                    setFMoneda('COP'); setFTasa('1'); setFEstado('borrador');
                                }
                            }} className="bg-card border border-sidebar-border rounded-lg px-3 py-2 text-sm text-foreground w-full">
                                {(Object.entries(TIPO_LABELS) as [PurchaseTipo, string][]).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-muted uppercase block mb-1">Estado</label>
                            <select value={fEstado} onChange={e => setFEstado(e.target.value as PurchaseEstado)} className="bg-card border border-sidebar-border rounded-lg px-3 py-2 text-sm text-foreground w-full">
                                {estadosDisponibles.map(k => <option key={k} value={k}>{ESTADO_LABELS[k]}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-muted uppercase block mb-1">Fecha Orden</label>
                            <input type="date" value={fFechaOrden} onChange={e => setFFechaOrden(e.target.value)} className="bg-card border border-sidebar-border rounded-lg px-3 py-2 text-sm text-foreground w-full" />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-muted uppercase block mb-1">{isDesarrollo ? 'Fecha Est. Entrega' : 'ETA Llegada'}</label>
                            <input type="date" value={fFechaEst} onChange={e => setFFechaEst(e.target.value)} className="bg-card border border-sidebar-border rounded-lg px-3 py-2 text-sm text-foreground w-full" />
                        </div>
                        {!isDesarrollo && (
                            <div>
                                <label className="text-[10px] font-bold text-muted uppercase block mb-1">Moneda</label>
                                <select value={fMoneda} onChange={e => setFMoneda(e.target.value as 'USD' | 'COP')} className="bg-card border border-sidebar-border rounded-lg px-3 py-2 text-sm text-foreground w-full">
                                    <option value="USD">USD</option>
                                    <option value="COP">COP</option>
                                </select>
                            </div>
                        )}
                        {!isDesarrollo && fMoneda === 'USD' && (
                            <div>
                                <label className="text-[10px] font-bold text-muted uppercase block mb-1">Tasa Cambio (COP/USD)</label>
                                <input type="number" value={fTasa} onChange={e => setFTasa(e.target.value)} className="bg-card border border-sidebar-border rounded-lg px-3 py-2 text-sm text-foreground w-full" placeholder="4200" />
                            </div>
                        )}
                    </div>

                    {/* Product Lines */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-[10px] font-bold text-muted uppercase">Líneas de Producto</label>
                            <button onClick={addLine} className="flex items-center gap-1 text-xs font-bold text-blue-400 hover:text-blue-300"><Plus className="w-3 h-3" /> Agregar</button>
                        </div>
                        {fLineas.length > 0 && (
                            <div className="border border-sidebar-border rounded-lg overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead><tr className="bg-hover-bg/30 border-b border-sidebar-border">
                                        <th className="text-left py-2 px-3 text-[10px] font-bold text-muted uppercase">Producto</th>
                                        <th className="text-right py-2 px-3 text-[10px] font-bold text-muted uppercase w-24">Cantidad</th>
                                        <th className="text-right py-2 px-3 text-[10px] font-bold text-muted uppercase w-32">Costo Unit.</th>
                                        <th className="text-right py-2 px-3 text-[10px] font-bold text-muted uppercase w-32">Total</th>
                                        <th className="w-10"></th>
                                    </tr></thead>
                                    <tbody>
                                        {fLineas.map((l, i) => (
                                            <tr key={l.id} className="border-b border-sidebar-border/50">
                                                <td className="py-2 px-3">
                                                    <select value={l.productoId ? `${l.productoId}||${l.variacionId}` : ''} onChange={e => selectProduct(i, e.target.value)} className="bg-transparent text-sm text-foreground w-full outline-none">
                                                        <option value="">— Seleccionar producto —</option>
                                                        {inventory.map(p => <option key={`${p.productoId}_${p.variacionId}`} value={`${p.productoId}||${p.variacionId}`}>{p.nombre}{p.variacion ? ` — ${p.variacion}` : ''}</option>)}
                                                    </select>
                                                </td>
                                                <td className="py-2 px-3"><input type="number" value={l.cantidad || ''} onChange={e => updateLine(i, 'cantidad', Number(e.target.value))} className="bg-transparent text-sm text-foreground text-right w-full outline-none" placeholder="0" /></td>
                                                <td className="py-2 px-3"><input type="number" value={l.costoUnitario || ''} onChange={e => updateLine(i, 'costoUnitario', Number(e.target.value))} className="bg-transparent text-sm text-foreground text-right w-full outline-none" placeholder="0" /></td>
                                                <td className="py-2 px-3 text-right font-mono text-foreground">{fMoneda === 'USD' ? `$${l.costoTotal.toFixed(2)}` : fmtFull(l.costoTotal)}</td>
                                                <td className="py-2 px-1"><button onClick={() => removeLine(i)} className="p-1 text-muted hover:text-red-400"><X className="w-3.5 h-3.5" /></button></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot><tr className="bg-card/30">
                                        <td colSpan={3} className="py-2 px-3 text-right text-[10px] font-bold text-muted uppercase">Subtotal</td>
                                        <td className="py-2 px-3 text-right font-bold font-mono text-foreground">{fMoneda === 'USD' ? `$${formSubtotal.toFixed(2)}` : fmtFull(formSubtotal)}</td>
                                        <td></td>
                                    </tr></tfoot>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* Costs */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-[10px] font-bold text-muted uppercase">{isDesarrollo ? 'Costos de Producción' : 'Costos Adicionales (Landed)'}</label>
                            <button onClick={addCost} className="flex items-center gap-1 text-xs font-bold text-blue-400 hover:text-blue-300"><Plus className="w-3 h-3" /> Agregar</button>
                        </div>
                        {fCostos.length > 0 && (
                            <div className="border border-sidebar-border rounded-lg overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead><tr className="bg-hover-bg/30 border-b border-sidebar-border">
                                        <th className="text-left py-2 px-3 text-[10px] font-bold text-muted uppercase">Concepto</th>
                                        <th className="text-right py-2 px-3 text-[10px] font-bold text-muted uppercase w-32">Monto</th>
                                        {!isDesarrollo && <th className="text-center py-2 px-3 text-[10px] font-bold text-muted uppercase w-20">Moneda</th>}
                                        <th className="w-10"></th>
                                    </tr></thead>
                                    <tbody>
                                        {fCostos.map((c, i) => (
                                            <tr key={c.id} className="border-b border-sidebar-border/50">
                                                <td className="py-2 px-3">
                                                    <select value={c.concepto} onChange={e => updateCost(i, 'concepto', e.target.value)} className="bg-transparent text-sm text-foreground w-full outline-none">
                                                        {costConcepts.map(lc => <option key={lc} value={lc}>{lc}</option>)}
                                                    </select>
                                                </td>
                                                <td className="py-2 px-3"><input type="number" value={c.monto || ''} onChange={e => updateCost(i, 'monto', Number(e.target.value))} className="bg-transparent text-sm text-foreground text-right w-full outline-none" placeholder="0" /></td>
                                                {!isDesarrollo && (
                                                    <td className="py-2 px-3 text-center">
                                                        <select value={c.moneda} onChange={e => updateCost(i, 'moneda', e.target.value)} className="bg-transparent text-sm text-foreground outline-none">
                                                            <option value="COP">COP</option>
                                                            <option value="USD">USD</option>
                                                        </select>
                                                    </td>
                                                )}
                                                <td className="py-2 px-1"><button onClick={() => removeCost(i)} className="p-1 text-muted hover:text-red-400"><X className="w-3.5 h-3.5" /></button></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot><tr className="bg-card/30">
                                        <td colSpan={isDesarrollo ? 1 : 2} className="py-2 px-3 text-right text-[10px] font-bold text-muted uppercase">Total Costos (COP)</td>
                                        <td className="py-2 px-3 text-center font-bold font-mono text-foreground">{fmtFull(formCostosTotal)}</td>
                                        <td></td>
                                    </tr></tfoot>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* Summary */}
                    <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-4 flex flex-wrap gap-6">
                        <div><span className="text-[10px] font-bold text-muted uppercase block">Subtotal ({isDesarrollo ? 'COP' : fMoneda})</span><span className="text-lg font-bold text-foreground font-mono">{fMoneda === 'USD' && !isDesarrollo ? `$${formSubtotal.toFixed(2)}` : fmtFull(formSubtotal)}</span></div>
                        <div><span className="text-[10px] font-bold text-muted uppercase block">+ {isDesarrollo ? 'Costos Producción' : 'Costos Landed'} (COP)</span><span className="text-lg font-bold text-foreground font-mono">{fmtFull(formCostosTotal)}</span></div>
                        <div><span className="text-[10px] font-bold text-muted uppercase block">= Total COP</span><span className="text-lg font-black text-emerald-400 font-mono">{fmtFull(formTotalCOP)}</span></div>
                    </div>

                    {/* Notas */}
                    <div>
                        <label className="text-[10px] font-bold text-muted uppercase block mb-1">Notas</label>
                        <input value={fNotas} onChange={e => setFNotas(e.target.value)} className="bg-card border border-sidebar-border rounded-lg px-3 py-2 text-sm text-foreground w-full" placeholder="Observaciones..." />
                    </div>

                    <div className="flex gap-2">
                        <button onClick={handleSavePO} disabled={saving || !fRef.trim() || !fProvId} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#d75c33] text-white text-sm font-bold hover:bg-[#c04f2a] disabled:opacity-50 transition-colors">
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} {editingPO ? 'Actualizar' : (isDesarrollo ? 'Crear Desarrollo' : 'Crear Importación')}
                        </button>
                        <button onClick={resetPOForm} className="px-4 py-2 rounded-lg text-sm font-bold text-muted hover:text-foreground transition-colors">Cancelar</button>
                    </div>
                </div>
            )}

            {/* PO List */}
            {filtered.length === 0 && !showForm ? (
                <div className="text-center py-16">
                    <Ship className="w-12 h-12 text-muted/30 mx-auto mb-4" />
                    <p className="text-muted text-sm">No hay importaciones registradas.</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {filtered.map(po => {
                        const totals = computePurchaseTotals(po);
                        const isExpanded = expandedId === po.id;
                        const canReceive = po.tipo === 'desarrollo_local'
                            ? ['en_produccion', 'control_calidad', 'recibida_parcial'].includes(po.estado)
                            : ['en_transito', 'en_aduana', 'recibida_parcial'].includes(po.estado);

                        return (
                            <div key={po.id} className="bg-card border border-card-border rounded-xl overflow-hidden">
                                {/* Row */}
                                <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-hover-bg/50 transition-colors" onClick={() => setExpandedId(isExpanded ? null : po.id)}>
                                    <ChevronRight className={`w-4 h-4 text-muted transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-foreground text-sm truncate">{po.referencia}</span>
                                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-black border ${estadoColor[po.estado]}`}>{ESTADO_LABELS[po.estado]}</span>
                                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-card border border-sidebar-border text-muted">{TIPO_LABELS[po.tipo]}</span>
                                        </div>
                                        <div className="text-[10px] text-muted mt-0.5">{po.proveedorNombre} · {po.fechaOrden}</div>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <div className="text-sm font-bold font-mono text-foreground">{fmtCOP(totals.totalCOP)}</div>
                                        {totals.saldoPendienteCOP > 0 && <div className="text-[10px] font-mono text-amber-400">Saldo: {fmtCOP(totals.saldoPendienteCOP)}</div>}
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                                        <button onClick={() => handleEditPO(po)} className="p-1.5 rounded-lg hover:bg-white/5 text-muted hover:text-foreground"><Edit3 className="w-3.5 h-3.5" /></button>
                                        <button onClick={() => handleDeletePO(po.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                                    </div>
                                </div>

                                {/* Expanded Detail */}
                                {isExpanded && (
                                    <div className="border-t border-sidebar-border px-4 py-4 space-y-4 bg-card/50">
                                        {/* Lines */}
                                        <div>
                                            <h4 className="text-[10px] font-bold text-muted uppercase mb-2">Productos ({po.lineas.length})</h4>
                                            <table className="w-full text-sm">
                                                <thead><tr className="border-b border-sidebar-border">
                                                    <th className="text-left py-1 px-2 text-[10px] text-muted uppercase">Producto</th>
                                                    <th className="text-right py-1 px-2 text-[10px] text-muted uppercase">Cant.</th>
                                                    <th className="text-right py-1 px-2 text-[10px] text-muted uppercase">Recibido</th>
                                                    <th className="text-right py-1 px-2 text-[10px] text-muted uppercase">Unit.</th>
                                                    <th className="text-right py-1 px-2 text-[10px] text-muted uppercase">Total</th>
                                                </tr></thead>
                                                <tbody>{po.lineas.map(l => (
                                                    <tr key={l.id} className="border-b border-sidebar-border/30">
                                                        <td className="py-1 px-2 text-foreground">{l.nombre}{l.variacion ? ` — ${l.variacion}` : ''}</td>
                                                        <td className="py-1 px-2 text-right font-mono">{l.cantidad}</td>
                                                        <td className="py-1 px-2 text-right font-mono">{l.cantidadRecibida > 0 ? <span className={l.cantidadRecibida >= l.cantidad ? 'text-emerald-400' : 'text-amber-400'}>{l.cantidadRecibida}</span> : <span className="text-muted">0</span>}</td>
                                                        <td className="py-1 px-2 text-right font-mono">{po.moneda === 'USD' ? `$${l.costoUnitario.toFixed(2)}` : fmtFull(l.costoUnitario)}</td>
                                                        <td className="py-1 px-2 text-right font-mono">{po.moneda === 'USD' ? `$${l.costoTotal.toFixed(2)}` : fmtFull(l.costoTotal)}</td>
                                                    </tr>
                                                ))}</tbody>
                                            </table>
                                        </div>

                                        {/* Costs */}
                                        {po.costosAdicionales.length > 0 && (
                                            <div>
                                                <h4 className="text-[10px] font-bold text-muted uppercase mb-2">{po.tipo === 'desarrollo_local' ? 'Costos Producción' : 'Costos Landed'} ({po.costosAdicionales.length})</h4>
                                                <div className="flex flex-wrap gap-2">
                                                    {po.costosAdicionales.map(c => (
                                                        <span key={c.id} className="px-3 py-1 rounded-lg bg-purple-500/10 border border-purple-500/20 text-xs">
                                                            <span className="text-purple-400 font-bold">{c.concepto}:</span>{' '}
                                                            <span className="font-mono text-foreground">{c.moneda === 'USD' ? `$${c.monto.toFixed(2)} USD` : fmtFull(c.monto)}</span>
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Financial Summary */}
                                        <div className="flex flex-wrap gap-4 bg-card border border-sidebar-border rounded-lg p-3">
                                            <div><span className="text-[10px] text-muted uppercase block">Total COP</span><span className="font-bold font-mono text-foreground">{fmtFull(totals.totalCOP)}</span></div>
                                            <div><span className="text-[10px] text-muted uppercase block">Pagado</span><span className="font-bold font-mono text-emerald-400">{fmtFull(totals.totalPagadoCOP)}</span></div>
                                            <div><span className="text-[10px] text-muted uppercase block">Saldo</span><span className={`font-bold font-mono ${totals.saldoPendienteCOP > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>{fmtFull(totals.saldoPendienteCOP)}</span></div>
                                            <div className="flex-1 min-w-[150px]">
                                                <span className="text-[10px] text-muted uppercase block mb-1">{fmtPct(totals.porcentajePagado)} pagado</span>
                                                <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                                                    <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${Math.min(100, totals.porcentajePagado)}%` }} />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Payments */}
                                        <div>
                                            <div className="flex items-center justify-between mb-2">
                                                <h4 className="text-[10px] font-bold text-muted uppercase">Pagos ({po.pagos.length})</h4>
                                                <button onClick={() => { setShowPayForm(showPayForm === po.id ? null : po.id); setPayMonto(''); setPayRef(''); setPayNotas(''); }} className="flex items-center gap-1 text-xs font-bold text-blue-400 hover:text-blue-300"><CreditCard className="w-3 h-3" /> Registrar Pago</button>
                                            </div>
                                            {showPayForm === po.id && (
                                                <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-3 mb-2 grid grid-cols-2 md:grid-cols-5 gap-2">
                                                    <input type="date" value={payFecha} onChange={e => setPayFecha(e.target.value)} className="bg-card border border-sidebar-border rounded-lg px-3 py-2 text-sm text-foreground" />
                                                    <input type="number" value={payMonto} onChange={e => setPayMonto(e.target.value)} className="bg-card border border-sidebar-border rounded-lg px-3 py-2 text-sm text-foreground" placeholder={`Monto (${po.moneda})`} />
                                                    <select value={payMetodo} onChange={e => setPayMetodo(e.target.value as Payment['metodo'])} className="bg-card border border-sidebar-border rounded-lg px-3 py-2 text-sm text-foreground">
                                                        <option value="transferencia">Transferencia</option>
                                                        <option value="efectivo">Efectivo</option>
                                                        <option value="LC">Carta de Crédito</option>
                                                        <option value="otro">Otro</option>
                                                    </select>
                                                    <input value={payRef} onChange={e => setPayRef(e.target.value)} className="bg-card border border-sidebar-border rounded-lg px-3 py-2 text-sm text-foreground" placeholder="# Referencia" />
                                                    <button onClick={() => handleAddPayment(po.id)} disabled={saving || !payMonto} className="flex items-center justify-center gap-1 rounded-lg bg-blue-600 text-white text-sm font-bold hover:bg-blue-500 disabled:opacity-50 transition-colors">
                                                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Agregar
                                                    </button>
                                                </div>
                                            )}
                                            {po.pagos.length > 0 && (
                                                <div className="space-y-1">
                                                    {po.pagos.sort((a, b) => a.fecha.localeCompare(b.fecha)).map(p => (
                                                        <div key={p.id} className="flex items-center justify-between px-3 py-2 bg-card border border-sidebar-border/50 rounded-lg text-xs">
                                                            <span className="text-muted font-mono">{p.fecha}</span>
                                                            <span className="font-bold font-mono text-foreground">{po.moneda === 'USD' ? `$${p.monto.toFixed(2)} USD` : fmtFull(p.monto)}</span>
                                                            <span className="text-muted">{p.metodo}</span>
                                                            <span className="text-muted truncate max-w-[120px]">{p.referencia || '—'}</span>
                                                            <button onClick={() => handleDeletePayment(po.id, p.id)} className="p-1 text-muted hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {/* Documents */}
                                        <div>
                                            <div className="flex items-center justify-between mb-2">
                                                <h4 className="text-[10px] font-bold text-muted uppercase">Documentos ({po.documentos.length})</h4>
                                                <label className="flex items-center gap-1 text-xs font-bold text-blue-400 hover:text-blue-300 cursor-pointer">
                                                    {uploadingDoc ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileText className="w-3 h-3" />}
                                                    Subir Documento
                                                    <input type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg,.xlsx,.xls" onChange={e => { if (e.target.files?.[0]) handleUploadDoc(po.id, e.target.files[0]); e.target.value = ''; }} />
                                                </label>
                                            </div>
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="text-[10px] text-muted">Tipo:</span>
                                                <select value={docTipo} onChange={e => setDocTipo(e.target.value as PurchaseDocument['tipo'])} className="bg-card border border-sidebar-border rounded-lg px-2 py-1 text-xs text-foreground">
                                                    {(Object.entries(DOC_TYPE_LABELS) as [PurchaseDocument['tipo'], string][]).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                                                </select>
                                            </div>
                                            {po.documentos.length > 0 && (
                                                <div className="space-y-1">
                                                    {po.documentos.map(d => (
                                                        <div key={d.id} className="flex items-center justify-between px-3 py-2 bg-card border border-sidebar-border/50 rounded-lg text-xs">
                                                            <div className="flex items-center gap-2 min-w-0">
                                                                <FileText className="w-3.5 h-3.5 text-muted shrink-0" />
                                                                <span className="text-foreground truncate">{d.nombre}</span>
                                                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-card border border-sidebar-border text-muted">{DOC_TYPE_LABELS[d.tipo]}</span>
                                                            </div>
                                                            <div className="flex items-center gap-1 shrink-0">
                                                                <a href={d.downloadUrl} target="_blank" rel="noopener noreferrer" className="p-1 text-blue-400 hover:text-blue-300"><Download className="w-3.5 h-3.5" /></a>
                                                                <button onClick={() => handleDeleteDoc(po.id, d)} className="p-1 text-muted hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {/* Receive Action */}
                                        {canReceive && (
                                            <div>
                                                {showReceive !== po.id ? (
                                                    <button onClick={() => { setShowReceive(po.id); setReceiveQtys({}); }} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-500 transition-colors">
                                                        <ArrowUpCircle className="w-4 h-4" /> Recibir Mercancía
                                                    </button>
                                                ) : (
                                                    <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-4 space-y-3">
                                                        <h4 className="text-sm font-bold text-emerald-400">Recepción de Mercancía</h4>
                                                        <table className="w-full text-sm">
                                                            <thead><tr className="border-b border-emerald-500/20">
                                                                <th className="text-left py-1 px-2 text-[10px] text-muted uppercase">Producto</th>
                                                                <th className="text-right py-1 px-2 text-[10px] text-muted uppercase">Pedido</th>
                                                                <th className="text-right py-1 px-2 text-[10px] text-muted uppercase">Ya Recibido</th>
                                                                <th className="text-right py-1 px-2 text-[10px] text-muted uppercase">Pendiente</th>
                                                                <th className="text-right py-1 px-2 text-[10px] text-muted uppercase w-24">Recibir</th>
                                                            </tr></thead>
                                                            <tbody>{po.lineas.map(l => {
                                                                const pending = l.cantidad - l.cantidadRecibida;
                                                                return (
                                                                    <tr key={l.id} className="border-b border-emerald-500/10">
                                                                        <td className="py-1 px-2 text-foreground">{l.nombre}{l.variacion ? ` — ${l.variacion}` : ''}</td>
                                                                        <td className="py-1 px-2 text-right font-mono">{l.cantidad}</td>
                                                                        <td className="py-1 px-2 text-right font-mono">{l.cantidadRecibida}</td>
                                                                        <td className="py-1 px-2 text-right font-mono text-amber-400">{pending}</td>
                                                                        <td className="py-1 px-2"><input type="number" min={0} max={pending} value={receiveQtys[l.id] || ''} onChange={e => setReceiveQtys(prev => ({ ...prev, [l.id]: Math.min(pending, Number(e.target.value) || 0) }))} className="bg-card border border-emerald-500/20 rounded px-2 py-1 text-sm text-foreground text-right w-full" placeholder="0" /></td>
                                                                    </tr>
                                                                );
                                                            })}</tbody>
                                                        </table>
                                                        <div className="flex gap-2">
                                                            <button onClick={() => handleReceive(po.id)} disabled={receiving || Object.values(receiveQtys).every(q => !q)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-500 disabled:opacity-50 transition-colors">
                                                                {receiving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Confirmar Recepción
                                                            </button>
                                                            <button onClick={() => setShowReceive(null)} className="px-4 py-2 rounded-lg text-sm font-bold text-muted hover:text-foreground">Cancelar</button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

// ── Helper: Process dispatch movements on import ────────────────────────────
async function processDispatchMovements(orders: SupplierOrder[], userId: string) {
    const { getInventory, getMovements: getMov, bulkAddMovements: bulkAdd } = await import('@/lib/services/supplierInventory');
    const inventory = await getInventory(userId);
    if (inventory.length === 0) return;

    const inventoryKeys = new Set(inventory.map(p => `${p.productoId}_${p.variacionId || 'NO_VAR'}`));

    const dispatchOrders = orders.filter(o => isDespachado(o.ESTATUS));
    const movements: InventoryMovement[] = dispatchOrders
        .filter(o => {
            const key = `${o.PRODUCTO_ID}_${o.VARIACION_ID || 'NO_VAR'}`;
            return inventoryKeys.has(key);
        })
        .map((o, i) => ({
            id: `desp_${Date.now()}_${i}`,
            productoId: o.PRODUCTO_ID,
            variacionId: o.VARIACION_ID || '',
            tipo: 'despacho' as const,
            cantidad: -o.CANTIDAD,
            referencia: o.ID,
            fecha: o.FECHA?.split?.(' ')?.[0] || o.FECHA || '',
            notas: `Orden #${o.ID}`,
            createdAt: Date.now(),
        }));

    if (movements.length > 0) {
        await bulkAdd(movements, userId);
    }
}
