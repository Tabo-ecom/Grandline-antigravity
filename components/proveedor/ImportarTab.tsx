'use client';

import { useState, useEffect } from 'react';
import { Loader2, Upload, Trash2 } from 'lucide-react';
import { SupplierOrder, parseSupplierFile } from '@/lib/utils/supplierParser';
import { InventoryProduct, InventoryMovement, bulkSaveInventory, getInventory } from '@/lib/services/supplierInventory';
import { isDespachado } from '@/lib/calculations/supplierKpis';
import {
    saveSupplierOrderFile,
    deleteSupplierImportLog,
    findOverlappingSupplierImports,
    getSupplierImportHistory,
} from '@/lib/firebase/firestore';
import { invalidateSupplierCache } from '@/lib/hooks/useSupplierData';

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

export default function ImportarTab({ userId, onImported }: { userId: string; onImported: () => void }) {
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
                setStatus(`${parsed.orders.length} ordenes parseadas. Se encontraron conflictos.`);
            } else if (overlap.isSubset) {
                setStatus(`Este archivo ya esta contenido en "${overlap.isSubset}". No se importara.`);
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
                    setStatus(`✓ ${parsed.orders.length} ordenes importadas. Se crearon ${productMap.size} productos en inventario automaticamente.`);
                } else {
                    setStatus(`✓ ${parsed.orders.length} ordenes importadas exitosamente.`);
                }
            } else {
                setStatus(`✓ ${parsed.orders.length} ordenes importadas exitosamente.`);
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
                            Archivos que seran reemplazados: {conflict.superseded.map((s: any) => s.fileName).join(', ')}
                        </p>
                    )}
                    {conflict.conflicts.length > 0 && (
                        <p className="text-sm text-muted">
                            Conflictos parciales: {conflict.conflicts.map((c: any) => `${c.fileName} (${c.commonCount} en comun)`).join(', ')}
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
                                        {log.orderCount} ordenes · {log.country} · {log.uploaded_at instanceof Date ? log.uploaded_at.toLocaleDateString('es-CO') : ''}
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
