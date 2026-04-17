'use client';

import React, { useState } from 'react';
import { Loader2, Upload, AlertTriangle } from 'lucide-react';
import { fmtNum } from './formatters';
import type { useSupplierData } from '@/lib/hooks/useSupplierData';
import { parseReturnsFile } from '@/lib/utils/supplierParser';
import { resolveReturnProducts, bulkImportReturns } from '@/lib/services/supplierReturns';

export default function DevolucionesTab({ data, userId }: { data: ReturnType<typeof useSupplierData>; userId: string }) {
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
                        notas: `Devolucion orden #${r.idDropi}`,
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
                        {uploadResult.imported} importadas, {uploadResult.skipped} omitidas (ya existian)
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
                                    <th className="text-left py-2 px-3 text-[10px] font-bold text-muted uppercase">Variacion</th>
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
                                    <th className="text-left py-2 px-3 text-[10px] font-bold text-muted uppercase">Variacion</th>
                                    <th className="text-right py-2 px-3 text-[10px] font-bold text-muted uppercase">Cant.</th>
                                    <th className="text-left py-2 px-3 text-[10px] font-bold text-muted uppercase">Transportadora</th>
                                    <th className="text-left py-2 px-3 text-[10px] font-bold text-muted uppercase">Guia</th>
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
