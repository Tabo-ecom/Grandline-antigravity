'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
    Loader2, Plus, X, Trash2, ChevronDown, Search,
    LayoutGrid, List, Send, Paperclip, ExternalLink,
    ListTodo, Lock, Globe, MoreHorizontal, FileText,
    Calendar, Flag, MessageSquare, Clock,
    ChevronRight, Link2,
} from 'lucide-react';
import { useAuth } from '@/lib/context/AuthContext';
import type { UserProfile } from '@/lib/context/AuthContext';
import {
    TaskSpace, SpaceTask, ListType, TaskStatusDef,
    getSpaces, saveSpace, seedDefaultSpaces,
    getTasks, saveTask, deleteTask,
    createId, createEmptyTask, getStatusDef,
    ASIGNACIONES_STATUSES, ANALISIS_STATUSES,
    ASIGNACIONES_BOARD_COLS, ANALISIS_BOARD_COLS,
    PRIORITIES, RENDIMIENTO_OPTIONS, TIPO_ACTIVIDAD_OPTIONS,
    TIENDA_OPTIONS, CUENTA_OPTIONS, PRODUCTO_OPTIONS, TEAM_MEMBERS_LIST,
    SpaceComment, SpaceActivity,
} from '@/lib/services/task-spaces';

// ─── Constants ───
const TIENDA_COLORS: Record<string, { bg: string; text: string; border: string }> = {
    'tabo': { bg: '#d75c33', text: '#fff', border: '#d75c33' },
    'tabo accesorios': { bg: '#d75c33', text: '#fff', border: '#d75c33' },
    'lucent': { bg: '#8b5cf6', text: '#fff', border: '#8b5cf6' },
    'dropshipping': { bg: '#06b6d4', text: '#fff', border: '#06b6d4' },
    'natural skin': { bg: '#22c55e', text: '#fff', border: '#22c55e' },
};

const TIPO_COLORS: Record<string, string> = {
    'Videos Creativos': '#ec4899',
    'Imagenes Publicitarias': '#f59e0b',
    'Landing Page': '#3b82f6',
    'Funnel': '#8b5cf6',
    'Testeo': '#06b6d4',
    'Asignacion Semanal': '#6366f1',
    'Analisis Creativos': '#14b8a6',
    'Contenido': '#f97316',
    'Gestion': '#64748b',
    'Desarrollo': '#22c55e',
    'Personal': '#a855f7',
};

// ─── Helpers ───
const timeAgo = (ts: number) => {
    const d = Date.now() - ts;
    if (d < 60000) return 'ahora';
    if (d < 3600000) return `hace ${Math.floor(d / 60000)}m`;
    if (d < 86400000) return `hace ${Math.floor(d / 3600000)}h`;
    return new Date(ts).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
};
const fmtDate = (ts: number | null) => ts ? new Date(ts).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }) : '';

function getTiendaColor(tienda: string): string {
    const t = TIENDA_OPTIONS.find(o => o.value.toLowerCase() === tienda.toLowerCase());
    if (t) return t.color;
    const key = tienda.toLowerCase();
    if (key.includes('tabo')) return '#d75c33';
    if (key.includes('lucent')) return '#8b5cf6';
    if (key.includes('natural')) return '#22c55e';
    if (key.includes('drop') && key.includes('col')) return '#6366f1';
    if (key.includes('drop') && key.includes('ecu')) return '#eab308';
    if (key.includes('drop') && key.includes('gua')) return '#06b6d4';
    if (key.includes('drop')) return '#6366f1';
    return '#64748b';
}

// ─── Badges (ClickUp pill style) ───
const BADGE = 'text-[10px] font-bold px-2.5 py-[5px] rounded-md whitespace-nowrap inline-flex items-center gap-1 leading-none';

function TiendaBadge({ value }: { value: string }) {
    if (!value) return <span className="text-xs text-muted/30">—</span>;
    const color = getTiendaColor(value);
    return <span className={BADGE} style={{ background: color, color: '#fff' }}>{value} <ChevronDown className="w-3 h-3 opacity-60" /></span>;
}

function StatusBadge({ status, listType }: { status: string; listType: ListType }) {
    const def = getStatusDef(status, listType);
    if (!def) return null;
    const emoji = getStatusEmoji(status);
    return (
        <span className={BADGE} style={{ background: `${def.color}25`, color: def.color, border: `1px solid ${def.color}35` }}>
            {emoji} {def.label}
        </span>
    );
}

function getStatusEmoji(status: string): string {
    const map: Record<string, string> = {
        pendiente: '⏳', en_progreso: '⚙️', bloqueado: '⚠️',
        retraso: '⚠️', pendiente_aprobacion: '🟡', corregir: '🔴',
        testeo_programado: '🧪', listo_para_subir: '✅', completado: '✅',
        sin_asignar: '⏳', corriendo: '▶️', revision: '🔍', escalando: '📈', apagado: '⛔',
    };
    return map[status] || '';
}

function PriorityBadge({ priority }: { priority: string }) {
    const p = PRIORITIES.find(pr => pr.value === priority);
    if (!p) return null;
    const icon = priority === 'urgente' ? '🔴' : priority === 'alta' ? '🟠' : priority === 'normal' ? '🔵' : '⚪';
    return <span className={BADGE} style={{ background: `${p.color}20`, color: p.color }}>{icon} {p.label}</span>;
}

const PRODUCTO_COLORS: Record<string, string> = {
    'MAGWALLET PRO': '#f59e0b', 'MAGWALLET': '#f59e0b', 'ECHOPLUGS SENSE': '#8b5cf6', 'ECHOPLUGS PARTY': '#7c3aed',
    'SELFIE PANTALLA': '#06b6d4', 'CINTA CICATRICES': '#ef4444', 'POLVOS CANDY BELLA': '#ec4899', 'Polvos Candy Bella': '#ec4899',
    'CONTORNO DE OJOS': '#a855f7', 'Contorno de ojos': '#a855f7', 'BRASSIER POSTURA': '#f43f5e',
    'EXFOLIANTE NARANJA': '#f97316', 'PINK STUFF': '#ec4899', 'RETINOL': '#14b8a6',
    'SEOUL 1988': '#6366f1', 'MIXSOON BEAN ESSENCE': '#84cc16', 'MIXSOON BEAN ESSENSE': '#84cc16',
    'SPRAY MAGNESIO': '#0ea5e9', 'SPRAY ARRUGAS ROPA': '#64748b', 'PETER TOMAS CONTORNO': '#e11d48',
    'MELAXIN PEEL SHOOT': '#d946ef', 'SUPER BEET': '#dc2626', 'BEETFLOW': '#15803d',
    'HAIR GROWTH GOMITAS': '#ca8a04', 'ASTAXANTHIN': '#b91c1c', 'Cinta cicatrices': '#ef4444',
    'DR MELAXIN': '#d946ef', 'CYPERUS GOTAS': '#059669',
};

