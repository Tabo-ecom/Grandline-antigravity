'use client';

import { useState, useEffect } from 'react';
import { Loader2, Plus, Trash2, Edit3, ChevronRight, Check, X, Upload, Download, Ship, CreditCard, FileText, ArrowUpCircle } from 'lucide-react';
import { fmtCOP, fmtFull, fmtPct } from './formatters';
import {
    PurchaseOrder, PurchaseOrderLine, LandedCost, Payment, PurchaseDocument,
    PurchaseEstado, PurchaseTipo,
    getPurchases, savePurchase, deletePurchase,
    computePurchaseTotals, computeLandedCostPerUnit,
    generatePurchaseId, generateLineId, generatePaymentId, generateCostId, generateDocId,
    LANDED_COST_CONCEPTS, PRODUCTION_COST_CONCEPTS, ESTADO_LABELS, TIPO_LABELS, DOC_TYPE_LABELS,
} from '@/lib/services/supplierPurchases';
import { Supplier, getSuppliers } from '@/lib/services/supplierDirectory';
import { uploadPurchaseDocument, deletePurchaseDocument } from '@/lib/services/supplierStorage';
import { InventoryProduct, receiveFromPurchase } from '@/lib/services/supplierInventory';

export default function ImportacionesTab({ userId, inventory, onRefresh }: { userId: string; inventory: InventoryProduct[]; onRefresh: () => void }) {
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
                    <span className="text-[10px] font-black text-muted uppercase tracking-widest">Inversion Activa</span>
                    <p className="text-2xl font-black tracking-tight text-foreground font-mono mt-1">{fmtCOP(totalInversionCOP)}</p>
                </div>
                <div className="bg-card border border-card-border rounded-xl p-4">
                    <span className="text-[10px] font-black text-muted uppercase tracking-widest">Saldo Pendiente</span>
                    <p className={`text-2xl font-black tracking-tight font-mono mt-1 ${totalSaldoCOP > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>{fmtCOP(totalSaldoCOP)}</p>
                </div>
                <div className="bg-card border border-card-border rounded-xl p-4">
                    <span className="text-[10px] font-black text-muted uppercase tracking-widest">En Transito / Aduana</span>
                    <p className="text-2xl font-black tracking-tight text-amber-400 font-mono mt-1">{enTransito}</p>
                </div>
                <div className="bg-card border border-card-border rounded-xl p-4">
                    <span className="text-[10px] font-black text-muted uppercase tracking-widest">En Produccion</span>
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
                    <h3 className="text-sm font-bold text-foreground">{editingPO ? (isDesarrollo ? 'Editar Desarrollo' : 'Editar Importacion') : (isDesarrollo ? 'Nuevo Desarrollo Local' : 'Nueva Importacion')}</h3>

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
                            <label className="text-[10px] font-bold text-muted uppercase">Lineas de Producto</label>
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
                            <label className="text-[10px] font-bold text-muted uppercase">{isDesarrollo ? 'Costos de Produccion' : 'Costos Adicionales (Landed)'}</label>
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
                        <div><span className="text-[10px] font-bold text-muted uppercase block">+ {isDesarrollo ? 'Costos Produccion' : 'Costos Landed'} (COP)</span><span className="text-lg font-bold text-foreground font-mono">{fmtFull(formCostosTotal)}</span></div>
                        <div><span className="text-[10px] font-bold text-muted uppercase block">= Total COP</span><span className="text-lg font-black text-emerald-400 font-mono">{fmtFull(formTotalCOP)}</span></div>
                    </div>

                    {/* Notas */}
                    <div>
                        <label className="text-[10px] font-bold text-muted uppercase block mb-1">Notas</label>
                        <input value={fNotas} onChange={e => setFNotas(e.target.value)} className="bg-card border border-sidebar-border rounded-lg px-3 py-2 text-sm text-foreground w-full" placeholder="Observaciones..." />
                    </div>

                    <div className="flex gap-2">
                        <button onClick={handleSavePO} disabled={saving || !fRef.trim() || !fProvId} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#d75c33] text-white text-sm font-bold hover:bg-[#c04f2a] disabled:opacity-50 transition-colors">
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} {editingPO ? 'Actualizar' : (isDesarrollo ? 'Crear Desarrollo' : 'Crear Importacion')}
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
                                                <h4 className="text-[10px] font-bold text-muted uppercase mb-2">{po.tipo === 'desarrollo_local' ? 'Costos Produccion' : 'Costos Landed'} ({po.costosAdicionales.length})</h4>
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
                                                        <option value="LC">Carta de Credito</option>
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
                                                        <ArrowUpCircle className="w-4 h-4" /> Recibir Mercancia
                                                    </button>
                                                ) : (
                                                    <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-4 space-y-3">
                                                        <h4 className="text-sm font-bold text-emerald-400">Recepcion de Mercancia</h4>
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
                                                                {receiving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Confirmar Recepcion
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
