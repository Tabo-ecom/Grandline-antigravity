'use client';

import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, Edit3, Trash2, Check, X, Loader2 } from 'lucide-react';
import { fmtFull, fmtNum } from './formatters';
import type { InventoryProduct, InventoryMovement } from '@/lib/services/supplierInventory';

export default function InventoryTable({ inventory, movements, expandedProduct, setExpandedProduct, onSave, onBulkSave, onDelete }: {
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
