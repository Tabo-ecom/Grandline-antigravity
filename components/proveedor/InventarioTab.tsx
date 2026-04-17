'use client';

import React, { useState, useMemo } from 'react';
import {
    Loader2, Plus, Trash2, Upload, CheckCircle, RefreshCw,
    Package, BarChart3, DollarSign, TrendingUp, AlertTriangle
} from 'lucide-react';
import InventoryTable from './InventoryTable';
import { fmtFull, fmtNum } from './formatters';
import type { useSupplierData } from '@/lib/hooks/useSupplierData';
import {
    InventoryProduct, saveInventoryProduct, deleteInventoryProduct,
    getInventory, bulkSaveInventory, clearAllInventory
} from '@/lib/services/supplierInventory';
import { ParsedInventoryProduct, parseInventoryFile } from '@/lib/utils/supplierParser';

export default function InventarioTab({ data, userId }: { data: ReturnType<typeof useSupplierData>; userId: string }) {
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
