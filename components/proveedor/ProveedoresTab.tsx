'use client';

import { useState, useEffect } from 'react';
import { Loader2, Plus, Trash2, Edit3, Check, Users } from 'lucide-react';
import { fmtCOP } from './formatters';
import {
    Supplier,
    getSuppliers,
    saveSupplier,
    deleteSupplier,
    generateSupplierId,
} from '@/lib/services/supplierDirectory';
import {
    PurchaseOrder,
    getPurchases,
    computePurchaseTotals,
} from '@/lib/services/supplierPurchases';

export default function ProveedoresTab({ userId }: { userId: string }) {
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
                                        <td className="py-3 px-4 text-muted text-xs">{s.condicionesPago || '\u2014'}</td>
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
