'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Loader2, Plus, ChevronLeft, ChevronRight, X, Clock,
    Calendar as CalIcon, Users, Trash2, Edit3,
} from 'lucide-react';
import { useAuth } from '@/lib/context/AuthContext';
import { db } from '@/lib/firebase/config';
import {
    collection, doc, setDoc, deleteDoc,
    query, where, getDocs, orderBy,
} from 'firebase/firestore';

// ─── Types ───
interface CalEvent {
    id: string;
    title: string;
    date: string; // YYYY-MM-DD
    start_time: string; // HH:mm
    end_time: string;
    color: string;
    team_id: string;
    created_by: string;
    description: string;
}

const EVENT_COLORS = [
    { value: '#d75c33', label: 'Accent' },
    { value: '#3b82f6', label: 'Azul' },
    { value: '#22c55e', label: 'Verde' },
    { value: '#8b5cf6', label: 'Morado' },
    { value: '#ec4899', label: 'Rosa' },
    { value: '#eab308', label: 'Amarillo' },
];

const DAYS = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'];
const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const EVENTS_COL = 'calendar_events';

function createEventId() {
    return `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export default function CalendarioPage() {
    const { user, effectiveUid } = useAuth();
    const [loading, setLoading] = useState(true);
    const [events, setEvents] = useState<CalEvent[]>([]);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
    const [showModal, setShowModal] = useState(false);
    const [editingEvent, setEditingEvent] = useState<CalEvent | null>(null);
    const [form, setForm] = useState({ title: '', date: '', start_time: '09:00', end_time: '10:00', color: '#d75c33', description: '' });

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    // Load events
    useEffect(() => {
        if (!effectiveUid) return;
        (async () => {
            setLoading(true);
            const q = query(collection(db, EVENTS_COL), where('team_id', '==', effectiveUid));
            const snap = await getDocs(q);
            setEvents(snap.docs.map(d => ({ id: d.id, ...d.data() } as CalEvent)));
            setLoading(false);
        })();
    }, [effectiveUid]);

    // Calendar grid
    const calendarDays = useMemo(() => {
        const firstDay = new Date(year, month, 1);
        let startDay = firstDay.getDay() - 1; // Monday=0
        if (startDay < 0) startDay = 6;
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const daysInPrevMonth = new Date(year, month, 0).getDate();

        const days: { day: number; month: number; year: number; isCurrentMonth: boolean; isToday: boolean }[] = [];

        // Previous month padding
        for (let i = startDay - 1; i >= 0; i--) {
            days.push({ day: daysInPrevMonth - i, month: month - 1, year, isCurrentMonth: false, isToday: false });
        }

        // Current month
        const today = new Date();
        for (let d = 1; d <= daysInMonth; d++) {
            days.push({
                day: d, month, year,
                isCurrentMonth: true,
                isToday: today.getFullYear() === year && today.getMonth() === month && today.getDate() === d,
            });
        }

        // Next month padding
        const remaining = 42 - days.length;
        for (let d = 1; d <= remaining; d++) {
            days.push({ day: d, month: month + 1, year, isCurrentMonth: false, isToday: false });
        }

        return days;
    }, [year, month]);

    const getEventsForDay = useCallback((day: number, m: number, y: number) => {
        const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        return events.filter(e => e.date === dateStr);
    }, [events]);

    // Nav
    const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
    const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
    const goToday = () => setCurrentDate(new Date());

    // Save event
    const handleSave = async () => {
        if (!form.title.trim() || !form.date || !effectiveUid || !user?.uid) return;
        const evt: CalEvent = {
            id: editingEvent?.id || createEventId(),
            title: form.title,
            date: form.date,
            start_time: form.start_time,
            end_time: form.end_time,
            color: form.color,
            team_id: effectiveUid,
            created_by: user.uid,
            description: form.description,
        };
        await setDoc(doc(db, EVENTS_COL, evt.id), evt);
        setEvents(prev => {
            const idx = prev.findIndex(e => e.id === evt.id);
            if (idx >= 0) { const n = [...prev]; n[idx] = evt; return n; }
            return [...prev, evt];
        });
        setShowModal(false);
        setEditingEvent(null);
    };

    // Delete event
    const handleDelete = async () => {
        if (!editingEvent) return;
        await deleteDoc(doc(db, EVENTS_COL, editingEvent.id));
        setEvents(prev => prev.filter(e => e.id !== editingEvent.id));
        setShowModal(false);
        setEditingEvent(null);
    };

    // Open create modal for a day
    const openCreate = (day: number, m: number, y: number) => {
        const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        setForm({ title: '', date: dateStr, start_time: '09:00', end_time: '10:00', color: '#d75c33', description: '' });
        setEditingEvent(null);
        setShowModal(true);
    };

    // Open edit modal
    const openEdit = (evt: CalEvent) => {
        setForm({ title: evt.title, date: evt.date, start_time: evt.start_time, end_time: evt.end_time, color: evt.color, description: evt.description });
        setEditingEvent(evt);
        setShowModal(true);
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="w-10 h-10 text-accent animate-spin mb-4" />
                <p className="text-muted font-mono text-xs uppercase tracking-widest">Cargando calendario...</p>
            </div>
        );
    }

    return (
        <div className="space-y-4 max-w-[1200px] mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <CalIcon className="w-6 h-6 text-accent" />
                    <h1 className="text-2xl font-black tracking-tight">Calendario</h1>
                </div>
                <button
                    onClick={() => { setForm({ title: '', date: new Date().toISOString().split('T')[0], start_time: '09:00', end_time: '10:00', color: '#d75c33', description: '' }); setEditingEvent(null); setShowModal(true); }}
                    className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent/90 text-white text-xs font-bold uppercase tracking-widest rounded-xl transition-all"
                >
                    <Plus className="w-3.5 h-3.5" /> Nuevo Evento
                </button>
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button onClick={prevMonth} className="w-8 h-8 rounded-lg border border-card-border flex items-center justify-center text-muted hover:text-foreground hover:bg-hover-bg transition-all">
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <h2 className="text-lg font-bold min-w-[200px] text-center">
                        {MONTHS[month]} {year}
                    </h2>
                    <button onClick={nextMonth} className="w-8 h-8 rounded-lg border border-card-border flex items-center justify-center text-muted hover:text-foreground hover:bg-hover-bg transition-all">
                        <ChevronRight className="w-4 h-4" />
                    </button>
                    <button onClick={goToday} className="px-3 py-1.5 text-[11px] font-medium border border-card-border rounded-lg text-muted hover:text-foreground hover:bg-hover-bg transition-all">
                        Hoy
                    </button>
                </div>
            </div>

            {/* Calendar Grid */}
            <div className="bg-card border border-card-border rounded-2xl overflow-hidden">
                {/* Day headers */}
                <div className="grid grid-cols-7 border-b border-card-border">
                    {DAYS.map(d => (
                        <div key={d} className="py-2.5 text-center text-[10px] font-bold text-muted uppercase tracking-widest bg-background">
                            {d}
                        </div>
                    ))}
                </div>

                {/* Day cells */}
                <div className="grid grid-cols-7">
                    {calendarDays.map((day, idx) => {
                        const dayEvents = getEventsForDay(day.day, day.month, day.year);
                        return (
                            <div
                                key={idx}
                                onClick={() => day.isCurrentMonth && openCreate(day.day, day.month, day.year)}
                                className={`min-h-[60px] md:min-h-[100px] p-1 md:p-1.5 border-b border-r border-card-border/50 cursor-pointer hover:bg-hover-bg/30 transition-all ${
                                    !day.isCurrentMonth ? 'opacity-30' : ''
                                }`}
                            >
                                <div className={`text-[11px] font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full ${
                                    day.isToday ? 'bg-accent text-white font-bold' : 'text-muted'
                                }`}>
                                    {day.day}
                                </div>
                                <div className="space-y-0.5">
                                    {dayEvents.slice(0, 3).map(evt => (
                                        <div
                                            key={evt.id}
                                            onClick={(e) => { e.stopPropagation(); openEdit(evt); }}
                                            className="text-[9px] font-semibold px-1.5 py-0.5 rounded truncate cursor-pointer hover:opacity-80 transition-all"
                                            style={{ background: `${evt.color}20`, color: evt.color, border: `1px solid ${evt.color}30` }}
                                        >
                                            {evt.start_time} {evt.title}
                                        </div>
                                    ))}
                                    {dayEvents.length > 3 && (
                                        <div className="text-[8px] text-muted/50 px-1.5">+{dayEvents.length - 3} mas</div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Event Modal */}
            {showModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowModal(false)} />
                    <div className="bg-card border border-card-border w-full max-w-md rounded-2xl relative z-10 p-6 shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="text-sm font-bold">{editingEvent ? 'Editar Evento' : 'Nuevo Evento'}</h3>
                            <button onClick={() => setShowModal(false)} className="text-muted hover:text-foreground">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1 block">Titulo</label>
                                <input
                                    value={form.title}
                                    onChange={e => setForm({ ...form, title: e.target.value })}
                                    className="w-full bg-hover-bg border border-card-border rounded-xl px-3 py-2.5 text-xs outline-none focus:border-accent/30 text-foreground"
                                    placeholder="Reunion de equipo..."
                                    autoFocus
                                />
                            </div>

                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1 block">Fecha</label>
                                    <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })}
                                        className="w-full bg-hover-bg border border-card-border rounded-xl px-3 py-2.5 text-xs outline-none focus:border-accent/30 text-foreground" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1 block">Inicio</label>
                                    <input type="time" value={form.start_time} onChange={e => setForm({ ...form, start_time: e.target.value })}
                                        className="w-full bg-hover-bg border border-card-border rounded-xl px-3 py-2.5 text-xs outline-none focus:border-accent/30 text-foreground" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1 block">Fin</label>
                                    <input type="time" value={form.end_time} onChange={e => setForm({ ...form, end_time: e.target.value })}
                                        className="w-full bg-hover-bg border border-card-border rounded-xl px-3 py-2.5 text-xs outline-none focus:border-accent/30 text-foreground" />
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1 block">Color</label>
                                <div className="flex gap-2">
                                    {EVENT_COLORS.map(c => (
                                        <button key={c.value}
                                            onClick={() => setForm({ ...form, color: c.value })}
                                            className={`w-7 h-7 rounded-lg transition-all ${form.color === c.value ? 'ring-2 ring-offset-2 ring-offset-card' : 'hover:scale-110'}`}
                                            style={{ background: c.value, ['--tw-ring-color' as string]: c.value }}
                                            title={c.label}
                                        />
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1 block">Descripcion</label>
                                <textarea
                                    value={form.description}
                                    onChange={e => setForm({ ...form, description: e.target.value })}
                                    className="w-full bg-hover-bg border border-card-border rounded-xl px-3 py-2.5 text-xs outline-none focus:border-accent/30 text-foreground resize-none"
                                    rows={2}
                                    placeholder="Notas del evento..."
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-between mt-6">
                            {editingEvent ? (
                                <button onClick={handleDelete} className="flex items-center gap-1.5 px-3 py-2 text-[11px] text-red-400 hover:bg-red-400/10 rounded-lg transition-all">
                                    <Trash2 className="w-3.5 h-3.5" /> Eliminar
                                </button>
                            ) : <div />}
                            <div className="flex gap-2">
                                <button onClick={() => setShowModal(false)} className="px-4 py-2 text-[11px] text-muted hover:text-foreground border border-card-border rounded-xl transition-all">
                                    Cancelar
                                </button>
                                <button onClick={handleSave} className="px-4 py-2 text-[11px] font-bold text-white bg-accent hover:bg-accent/90 rounded-xl transition-all">
                                    {editingEvent ? 'Guardar' : 'Crear'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
