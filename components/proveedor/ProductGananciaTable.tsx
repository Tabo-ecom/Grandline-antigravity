'use client';

import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, Edit3 } from 'lucide-react';
import { fmtCOP, fmtFull, fmtPct, fmtNum } from './formatters';
import type { ProductSupplierKPI } from '@/lib/calculations/supplierKpis';

export default function ProductGananciaTable({ products, onGoToInventario }: { products: ProductSupplierKPI[]; onGoToInventario: () => void }) {
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
                                                <td className="py-1.5 px-3 pl-8 text-muted text-xs">{v.variacion || 'Sin variacion'}</td>
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