function TipoBadge({ value }: { value: string }) {
    if (!value) return <span className="text-xs text-muted/30">—</span>;
    const color = TIPO_COLORS[value] || TIPO_COLORS[value.toUpperCase()] || '#888';
    return <span className={BADGE} style={{ background: color, color: '#fff' }}>{value} <ChevronDown className="w-3 h-3 opacity-60" /></span>;
}

function ProductoBadge({ value }: { value: string }) {
    if (!value) return <span className="text-xs text-muted/30">—</span>;
    const color = PRODUCTO_COLORS[value] || '#64748b';
    return <span className={BADGE} style={{ background: `${color}25`, color, border: `1px solid ${color}35` }}>{value} <ChevronDown className="w-3 h-3 opacity-50" /></span>;
}

function RendimientoBadge({ value }: { value: string }) {
    const colors: Record<string, string> = { excelente: '#008844', bueno: '#1090e0', regular: '#f8ae00', malo: '#d33d44' };
    const color = colors[value] || '#888';
    if (!value) return null;
    return <span className={BADGE} style={{ background: `${color}25`, color }} >{value}</span>;
}

function Avatar({ name, size = 'sm' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
    if (!name) return null;
    const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    const hue = (name.charCodeAt(0) * 47 + (name.charCodeAt(1) || 0) * 13) % 360;
    const sizes = { sm: 'w-6 h-6 text-[8px]', md: 'w-8 h-8 text-[10px]', lg: 'w-10 h-10 text-xs' };
    return (
        <div className={`${sizes[size]} rounded-full flex items-center justify-center font-bold text-white shrink-0`}
            style={{ background: `hsl(${hue}, 60%, 50%)` }} title={name}>{initials}</div>
    );
}

// ═══════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════
export default function TareasPage() {
    const { user, profile, effectiveUid } = useAuth();
    const [loading, setLoading] = useState(true);
    const [spaces, setSpaces] = useState<TaskSpace[]>([]);
    const [tasks, setTasks] = useState<SpaceTask[]>([]);
    const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null);
    const [selectedListType, setSelectedListType] = useState<ListType>('asignaciones');
    const [viewMode, setViewMode] = useState<'list' | 'board'>('list');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedTask, setSelectedTask] = useState<SpaceTask | null>(null);
    const [newComment, setNewComment] = useState('');
    const [saving, setSaving] = useState(false);
    const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
    const [dragOverCol, setDragOverCol] = useState<string | null>(null);
    const justDroppedRef = useRef(false);
    const [showNewSpace, setShowNewSpace] = useState(false);
    const [newSpaceName, setNewSpaceName] = useState('');
    const [newSpaceType, setNewSpaceType] = useState<'public' | 'private'>('public');
    const activityEndRef = useRef<HTMLDivElement>(null);

    // Column filters
    const [filterTienda, setFilterTienda] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [filterTipo, setFilterTipo] = useState('');
    const [filterPriority, setFilterPriority] = useState('');
    const [filterAssignee, setFilterAssignee] = useState('');

    useEffect(() => {
        if (!effectiveUid) return;
        (async () => {
            setLoading(true);
            const [sp, ts] = await Promise.all([getSpaces(effectiveUid), getTasks(effectiveUid)]);
            setSpaces(sp); setTasks(ts); setLoading(false);
        })();
    }, [effectiveUid]);

    const filteredTasks = useMemo(() => {
        let r = tasks.filter(t => t.list_type === selectedListType);
        if (selectedSpaceId) r = r.filter(t => t.space_id === selectedSpaceId);
        if (searchTerm) { const q = searchTerm.toLowerCase(); r = r.filter(t => t.name.toLowerCase().includes(q) || t.producto?.toLowerCase().includes(q) || t.tienda?.toLowerCase().includes(q)); }
        if (filterTienda) r = r.filter(t => t.tienda === filterTienda);
        if (filterStatus) r = r.filter(t => t.status === filterStatus);
        if (filterTipo) r = r.filter(t => t.tipo_actividad === filterTipo);
        if (filterPriority) r = r.filter(t => t.priority === filterPriority);
        if (filterAssignee) r = r.filter(t => t.assignees.includes(filterAssignee));
        return r;
    }, [tasks, selectedSpaceId, selectedListType, searchTerm, filterTienda, filterStatus, filterTipo, filterPriority, filterAssignee]);

    const statuses = selectedListType === 'asignaciones' ? ASIGNACIONES_STATUSES : ANALISIS_STATUSES;
    const boardCols = selectedListType === 'asignaciones' ? ASIGNACIONES_BOARD_COLS : ANALISIS_BOARD_COLS;

    const handleSave = useCallback(async (task: SpaceTask, logText?: string) => {
        setSaving(true);
        const updated = { ...task, updated_at: Date.now() };
        if (logText) {
            const displayName = (profile as UserProfile)?.display_name || user?.email?.split('@')[0] || 'Usuario';
            updated.activity = [...updated.activity, { id: createId('act'), actor: displayName, text: logText, timestamp: Date.now() }];
        }
        if (task.list_type === 'asignaciones' && task.status === 'testeo_programado') {
            updated.list_type = 'analisis'; updated.status = 'sin_asignar';
            updated.activity = [...updated.activity, { id: createId('act'), actor: 'Sistema', text: 'Movida a Analisis Creativos (Testeo Programado)', timestamp: Date.now() }];
        }
        await saveTask(updated);
        setTasks(prev => { const i = prev.findIndex(t => t.id === task.id); if (i >= 0) { const n = [...prev]; n[i] = updated; return n; } return [...prev, updated]; });
        setSelectedTask(updated); setSaving(false);
    }, [profile, user]);

    const handleNewTask = useCallback(async () => {
        if (!effectiveUid || !selectedSpaceId) return;
        const t = createEmptyTask(selectedSpaceId, selectedListType, effectiveUid);
        t.name = 'Nueva Tarea'; t.created_by = user?.uid || '';
        await saveTask(t); setTasks(prev => [t, ...prev]); setSelectedTask(t);
    }, [effectiveUid, selectedSpaceId, selectedListType, user?.uid]);

    const handleDelete = useCallback(async (id: string) => {
        await deleteTask(id); setTasks(prev => prev.filter(t => t.id !== id)); setSelectedTask(null);
    }, []);

    const handleAddComment = useCallback(() => {
        if (!selectedTask || !newComment.trim()) return;
        const name = (profile as UserProfile)?.display_name || user?.email?.split('@')[0] || 'Tu';
        const cmt: SpaceComment = { id: createId('cmt'), author: name, text: newComment.trim(), timestamp: Date.now() };
        const act: SpaceActivity = { id: createId('act'), actor: name, text: newComment.trim(), timestamp: Date.now() };
        handleSave({ ...selectedTask, comments: [...selectedTask.comments, cmt], activity: [...selectedTask.activity, act] });
        setNewComment('');
        setTimeout(() => activityEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }, [selectedTask, newComment, profile, user, handleSave]);

    const handleCreateSpace = useCallback(async () => {
        if (!newSpaceName.trim() || !effectiveUid) return;
        const space: TaskSpace = { id: createId('space'), name: newSpaceName.trim(), icon: '📁', color: `hsl(${Math.random() * 360}, 55%, 50%)`, type: newSpaceType, members: [], team_id: effectiveUid, order_index: spaces.length };
        await saveSpace(space); setSpaces(prev => [...prev, space]); setNewSpaceName(''); setShowNewSpace(false); setSelectedSpaceId(space.id);
    }, [newSpaceName, newSpaceType, effectiveUid, spaces.length]);

    // Drag
    const onDragStart = (e: React.DragEvent, id: string) => { setDraggedTaskId(id); e.dataTransfer.effectAllowed = 'move'; (e.currentTarget as HTMLElement).style.opacity = '0.3'; };
    const onDragEnd = (e: React.DragEvent) => { if (draggedTaskId) justDroppedRef.current = true; setDraggedTaskId(null); setDragOverCol(null); (e.currentTarget as HTMLElement).style.opacity = '1'; setTimeout(() => { justDroppedRef.current = false; }, 100); };
    const onDrop = async (e: React.DragEvent, colKey: string) => {
        e.preventDefault(); setDragOverCol(null); if (!draggedTaskId) return;
        const col = boardCols.find(c => c.key === colKey); if (!col) return;
        const task = tasks.find(t => t.id === draggedTaskId); if (!task || col.statuses.includes(task.status)) return;
        const oldDef = getStatusDef(task.status, task.list_type);
        const newDef = getStatusDef(col.statuses[0], task.list_type);
        await handleSave({ ...task, status: col.statuses[0] }, `Cambio estado: ${oldDef?.label || task.status} → ${newDef?.label || col.statuses[0]}`);
        setDraggedTaskId(null);
    };

    if (loading) return (
        <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-10 h-10 text-accent animate-spin mb-4" />
            <p className="text-muted font-mono text-xs uppercase tracking-widest">Cargando tareas...</p>
        </div>
    );

    // ═══════════════════════════════════════════
    // TASK DETAIL (ClickUp style: fields left, activity right)
    // ═══════════════════════════════════════════
    if (selectedTask) {
        const sd = getStatusDef(selectedTask.status, selectedTask.list_type);
        const space = spaces.find(s => s.id === selectedTask.space_id);
        const sts = selectedTask.list_type === 'asignaciones' ? ASIGNACIONES_STATUSES : ANALISIS_STATUSES;

        return (
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-stretch" onClick={() => setSelectedTask(null)}>
                <div className="flex-1" /> {/* Left spacer for clicking to close */}
                <div className="w-full md:w-[900px] md:max-w-[95vw] h-full bg-card flex flex-col md:flex-row" onClick={e => e.stopPropagation()}>
                    {/* ── LEFT: Task Details ── */}
                    <div className="flex-1 flex flex-col min-w-0 md:border-r border-card-border">
                        {/* Header */}
                        <div className="flex items-center gap-2 px-5 py-3 border-b border-card-border shrink-0">
                            {space && <span className="text-[10px]">{space.icon}</span>}
                            <span className="text-[10px] text-muted">{space?.name}</span>
                            <ChevronRight className="w-3 h-3 text-muted/30" />
                            <span className="text-[10px] text-muted">{selectedTask.list_type === 'asignaciones' ? 'Asignaciones' : 'Analisis'}</span>
                            <div className="flex-1" />
                            {selectedTask.url_pagina && <a href={selectedTask.url_pagina} target="_blank" rel="noopener" className="text-[9px] text-purple-400 hover:underline flex items-center gap-1"><ExternalLink className="w-3 h-3" />ClickUp</a>}
                            <button onClick={() => handleDelete(selectedTask.id)} className="w-7 h-7 rounded-lg text-muted hover:text-red-400 hover:bg-red-400/10 flex items-center justify-center transition-all"><Trash2 className="w-3.5 h-3.5" /></button>
                            <button onClick={() => setSelectedTask(null)} className="w-7 h-7 rounded-lg text-muted hover:text-foreground hover:bg-hover-bg flex items-center justify-center transition-all"><X className="w-4 h-4" /></button>
                        </div>

                        <div className="flex-1 overflow-y-auto px-5 py-4">
                            {/* Title */}
                            <input className="text-xl font-black bg-transparent border-none outline-none w-full text-foreground mb-3" value={selectedTask.name}
                                onChange={e => setSelectedTask({ ...selectedTask, name: e.target.value })}
                                onBlur={() => handleSave(selectedTask)} placeholder="Titulo..." />

                            {/* Status row */}
                            <div className="flex items-center gap-2 flex-wrap mb-4 pb-4 border-b border-card-border/30">
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-muted">Estado</span>
                                    <select className="bg-transparent font-bold text-[11px] outline-none cursor-pointer rounded-md px-2 py-1"
                                        style={{ color: sd?.color, background: `${sd?.color}15` }}
                                        value={selectedTask.status}
                                        onChange={e => {
                                            const oldDef = getStatusDef(selectedTask.status, selectedTask.list_type);
                                            const newDef = getStatusDef(e.target.value, selectedTask.list_type);
                                            handleSave({ ...selectedTask, status: e.target.value }, `Cambio estado: ${oldDef?.label} → ${newDef?.label}`);
                                        }}>
                                        {sts.map(s => <option key={s.value} value={s.value}>{getStatusEmoji(s.value)} {s.label}</option>)}
                                    </select>
                                </div>
                                <div className="w-px h-5 bg-card-border" />
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-muted">Prioridad</span>
                                    <select className="bg-hover-bg text-[11px] rounded-md px-2 py-1 outline-none border border-card-border"
                                        value={selectedTask.priority} onChange={e => handleSave({ ...selectedTask, priority: e.target.value })}>
                                        {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                                    </select>
                                </div>
                                <div className="w-px h-5 bg-card-border" />
                                <div className="flex items-center gap-2">
                                    <Calendar className="w-3.5 h-3.5 text-muted/50" />
                                    <input type="date" className="bg-transparent text-[11px] outline-none text-foreground"
                                        value={selectedTask.due_date ? new Date(selectedTask.due_date).toISOString().split('T')[0] : ''}
                                        onChange={e => handleSave({ ...selectedTask, due_date: e.target.value ? new Date(e.target.value).getTime() : null })} />
                                </div>
                                {saving && <span className="text-[9px] text-accent animate-pulse ml-auto">Guardando...</span>}
                            </div>

                            {/* Assignees */}
                            <div className="flex items-start gap-2 mb-4">
                                <span className="text-[10px] text-muted w-[100px] shrink-0 pt-1">Asignados</span>
                                <div className="flex-1">
                                    <div className="flex gap-1.5 items-center flex-wrap mb-2">
                                        {selectedTask.assignees.filter(Boolean).map((a, i) => (
                                            <span key={i} className="inline-flex items-center gap-1 bg-hover-bg border border-card-border rounded-lg px-2 py-1 text-[11px]">
                                                <Avatar name={a} />
                                                <span className="font-medium">{a}</span>
                                                <button onClick={() => {
                                                    const updated = { ...selectedTask, assignees: selectedTask.assignees.filter((_, idx) => idx !== i) };
                                                    handleSave(updated);
                                                }} className="text-muted/40 hover:text-red-400 ml-0.5"><X className="w-3 h-3" /></button>
                                            </span>
                                        ))}
                                    </div>
                                    <select className="bg-hover-bg border border-card-border rounded-lg px-2 py-1.5 text-[11px] outline-none text-muted w-full"
                                        value="" onChange={e => {
                                            if (!e.target.value) return;
                                            if (selectedTask.assignees.includes(e.target.value)) return;
                                            handleSave({ ...selectedTask, assignees: [...selectedTask.assignees, e.target.value] });
                                        }}>
                                        <option value="">+ Agregar persona...</option>
                                        {TEAM_MEMBERS_LIST.filter(m => !selectedTask.assignees.includes(m.name)).map(m => (
                                            <option key={m.name} value={m.name}>{m.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Description */}
                            <div className="mb-4">
                                <textarea className="w-full bg-hover-bg/30 border border-card-border/50 rounded-xl px-4 py-3 text-[13px] outline-none resize-none text-foreground placeholder:text-muted/30 leading-relaxed focus:border-accent/30 transition-all"
                                    value={selectedTask.description}
                                    onChange={e => setSelectedTask({ ...selectedTask, description: e.target.value })}
                                    onBlur={() => handleSave(selectedTask)} placeholder="Agrega una descripcion..."
                                    rows={Math.max(3, (selectedTask.description?.split('\n').length || 1) + 1)} />
                            </div>

                            {/* ── Campos ── */}
                            <div className="mb-4">
                                <div className="text-[10px] font-bold text-muted/50 uppercase tracking-widest mb-2 flex items-center gap-2">
                                    <ChevronDown className="w-3 h-3" /> Campos
                                </div>
                                <div className="bg-hover-bg/20 border border-card-border/30 rounded-xl overflow-hidden divide-y divide-card-border/20">
                                    <FieldRow label="Tienda" icon="🏪">
                                        <select className="field-input font-bold" value={selectedTask.tienda}
                                            style={selectedTask.tienda ? { color: getTiendaColor(selectedTask.tienda), background: `${getTiendaColor(selectedTask.tienda)}15` } : {}}
                                            onChange={e => handleSave({ ...selectedTask, tienda: e.target.value })}>
                                            <option value="">—</option>
                                            {TIENDA_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                        </select>
                                    </FieldRow>
                                    <FieldRow label="Producto" icon="📦">
                                        <select className="field-input font-bold" value={selectedTask.producto}
                                            style={selectedTask.producto ? { color: PRODUCTO_COLORS[selectedTask.producto] || '#64748b', background: `${PRODUCTO_COLORS[selectedTask.producto] || '#64748b'}15` } : {}}
                                            onChange={e => handleSave({ ...selectedTask, producto: e.target.value })}>
                                            <option value="">—</option>
                                            {PRODUCTO_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                                        </select>
                                    </FieldRow>

                                    {selectedTask.list_type === 'asignaciones' && (<>
                                        <FieldRow label="Codigo Dropi" icon="🏷️">
                                            <input className="field-input" value={selectedTask.codigo_dropi} onChange={e => setSelectedTask({ ...selectedTask, codigo_dropi: e.target.value })} onBlur={() => handleSave(selectedTask)} placeholder="—" />
                                        </FieldRow>
                                        <FieldRow label="Tipo Actividad" icon="⚡">
                                            <select className="field-input font-bold" value={selectedTask.tipo_actividad}
                                                style={selectedTask.tipo_actividad ? { color: TIPO_COLORS[selectedTask.tipo_actividad] || '#888', background: `${TIPO_COLORS[selectedTask.tipo_actividad] || '#888'}15` } : {}}
                                                onChange={e => handleSave({ ...selectedTask, tipo_actividad: e.target.value })}>
                                                <option value="">—</option>
                                                {TIPO_ACTIVIDAD_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                                            </select>
                                        </FieldRow>
                                        <FieldRow label="Link Drive" icon="📂">
                                            <div className="flex items-center gap-1">
                                                <input className="field-input flex-1" value={selectedTask.link_drive} onChange={e => setSelectedTask({ ...selectedTask, link_drive: e.target.value })} onBlur={() => handleSave(selectedTask)} placeholder="https://..." />
                                                {selectedTask.link_drive && <a href={selectedTask.link_drive} target="_blank" rel="noopener" className="text-accent"><ExternalLink className="w-3 h-3" /></a>}
                                            </div>
                                        </FieldRow>
                                        <FieldRow label="URL Pagina" icon="🌐">
                                            <input className="field-input" value={selectedTask.url_pagina} onChange={e => setSelectedTask({ ...selectedTask, url_pagina: e.target.value })} onBlur={() => handleSave(selectedTask)} placeholder="—" />
                                        </FieldRow>
                                    </>)}

                                    {selectedTask.list_type === 'analisis' && (<>
                                        <FieldRow label="Cuenta Publicitaria" icon="💳">
                                            <select className="field-input" value={selectedTask.cuenta_publicitaria} onChange={e => handleSave({ ...selectedTask, cuenta_publicitaria: e.target.value })}>
                                                <option value="">—</option>
                                                {CUENTA_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                                            </select>
                                        </FieldRow>
                                        <FieldRow label="Rendimiento" icon="📊">
                                            <select className="field-input font-bold" value={selectedTask.rendimiento}
                                                style={selectedTask.rendimiento ? { color: ({ excelente: '#008844', bueno: '#1090e0', regular: '#f8ae00', malo: '#d33d44' } as Record<string,string>)[selectedTask.rendimiento] || '#888', background: `${({ excelente: '#008844', bueno: '#1090e0', regular: '#f8ae00', malo: '#d33d44' } as Record<string,string>)[selectedTask.rendimiento] || '#888'}15` } : {}}
                                                onChange={e => handleSave({ ...selectedTask, rendimiento: e.target.value })}>
                                                <option value="">—</option>
                                                {RENDIMIENTO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                            </select>
                                        </FieldRow>
                                        <FieldRow label="Resultados" icon="📝">
                                            <input className="field-input" value={selectedTask.resultados} onChange={e => setSelectedTask({ ...selectedTask, resultados: e.target.value })} onBlur={() => handleSave(selectedTask)} placeholder="—" />
                                        </FieldRow>
                                        <FieldRow label="Punto de Dolor" icon="🎯">
                                            <input className="field-input" value={selectedTask.punto_dolor} onChange={e => setSelectedTask({ ...selectedTask, punto_dolor: e.target.value })} onBlur={() => handleSave(selectedTask)} placeholder="—" />
                                        </FieldRow>
                                        <FieldRow label="Estrategia" icon="🧩">
                                            <input className="field-input" value={selectedTask.tipo_estrategia} onChange={e => setSelectedTask({ ...selectedTask, tipo_estrategia: e.target.value })} onBlur={() => handleSave(selectedTask)} placeholder="—" />
                                        </FieldRow>
                                        <FieldRow label="Nota" icon="📋">
                                            <input className="field-input" value={selectedTask.nota} onChange={e => setSelectedTask({ ...selectedTask, nota: e.target.value })} onBlur={() => handleSave(selectedTask)} placeholder="—" />
                                        </FieldRow>
                                    </>)}
                                </div>
                            </div>

                            {/* Files */}
                            {selectedTask.files.length > 0 && (
                                <div className="mb-4">
                                    <div className="text-[10px] font-bold text-muted/50 uppercase tracking-widest mb-2">Archivos ({selectedTask.files.length})</div>
                                    <div className="space-y-1">
                                        {selectedTask.files.map(f => (
                                            <a key={f.id} href={f.url} target="_blank" rel="noopener"
                                                className="flex items-center gap-2 p-2.5 bg-hover-bg/50 border border-card-border/50 rounded-lg hover:border-accent/30 transition-all">
                                                <Paperclip className="w-3.5 h-3.5 text-accent/50 shrink-0" />
                                                <span className="text-[11px] flex-1 truncate font-medium">{f.name}</span>
                                                <span className="text-[9px] text-muted/30">{f.size}</span>
                                                <ExternalLink className="w-3 h-3 text-muted/20" />
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ── RIGHT: Activity & Chat (like ClickUp) ── */}
                    <div className="hidden md:flex w-[320px] flex-col bg-background/50 shrink-0">
                        <div className="px-4 py-3 border-b border-card-border shrink-0">
                            <span className="text-[11px] font-bold text-muted uppercase tracking-widest">Actividad</span>
                        </div>
                        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                            {selectedTask.activity.length === 0 && selectedTask.comments.length === 0 && (
                                <div className="text-center py-8 text-[11px] text-muted/30">Sin actividad</div>
                            )}
                            {/* Merge activity + comments, sorted by time */}
                            {[...selectedTask.activity.map(a => ({ ...a, _type: 'activity' as const })),
                              ...selectedTask.comments.map(c => ({ id: c.id, actor: c.author, text: c.text, timestamp: c.timestamp, _type: 'comment' as const }))]
                                .sort((a, b) => a.timestamp - b.timestamp)
                                .map(item => (
                                    <div key={item.id} className="flex gap-2.5">
                                        <Avatar name={item.actor} />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-baseline gap-2 mb-0.5">
                                                <span className="text-[11px] font-bold">{item.actor}</span>
                                                <span className="text-[9px] text-muted/30">{timeAgo(item.timestamp)}</span>
                                            </div>
                                            {item._type === 'comment' ? (
                                                <div className="text-[12px] text-foreground/80 leading-relaxed bg-hover-bg/50 border border-card-border/30 rounded-lg px-3 py-2">{item.text}</div>
                                            ) : (
                                                <div className="text-[11px] text-muted leading-relaxed">{item.text}</div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            <div ref={activityEndRef} />
                        </div>
                        {/* Comment input */}
                        <div className="px-4 py-3 border-t border-card-border shrink-0">
                            <div className="flex gap-2">
                                <input className="flex-1 bg-hover-bg border border-card-border rounded-lg px-3 py-2 text-[12px] outline-none text-foreground placeholder:text-muted/30 focus:border-accent/30"
                                    value={newComment} onChange={e => setNewComment(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleAddComment()}
                                    placeholder="Comentario..." />
                                <button onClick={handleAddComment} className="w-8 h-8 bg-accent text-white rounded-lg flex items-center justify-center hover:bg-accent/90 transition-all shrink-0">
                                    <Send className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // ═══════════════════════════════════════════
    // MAIN LAYOUT
    // ═══════════════════════════════════════════
    return (
        <div className="flex h-[calc(100vh-48px)] -m-3 md:-m-6">
            {/* ── Spaces Sidebar ── */}
            <div className="hidden md:flex w-[200px] bg-card/50 border-r border-card-border flex-col shrink-0">
                <div className="p-3 border-b border-card-border flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted">Espacios</span>
                    <button onClick={() => setShowNewSpace(true)} className="w-5 h-5 rounded bg-accent/10 text-accent flex items-center justify-center hover:bg-accent/20 transition-all"><Plus className="w-3 h-3" /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-1.5">
                    <SidebarBtn active={!selectedSpaceId} onClick={() => setSelectedSpaceId(null)} icon="🔍" label="Todas" count={tasks.length} />
                    {spaces.length === 0 && <button onClick={async () => { if (effectiveUid) { const sp = await seedDefaultSpaces(effectiveUid); setSpaces(sp); }}} className="w-full text-center py-3 text-[10px] text-accent">Crear espacios</button>}
                    {spaces.map(s => (
                        <SidebarBtn key={s.id} active={selectedSpaceId === s.id}
                            onClick={() => setSelectedSpaceId(s.id)}
                            icon={s.icon} label={s.name}
                            count={tasks.filter(t => t.space_id === s.id).length}
                            isPrivate={s.type === 'private'} color={s.color} />
                    ))}
                </div>
                {showNewSpace && (
                    <div className="p-2 border-t border-card-border bg-card">
                        <input value={newSpaceName} onChange={e => setNewSpaceName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleCreateSpace()} placeholder="Nombre..." autoFocus className="w-full bg-hover-bg border border-card-border rounded-lg px-2 py-1.5 text-[11px] outline-none text-foreground mb-1.5" />
                        <div className="flex gap-1 mb-1.5">
                            <button onClick={() => setNewSpaceType('public')} className={`flex-1 py-1 rounded text-[9px] font-medium border ${newSpaceType === 'public' ? 'border-accent/30 bg-accent/10 text-accent' : 'border-card-border text-muted'}`}><Globe className="w-2.5 h-2.5 inline mr-1" />Publico</button>
                            <button onClick={() => setNewSpaceType('private')} className={`flex-1 py-1 rounded text-[9px] font-medium border ${newSpaceType === 'private' ? 'border-accent/30 bg-accent/10 text-accent' : 'border-card-border text-muted'}`}><Lock className="w-2.5 h-2.5 inline mr-1" />Privado</button>
                        </div>
                        <div className="flex gap-1">
                            <button onClick={() => setShowNewSpace(false)} className="flex-1 py-1.5 text-[10px] text-muted border border-card-border rounded-lg">Cancelar</button>
                            <button onClick={handleCreateSpace} className="flex-1 py-1.5 text-[10px] font-bold text-white bg-accent rounded-lg">Crear</button>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Main ── */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Toolbar */}
                <div className="flex items-center gap-2 px-3 md:px-4 py-2 md:py-2.5 border-b border-card-border bg-card/30 shrink-0 flex-wrap">
                    {/* Mobile space selector */}
                    <select className="md:hidden bg-hover-bg border border-card-border rounded-lg px-2 py-1 text-xs font-bold outline-none text-foreground"
                        value={selectedSpaceId || ''}
                        onChange={e => setSelectedSpaceId(e.target.value || null)}>
                        <option value="">📋 Todas</option>
                        {spaces.map(s => <option key={s.id} value={s.id}>{s.icon} {s.name}</option>)}
                    </select>
                    <h2 className="hidden md:block text-sm font-bold mr-1">{spaces.find(s => s.id === selectedSpaceId)?.icon || '📋'} {spaces.find(s => s.id === selectedSpaceId)?.name || 'Todas'}</h2>
                    <div className="flex gap-0.5 bg-card border border-card-border rounded-lg p-0.5">
                        <button onClick={() => setSelectedListType('asignaciones')} className={`px-2.5 py-1 rounded text-[10px] font-medium transition-all ${selectedListType === 'asignaciones' ? 'bg-hover-bg text-foreground' : 'text-muted'}`}>Asignaciones</button>
                        <button onClick={() => setSelectedListType('analisis')} className={`px-2.5 py-1 rounded text-[10px] font-medium transition-all ${selectedListType === 'analisis' ? 'bg-hover-bg text-foreground' : 'text-muted'}`}>Analisis</button>
                    </div>
                    <div className="relative flex-1 max-w-[200px]">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted/40" />
                        <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-card border border-card-border rounded-lg pl-6 pr-2 py-1 text-[11px] outline-none focus:border-accent/30" placeholder="Buscar..." />
                    </div>
                    <div className="flex-1" />
                    <div className="flex gap-0.5 bg-card border border-card-border rounded-lg p-0.5">
                        <button onClick={() => setViewMode('list')} className={`px-2 py-1 rounded text-[10px] flex items-center gap-1 ${viewMode === 'list' ? 'bg-hover-bg text-foreground' : 'text-muted'}`}><List className="w-3 h-3" />Lista</button>
                        <button onClick={() => setViewMode('board')} className={`px-2 py-1 rounded text-[10px] flex items-center gap-1 ${viewMode === 'board' ? 'bg-hover-bg text-foreground' : 'text-muted'}`}><LayoutGrid className="w-3 h-3" />Board</button>
                    </div>
                    {selectedSpaceId && <button onClick={handleNewTask} className="flex items-center gap-1 px-3 py-1.5 bg-accent text-white text-[10px] font-bold rounded-lg hover:bg-accent/90"><Plus className="w-3 h-3" />Tarea</button>}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto">
                    {/* LIST VIEW */}
                    {viewMode === 'list' && (
                        <div className="overflow-x-auto">
                            <div style={{ minWidth: selectedListType === 'asignaciones' ? '1300px' : '1350px' }}>
                                {/* Header with filter dropdowns */}
                                <div className={`grid items-center px-4 py-2 bg-background/80 border-b border-card-border sticky top-0 z-10 backdrop-blur-sm gap-x-3 ${selectedListType === 'asignaciones'
                                    ? 'grid-cols-[5px_1.3fr_140px_135px_80px_145px_155px_85px_95px_90px]'
                                    : 'grid-cols-[5px_1.3fr_140px_145px_95px_130px_110px_95px_150px_95px]'}`}>
                                    <div/>
                                    <div className="text-[8px] font-bold uppercase tracking-[0.15em] text-muted/50">{filteredTasks.length} tareas</div>
                                    {selectedListType === 'asignaciones' ? (<>
                                        <HeaderFilter label="Tiendas" value={filterTienda} onChange={setFilterTienda} options={TIENDA_OPTIONS.map(o => o.value)} />
                                        <HeaderFilter label="Estado" value={filterStatus} onChange={setFilterStatus} options={ASIGNACIONES_STATUSES.map(s => s.value)} labels={Object.fromEntries(ASIGNACIONES_STATUSES.map(s => [s.value, s.label]))} />
                                        <HeaderFilter label="Asignado" value={filterAssignee} onChange={setFilterAssignee} options={TEAM_MEMBERS_LIST.map(m => m.name)} />
                                        <div className="text-[8px] font-bold uppercase tracking-[0.15em] text-muted/50">Producto</div>
                                        <HeaderFilter label="Tipo Actividad" value={filterTipo} onChange={setFilterTipo} options={TIPO_ACTIVIDAD_OPTIONS} />
                                        <div className="text-[8px] font-bold uppercase tracking-[0.15em] text-muted/50">Fecha</div>
                                        <HeaderFilter label="Prioridad" value={filterPriority} onChange={setFilterPriority} options={PRIORITIES.map(p => p.value)} labels={Object.fromEntries(PRIORITIES.map(p => [p.value, p.label]))} />
                                        <div className="text-[8px] font-bold uppercase tracking-[0.15em] text-muted/50">Cod. Dropi</div>
                                    </>) : (<>
                                        <HeaderFilter label="Tiendas" value={filterTienda} onChange={setFilterTienda} options={TIENDA_OPTIONS.map(o => o.value)} />
                                        <div className="text-[8px] font-bold uppercase tracking-[0.15em] text-muted/50">Producto</div>
                                        <HeaderFilter label="Estado" value={filterStatus} onChange={setFilterStatus} options={ANALISIS_STATUSES.map(s => s.value)} labels={Object.fromEntries(ANALISIS_STATUSES.map(s => [s.value, s.label]))} />
                                        <div className="text-[8px] font-bold uppercase tracking-[0.15em] text-muted/50">Cuenta Pub.</div>
                                        <div className="text-[8px] font-bold uppercase tracking-[0.15em] text-muted/50">Rendimiento</div>
                                        <HeaderFilter label="Prioridad" value={filterPriority} onChange={setFilterPriority} options={PRIORITIES.map(p => p.value)} labels={Object.fromEntries(PRIORITIES.map(p => [p.value, p.label]))} />
                                        <div className="text-[8px] font-bold uppercase tracking-[0.15em] text-muted/50">Resultados</div>
                                        <div className="text-[8px] font-bold uppercase tracking-[0.15em] text-muted/50">P. Dolor</div>
                                    </>)}
                                </div>

                                {/* Filter row */}
                                {(filterTienda || filterStatus || filterTipo || filterPriority || filterAssignee) && (
                                    <div className="flex items-center gap-2 px-3 py-1.5 bg-accent/5 border-b border-accent/10 text-[10px]">
                                        <span className="text-muted">Filtros:</span>
                                        {filterTienda && <span className="bg-accent/10 text-accent px-2 py-0.5 rounded-md flex items-center gap-1">{filterTienda}<button onClick={() => setFilterTienda('')}><X className="w-3 h-3" /></button></span>}
                                        {filterStatus && <span className="bg-accent/10 text-accent px-2 py-0.5 rounded-md flex items-center gap-1">{getStatusDef(filterStatus, selectedListType)?.label || filterStatus}<button onClick={() => setFilterStatus('')}><X className="w-3 h-3" /></button></span>}
                                        {filterTipo && <span className="bg-accent/10 text-accent px-2 py-0.5 rounded-md flex items-center gap-1">{filterTipo}<button onClick={() => setFilterTipo('')}><X className="w-3 h-3" /></button></span>}
                                        {filterPriority && <span className="bg-accent/10 text-accent px-2 py-0.5 rounded-md flex items-center gap-1">{filterPriority}<button onClick={() => setFilterPriority('')}><X className="w-3 h-3" /></button></span>}
                                        {filterAssignee && <span className="bg-accent/10 text-accent px-2 py-0.5 rounded-md flex items-center gap-1">{filterAssignee}<button onClick={() => setFilterAssignee('')}><X className="w-3 h-3" /></button></span>}
                                        <button onClick={() => { setFilterTienda(''); setFilterStatus(''); setFilterTipo(''); setFilterPriority(''); setFilterAssignee(''); }} className="text-muted hover:text-foreground ml-auto">Limpiar</button>
                                    </div>
                                )}

                                {/* Rows */}
                                {filteredTasks.map(task => {
                                    const sd = getStatusDef(task.status, task.list_type);
                                    return (
                                        <div key={task.id} onClick={() => { if (justDroppedRef.current) return; setSelectedTask(task); }}
                                            className={`grid items-center px-4 py-2 border-b border-card-border/15 hover:bg-hover-bg/40 cursor-pointer transition-all group gap-x-3 ${selectedListType === 'asignaciones'
                                                ? 'grid-cols-[5px_1.3fr_140px_135px_80px_145px_155px_85px_95px_90px]'
                                                : 'grid-cols-[5px_1.3fr_140px_145px_95px_130px_110px_95px_150px_95px]'}`}>
                                            <div className="w-1 h-7 rounded-full transition-all group-hover:h-5" style={{ background: sd?.color || '#444' }} />
                                            <div className="text-[12px] font-semibold truncate pr-2 flex items-center gap-1.5">
                                                {task.name}
                                                {task.description && <FileText className="w-3.5 h-3.5 text-muted/20 shrink-0" />}
                                                {task.files.length > 0 && <Paperclip className="w-3.5 h-3.5 text-muted/20 shrink-0" />}
                                                {task.comments.length > 0 && <span className="flex items-center gap-0.5 text-muted/25"><MessageSquare className="w-3.5 h-3.5" /><span className="text-[9px]">{task.comments.length}</span></span>}
                                            </div>

                                            {selectedListType === 'asignaciones' ? (<>
                                                <TiendaBadge value={task.tienda} />
                                                <StatusBadge status={task.status} listType={task.list_type} />
                                                <div className="flex -space-x-1.5">{task.assignees.filter(Boolean).slice(0, 3).map((a, i) => <Avatar key={i} name={a} size="md" />)}{!task.assignees.filter(Boolean).length && <span className="text-xs text-muted/20">—</span>}</div>
                                                <ProductoBadge value={task.producto} />
                                                <TipoBadge value={task.tipo_actividad} />
                                                <div className="text-xs text-muted/50">{fmtDate(task.due_date) || '—'}</div>
                                                <PriorityBadge priority={task.priority} />
                                                <div className="text-xs text-muted/40 truncate">{task.codigo_dropi || '—'}</div>
                                            </>) : (<>
                                                <TiendaBadge value={task.tienda} />
                                                <ProductoBadge value={task.producto} />
                                                <StatusBadge status={task.status} listType={task.list_type} />
                                                <div className="text-xs text-muted truncate">{task.cuenta_publicitaria || '—'}</div>
                                                <RendimientoBadge value={task.rendimiento} />
                                                <PriorityBadge priority={task.priority} />
                                                <div className="text-xs text-muted/50 truncate">{task.resultados || '—'}</div>
                                                <div className="text-xs text-muted/40 truncate">{task.punto_dolor || '—'}</div>
                                            </>)}
                                        </div>
                                    );
                                })}
                                {filteredTasks.length === 0 && <div className="text-center py-16 text-muted/20 text-sm">{selectedSpaceId ? 'No hay tareas en este espacio' : 'Selecciona un espacio o usa "Todas"'}</div>}
                                {selectedSpaceId && <div onClick={handleNewTask} className="px-4 py-3 text-xs text-muted hover:text-foreground cursor-pointer hover:bg-hover-bg/30 flex items-center gap-2 border-b border-card-border/10"><Plus className="w-4 h-4" />Anadir Tarea</div>}
                            </div>
                        </div>
                    )}

                    {/* BOARD VIEW */}
                    {viewMode === 'board' && (
                        <div className="flex gap-3 p-3 h-full" style={{ minWidth: `${boardCols.length * 250}px` }}>
                            {boardCols.map(col => {
                                const colTasks = filteredTasks.filter(t => col.statuses.includes(t.status));
                                return (
                                    <div key={col.key} className={`w-[240px] bg-card border rounded-2xl flex flex-col overflow-hidden shrink-0 transition-all ${dragOverCol === col.key ? 'border-accent/50 bg-accent/5' : 'border-card-border'}`}
                                        onDragOver={e => { e.preventDefault(); setDragOverCol(col.key); }} onDragLeave={() => setDragOverCol(null)} onDrop={e => onDrop(e, col.key)}>
                                        <div className="flex items-center justify-between px-3 py-2 border-b border-card-border">
                                            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted">
                                                <div className="w-2 h-2 rounded-full" style={{ background: col.color }} />{col.label}
                                            </div>
                                            <span className="font-mono text-[10px] text-muted/30">{colTasks.length}</span>
                                        </div>
                                        <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
                                            {colTasks.map(task => (
                                                <div key={task.id} draggable onDragStart={e => onDragStart(e, task.id)} onDragEnd={onDragEnd}
                                                    onClick={() => { if (justDroppedRef.current) return; setSelectedTask(task); }}
                                                    className={`bg-background border border-card-border rounded-xl p-2.5 cursor-grab active:cursor-grabbing hover:border-accent/20 transition-all ${draggedTaskId === task.id ? 'opacity-30 scale-95' : ''}`}>
                                                    {task.progress > 0 && <div className="h-0.5 rounded-full mb-1.5 bg-card-border"><div className="h-full rounded-full" style={{ width: `${task.progress}%`, background: '#22c55e' }} /></div>}
                                                    <div className="text-[11px] font-semibold mb-1.5 leading-tight">{task.name}</div>
                                                    <div className="flex items-center gap-1 flex-wrap mb-1.5">
                                                        {task.tienda && <TiendaBadge value={task.tienda} />}
                                                        <PriorityBadge priority={task.priority} />
                                                    </div>
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex -space-x-1">{task.assignees.slice(0, 3).map((a, i) => <Avatar key={i} name={a} />)}</div>
                                                        <div className="flex items-center gap-1.5 text-muted/30">
                                                            {task.comments.length > 0 && <span className="flex items-center gap-0.5 text-[9px]"><MessageSquare className="w-3 h-3" />{task.comments.length}</span>}
                                                            {task.files.length > 0 && <span className="flex items-center gap-0.5 text-[9px]"><Paperclip className="w-3 h-3" />{task.files.length}</span>}
                                                            {task.due_date && <span className="text-[9px]">{fmtDate(task.due_date)}</span>}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                            {colTasks.length === 0 && <div className="text-center text-muted/15 text-[10px] py-6">Arrastra aqui</div>}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Reusable Components ───
function FieldRow({ label, icon, children }: { label: string; icon: string; children: React.ReactNode }) {
    return (
        <div className="grid grid-cols-[130px_1fr] items-center px-3 py-2 text-[12px]">
            <span className="text-muted flex items-center gap-1.5"><span>{icon}</span>{label}</span>
            {children}
        </div>
    );
}

function HeaderFilter({ label, value, onChange, options, labels }: {
    label: string; value: string; onChange: (v: string) => void; options: string[]; labels?: Record<string, string>;
}) {
    return (
        <div className="relative">
            <select
                value={value}
                onChange={e => onChange(e.target.value)}
                className={`text-[8px] font-bold uppercase tracking-[0.15em] bg-transparent outline-none cursor-pointer appearance-none pr-3 w-full ${value ? 'text-accent' : 'text-muted/50 hover:text-muted'}`}
            >
                <option value="">{label} ▾</option>
                {options.map(o => <option key={o} value={o}>{labels?.[o] || o}</option>)}
            </select>
        </div>
    );
}

function SidebarBtn({ active, onClick, icon, label, count, isPrivate, color }: {
    active: boolean; onClick: () => void; icon: string; label: string; count: number; isPrivate?: boolean; color?: string;
}) {
    return (
        <button onClick={onClick}
            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px] font-medium transition-all mb-0.5 ${active ? 'bg-hover-bg text-foreground' : 'text-muted hover:text-foreground hover:bg-hover-bg/50'}`}>
            <span className="text-sm">{icon}</span>
            <span className="truncate flex-1 text-left">{label}</span>
            {isPrivate && <Lock className="w-3 h-3 text-muted/30" />}
            <span className="text-[9px] opacity-40 tabular-nums">{count || ''}</span>
            {color && active && <div className="w-1 h-4 rounded-full ml-0.5" style={{ background: color }} />}
        </button>
    );
}
