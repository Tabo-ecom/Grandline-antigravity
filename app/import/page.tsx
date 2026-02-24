'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Upload, FileText, CheckCircle2, AlertCircle, Loader2, Trash2, AlertTriangle, AlertOctagon, DollarSign } from 'lucide-react';
import { parseDropiFile, ParseResult } from '@/lib/utils/parser';
import { saveOrderFile, getImportHistory, deleteImportLog, findOverlappingImports } from '@/lib/firebase/firestore';
import { clearAdCenterCache } from '@/lib/services/marketing';
import { invalidateDashboardCache } from '@/lib/hooks/useDashboardData';
import { useAuth } from '@/lib/context/AuthContext';
import dynamic from 'next/dynamic';

const PriceCorrections = dynamic(() => import('@/components/import/PriceCorrections'), { ssr: false });

type ActiveTab = 'import' | 'corrections';

export default function ImportPage() {
    const { user, effectiveUid } = useAuth();
    const [activeTab, setActiveTab] = useState<ActiveTab>('import');
    const [isDragging, setIsDragging] = useState(false);
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState<ParseResult[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [importHistory, setImportHistory] = useState<any[]>([]);
    const [updates, setUpdates] = useState<string[]>([]);
    const [conflict, setConflict] = useState<{
        file: File;
        parsedData: ParseResult;
        overlap: any;
        onResolve: (action: 'replace' | 'keep' | 'cancel') => void;
    } | null>(null);

    // Load import history on mount
    useEffect(() => {
        async function loadHistory() {
            if (!user) return;
            try {
                const history = await getImportHistory(effectiveUid!);
                setImportHistory(history);
            } catch (err) {
                console.error('Error loading import history:', err);
            }
        }
        loadHistory();
    }, [user]);

    const onDrop = useCallback(async (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) handleFiles(files);
    }, [user]);

    const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files ? Array.from(e.target.files) : [];
        if (files.length > 0) handleFiles(files);
    };

    const handleDelete = async (logId: string) => {
        if (!user) return;
        if (!window.confirm('¿Estás seguro de que deseas eliminar este reporte? Las métricas relacionadas en el dashboard desaparecerán.')) return;

        try {
            setLoading(true);
            await deleteImportLog(logId);

            // Invalidate Ad Center cache to reflect deletion in other tabs
            clearAdCenterCache();

            // Reload history after successful deletion
            const history = await getImportHistory(effectiveUid!);
            setImportHistory(history);
            setError(null);
        } catch (err) {
            console.error('Delete error:', err);
            setError('Error al eliminar el registro de importación.');
        } finally {
            setLoading(false);
        }
    };

    const processFile = async (parsedData: ParseResult, file: File, forceAction?: 'replace' | 'keep') => {
        if (!user) return;

        try {
            const orderIds = parsedData.orders.map(o => o.ID);
            const overlap = await findOverlappingImports(effectiveUid!, parsedData.country, orderIds);

            // 1. Auto-delete superseded reports (case where new file has ALL orders of old ones)
            const supersededNames: string[] = [];
            for (const old of overlap.superseded) {
                await deleteImportLog(old.id);
                supersededNames.push(old.fileName);
            }

            // 2. Handle conflicts (partial overlaps or subsets) if not forced
            if (!forceAction) {
                if (overlap.isSubset || overlap.conflicts.length > 0) {
                    return new Promise<'resolved'>((resolve) => {
                        setConflict({
                            file,
                            parsedData,
                            overlap,
                            onResolve: async (action) => {
                                if (action === 'cancel') {
                                    setConflict(null);
                                    resolve('resolved');
                                    return;
                                }

                                // Reset loading state for the specific save
                                setLoading(true);
                                if (action === 'replace') {
                                    for (const c of overlap.conflicts) {
                                        await deleteImportLog(c.id);
                                        supersededNames.push(c.fileName);
                                    }
                                    if (typeof overlap.isSubset === 'string') {
                                        // If subset, we don't necessarily delete the big file unless user wants to update it
                                        // But usually if it's a subset, "Replace" means the user wants the new file to be the source
                                        // However, if new is subset of old, replacing old would LOSE data.
                                        // We should probably just warn that data is already there.
                                    }
                                }

                                await saveOrderFile({
                                    userId: effectiveUid!,
                                    fileName: parsedData.fileName,
                                    country: parsedData.country,
                                    orderCount: parsedData.orders.length,
                                    orders: parsedData.orders,
                                });
                                invalidateDashboardCache();

                                if (supersededNames.length > 0) {
                                    setUpdates(prev => [...prev, ...supersededNames]);
                                }

                                setResults(prev => [parsedData, ...prev]);
                                setConflict(null);
                                setLoading(false);
                                resolve('resolved');
                            }
                        });
                    });
                }
            }

            // 3. Normal save if no conflict or auto-replacement happened
            await saveOrderFile({
                userId: effectiveUid!,
                fileName: parsedData.fileName,
                country: parsedData.country,
                orderCount: parsedData.orders.length,
                orders: parsedData.orders,
            });
            invalidateDashboardCache();

            if (supersededNames.length > 0) {
                setUpdates(prev => [...prev, ...supersededNames]);
            }

            setResults(prev => [parsedData, ...prev]);
            return 'done';
        } catch (err: any) {
            console.error('Process error:', err);
            setError(`Error procesando ${file.name}: ${err.message}`);
        }
    };

    const handleFiles = async (files: File[]) => {
        if (!user) {
            setError('Debes iniciar sesión para subir archivos.');
            return;
        }

        setLoading(true);
        setError(null);
        setUpdates([]);

        for (const file of files) {
            try {
                const parsedData = await parseDropiFile(file);

                const result = await processFile(parsedData, file);

                // If it opened a modal, the loop will naturally wait for the promise to resolve
                // if processFile returns a promise.

                // Invalidate Ad Center cache
                clearAdCenterCache();
            } catch (err: any) {
                console.error('Upload error for file:', file.name, err);
                setError(`Error en ${file.name}: ${err.message || 'Error al procesar.'}`);
            }
        }

        // Reload history
        const history = await getImportHistory(effectiveUid!);
        setImportHistory(history);
        setLoading(false);
    };

    return (
        <div className="space-y-8 max-w-5xl mx-auto">
            <div>
                <h1 className="text-3xl font-bold tracking-tight font-['Space_Grotesk']">Importar Datos</h1>
                <p className="text-muted mt-1">Sube tus archivos de órdenes de Dropi para actualizar el Grand Line.</p>
            </div>

            {/* Tab Toggle */}
            <div className="flex gap-2 bg-card border border-card-border rounded-2xl p-1.5 w-fit">
                <button
                    onClick={() => setActiveTab('import')}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'import'
                        ? 'bg-accent text-white shadow-lg shadow-accent/20'
                        : 'text-muted hover:text-foreground hover:bg-hover-bg'
                    }`}
                >
                    <Upload className="w-4 h-4" />
                    Importar Órdenes
                </button>
                <button
                    onClick={() => setActiveTab('corrections')}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'corrections'
                        ? 'bg-accent text-white shadow-lg shadow-accent/20'
                        : 'text-muted hover:text-foreground hover:bg-hover-bg'
                    }`}
                >
                    <DollarSign className="w-4 h-4" />
                    Corrección de Precios
                </button>
            </div>

            {/* Tab Content */}
            {activeTab === 'import' ? (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {/* Upload Area */}
                        <div className="md:col-span-2 space-y-6">
                            <label
                                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                                onDragLeave={() => setIsDragging(false)}
                                onDrop={onDrop}
                                className={`bg-card border-2 border-dashed rounded-3xl p-12 flex flex-col items-center justify-center text-center group transition-all cursor-pointer ${isDragging ? 'border-accent bg-accent/5' : 'border-card-border hover:border-accent/50'
                                    } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                <input
                                    type="file"
                                    className="hidden"
                                    accept=".xlsx,.csv"
                                    onChange={onFileChange}
                                    disabled={loading}
                                    multiple
                                />
                                <div className="w-20 h-20 rounded-full bg-hover-bg flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                    {loading ? (
                                        <Loader2 className="w-10 h-10 text-accent animate-spin" />
                                    ) : (
                                        <Upload className="w-10 h-10 text-accent" />
                                    )}
                                </div>
                                <h3 className="text-2xl font-bold italic">
                                    {loading ? 'Navegando entre Datos...' : 'Suelte el Log de Navegación'}
                                </h3>
                                <p className="text-muted mt-3 max-w-xs text-sm">
                                    Arrastra tu archivo Excel o CSV de Dropi aquí o <span className="text-accent font-bold">haz clic para buscar</span>.
                                </p>
                                <div className="mt-8 flex gap-4">
                                    <span className="px-4 py-1.5 bg-hover-bg border border-card-border rounded-full text-[10px] uppercase tracking-widest font-bold text-muted">Excel (.xlsx)</span>
                                    <span className="px-4 py-1.5 bg-hover-bg border border-card-border rounded-full text-[10px] uppercase tracking-widest font-bold text-muted">CSV (.csv)</span>
                                </div>
                            </label>

                            {error && (
                                <div className="bg-red-500/10 border border-red-500/20 p-6 rounded-2xl flex gap-4 animate-in fade-in slide-in-from-top-4">
                                    <AlertCircle className="w-6 h-6 text-red-400 shrink-0" />
                                    <div className="text-sm">
                                        <h4 className="font-bold text-red-400 uppercase tracking-wider text-xs mb-1">¡Alerta de Niebla!</h4>
                                        <p className="text-foreground/80">{error}</p>
                                    </div>
                                </div>
                            )}

                            {results.length > 0 && (
                                <div className="bg-green-500/10 border border-green-500/20 p-6 rounded-2xl flex gap-4 animate-in fade-in slide-in-from-top-4">
                                    <CheckCircle2 className="w-6 h-6 text-green-400 shrink-0" />
                                    <div className="text-sm">
                                        <h4 className="font-bold text-green-400 uppercase tracking-wider text-xs mb-1">
                                            {updates.length > 0 ? '¡LOG DE NAVEGACIÓN ACTUALIZADO!' : '¡Tierra a la vista!'}
                                        </h4>
                                        <div className="text-foreground/80 space-y-2">
                                            <p>Se han procesado <b>{results.length} archivos</b> exitosamente.</p>
                                            {updates.length > 0 && (
                                                <div className="bg-green-500/20 px-3 py-2 rounded-xl border border-green-500/30 text-xs">
                                                    <p className="font-bold text-green-400 mb-1">Reportes Reemplazados:</p>
                                                    <ul className="list-disc list-inside opacity-80">
                                                        {updates.map((name, i) => <li key={i}>{name}</li>)}
                                                    </ul>
                                                    <p className="mt-2 text-[10px] italic">Se eliminaron los reportes anteriores que ya están contenidos en esta carga para evitar duplicados.</p>
                                                </div>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => window.location.href = '/dashboard'}
                                            className="mt-3 text-green-400 font-bold hover:underline flex items-center gap-1"
                                        >
                                            Ir al Dashboard →
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div className="bg-blue-500/5 border border-blue-500/20 p-6 rounded-2xl flex gap-4">
                                <AlertCircle className="w-6 h-6 text-blue-400 shrink-0" />
                                <div className="text-sm">
                                    <h4 className="font-bold text-blue-400 uppercase tracking-wider text-xs mb-1">Nota de Inteligencia</h4>
                                    <p className="text-muted leading-relaxed">
                                        El sistema detectará automáticamente el país basado en las ciudades del archivo. Asegúrate de que las columnas coincidan con el formato estándar de Dropi.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Instructions / Status */}
                        <div className="space-y-6">
                            <div className="bg-card border border-card-border p-6 rounded-3xl">
                                <h3 className="text-lg font-bold mb-4">Guía de Importación</h3>
                                <ul className="space-y-4">
                                    {[
                                        'Descarga el reporte de órdenes de Dropi.',
                                        'Asegúrate de NO modificar las columnas.',
                                        'Sube el archivo aquí.',
                                        'Verifica el país detectado.',
                                        'Procesa y actualiza el dashboard.'
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

                            <div className="bg-card border border-card-border p-6 rounded-3xl overflow-hidden">
                                <h3 className="text-lg font-bold mb-6 flex items-center justify-between">
                                    Historial
                                    <FileText className="w-4 h-4 text-muted" />
                                </h3>
                                <div className="space-y-4 max-h-96 overflow-y-auto">
                                    {importHistory.length > 0 ? (
                                        importHistory.slice(0, 10).map((log, idx) => (
                                            <div key={log.id || idx} className="p-4 bg-hover-bg border border-card-border rounded-2xl flex items-center gap-4 animate-in fade-in slide-in-from-right-4" style={{ animationDelay: `${idx * 50}ms` }}>
                                                <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center text-lg font-bold">
                                                    {log.country}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-xs font-bold text-foreground truncate">{log.fileName}</p>
                                                    <p className="text-[10px] text-muted uppercase tracking-tighter">
                                                        {log.orderCount} órdenes · {new Date(log.uploaded_at).toLocaleDateString('es-ES', {
                                                            month: 'short',
                                                            day: 'numeric',
                                                            hour: '2-digit',
                                                            minute: '2-digit'
                                                        })}
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={() => handleDelete(log.id)}
                                                    disabled={loading}
                                                    className="w-8 h-8 rounded-full flex items-center justify-center text-muted hover:text-red-400 hover:bg-red-400/10 transition-colors"
                                                    title="Eliminar importación"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="border border-dashed border-card-border rounded-2xl p-4 flex flex-col items-center justify-center text-center py-10">
                                            <p className="text-xs text-muted italic">No hay importaciones recientes.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Conflict Resolution Modal */}
                    {conflict && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
                            <div className="bg-card border border-card-border rounded-3xl p-8 max-w-lg w-full shadow-2xl animate-in zoom-in-95 duration-200">
                                <div className="flex items-start gap-4 mb-6">
                                    <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
                                        <AlertTriangle className="w-6 h-6 text-amber-500" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold">Conflicto de Órdenes Detectado</h3>
                                        <p className="text-muted text-sm mt-1">
                                            El archivo <span className="text-foreground font-mono">{conflict.file.name}</span> tiene solapamiento con datos existentes.
                                        </p>
                                    </div>
                                </div>

                                <div className="space-y-4 mb-8">
                                    {conflict.overlap.isSubset && (
                                        <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl">
                                            <div className="flex gap-3">
                                                <AlertOctagon className="w-5 h-5 text-amber-500 shrink-0" />
                                                <div className="text-sm">
                                                    <p className="font-bold text-amber-500">Subconjunto Detectado</p>
                                                    <p className="text-foreground/80 mt-1">Todas las órdenes de este archivo ya están en <span className="italic font-bold text-amber-400">{conflict.overlap.isSubset}</span>.</p>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {conflict.overlap.conflicts.map((c: any, i: number) => (
                                        <div key={i} className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl">
                                            <div className="flex gap-3">
                                                <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
                                                <div className="text-sm">
                                                    <p className="font-bold text-red-500 whitespace-nowrap overflow-hidden text-ellipsis max-w-[300px]">Conflicto con: {c.fileName}</p>
                                                    <p className="text-foreground/80 mt-1">
                                                        Comparten <b>{c.commonCount}</b> órdenes.
                                                        Al reporte anterior le faltarían <b>{c.missingCount}</b> órdenes si lo reemplazas ahora.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="grid grid-cols-1 gap-3">
                                    <button
                                        onClick={() => conflict.onResolve('replace')}
                                        className="w-full py-4 bg-red-500 hover:bg-red-600 text-white rounded-2xl font-bold transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                                    >
                                        Reemplazar reportes anteriores
                                        <span className="text-[10px] opacity-60 uppercase font-black">(Recomendado para evitar dobles)</span>
                                    </button>
                                    <button
                                        onClick={() => conflict.onResolve('keep')}
                                        className="w-full py-4 bg-hover-bg border border-card-border hover:bg-card text-foreground rounded-2xl font-bold transition-all active:scale-[0.98]"
                                    >
                                        Conservar ambos archivos por ahora
                                    </button>
                                    <button
                                        onClick={() => conflict.onResolve('cancel')}
                                        className="w-full py-4 bg-transparent border border-card-border text-muted hover:text-foreground hover:bg-hover-bg rounded-2xl font-bold transition-all"
                                    >
                                        Cancelar carga de este archivo
                                    </button>
                                </div>

                                <p className="text-[10px] text-muted mt-6 text-center leading-relaxed">
                                    Si eliges conservar ambos, ten en cuenta que el dashboard podría mostrar información duplicada para las órdenes que se solapan en los reportes de {conflict.parsedData.country}.
                                </p>
                            </div>
                        </div>
                    )}
                </>
            ) : (
                <PriceCorrections />
            )}
        </div>
    );
}
