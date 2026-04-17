'use client';

import React, { useState, useEffect } from 'react';
import { Loader2, Plus, Trash2, Edit3, Upload, CheckCircle, Ticket } from 'lucide-react';
import { SupplierTicket, saveTicket, deleteTicket, bulkImportTickets, getTickets } from '@/lib/services/supplierTickets';
import { parseTicketsSheet } from '@/lib/utils/supplierParser';

export default function TicketsTab({ userId }: { userId: string }) {
    const [tickets, setTickets] = useState<SupplierTicket[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editingTicket, setEditingTicket] = useState<SupplierTicket | null>(null);
    const [uploadResult, setUploadResult] = useState<{ imported: number; skipped: number } | null>(null);

    // Form
    const [formTicket, setFormTicket] = useState('');
    const [formGuia, setFormGuia] = useState('');
    const [formTransp, setFormTransp] = useState('');
    const [formFecha, setFormFecha] = useState(new Date().toISOString().split('T')[0]);
    const [formSeguimiento, setFormSeguimiento] = useState('');
    const [formResuelto, setFormResuelto] = useState(false);
    const [formSolucion, setFormSolucion] = useState('');

    useEffect(() => { loadTickets(); }, [userId]);

    const loadTickets = async () => {
        if (!userId) return;
        setLoading(true);
        try {
            const data = await getTickets(userId);
            setTickets(data);
        } finally { setLoading(false); }
    };

    const resetForm = () => {
        setFormTicket(''); setFormGuia(''); setFormTransp(''); setFormFecha(new Date().toISOString().split('T')[0]);
        setFormSeguimiento(''); setFormResuelto(false); setFormSolucion('');
        setEditingTicket(null); setShowForm(false);
    };

    const handleSave = async () => {
        if (!formTicket && !formGuia) return;
        setSaving(true);
        try {
            const now = Date.now();
            const ticket: SupplierTicket = {
                id: editingTicket?.id || `ticket_${now}`,
                fechaTicket: formFecha,
                ticketNumber: formTicket,
                numeroGuia: formGuia,
                transportadora: formTransp,
                fechaSeguimiento: formSeguimiento || undefined,
                resuelto: formResuelto,
                solucion: formSolucion || undefined,
                createdAt: editingTicket?.createdAt || now,
                updatedAt: now,
            };
            await saveTicket(ticket, userId);
            resetForm();
            loadTickets();
        } finally { setSaving(false); }
    };

    const handleEdit = (t: SupplierTicket) => {
        setEditingTicket(t);
        setFormTicket(t.ticketNumber); setFormGuia(t.numeroGuia); setFormTransp(t.transportadora);
        setFormFecha(t.fechaTicket); setFormSeguimiento(t.fechaSeguimiento || '');
        setFormResuelto(t.resuelto); setFormSolucion(t.solucion || '');
        setShowForm(true);
    };

    const handleDelete = async (id: string) => {
        await deleteTicket(id, userId);
        loadTickets();
    };

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !userId) return;
        setSaving(true);
        try {
            const rawTickets = await parseTicketsSheet(file);
            const result = await bulkImportTickets(rawTickets, userId);
            setUploadResult(result);
            loadTickets();
        } catch (err: any) {
            alert(err.message);
        } finally {
            setSaving(false);
            e.target.value = '';
        }
    };

    if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted" /></div>;

    return (
        <div className="space-y-6">
            {/* Actions */}
            <div className="flex gap-3 items-center">
                <button onClick={() => { resetForm(); setShowForm(true); }}
                    className="flex items-center gap-2 px-4 py-2 bg-[#d75c33] text-white rounded-xl text-sm font-medium hover:bg-[#d75c33]/90 transition-all">
                    <Plus className="w-4 h-4" /> Nuevo Ticket
                </button>
                <label className="flex items-center gap-2 px-4 py-2 border border-sidebar-border rounded-xl text-sm font-medium text-muted hover:text-foreground hover:bg-hover-bg transition-all cursor-pointer">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    Importar desde Excel
                    <input type="file" accept=".xlsx,.xls" onChange={handleUpload} className="hidden" disabled={saving} />
                </label>
                {uploadResult && (
                    <p className="text-sm text-emerald-400">{uploadResult.imported} importados, {uploadResult.skipped} omitidos</p>
                )}
            </div>

            {/* Form */}
            {showForm && (
                <div className="bg-card border border-sidebar-border rounded-xl p-4 space-y-4">
                    <h3 className="text-sm font-bold text-foreground">{editingTicket ? 'Editar Ticket' : 'Nuevo Ticket'}</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div>
                            <label className="text-[10px] font-bold text-muted uppercase block mb-1">Ticket #</label>
                            <input value={formTicket} onChange={e => setFormTicket(e.target.value)}
                                className="bg-card border border-sidebar-border rounded-lg px-3 py-2 text-sm text-foreground w-full" />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-muted uppercase block mb-1">Numero de Guia</label>
                            <input value={formGuia} onChange={e => setFormGuia(e.target.value)}
                                className="bg-card border border-sidebar-border rounded-lg px-3 py-2 text-sm text-foreground w-full" />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-muted uppercase block mb-1">Transportadora</label>
                            <input value={formTransp} onChange={e => setFormTransp(e.target.value)}
                                className="bg-card border border-sidebar-border rounded-lg px-3 py-2 text-sm text-foreground w-full" />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-muted uppercase block mb-1">Fecha Ticket</label>
                            <input type="date" value={formFecha} onChange={e => setFormFecha(e.target.value)}
                                className="bg-card border border-sidebar-border rounded-lg px-3 py-2 text-sm text-foreground w-full" />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-muted uppercase block mb-1">Fecha Seguimiento</label>
                            <input type="date" value={formSeguimiento} onChange={e => setFormSeguimiento(e.target.value)}
                                className="bg-card border border-sidebar-border rounded-lg px-3 py-2 text-sm text-foreground w-full" />
                        </div>
                        <div className="flex items-center gap-2 pt-5">
                            <input type="checkbox" checked={formResuelto} onChange={e => setFormResuelto(e.target.checked)}
                                className="rounded" id="resuelto-check" />
                            <label htmlFor="resuelto-check" className="text-sm text-foreground">Resuelto</label>
                        </div>
                        <div className="col-span-2">
                            <label className="text-[10px] font-bold text-muted uppercase block mb-1">Solucion / Razon</label>
                            <input value={formSolucion} onChange={e => setFormSolucion(e.target.value)}
                                className="bg-card border border-sidebar-border rounded-lg px-3 py-2 text-sm text-foreground w-full" />
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={handleSave} disabled={saving}
                            className="flex items-center gap-2 px-4 py-2 bg-[#d75c33] text-white rounded-lg text-sm font-medium disabled:opacity-50">
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                            {editingTicket ? 'Actualizar' : 'Guardar'}
                        </button>
                        <button onClick={resetForm} className="px-4 py-2 text-sm text-muted">Cancelar</button>
                    </div>
                </div>
            )}

            {/* Tickets Table */}
            {tickets.length > 0 ? (
                <div className="bg-card border border-sidebar-border rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-sidebar-border bg-hover-bg/30">
                                <th className="text-left py-3 px-4 text-[10px] font-bold text-muted uppercase">Ticket</th>
                                <th className="text-left py-3 px-4 text-[10px] font-bold text-muted uppercase">Guia</th>
                                <th className="text-left py-3 px-4 text-[10px] font-bold text-muted uppercase">Transportadora</th>
                                <th className="text-left py-3 px-4 text-[10px] font-bold text-muted uppercase">Fecha</th>
                                <th className="text-left py-3 px-4 text-[10px] font-bold text-muted uppercase">Seguimiento</th>
                                <th className="text-center py-3 px-4 text-[10px] font-bold text-muted uppercase">Estado</th>
                                <th className="text-left py-3 px-4 text-[10px] font-bold text-muted uppercase">Solucion</th>
                                <th className="text-center py-3 px-4 text-[10px] font-bold text-muted uppercase">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {tickets.sort((a, b) => b.createdAt - a.createdAt).map(t => (
                                <tr key={t.id} className="border-b border-sidebar-border/50 hover:bg-hover-bg/30">
                                    <td className="py-2 px-4 text-foreground font-mono">{t.ticketNumber}</td>
                                    <td className="py-2 px-4 text-muted font-mono text-xs">{t.numeroGuia}</td>
                                    <td className="py-2 px-4 text-muted">{t.transportadora}</td>
                                    <td className="py-2 px-4 text-muted">{t.fechaTicket}</td>
                                    <td className="py-2 px-4 text-muted">{t.fechaSeguimiento || '—'}</td>
                                    <td className="py-2 px-4 text-center">
                                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${t.resuelto ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                                            {t.resuelto ? 'RESUELTO' : 'PENDIENTE'}
                                        </span>
                                    </td>
                                    <td className="py-2 px-4 text-muted text-xs truncate max-w-[200px]">{t.solucion || '—'}</td>
                                    <td className="py-2 px-4 text-center">
                                        <div className="flex items-center justify-center gap-2">
                                            <button onClick={() => handleEdit(t)} className="text-muted hover:text-foreground"><Edit3 className="w-3.5 h-3.5" /></button>
                                            <button onClick={() => handleDelete(t.id)} className="text-muted hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="text-center py-16">
                    <Ticket className="w-12 h-12 text-muted/30 mx-auto mb-4" />
                    <p className="text-muted text-sm">No hay tickets registrados.</p>
                </div>
            )}
        </div>
    );
}
