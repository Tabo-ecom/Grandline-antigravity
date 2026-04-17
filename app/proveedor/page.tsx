'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Loader2, RefreshCw, BarChart3, Package, Ship, Users, Upload, Ticket } from 'lucide-react';
import { getStartDateForRange, getEndDateForRange } from '@/lib/utils/date-parsers';
import { useAuth } from '@/lib/context/AuthContext';
import { useSupplierData } from '@/lib/hooks/useSupplierData';
import { InventoryProduct, bulkSaveInventory } from '@/lib/services/supplierInventory';
import { getCatalog, ProductCatalogData } from '@/lib/services/productCatalog';
import { getAllOrderFiles } from '@/lib/firebase/firestore';
import dynamic from 'next/dynamic';

// ── Dynamic imports for tab components ─────────────────────────────────────
const CatalogTab = dynamic(() => import('@/components/proveedor/CatalogTab'));
const DashboardTab = dynamic(() => import('@/components/proveedor/DashboardTab'));
const InventarioTab = dynamic(() => import('@/components/proveedor/InventarioTab'));
const ImportacionesTab = dynamic(() => import('@/components/proveedor/ImportacionesTab'));
const ProveedoresTab = dynamic(() => import('@/components/proveedor/ProveedoresTab'));
const DevolucionesTab = dynamic(() => import('@/components/proveedor/DevolucionesTab'));
const ImportarTab = dynamic(() => import('@/components/proveedor/ImportarTab'));
const TicketsTab = dynamic(() => import('@/components/proveedor/TicketsTab'));

// ── Tab type ────────────────────────────────────────────────────────────────
type TabId = 'dashboard' | 'catalogo' | 'inventario' | 'importaciones' | 'proveedores' | 'devoluciones' | 'importar' | 'tickets';

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'catalogo', label: 'Catálogo', icon: Package },
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
    const [catalog, setCatalog] = useState<ProductCatalogData | null>(null);
    const [dropiOrders, setDropiOrders] = useState<any[]>([]);

    // Load catalog + Dropi orders on mount
    useEffect(() => {
        if (!effectiveUid) return;
        getCatalog(effectiveUid).then(setCatalog);
        getAllOrderFiles(effectiveUid).then(files => {
            const all: any[] = [];
            (files || []).forEach((f: any) => {
                if (f.orders && Array.isArray(f.orders)) {
                    f.orders.forEach((o: any) => all.push({ ...o, _country: f.country, _store: o.TIENDA || o._raw?.TIENDA || '' }));
                }
            });
            setDropiOrders(all);
        });
    }, [effectiveUid]);

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
            {activeTab === 'catalogo' && catalog && (
                <CatalogTab catalog={catalog} userId={effectiveUid || ''} onUpdate={setCatalog} dropiOrders={dropiOrders} />
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
