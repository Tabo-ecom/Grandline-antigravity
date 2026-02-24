'use client';

import React, { useState, useMemo } from 'react';
import { DollarSign, Search, ArrowRight, Trash2, CheckCircle2, ChevronDown, AlertCircle, Loader2 } from 'lucide-react';
import { useDashboardData } from '@/lib/hooks/useDashboardData';
import { isEntregado } from '@/lib/utils/status';
import { getSupplierUnitPrice } from '@/lib/services/priceCorrections';
import type { PriceCorrection } from '@/lib/services/priceCorrections';

function formatCOP(value: number): string {
    return '$' + Math.round(value).toLocaleString('es-CO');
}

export default function PriceCorrections() {
    const {
        loading,
        rawOrders,
        rawOrdersCount,
        availableProducts,
        priceCorrections,
        savePriceCorrection,
        deletePriceCorrection,
    } = useDashboardData();

    const [selectedProduct, setSelectedProduct] = useState<string>('');
    const [editingPrice, setEditingPrice] = useState<number | null>(null);
    const [correctedValue, setCorrectedValue] = useState<string>('');
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState<string | null>(null);

    // Get ALL orders for the selected product (not date-filtered)
    const productOrders = useMemo(() => {
        if (!selectedProduct) return [];
        return rawOrders.filter(o => {
            const pid = o.PRODUCTO_ID?.toString() || '';
            return pid === selectedProduct;
        });
    }, [rawOrders, selectedProduct]);

    // Analyze distinct supplier unit prices for selected product
    const priceAnalysis = useMemo(() => {
        if (!productOrders.length) return [];

        const priceMap = new Map<number, { total: number; delivered: number }>();

        for (const order of productOrders) {
            const unitPrice = getSupplierUnitPrice(order);
            if (unitPrice === 0) continue;

            const existing = priceMap.get(unitPrice) || { total: 0, delivered: 0 };
            existing.total++;
            if (isEntregado(order.ESTATUS)) existing.delivered++;
            priceMap.set(unitPrice, existing);
        }

        return Array.from(priceMap.entries())
            .map(([price, counts]) => ({ price, ...counts }))
            .sort((a, b) => a.price - b.price);
    }, [productOrders]);

    // Count affected orders for each active correction
    const correctionCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        for (const corr of priceCorrections) {
            // Corrections are already applied in the pipeline, so match correctedUnitPrice
            const matching = rawOrders.filter(o => {
                const pid = o.PRODUCTO_ID?.toString() || '';
                if (pid !== corr.productId) return false;
                if (corr.country && o.country !== corr.country) return false;
                const unitPrice = getSupplierUnitPrice(o);
                return Math.abs(unitPrice - corr.correctedUnitPrice) <= 1;
            }).length;
            counts[corr.id] = matching;
        }
        return counts;
    }, [priceCorrections, rawOrders]);

    const selectedProductName = availableProducts.find(p => p.id === selectedProduct)?.label || '';

    const handleSave = async (originalPrice: number) => {
        const corrected = parseFloat(correctedValue);
        if (!corrected || corrected <= 0 || !selectedProduct) return;

        setSaving(true);
        try {
            const correction: PriceCorrection = {
                id: crypto.randomUUID(),
                productId: selectedProduct,
                productName: selectedProductName,
                originalUnitPrice: originalPrice,
                correctedUnitPrice: corrected,
                createdAt: Date.now(),
            };
            await savePriceCorrection(correction);
            setEditingPrice(null);
            setCorrectedValue('');
        } catch (err) {
            console.error('Error saving correction:', err);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        setDeleting(id);
        try {
            await deletePriceCorrection(id);
        } catch (err) {
            console.error('Error deleting correction:', err);
        } finally {
            setDeleting(null);
        }
    };

    if (loading && rawOrdersCount === 0) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 text-accent animate-spin" />
                <span className="ml-3 text-muted">Cargando datos...</span>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Info Banner */}
            <div className="bg-accent/5 border border-accent/20 p-6 rounded-2xl flex gap-4">
                <DollarSign className="w-6 h-6 text-accent shrink-0" />
                <div className="text-sm">
                    <h4 className="font-bold text-accent uppercase tracking-wider text-xs mb-1">Corrección de Precio Proveedor</h4>
                    <p className="text-muted leading-relaxed">
                        Selecciona un producto y corrige el precio de proveedor incorrecto. Las correcciones se aplican automáticamente a todas las órdenes afectadas y recalculan el costo del producto y la ganancia.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Content */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Step 1: Product Selector */}
                    <div className="bg-card border border-card-border rounded-3xl p-6">
                        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center text-[10px] font-bold text-accent">1</span>
                            Seleccionar Producto
                        </h3>
                        <div className="relative">
                            <select
                                value={selectedProduct}
                                onChange={(e) => {
                                    setSelectedProduct(e.target.value);
                                    setEditingPrice(null);
                                    setCorrectedValue('');
                                }}
                                className="w-full bg-hover-bg border border-card-border rounded-2xl px-4 py-3 text-sm font-medium appearance-none cursor-pointer focus:outline-none focus:border-accent transition-colors"
                            >
                                <option value="">Selecciona un producto...</option>
                                {availableProducts.filter(p => p.id !== 'Todos').map(p => (
                                    <option key={p.id} value={p.id}>{p.label}</option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
                        </div>
                    </div>

                    {/* Step 2: Price Analysis Table */}
                    {selectedProduct && (
                        <div className="bg-card border border-card-border rounded-3xl p-6 animate-in fade-in slide-in-from-top-4">
                            <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                                <span className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center text-[10px] font-bold text-accent">2</span>
                                Precios de Proveedor Encontrados
                            </h3>
                            <p className="text-muted text-xs mb-4">
                                {selectedProductName} — {productOrders.length} órdenes en el rango seleccionado
                            </p>

                            {priceAnalysis.length === 0 ? (
                                <div className="border border-dashed border-card-border rounded-2xl p-8 text-center">
                                    <Search className="w-8 h-8 text-muted mx-auto mb-2" />
                                    <p className="text-sm text-muted">No se encontraron precios de proveedor para este producto.</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {priceAnalysis.map(({ price, total, delivered }) => {
                                        const isEditing = editingPrice === price;
                                        const hasCorrection = priceCorrections.some(
                                            c => c.productId === selectedProduct && Math.abs(c.originalUnitPrice - price) <= 1
                                        );

                                        return (
                                            <div
                                                key={price}
                                                className={`p-4 rounded-2xl border transition-all ${isEditing
                                                    ? 'bg-accent/5 border-accent/30'
                                                    : hasCorrection
                                                        ? 'bg-emerald-500/5 border-emerald-500/20'
                                                        : 'bg-hover-bg border-card-border'
                                                }`}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-4">
                                                        <div className="text-right min-w-[120px]">
                                                            <p className="text-lg font-bold font-mono">{formatCOP(price)}</p>
                                                            <p className="text-[10px] text-muted uppercase">por unidad</p>
                                                        </div>
                                                        <div className="h-10 w-px bg-card-border" />
                                                        <div>
                                                            <p className="text-sm">
                                                                <span className="font-bold">{total}</span>
                                                                <span className="text-muted"> órdenes</span>
                                                            </p>
                                                            <p className="text-xs text-muted">
                                                                {delivered} entregadas
                                                            </p>
                                                        </div>
                                                    </div>

                                                    {hasCorrection ? (
                                                        <span className="flex items-center gap-1 text-xs font-bold text-emerald-400">
                                                            <CheckCircle2 className="w-4 h-4" />
                                                            Corregido
                                                        </span>
                                                    ) : (
                                                        <button
                                                            onClick={() => {
                                                                setEditingPrice(isEditing ? null : price);
                                                                setCorrectedValue('');
                                                            }}
                                                            className="px-4 py-2 rounded-xl text-xs font-bold bg-accent/10 text-accent hover:bg-accent/20 transition-colors"
                                                        >
                                                            {isEditing ? 'Cancelar' : 'Corregir'}
                                                        </button>
                                                    )}
                                                </div>

                                                {/* Correction Input */}
                                                {isEditing && (
                                                    <div className="mt-4 pt-4 border-t border-card-border animate-in fade-in slide-in-from-top-2">
                                                        <div className="flex items-center gap-3">
                                                            <div className="flex-1">
                                                                <label className="text-[10px] text-muted uppercase tracking-wider font-bold mb-1 block">
                                                                    Precio correcto por unidad
                                                                </label>
                                                                <div className="relative">
                                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm">$</span>
                                                                    <input
                                                                        type="number"
                                                                        value={correctedValue}
                                                                        onChange={(e) => setCorrectedValue(e.target.value)}
                                                                        placeholder="7000"
                                                                        className="w-full bg-background border border-card-border rounded-xl pl-7 pr-4 py-2.5 text-sm font-mono focus:outline-none focus:border-accent transition-colors"
                                                                        autoFocus
                                                                    />
                                                                </div>
                                                            </div>
                                                            <button
                                                                onClick={() => handleSave(price)}
                                                                disabled={saving || !correctedValue || parseFloat(correctedValue) <= 0}
                                                                className="mt-5 px-6 py-2.5 rounded-xl text-sm font-bold bg-accent text-white hover:bg-accent/90 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                                            >
                                                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                                                                Aplicar
                                                            </button>
                                                        </div>

                                                        {correctedValue && parseFloat(correctedValue) > 0 && (
                                                            <div className="mt-3 bg-accent/10 border border-accent/20 rounded-xl p-3 text-xs">
                                                                <p className="text-accent font-bold flex items-center gap-2">
                                                                    <ArrowRight className="w-3 h-3" />
                                                                    Se corregirán {total} órdenes: {formatCOP(price)} → {formatCOP(parseFloat(correctedValue))}
                                                                </p>
                                                                <p className="text-muted mt-1">
                                                                    Impacto en costo por orden entregada: +{formatCOP(parseFloat(correctedValue) - price)}
                                                                </p>
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
                    )}
                </div>

                {/* Sidebar: Active Corrections */}
                <div className="space-y-6">
                    <div className="bg-card border border-card-border p-6 rounded-3xl">
                        <h3 className="text-lg font-bold mb-4 flex items-center justify-between">
                            Correcciones Activas
                            <span className="text-xs font-bold text-muted bg-hover-bg px-2 py-1 rounded-lg">
                                {priceCorrections.length}
                            </span>
                        </h3>

                        {priceCorrections.length === 0 ? (
                            <div className="border border-dashed border-card-border rounded-2xl p-6 text-center">
                                <AlertCircle className="w-6 h-6 text-muted mx-auto mb-2" />
                                <p className="text-xs text-muted italic">No hay correcciones activas.</p>
                                <p className="text-[10px] text-muted mt-1">Selecciona un producto y corrige un precio para comenzar.</p>
                            </div>
                        ) : (
                            <div className="space-y-3 max-h-[500px] overflow-y-auto">
                                {priceCorrections.map((corr, idx) => (
                                    <div
                                        key={corr.id}
                                        className="p-4 bg-hover-bg border border-card-border rounded-2xl animate-in fade-in slide-in-from-right-4"
                                        style={{ animationDelay: `${idx * 50}ms` }}
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0 flex-1">
                                                <p className="text-xs font-bold text-foreground truncate">{corr.productName}</p>
                                                <div className="flex items-center gap-1.5 mt-1">
                                                    <span className="text-xs font-mono text-red-400 line-through">{formatCOP(corr.originalUnitPrice)}</span>
                                                    <ArrowRight className="w-3 h-3 text-muted" />
                                                    <span className="text-xs font-mono text-emerald-400 font-bold">{formatCOP(corr.correctedUnitPrice)}</span>
                                                </div>
                                                <p className="text-[10px] text-muted mt-1">
                                                    {correctionCounts[corr.id] || 0} órdenes afectadas
                                                    {corr.country && ` · ${corr.country}`}
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => handleDelete(corr.id)}
                                                disabled={deleting === corr.id}
                                                className="w-7 h-7 rounded-full flex items-center justify-center text-muted hover:text-red-400 hover:bg-red-400/10 transition-colors shrink-0"
                                                title="Eliminar corrección"
                                            >
                                                {deleting === corr.id ? (
                                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                ) : (
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* How it works */}
                    <div className="bg-card border border-card-border p-6 rounded-3xl">
                        <h3 className="text-lg font-bold mb-4">¿Cómo funciona?</h3>
                        <ul className="space-y-4">
                            {[
                                'Selecciona el producto con precio incorrecto.',
                                'Identifica el precio de proveedor equivocado.',
                                'Ingresa el precio correcto y aplica.',
                                'El dashboard recalcula costos y ganancias.',
                            ].map((step, i) => (
                                <li key={i} className="flex gap-3 text-sm">
                                    <span className="w-5 h-5 rounded-full bg-hover-bg border border-card-border flex items-center justify-center text-[10px] font-bold text-accent shrink-0">
                                        {i + 1}
                                    </span>
                                    <span className="text-muted">{step}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}
