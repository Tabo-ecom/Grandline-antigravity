'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    Loader2, Plus, X, Trash2, Edit3, ChevronDown, Search,
    LayoutGrid, List, FolderOpen, BarChart3, Pause, Play,
    MessageSquare, Paperclip, Clock, Users, Send, Cpu,
    ExternalLink, AlertCircle, Microscope, ArrowLeft, CheckCircle2,
    Target, TrendingUp, DollarSign, Zap, Download, Rocket, Sparkles
} from 'lucide-react';
import { useAuth } from '@/lib/context/AuthContext';
import { authFetch } from '@/lib/api/client';
import {
    VegaTask, VegaAnalysis, VegaTemplate, VegaSubtask, VegaComment, VegaActivity,
    TaskStatus, AnalysisStatus,
    VegaResearch, ResearchReport,
    VEGA_AGENTS, TEAM_MEMBERS, TASK_STATUSES, ANALYSIS_STATUSES, STORES, TIPO_ACTIVIDADES, DEFAULT_TEMPLATES,
    getVegaTasks, saveVegaTask, deleteVegaTask,
    getVegaResearchList, saveVegaResearch, deleteVegaResearch,
    getVegaAnalysis, saveVegaAnalysisItem,
    getVegaTemplates, saveVegaTemplates,
    createId, createEmptyTask, getAgent, getStoreInfo, getStatusInfo, getAnalysisStatusInfo,
} from '@/lib/services/vega';
import { startAdLibrary, pollJob as pollPipelineJob } from '@/lib/services/pipeline';

// ── Formatters ──────────────────────────────────────────────────────────────
const timeAgo = (ts: number) => {
    const d = Date.now() - ts;
    if (d < 60000) return 'Ahora';
    if (d < 3600000) return `Hace ${Math.floor(d / 60000)} min`;
    if (d < 86400000) return `Hace ${Math.floor(d / 3600000)}h`;
    return new Date(ts).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
};

// ── Agent Avatar ────────────────────────────────────────────────────────────
function AgentAvatar({ agentId, size = 'sm' }: { agentId: string; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
    const a = getAgent(agentId);
    if (!a) return null;
    const sizes = { sm: 'w-5 h-5 text-[7px] rounded-[5px]', md: 'w-6 h-6 text-[8px] rounded-[6px]', lg: 'w-10 h-10 text-sm rounded-[10px]', xl: 'w-12 h-12 text-base rounded-[12px]' };
    return <div className={`${sizes[size]} flex items-center justify-center font-bold text-white shrink-0`} style={{ background: `linear-gradient(135deg, ${a.color}, ${a.color}99)` }}>{a.initials}</div>;
}

function PersonAvatar({ name, size = 'sm' }: { name: string; size?: 'sm' | 'md' }) {
    const m = TEAM_MEMBERS.find(t => t.name === name || t.initials === name);
    const initials = m?.initials || name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    const color = m?.color || '#888';
    const s = size === 'sm' ? 'w-5 h-5 text-[7px]' : 'w-6 h-6 text-[8px]';
    return <div className={`${s} rounded-full flex items-center justify-center font-semibold text-white shrink-0`} style={{ background: color }}>{initials}</div>;
}

// ── Pythagoras Tab — Market Research ────────────────────────────────────────
export default function PythagorasTab({ onCreateLanding }: { onCreateLanding?: (url: string, niche: string, researchData?: any) => void }) {
    const { effectiveUid } = useAuth();
    const [loading, setLoading] = useState(true);
    const [tasks, setTasks] = useState<VegaTask[]>([]);
    const [analysis, setAnalysis] = useState<VegaAnalysis[]>([]);
    const [templates, setTemplates] = useState<VegaTemplate[]>([]);

    // UI State
    const [activeTab, setActiveTab] = useState<'tasks' | 'agents' | 'templates' | 'recurring' | 'research'>('tasks');
    const [activeFolder, setActiveFolder] = useState<'general' | 'analysis'>('general');
    const [viewMode, setViewMode] = useState<'board' | 'list'>('board');
    const [storeFilter, setStoreFilter] = useState('');
    const [selectedTask, setSelectedTask] = useState<VegaTask | null>(null);
    const [flowTemplate, setFlowTemplate] = useState<VegaTemplate | null>(null);
    const [saving, setSaving] = useState(false);
    const [detailTab, setDetailTab] = useState<'activity' | 'comments' | 'files'>('activity');
    const [newComment, setNewComment] = useState('');

    // Research state
    const [researches, setResearches] = useState<VegaResearch[]>([]);
    const [researchForm, setResearchForm] = useState({ productName: '', referenceUrl: '', productUrl: '', country: 'Colombia' });
    const [researchRunning, setResearchRunning] = useState(false);
    const [researchError, setResearchError] = useState('');
    const [selectedResearch, setSelectedResearch] = useState<VegaResearch | null>(null);
    const [adLibResults, setAdLibResults] = useState<any>(null);
    const [adLibLoading, setAdLibLoading] = useState(false);
    const [researchSearch, setResearchSearch] = useState('');

    // Load data
    useEffect(() => {
        if (!effectiveUid) return;
        (async () => {
            setLoading(true);
            const [t, a, tpl, r] = await Promise.all([
                getVegaTasks(effectiveUid),
                getVegaAnalysis(effectiveUid),
                getVegaTemplates(effectiveUid),
                getVegaResearchList(effectiveUid),
            ]);
            setTasks(t);
            setAnalysis(a);
            setTemplates(tpl.length > 0 ? tpl : DEFAULT_TEMPLATES);
            setResearches(r);
            setLoading(false);
        })();
    }, [effectiveUid]);

    // Filtered tasks
    const filteredTasks = useMemo(() => {
        if (!storeFilter) return tasks;
        return tasks.filter(t => t.store === storeFilter);
    }, [tasks, storeFilter]);

    // Kanban columns
    const kanbanCols: { key: string; label: string; color: string; statuses: TaskStatus[] }[] = [
        { key: 'pendiente', label: 'Pendiente', color: '#666', statuses: ['pendiente'] },
        { key: 'progreso', label: 'En Progreso', color: '#00CFFF', statuses: ['en_progreso', 'bloqueado', 'retraso'] },
        { key: 'aprobacion', label: 'Pend. Aprobación', color: '#FFAA00', statuses: ['pendiente_aprobacion', 'corregir'] },
        { key: 'listo', label: 'Listo / Completado', color: '#00FF88', statuses: ['listo_para_subir', 'completado'] },
    ];

    // Save task
    const handleSaveTask = useCallback(async (task: VegaTask) => {
        if (!effectiveUid) return;
        setSaving(true);
        await saveVegaTask(effectiveUid, task);
        setTasks(prev => {
            const idx = prev.findIndex(t => t.id === task.id);
            if (idx >= 0) { const n = [...prev]; n[idx] = task; return n; }
            return [...prev, task];
        });
        setSelectedTask(task);
        setSaving(false);
    }, [effectiveUid]);

    // Delete task
    const handleDeleteTask = useCallback(async (taskId: string) => {
        if (!effectiveUid) return;
        await deleteVegaTask(effectiveUid, taskId);
        setTasks(prev => prev.filter(t => t.id !== taskId));
        setSelectedTask(null);
    }, [effectiveUid]);

    // Create new task
    const handleNewTask = () => {
        const t = createEmptyTask({ name: 'Nueva Tarea' });
        setTasks(prev => [...prev, t]);
        setSelectedTask(t);
    };

    // Add comment
    const handleAddComment = () => {
        if (!selectedTask || !newComment.trim()) return;
        const comment: VegaComment = {
            id: createId(), author: 'Gustavo M.', authorType: 'person',
            text: newComment, timestamp: Date.now(),
        };
        const updated = { ...selectedTask, comments: [...selectedTask.comments, comment] };
        handleSaveTask(updated);
        setNewComment('');
    };

    // Run research
    const handleRunResearch = async () => {
        if (!researchForm.productName || (!researchForm.referenceUrl && !researchForm.productUrl)) return;
        setResearchRunning(true);
        setResearchError('');
        try {
            const res = await authFetch('/api/vega/research', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(researchForm),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || 'Error en la investigación');
            }
            const { research } = await res.json();
            // Save to Firestore from client
            if (effectiveUid) await saveVegaResearch(effectiveUid, research);
            setResearches(prev => [research, ...prev]);
            setSelectedResearch(research);
            setResearchForm({ productName: '', referenceUrl: '', productUrl: '', country: 'Colombia' });
        } catch (e: any) {
            setResearchError(e.message);
        } finally {
            setResearchRunning(false);
        }
    };

    // Search Ad Library
    const handleAdLibSearch = async (query: string, country: string) => {
        setAdLibLoading(true);
        setAdLibResults(null);
        try {
            const { job_id } = await startAdLibrary({ query, country, limit: 10 });
            // Poll for results
            const poll = setInterval(async () => {
                try {
                    const job = await pollPipelineJob(job_id);
                    if (job.status === 'completed' && job.result) {
                        clearInterval(poll);
                        setAdLibResults(job.result);
                        setAdLibLoading(false);
                    } else if (job.status === 'failed') {
                        clearInterval(poll);
                        setAdLibLoading(false);
                    }
                } catch { /* ignore */ }
            }, 4000);
            // Timeout after 60s
            setTimeout(() => { clearInterval(poll); setAdLibLoading(false); }, 60000);
        } catch (e: any) {
            setAdLibLoading(false);
        }
    };

    // Delete research
    const handleDeleteResearch = async (id: string) => {
        if (!effectiveUid) return;
        await deleteVegaResearch(effectiveUid, id);
        setResearches(prev => prev.filter(r => r.id !== id));
        if (selectedResearch?.id === id) setSelectedResearch(null);
    };

    // Toggle subtask
    const handleToggleSubtask = (subtaskId: string) => {
        if (!selectedTask) return;
        const updated = {
            ...selectedTask,
            subtasks: selectedTask.subtasks.map(s => s.id === subtaskId ? { ...s, done: !s.done } : s),
        };
        handleSaveTask(updated);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-accent mr-3" />
                <span className="text-sm text-muted font-medium">Cargando VEGA Satellites...</span>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background text-foreground p-3 md:p-5 font-sans">
            <div className="max-w-full mx-auto space-y-4">

                {/* ── Header ── */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-accent flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-accent/25">V</div>
                        <div>
                            <h1 className="text-sm font-bold tracking-widest uppercase">VEGA SATELLITES</h1>
                            <p className="text-[9px] text-muted font-mono tracking-wider uppercase">Centro de Comando</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5 text-[10px] text-muted font-mono">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_5px_rgba(0,255,136,0.5)]" />
                            7 agentes online
                        </div>
                        <button onClick={handleNewTask} className="flex items-center gap-1.5 px-4 py-2 bg-accent hover:bg-orange-600 text-white rounded-xl font-bold text-[11px] uppercase tracking-wider transition-all shadow-lg shadow-accent/25">
                            <Plus className="w-3.5 h-3.5" /> Nueva Tarea
                        </button>
                    </div>
                </div>

                {/* ── Tabs ── */}
                <div className="flex gap-1">
                    {([
                        { key: 'tasks' as const, label: 'Tareas', count: tasks.length },
                        { key: 'agents' as const, label: 'Agentes', count: 7 },
                        { key: 'templates' as const, label: 'Templates', count: templates.length },
                        { key: 'research' as const, label: 'Research', count: researches.length },
                        { key: 'recurring' as const, label: 'Recurrentes', count: 0 },
                    ]).map(tab => (
                        <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === tab.key
                                ? 'bg-[#d75c33]/10 text-[#d75c33] border border-[#d75c33]/20'
                                : 'text-muted hover:text-foreground hover:bg-hover-bg border border-transparent'
                                }`}>
                            {tab.label}
                            <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded ${activeTab === tab.key ? 'bg-[#d75c33]/15 text-[#d75c33]' : 'bg-card border border-card-border text-muted'}`}>{tab.count}</span>
                        </button>
                    ))}
                </div>

                {/* ═══════════ TAB: TASKS ═══════════ */}
                {activeTab === 'tasks' && (
                    <div className="space-y-3">
                        {/* Folder Tabs */}
                        <div className="flex gap-1">
                            <button onClick={() => setActiveFolder('general')}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-t-lg text-[11px] font-semibold border border-b-0 transition-all ${activeFolder === 'general' ? 'bg-background text-foreground border-card-border' : 'bg-card text-muted border-card-border'}`}>
                                <FolderOpen className="w-3.5 h-3.5" /> Tareas General
                                <span className="font-mono text-[9px] bg-hover-bg px-1.5 rounded">{tasks.length}</span>
                            </button>
                            <button onClick={() => setActiveFolder('analysis')}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-t-lg text-[11px] font-semibold border border-b-0 transition-all ${activeFolder === 'analysis' ? 'bg-background text-foreground border-card-border' : 'bg-card text-muted border-card-border'}`}>
                                <BarChart3 className="w-3.5 h-3.5" /> Análisis Testeos
                                <span className="font-mono text-[9px] bg-hover-bg px-1.5 rounded">{analysis.length}</span>
                            </button>
                        </div>

                        {/* ── FOLDER: General ── */}
                        {activeFolder === 'general' && (
                            <>
                                {/* Filters + View toggle */}
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-[10px] text-muted">Tienda:</span>
                                    {[{ value: '', label: 'Todas' }, ...STORES].map(s => (
                                        <button key={s.value} onClick={() => setStoreFilter(s.value)}
                                            className={`px-3 py-1 rounded-lg text-[11px] font-medium border transition-all ${storeFilter === s.value ? 'bg-[#d75c33]/10 border-[#d75c33]/20 text-[#d75c33]' : 'border-card-border text-muted hover:text-foreground'}`}>
                                            {s.label}
                                        </button>
                                    ))}
                                    <div className="flex-1" />
                                    <div className="flex gap-0.5 bg-card border border-card-border rounded-lg p-0.5">
                                        <button onClick={() => setViewMode('board')} className={`px-2.5 py-1.5 rounded-md text-[11px] flex items-center gap-1 transition-all ${viewMode === 'board' ? 'bg-hover-bg text-foreground' : 'text-muted'}`}>
                                            <LayoutGrid className="w-3 h-3" /> Board
                                        </button>
                                        <button onClick={() => setViewMode('list')} className={`px-2.5 py-1.5 rounded-md text-[11px] flex items-center gap-1 transition-all ${viewMode === 'list' ? 'bg-hover-bg text-foreground' : 'text-muted'}`}>
                                            <List className="w-3 h-3" /> Lista
                                        </button>
                                    </div>
                                </div>

                                {/* Board View */}
                                {viewMode === 'board' && (
                                    <div className="grid grid-cols-4 gap-3" style={{ height: 'calc(100vh - 280px)' }}>
                                        {kanbanCols.map(col => {
                                            const colTasks = filteredTasks.filter(t => col.statuses.includes(t.status));
                                            return (
                                                <div key={col.key} className="bg-card border border-card-border rounded-2xl flex flex-col overflow-hidden">
                                                    <div className="flex items-center justify-between px-3 py-2.5 border-b border-card-border">
                                                        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted">
                                                            <div className="w-1.5 h-1.5 rounded-full" style={{ background: col.color }} />
                                                            {col.label}
                                                        </div>
                                                        <span className="font-mono text-[10px] text-muted/40">{colTasks.length}</span>
                                                    </div>
                                                    <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
                                                        {colTasks.map(task => {
                                                            const agent = task.agentId ? getAgent(task.agentId) : null;
                                                            const store = getStoreInfo(task.store);
                                                            return (
                                                                <div key={task.id} onClick={() => { setSelectedTask(task); setDetailTab('activity'); }}
                                                                    className="bg-background border border-card-border rounded-xl p-3 cursor-pointer hover:border-accent/30 transition-all relative overflow-hidden group">
                                                                    {task.progress > 0 && (
                                                                        <div className="absolute top-0 left-0 h-0.5 rounded-t-xl" style={{ width: `${task.progress}%`, background: agent?.color || '#d75c33' }} />
                                                                    )}
                                                                    <div className="text-[12px] font-semibold mb-1.5">{task.name}</div>
                                                                    <div className="flex items-center justify-between">
                                                                        <div className="flex items-center gap-1.5">
                                                                            {agent && <AgentAvatar agentId={agent.id} />}
                                                                            <span className="text-[10px] text-muted">{agent?.name || 'Sin asignar'}</span>
                                                                        </div>
                                                                        <span className="font-mono text-[9px] text-muted/40">{timeAgo(task.updatedAt)}</span>
                                                                    </div>
                                                                    {(store || task.tipoActividad) && (
                                                                        <div className="flex gap-1 mt-1.5 flex-wrap">
                                                                            {store && <span className="text-[8px] font-semibold px-1.5 py-0.5 rounded" style={{ background: `${store.color}15`, color: store.color, border: `1px solid ${store.color}20` }}>{store.label}</span>}
                                                                            {task.tipoActividad && <span className="text-[8px] font-semibold px-1.5 py-0.5 rounded bg-accent/10 text-accent border border-accent/15">{task.tipoActividad}</span>}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* List View */}
                                {viewMode === 'list' && (
                                    <div className="bg-card border border-card-border rounded-2xl overflow-hidden">
                                        <div className="grid grid-cols-[8px_1.5fr_100px_120px_110px_100px_80px] items-center px-3 py-2 bg-background border-b border-card-border text-[9px] font-bold uppercase tracking-widest text-muted/40">
                                            <div />
                                            <div>Tarea</div>
                                            <div>Asignado</div>
                                            <div>Producto</div>
                                            <div>Tipo</div>
                                            <div>Tienda</div>
                                            <div>Link</div>
                                        </div>
                                        {filteredTasks.map(task => {
                                            const agent = task.agentId ? getAgent(task.agentId) : null;
                                            const store = getStoreInfo(task.store);
                                            const st = getStatusInfo(task.status);
                                            return (
                                                <div key={task.id} onClick={() => { setSelectedTask(task); setDetailTab('activity'); }}
                                                    className="grid grid-cols-[8px_1.5fr_100px_120px_110px_100px_80px] items-center px-3 py-2.5 border-b border-card-border/30 hover:bg-hover-bg cursor-pointer transition-all">
                                                    <div className="w-2 h-2 rounded-full" style={{ background: st?.color || '#666' }} />
                                                    <div className="flex items-center gap-2 text-[12px] font-semibold">
                                                        {agent && <AgentAvatar agentId={agent.id} />}
                                                        {task.name}
                                                    </div>
                                                    <div className="flex -space-x-1">
                                                        {task.assignees.slice(0, 3).map((a, i) => <PersonAvatar key={i} name={a} />)}
                                                        {!task.assignees.length && agent && <AgentAvatar agentId={agent.id} />}
                                                    </div>
                                                    <div className="text-[10px] font-semibold truncate">{task.product}</div>
                                                    <div>{task.tipoActividad && <span className="text-[8px] font-semibold px-1.5 py-0.5 rounded bg-accent/10 text-accent border border-accent/15">{task.tipoActividad}</span>}</div>
                                                    <div>{store && <span className="text-[8px] font-semibold px-1.5 py-0.5 rounded" style={{ background: `${store.color}15`, color: store.color, border: `1px solid ${store.color}20` }}>{store.label}</span>}</div>
                                                    <div className="text-[10px] text-muted/40 truncate">{task.linkDrive ? 'drive.google.com' : '—'}</div>
                                                </div>
                                            );
                                        })}
                                        <div onClick={handleNewTask} className="px-3 py-2.5 text-[11px] text-muted hover:text-foreground cursor-pointer hover:bg-hover-bg transition-all flex items-center gap-1.5">
                                            <Plus className="w-3 h-3" /> Añadir Tarea
                                        </div>
                                    </div>
                                )}
                            </>
                        )}

                        {/* ── FOLDER: Analysis Testeos ── */}
                        {activeFolder === 'analysis' && (
                            <div className="bg-card border border-card-border rounded-2xl overflow-hidden">
                                <div className="grid grid-cols-[8px_1.4fr_90px_110px_90px_70px_60px_65px_60px_1fr] items-center px-3 py-2 bg-background border-b border-card-border text-[9px] font-bold uppercase tracking-widest text-muted/40">
                                    <div /><div>Testeo</div><div>Asignado</div><div>Producto</div><div>Estado</div><div>CPC</div><div>CTR</div><div>Rend.</div><div>Ventas</div><div>Resultado</div>
                                </div>
                                {analysis.length === 0 && (
                                    <div className="px-4 py-8 text-center text-muted text-sm">
                                        <AlertCircle className="w-5 h-5 mx-auto mb-2 opacity-30" />
                                        No hay testeos registrados. Las tareas en estado "Listo para Subir" aparecerán aquí.
                                    </div>
                                )}
                                {analysis.map(item => {
                                    const agent = getAgent(item.agentId);
                                    const st = getAnalysisStatusInfo(item.status);
                                    const rendCls = item.rendimiento === 'alto' ? 'bg-emerald-400/12 text-emerald-400' : item.rendimiento === 'medio' ? 'bg-yellow-400/12 text-yellow-400' : 'bg-red-400/12 text-red-400';
                                    return (
                                        <div key={item.id} className="grid grid-cols-[8px_1.4fr_90px_110px_90px_70px_60px_65px_60px_1fr] items-center px-3 py-2.5 border-b border-card-border/30 hover:bg-hover-bg cursor-pointer transition-all">
                                            <div className="w-2 h-2 rounded-full" style={{ background: st?.color || '#666', boxShadow: item.status === 'corriendo' ? `0 0 6px ${st?.color}60` : 'none' }} />
                                            <div className="flex items-center gap-2 text-[12px] font-semibold">
                                                {agent && <AgentAvatar agentId={agent.id} />}
                                                {item.name}
                                            </div>
                                            <div className="flex -space-x-1">
                                                {item.assignees.slice(0, 2).map((a, i) => <PersonAvatar key={i} name={a} />)}
                                                {!item.assignees.length && agent && <AgentAvatar agentId={agent.id} />}
                                            </div>
                                            <div className="text-[10px] font-semibold truncate">{item.product}</div>
                                            <div className="text-[10px] font-semibold" style={{ color: st?.color }}>{st?.label}</div>
                                            <div className="font-mono text-[10px]">{item.cpc || '—'}</div>
                                            <div className="font-mono text-[10px]">{item.ctr || '—'}</div>
                                            <div>{item.rendimiento && <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${rendCls}`}>{item.rendimiento.charAt(0).toUpperCase() + item.rendimiento.slice(1)}</span>}</div>
                                            <div className="font-mono text-[11px] font-bold">{item.numVentas || '—'}</div>
                                            <div className="text-[10px] text-muted truncate">{item.resultado || '—'}</div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* ═══════════ TAB: AGENTS ═══════════ */}
                {activeTab === 'agents' && (
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-muted">Agentes Configurados</span>
                            <span className="font-mono text-[10px] text-muted/40">7 agentes</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                            {VEGA_AGENTS.map(agent => {
                                const agentTasks = tasks.filter(t => t.agentId === agent.id && !['completado', 'listo_para_subir'].includes(t.status));
                                const doneTasks = tasks.filter(t => t.agentId === agent.id && ['completado', 'listo_para_subir'].includes(t.status));
                                const isWorking = agentTasks.length > 0;
                                return (
                                    <div key={agent.id} className="bg-card border border-card-border rounded-2xl overflow-hidden hover:border-accent/30 transition-all cursor-pointer">
                                        <div className="h-16 relative flex items-center justify-center">
                                            <div className="absolute inset-0 opacity-[0.12]" style={{ background: `linear-gradient(135deg, ${agent.color}, ${agent.color}99)` }} />
                                            <AgentAvatar agentId={agent.id} size="lg" />
                                        </div>
                                        <div className="p-3">
                                            <div className="flex items-center justify-between mb-0.5">
                                                <span className="font-bold text-[13px]" style={{ color: agent.color }}>{agent.name}</span>
                                                <div className="flex items-center gap-1.5">
                                                    <div className={`w-1.5 h-1.5 rounded-full ${isWorking ? 'bg-emerald-400 shadow-[0_0_5px_rgba(0,255,136,0.5)] animate-pulse' : 'bg-muted/30'}`} />
                                                    <span className="text-[9px] text-muted">{isWorking ? 'Trabajando' : 'Inactivo'}</span>
                                                </div>
                                            </div>
                                            <div className="text-[10px] text-muted mb-2">{agent.role}</div>
                                            <div className="font-mono text-[8px] px-1.5 py-0.5 rounded bg-hover-bg border border-card-border text-muted/40 inline-block">{agent.model}</div>
                                            <div className="flex gap-2 mt-3 pt-3 border-t border-card-border">
                                                <div className="flex-1 text-center">
                                                    <div className="font-mono font-bold text-[14px]" style={{ color: agent.color }}>{agentTasks.length}</div>
                                                    <div className="text-[8px] text-muted/30 uppercase tracking-wider">Activas</div>
                                                </div>
                                                <div className="flex-1 text-center">
                                                    <div className="font-mono font-bold text-[14px]">{doneTasks.length}</div>
                                                    <div className="text-[8px] text-muted/30 uppercase tracking-wider">Hechas</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* ═══════════ TAB: TEMPLATES ═══════════ */}
                {activeTab === 'templates' && (
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-muted">Templates de Flujos</span>
                            <span className="font-mono text-[10px] text-muted/40">{templates.length} templates</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {templates.map(tpl => {
                                const agent = getAgent(tpl.agentId);
                                return (
                                    <div key={tpl.id} onClick={() => setFlowTemplate(tpl)}
                                        className="bg-card border border-card-border rounded-2xl p-4 cursor-pointer hover:border-accent/30 hover:bg-hover-bg transition-all">
                                        <div className="font-bold text-[13px] mb-1">{tpl.name}</div>
                                        <div className="text-[11px] text-muted leading-relaxed mb-3">{tpl.description}</div>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-1.5">
                                                {agent && <AgentAvatar agentId={agent.id} />}
                                                <span className="text-[10px] text-muted">{agent?.name}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono text-[9px] px-2 py-0.5 rounded bg-accent/10 border border-accent/20 text-accent">{tpl.steps.length} pasos</span>
                                                <span className="font-mono text-[9px] text-muted/30">#{tpl.runs}</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* ═══════════ TAB: RECURRING (placeholder) ═══════════ */}
                {/* ═══════════ TAB: RESEARCH ═══════════ */}
                {activeTab === 'research' && (
                    <div>
                        {selectedResearch && selectedResearch.report ? (() => {
                            const r = selectedResearch.report!;
                            const sc = r.scorecard;
                            const scorecardItems = [
                                { key: 'wowFactor' as const, label: 'WOW Factor', icon: '✨', desc: 'Reacción viral' },
                                { key: 'solvesProblem' as const, label: 'Resuelve Problema', icon: '🎯', desc: 'Dolor real' },
                                { key: 'impulsePrice' as const, label: 'Precio Impulso', icon: '💸', desc: '$15-$80 USD' },
                                { key: 'goodMargins' as const, label: 'Buenos Márgenes', icon: '💰', desc: '3x-5x markup' },
                                { key: 'notInRetail' as const, label: 'No en Retail', icon: '🏪', desc: 'No en tiendas' },
                                { key: 'easyToShip' as const, label: 'Fácil Envío', icon: '📦', desc: 'Ligero/compacto' },
                                { key: 'videoFriendly' as const, label: 'Video Friendly', icon: '🎬', desc: 'Demo visual' },
                            ];
                            const getColor = (v: number) => v >= 7 ? '#00FF88' : v >= 5 ? '#FFD700' : '#FF3366';
                            const satColors = { low: '#00FF88', medium: '#FFD700', high: '#FF3366' };
                            const satLabels = { low: 'BAJA', medium: 'MEDIA', high: 'ALTA' };
                            const trendLabels = { emergent: 'EMERGENTE', growth: 'CRECIMIENTO', peak: 'TOPE', decline: 'DECLIVE', dead: 'MUERTO' };
                            const trendColors = { emergent: '#00FF88', growth: '#00CFFF', peak: '#FFD700', decline: '#FF8800', dead: '#FF3366' };
                            return (<>
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <button onClick={() => setSelectedResearch(null)} className="flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition-all"><ArrowLeft className="w-4 h-4" /> Volver</button>
                                    <button onClick={() => handleDeleteResearch(selectedResearch.id)} className="w-8 h-8 rounded-lg border border-card-border flex items-center justify-center text-muted hover:text-red-400 hover:border-red-400/30 transition-all"><Trash2 className="w-4 h-4" /></button>
                                </div>

                                {/* Header with badges */}
                                <div className="bg-card border border-card-border rounded-2xl p-5">
                                    <h2 className="text-xl font-bold mb-2">{selectedResearch.productName}</h2>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-accent/10 text-accent border border-accent/15 uppercase">{selectedResearch.niche || 'generic'}</span>
                                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded uppercase ${r.recommendation === 'GO' ? 'bg-emerald-400/15 text-emerald-400 border border-emerald-400/20' : r.recommendation === 'NO_GO' ? 'bg-red-400/15 text-red-400 border border-red-400/20' : 'bg-yellow-400/15 text-yellow-400 border border-yellow-400/20'}`}>{r.recommendation === 'GO' ? '✅ GO' : r.recommendation === 'NO_GO' ? '❌ NO GO' : '🔍 INVESTIGAR MÁS'}</span>
                                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded uppercase" style={{ background: `${satColors[r.saturationLevel]}15`, color: satColors[r.saturationLevel], border: `1px solid ${satColors[r.saturationLevel]}30` }}>Saturación: {satLabels[r.saturationLevel]}</span>
                                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded uppercase" style={{ background: `${trendColors[r.trendPhase]}15`, color: trendColors[r.trendPhase], border: `1px solid ${trendColors[r.trendPhase]}30` }}>Fase: {trendLabels[r.trendPhase]}</span>
                                        <span className="text-[10px] text-muted font-mono ml-auto">{new Date(selectedResearch.createdAt).toLocaleDateString('es-CO')}</span>
                                    </div>
                                    <p className="text-sm text-muted leading-relaxed mt-3">{r.summary}</p>

                                    {/* Action buttons */}
                                    {onCreateLanding && selectedResearch.referenceUrl && (
                                        <div className="flex gap-2 mt-4 pt-3 border-t border-card-border/30">
                                            <button
                                                onClick={() => onCreateLanding(selectedResearch.referenceUrl, selectedResearch.niche || 'generic', selectedResearch.report)}
                                                className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-orange-600 text-white rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all"
                                            >
                                                <Rocket className="w-3.5 h-3.5" />
                                                Crear Landing Page
                                            </button>
                                            <button
                                                onClick={() => onCreateLanding(selectedResearch.referenceUrl, selectedResearch.niche || 'generic', selectedResearch.report)}
                                                className="flex items-center gap-2 px-4 py-2 bg-[#AA77FF] hover:bg-[#9966EE] text-white rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all"
                                            >
                                                <Sparkles className="w-3.5 h-3.5" />
                                                Crear Creativos
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Product Images */}
                                {selectedResearch.productImages && selectedResearch.productImages.length > 0 && (
                                    <div className="flex gap-3 overflow-x-auto pb-2">
                                        {selectedResearch.productImages.map((img, i) => (
                                            <img key={i} src={img} alt={`Producto ${i+1}`} className="w-32 h-32 object-contain rounded-xl border border-card-border bg-card shrink-0" />
                                        ))}
                                    </div>
                                )}

                                {/* Row 1: Scorecard + Unit Economics */}
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                                    <div className="lg:col-span-2 bg-card border border-card-border rounded-2xl p-5">
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="text-[10px] font-bold uppercase tracking-widest text-muted">Scorecard — 7 Criterios Hormozi</div>
                                            <div className="text-3xl font-bold font-mono" style={{ color: getColor(sc.total) }}>{sc.total.toFixed(1)}<span className="text-lg text-muted/40">/10</span></div>
                                        </div>
                                        <div className="space-y-2.5">
                                            {scorecardItems.map(item => {
                                                const val = sc[item.key];
                                                return (
                                                    <div key={item.key} className="flex items-center gap-2">
                                                        <span className="text-sm w-5">{item.icon}</span>
                                                        <span className="text-[11px] w-36 text-muted">{item.label}</span>
                                                        <span className="text-[9px] text-muted/40 w-20">{item.desc}</span>
                                                        <div className="flex-1 h-3 bg-card-border/20 rounded-full overflow-hidden"><div className="h-full rounded-full transition-all" style={{ width: `${val * 10}%`, background: getColor(val) }} /></div>
                                                        <span className="font-mono text-[13px] font-bold w-8 text-right" style={{ color: getColor(val) }}>{val}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                    <div className="bg-card border border-card-border rounded-2xl p-5">
                                        <div className="text-[10px] font-bold uppercase tracking-widest text-muted mb-3">Unit Economics</div>
                                        {[
                                            { l: 'Costo Producto', v: r.unitEconomics.costProduct, icon: DollarSign },
                                            { l: 'Precio Sugerido', v: r.unitEconomics.suggestedPrice, icon: Target },
                                            { l: 'CPA Estimado', v: r.unitEconomics.estimatedCPA, icon: Zap },
                                            { l: 'Margen Proyectado', v: r.unitEconomics.projectedMargin, icon: TrendingUp },
                                            { l: 'ROAS Mínimo', v: r.unitEconomics.minROAS, icon: BarChart3 },
                                        ].map(item => { const I = item.icon; return (
                                            <div key={item.l} className="flex items-center justify-between py-2 border-b border-card-border/20 last:border-none">
                                                <span className="text-[11px] text-muted flex items-center gap-1.5"><I className="w-3.5 h-3.5 opacity-30" />{item.l}</span>
                                                <span className="text-[13px] font-bold font-mono">{item.v}</span>
                                            </div>
                                        ); })}
                                    </div>
                                </div>

                                {/* Row 2: Buyer Persona + Reddit */}
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                    <div className="bg-card border border-card-border rounded-2xl p-5">
                                        <div className="text-[10px] font-bold uppercase tracking-widest text-muted mb-3">👤 Buyer Persona</div>
                                        <div className="flex items-center gap-3 mb-3 pb-3 border-b border-card-border/30">
                                            <div className="w-12 h-12 rounded-full bg-accent/15 flex items-center justify-center text-xl">👤</div>
                                            <div><div className="font-bold text-sm">{r.buyerPersona.name}</div><div className="text-[11px] text-muted">{r.buyerPersona.age} · {r.buyerPersona.gender} · {r.buyerPersona.occupation}</div><div className="text-[10px] text-muted/60">{r.buyerPersona.income} · {r.buyerPersona.location}</div></div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3 text-[11px]">
                                            <div><div className="text-[9px] font-bold uppercase text-red-400/60 mb-1">Dolores</div>{r.buyerPersona.painPoints.map((p,i) => <div key={i} className="text-muted py-0.5">• {p}</div>)}</div>
                                            <div><div className="text-[9px] font-bold uppercase text-emerald-400/60 mb-1">Deseos</div>{r.buyerPersona.desires.map((d,i) => <div key={i} className="text-muted py-0.5">• {d}</div>)}</div>
                                            <div><div className="text-[9px] font-bold uppercase text-yellow-400/60 mb-1">Objeciones</div>{r.buyerPersona.objections.map((o,i) => <div key={i} className="text-muted py-0.5">• {o}</div>)}</div>
                                            <div><div className="text-[9px] font-bold uppercase text-blue-400/60 mb-1">Triggers</div>{r.buyerPersona.buyingTriggers.map((t,i) => <div key={i} className="text-muted py-0.5">• {t}</div>)}</div>
                                        </div>
                                        <div className="mt-3 pt-3 border-t border-card-border/30">
                                            <div className="text-[9px] font-bold uppercase text-muted/40 mb-1">Plataformas</div>
                                            <div className="flex gap-1.5 flex-wrap">{r.buyerPersona.platforms.map((p,i) => <span key={i} className="text-[9px] px-2 py-0.5 rounded bg-hover-bg border border-card-border text-muted">{p}</span>)}</div>
                                        </div>
                                        {r.buyerPersona.phrase && <div className="mt-3 px-3 py-2 bg-accent/5 border border-accent/10 rounded-lg text-[11px] text-accent italic">"{r.buyerPersona.phrase}"</div>}
                                    </div>

                                    <div className="space-y-4">
                                        <div className="bg-card border border-card-border rounded-2xl p-5">
                                            <div className="text-[10px] font-bold uppercase tracking-widest text-muted mb-2">🔍 Reddit Insights — {r.redditInsights.subreddit}</div>
                                            <p className="text-[12px] text-muted leading-relaxed mb-3">{r.redditInsights.summary}</p>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <div className="text-[9px] font-bold uppercase text-red-400/60 mb-1.5">😡 Lo que se quejan</div>
                                                    {r.redditInsights.topPains.map((p,i) => <div key={i} className="text-[11px] text-muted py-1 flex items-start gap-1.5"><AlertCircle className="w-3.5 h-3.5 text-red-400/50 shrink-0 mt-0.5" />{p}</div>)}
                                                </div>
                                                <div>
                                                    <div className="text-[9px] font-bold uppercase text-emerald-400/60 mb-1.5">😍 Lo que les encanta</div>
                                                    {(r.redditInsights.topLoves || []).map((l,i) => <div key={i} className="text-[11px] text-muted py-1 flex items-start gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400/50 shrink-0 mt-0.5" />{l}</div>)}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="bg-card border border-card-border rounded-2xl p-5">
                                            <div className="text-[10px] font-bold uppercase tracking-widest text-muted mb-2">Demanda del Mercado</div>
                                            <p className="text-[12px] text-muted leading-relaxed">{r.demand}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Row 3: Competitors + US Brands */}
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                    <div className="bg-card border border-card-border rounded-2xl p-5">
                                        <div className="text-[10px] font-bold uppercase tracking-widest text-muted mb-3">🏪 Competidores Directos</div>
                                        <p className="text-[11px] text-muted leading-relaxed mb-3">{r.competition}</p>
                                        <div className="space-y-2">
                                            {r.competitors.map((c,i) => (
                                                <div key={i} className="p-3 bg-background border border-card-border rounded-xl">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <span className="text-[12px] font-bold">{c.name}</span>
                                                        <span className="text-[10px] text-muted font-mono">{c.priceRange}</span>
                                                    </div>
                                                    <a href={c.url} target="_blank" rel="noopener" className="text-[10px] text-accent hover:underline truncate block mb-1.5">{c.url}</a>
                                                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                                                        <div><span className="text-emerald-400/60">✓</span> <span className="text-muted">{c.strengths}</span></div>
                                                        <div><span className="text-red-400/60">✗</span> <span className="text-muted">{c.weaknesses}</span></div>
                                                    </div>
                                                    <div className="text-[9px] text-muted/50 mt-1">{c.adStatus}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="bg-card border border-card-border rounded-2xl p-5">
                                        <div className="text-[10px] font-bold uppercase tracking-widest text-muted mb-3">🇺🇸 Marcas Líderes en USA</div>
                                        <div className="space-y-2">
                                            {r.usBrands.map((b,i) => (
                                                <div key={i} className="p-3 bg-background border border-card-border rounded-xl">
                                                    <div className="font-bold text-[12px] mb-0.5">{b.name}</div>
                                                    <a href={b.url} target="_blank" rel="noopener" className="text-[10px] text-accent hover:underline truncate block mb-1">{b.url}</a>
                                                    <p className="text-[10px] text-muted">{b.description}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Meta Ad Library — Real competitor ads */}
                                <div className="bg-card border border-card-border rounded-2xl p-5">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="text-[10px] font-bold uppercase tracking-widest text-muted">📢 Meta Ad Library — Ads Activos en {selectedResearch.country || 'Colombia'}</div>
                                        {!adLibResults && !adLibLoading && (
                                            <button onClick={() => handleAdLibSearch(selectedResearch.productName, selectedResearch.country || 'Colombia')}
                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#AA77FF] hover:bg-[#9966EE] text-white rounded-lg text-[10px] font-bold transition-all">
                                                <Search className="w-3 h-3" /> Buscar Competencia
                                            </button>
                                        )}
                                        {adLibLoading && (
                                            <span className="flex items-center gap-1.5 text-[10px] text-[#AA77FF]">
                                                <Loader2 className="w-3 h-3 animate-spin" /> Buscando ads...
                                            </span>
                                        )}
                                    </div>

                                    {adLibResults && (
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-[11px] text-muted">{adLibResults.total_found} anunciantes encontrados</span>
                                                <a href={adLibResults.search_url} target="_blank" rel="noopener" className="text-[10px] text-accent hover:underline flex items-center gap-1">
                                                    <ExternalLink className="w-3 h-3" /> Ver en Ad Library
                                                </a>
                                            </div>
                                            {(adLibResults.ads || []).map((ad: any, i: number) => (
                                                <div key={i} className="p-3 bg-background border border-card-border rounded-xl">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <a href={ad.facebook_page_url || '#'} target="_blank" rel="noopener" className="text-[12px] font-bold hover:text-accent transition-colors">{ad.advertiser_name}</a>
                                                        <span className={`text-[9px] font-semibold px-2 py-0.5 rounded ${
                                                            ad.destination_type === 'website' ? 'bg-emerald-400/12 text-emerald-400' :
                                                            ad.destination_type === 'whatsapp' ? 'bg-green-400/12 text-green-400' :
                                                            ad.destination_type === 'instagram' ? 'bg-pink-400/12 text-pink-400' :
                                                            'bg-muted/10 text-muted'
                                                        }`}>
                                                            {ad.destination_type === 'website' ? '🌐 Web' :
                                                             ad.destination_type === 'whatsapp' ? '💬 WhatsApp' :
                                                             ad.destination_type === 'instagram' ? '📸 Instagram' : '❓ Otro'}
                                                        </span>
                                                    </div>
                                                    {ad.facebook_page_url && (
                                                        <a href={ad.facebook_page_url} target="_blank" rel="noopener" className="text-[10px] text-blue-400 hover:underline mb-1 block truncate">📘 {ad.facebook_page_url}</a>
                                                    )}
                                                    {ad.destination_url && (
                                                        <a href={ad.destination_url} target="_blank" rel="noopener" className="text-[10px] text-accent hover:underline mb-1.5 block truncate">🔗 {ad.destination_url}</a>
                                                    )}
                                                    <div className="flex items-center gap-3 text-[9px]">
                                                        <a href={ad.ad_library_url} target="_blank" rel="noopener" className="text-[#AA77FF] hover:underline">Ver todos los ads →</a>
                                                        {ad.platform && <span className="text-muted ml-auto">{ad.platform}</span>}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {!adLibResults && !adLibLoading && (
                                        <p className="text-[11px] text-muted/40 text-center py-4">Click "Buscar Competencia" para scrapear Meta Ad Library en tiempo real</p>
                                    )}
                                </div>

                                {/* Amazon Best Seller */}
                                {r.amazonBestSeller && r.amazonBestSeller.title && (
                                    <div className="bg-card border border-card-border rounded-2xl p-5">
                                        <div className="text-[10px] font-bold uppercase tracking-widest text-muted mb-3">🏆 Amazon Best Seller en esta Categoría</div>
                                        <div className="p-4 bg-background border border-card-border rounded-xl">
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="font-bold text-[13px]">{r.amazonBestSeller.title}</span>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono text-[13px] font-bold text-emerald-400">{r.amazonBestSeller.price}</span>
                                                    <span className="text-[10px] text-yellow-400">⭐ {r.amazonBestSeller.rating}</span>
                                                </div>
                                            </div>
                                            <a href={r.amazonBestSeller.url} target="_blank" rel="noopener" className="text-[10px] text-accent hover:underline truncate block mb-2">{r.amazonBestSeller.url}</a>
                                            <p className="text-[11px] text-muted">{r.amazonBestSeller.whyBest}</p>
                                        </div>
                                    </div>
                                )}

                                {/* Row 4: Keywords */}
                                <div className="bg-card border border-card-border rounded-2xl p-5">
                                    <div className="text-[10px] font-bold uppercase tracking-widest text-muted mb-3">🔑 20 Keywords Relacionadas</div>
                                    <div className="flex flex-wrap gap-2">{r.keywords.map((k,i) => <span key={i} className="text-[11px] px-3 py-1.5 rounded-lg bg-hover-bg border border-card-border text-muted hover:text-foreground hover:border-accent/30 transition-all cursor-default">{k}</span>)}</div>
                                </div>

                                {/* Row 5: Pain Points + Ad Angles */}
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                    <div className="bg-card border border-card-border rounded-2xl p-5">
                                        <div className="text-[10px] font-bold uppercase tracking-widest text-muted mb-3">🔥 Pain Points del Mercado</div>
                                        {r.painPoints.map((p,i) => <div key={i} className="flex items-start gap-2 text-[12px] py-1"><AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" /><span className="text-muted">{p}</span></div>)}
                                    </div>
                                    <div className="bg-card border border-card-border rounded-2xl p-5">
                                        <div className="text-[10px] font-bold uppercase tracking-widest text-muted mb-3">⚡ Ángulos para Ads</div>
                                        {r.adAngles.map((a,i) => <div key={i} className="flex items-start gap-2 text-[12px] py-1"><Zap className="w-4 h-4 text-accent shrink-0 mt-0.5" /><span className="text-muted">{a}</span></div>)}
                                    </div>
                                </div>

                                {/* Target Audience */}
                                <div className="bg-card border border-card-border rounded-2xl p-5">
                                    <div className="text-[10px] font-bold uppercase tracking-widest text-muted mb-2">🎯 Público Objetivo</div>
                                    <p className="text-[12px] text-muted leading-relaxed">{r.targetAudience}</p>
                                </div>

                                {/* Ad Scripts (Guiones) */}
                                {r.adScripts && r.adScripts.length > 0 && (
                                    <div className="bg-card border border-card-border rounded-2xl p-5">
                                        <div className="text-[10px] font-bold uppercase tracking-widest text-muted mb-3">🎬 Guiones Publicitarios</div>
                                        <div className="space-y-3">
                                            {r.adScripts.map((script, i) => (
                                                <div key={i} className="p-4 bg-background border border-card-border rounded-xl">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <span className="text-[10px] font-bold text-accent bg-accent/10 px-2 py-0.5 rounded">#{i + 1}</span>
                                                        <span className="text-[12px] font-bold">{script.angle}</span>
                                                    </div>
                                                    <div className="space-y-1.5 text-[11px]">
                                                        <div><span className="font-bold text-yellow-400">HOOK:</span> <span className="text-muted">{script.hook}</span></div>
                                                        <div><span className="font-bold text-blue-400">BODY:</span> <span className="text-muted">{script.body}</span></div>
                                                        <div><span className="font-bold text-emerald-400">CTA:</span> <span className="text-muted">{script.cta}</span></div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Offer Suggestions */}
                                {r.offerSuggestions && r.offerSuggestions.length > 0 && (
                                    <div className="bg-card border border-card-border rounded-2xl p-5">
                                        <div className="text-[10px] font-bold uppercase tracking-widest text-muted mb-3">🎁 Ofertas Sugeridas (Grand Slam Offer)</div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                            {r.offerSuggestions.map((offer, i) => {
                                                const typeIcons: Record<string, string> = { bundle: '📦', gift: '🎁', guarantee: '🛡️', discount: '💰', urgency: '⏰', guide: '📚', bonus: '⭐' };
                                                return (
                                                    <div key={i} className="p-3 bg-background border border-card-border rounded-xl">
                                                        <div className="flex items-center gap-2 mb-1.5">
                                                            <span className="text-lg">{typeIcons[offer.type] || '💡'}</span>
                                                            <div>
                                                                <div className="text-[12px] font-bold">{offer.name}</div>
                                                                <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-accent/10 text-accent uppercase">{offer.type}</span>
                                                            </div>
                                                        </div>
                                                        <p className="text-[10px] text-muted leading-relaxed">{offer.description}</p>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* CTA */}
                                <button onClick={() => {
                                    // Store research data for Pipeline to pick up
                                    sessionStorage.setItem('pipeline_research', JSON.stringify({
                                        productName: selectedResearch.productName,
                                        niche: selectedResearch.niche,
                                        referenceUrl: selectedResearch.referenceUrl,
                                        productUrl: selectedResearch.productUrl,
                                        productImages: selectedResearch.productImages,
                                        adAngles: r.adAngles,
                                        targetAudience: r.targetAudience,
                                        buyerPersona: r.buyerPersona,
                                    }));
                                    window.location.href = `/pipeline?niche=${selectedResearch.niche}&from=research`;
                                }} className="flex items-center justify-center gap-2 px-5 py-3 bg-accent hover:bg-orange-600 text-white rounded-xl font-bold text-[11px] uppercase tracking-wider transition-all shadow-lg shadow-accent/25 w-full">
                                    <Zap className="w-4 h-4" /> Generar Creativos en Pipeline
                                </button>
                                <button onClick={() => window.print()}
                                    className="flex items-center justify-center gap-2 px-5 py-3 bg-card border border-card-border hover:bg-hover-bg text-foreground rounded-xl font-bold text-[11px] uppercase tracking-wider transition-all w-full">
                                    <Download className="w-4 h-4" /> Descargar PDF
                                </button>
                            </div>
                            </>); })() : (
                            <div className="space-y-4">
                                {/* New research form */}
                                <div className="bg-card border border-card-border rounded-2xl p-5 space-y-4">
                                    <div className="flex items-center gap-2 mb-1">
                                        <AgentAvatar agentId="pythagoras" size="md" />
                                        <div>
                                            <div className="text-sm font-bold" style={{ color: '#AA77FF' }}>Pythagoras</div>
                                            <div className="text-[10px] text-muted">Market Research Agent</div>
                                        </div>
                                    </div>

                                    <div>
                                        <div className="text-[10px] font-bold uppercase tracking-widest text-muted mb-1.5">Nombre del Producto</div>
                                        <input type="text" value={researchForm.productName}
                                            onChange={e => setResearchForm(f => ({ ...f, productName: e.target.value }))}
                                            placeholder="Ej: Creatina Monohidratada 500g"
                                            className="w-full bg-background border border-card-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted/30 focus:border-accent/50 focus:outline-none" />
                                    </div>
                                    <div>
                                        <div className="text-[10px] font-bold uppercase tracking-widest text-muted mb-1.5">Link de Referencia</div>
                                        <input type="url" value={researchForm.referenceUrl}
                                            onChange={e => setResearchForm(f => ({ ...f, referenceUrl: e.target.value }))}
                                            placeholder="https://amazon.com/producto..."
                                            className="w-full bg-background border border-card-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted/30 focus:border-accent/50 focus:outline-none" />
                                    </div>
                                    <div>
                                        <div className="text-[10px] font-bold uppercase tracking-widest text-muted mb-1.5">Link del Producto</div>
                                        <input type="url" value={researchForm.productUrl}
                                            onChange={e => setResearchForm(f => ({ ...f, productUrl: e.target.value }))}
                                            placeholder="https://aliexpress.com/item..."
                                            className="w-full bg-background border border-card-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted/30 focus:border-accent/50 focus:outline-none" />
                                    </div>
                                    <div>
                                        <div className="text-[10px] font-bold uppercase tracking-widest text-muted mb-1.5">País Objetivo</div>
                                        <div className="grid grid-cols-3 gap-2">
                                            {['Colombia', 'México', 'Ecuador', 'Guatemala', 'Perú', 'Chile'].map(c => (
                                                <button key={c} onClick={() => setResearchForm(f => ({ ...f, country: c }))}
                                                    className={`py-2 rounded-xl border text-[11px] font-semibold transition-all ${researchForm.country === c ? 'bg-[#AA77FF]/10 border-[#AA77FF]/30 text-[#AA77FF]' : 'border-card-border text-muted hover:border-[#AA77FF]/20'}`}>
                                                    {c}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {researchError && (
                                        <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">
                                            <AlertCircle className="w-4 h-4 shrink-0" /> {researchError}
                                        </div>
                                    )}

                                    <button onClick={handleRunResearch}
                                        disabled={researchRunning || !researchForm.productName || (!researchForm.referenceUrl && !researchForm.productUrl)}
                                        className="w-full py-3 bg-[#AA77FF] hover:bg-[#9966EE] disabled:bg-muted/10 disabled:text-muted/40 text-white rounded-xl font-bold text-[11px] uppercase tracking-wider transition-all shadow-lg shadow-[#AA77FF]/25 flex items-center justify-center gap-2">
                                        {researchRunning ? <><Loader2 className="w-4 h-4 animate-spin" /> Investigando... (30-60s)</> : <><Microscope className="w-4 h-4" /> Investigar Producto</>}
                                    </button>
                                </div>

                                {/* Research list */}
                                {researches.length > 0 && (
                                    <div>
                                        <input type="text" value={researchSearch} onChange={e => setResearchSearch(e.target.value)}
                                            placeholder="Buscar investigación..."
                                            className="w-full bg-background border border-card-border rounded-xl px-4 py-2 text-sm text-foreground placeholder:text-muted/30 focus:border-accent/50 focus:outline-none mb-3" />
                                        <div className="text-[10px] font-bold uppercase tracking-widest text-muted mb-3">Investigaciones Guardadas</div>
                                        <div className="space-y-2">
                                            {researches.filter(r => !researchSearch || r.productName.toLowerCase().includes(researchSearch.toLowerCase())).map(r => (
                                                <div key={r.id} onClick={() => setSelectedResearch(r)}
                                                    className="bg-card border border-card-border rounded-xl p-4 cursor-pointer hover:border-accent/30 transition-all flex items-center gap-4">
                                                    <AgentAvatar agentId="pythagoras" />
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-[13px] font-semibold truncate">{r.productName}</div>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            {r.niche && <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-[#AA77FF]/10 text-[#AA77FF] border border-[#AA77FF]/15 uppercase">{r.niche}</span>}
                                                            <span className="text-[10px] text-muted font-mono">{new Date(r.createdAt).toLocaleDateString('es-CO')}</span>
                                                        </div>
                                                    </div>
                                                    {r.report && (
                                                        <>
                                                            <span className="font-mono text-[14px] font-bold" style={{ color: r.report.scorecard.total >= 7 ? '#00FF88' : r.report.scorecard.total >= 5 ? '#FFD700' : '#FF3366' }}>
                                                                {r.report.scorecard.total.toFixed(1)}
                                                            </span>
                                                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${
                                                                r.report.recommendation === 'GO' ? 'bg-emerald-400/15 text-emerald-400' :
                                                                r.report.recommendation === 'NO_GO' ? 'bg-red-400/15 text-red-400' :
                                                                'bg-yellow-400/15 text-yellow-400'
                                                            }`}>{r.report.recommendation === 'GO' ? 'GO' : r.report.recommendation === 'NO_GO' ? 'NO GO' : 'INVESTIGAR'}</span>
                                                        </>
                                                    )}
                                                    {r.status === 'failed' && <span className="text-[9px] text-red-400">Error</span>}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'recurring' && (
                    <div className="bg-card border border-card-border rounded-2xl p-8 text-center">
                        <Clock className="w-8 h-8 mx-auto mb-3 text-muted/20" />
                        <p className="text-sm text-muted">Las tareas recurrentes se configurarán en la Fase 2 cuando los agentes estén conectados.</p>
                    </div>
                )}
            </div>

            {/* ═══ DETAIL PANEL ═══ */}
            {selectedTask && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-end" onClick={() => setSelectedTask(null)}>
                    <div className="w-[680px] h-full bg-card border-l border-card-border flex flex-col animate-in slide-in-from-right duration-300" onClick={e => e.stopPropagation()}>
                        {/* Top bar */}
                        <div className="flex items-center justify-between px-5 py-3 border-b border-card-border shrink-0">
                            <div className="flex items-center gap-2">
                                <span className="text-[9px] text-muted/30 tracking-widest uppercase">Tarea</span>
                                <div className="w-2 h-2 rounded-full" style={{ background: getStatusInfo(selectedTask.status)?.color || '#666' }} />
                                <span className="text-[10px] font-semibold" style={{ color: getStatusInfo(selectedTask.status)?.color }}>{getStatusInfo(selectedTask.status)?.label}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={() => handleDeleteTask(selectedTask.id)} className="w-7 h-7 rounded-lg border border-card-border flex items-center justify-center text-muted hover:text-red-400 hover:border-red-400/30 transition-all">
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => setSelectedTask(null)} className="w-7 h-7 rounded-lg border border-card-border flex items-center justify-center text-muted hover:text-red-400 hover:border-red-400/30 transition-all">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* Scrollable content */}
                        <div className="flex-1 overflow-y-auto">
                            <div className="px-5 py-4">
                                {/* Title */}
                                <input
                                    className="text-lg font-bold bg-transparent border-none outline-none w-full mb-4 text-foreground"
                                    value={selectedTask.name}
                                    onChange={e => setSelectedTask({ ...selectedTask, name: e.target.value })}
                                    onBlur={() => handleSaveTask(selectedTask)}
                                />

                                {/* Fields */}
                                <div className="text-[9px] font-bold uppercase tracking-widest text-muted/30 mb-2">Campos</div>

                                {/* Status */}
                                <div className="grid grid-cols-[140px_1fr] items-center py-2 border-b border-card-border/20 text-[12px]">
                                    <span className="text-muted flex items-center gap-1.5"><span className="opacity-40">&#9745;</span> Estado</span>
                                    <select className="bg-background border border-card-border rounded-lg px-2 py-1 text-[11px] outline-none appearance-none text-foreground"
                                        value={selectedTask.status}
                                        onChange={e => handleSaveTask({ ...selectedTask, status: e.target.value as TaskStatus })}>
                                        {TASK_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                                    </select>
                                </div>

                                {/* Assignees */}
                                <div className="grid grid-cols-[140px_1fr] items-center py-2 border-b border-card-border/20 text-[12px]">
                                    <span className="text-muted flex items-center gap-1.5"><Users className="w-3 h-3 opacity-40" /> Asignados</span>
                                    <div className="flex items-center gap-1 flex-wrap">
                                        {selectedTask.assignees.map((a, i) => (
                                            <span key={i} className="flex items-center gap-1 px-2 py-0.5 bg-hover-bg border border-card-border rounded-full text-[10px]">
                                                <PersonAvatar name={a} /> {a}
                                            </span>
                                        ))}
                                        {selectedTask.agentId && <span className="flex items-center gap-1 px-2 py-0.5 bg-hover-bg border border-card-border rounded-full text-[10px]"><AgentAvatar agentId={selectedTask.agentId} /> {getAgent(selectedTask.agentId)?.name}</span>}
                                    </div>
                                </div>

                                {/* Store */}
                                <div className="grid grid-cols-[140px_1fr] items-center py-2 border-b border-card-border/20 text-[12px]">
                                    <span className="text-muted flex items-center gap-1.5"><span className="opacity-40">&#127979;</span> Tiendas</span>
                                    <select className="bg-background border border-card-border rounded-lg px-2 py-1 text-[11px] outline-none appearance-none text-foreground"
                                        value={selectedTask.store}
                                        onChange={e => handleSaveTask({ ...selectedTask, store: e.target.value })}>
                                        <option value="">— Sin tienda —</option>
                                        {STORES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                                    </select>
                                </div>

                                {/* Product */}
                                <div className="grid grid-cols-[140px_1fr] items-center py-2 border-b border-card-border/20 text-[12px]">
                                    <span className="text-muted flex items-center gap-1.5"><span className="opacity-40">&#128230;</span> Producto</span>
                                    <input className="bg-background border border-card-border rounded-lg px-2 py-1 text-[11px] outline-none text-foreground w-full"
                                        value={selectedTask.product} placeholder="Nombre del producto..."
                                        onChange={e => setSelectedTask({ ...selectedTask, product: e.target.value })}
                                        onBlur={() => handleSaveTask(selectedTask)} />
                                </div>

                                {/* Progress */}
                                <div className="grid grid-cols-[140px_1fr] items-center py-2 border-b border-card-border/20 text-[12px]">
                                    <span className="text-muted flex items-center gap-1.5"><span className="opacity-40">&#128200;</span> Progreso</span>
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1 h-1.5 bg-card-border/30 rounded-full overflow-hidden">
                                            <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${selectedTask.progress}%` }} />
                                        </div>
                                        <span className="font-mono text-[10px] text-muted">{selectedTask.progress}%</span>
                                    </div>
                                </div>

                                {/* Tipo Actividad */}
                                <div className="grid grid-cols-[140px_1fr] items-center py-2 border-b border-card-border/20 text-[12px]">
                                    <span className="text-muted flex items-center gap-1.5"><span className="opacity-40">&#127919;</span> Tipo actividad</span>
                                    <select className="bg-background border border-card-border rounded-lg px-2 py-1 text-[11px] outline-none appearance-none text-foreground"
                                        value={selectedTask.tipoActividad}
                                        onChange={e => handleSaveTask({ ...selectedTask, tipoActividad: e.target.value })}>
                                        <option value="">—</option>
                                        {TIPO_ACTIVIDADES.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>

                                {/* Link Drive */}
                                <div className="grid grid-cols-[140px_1fr] items-center py-2 border-b border-card-border/20 text-[12px]">
                                    <span className="text-muted flex items-center gap-1.5"><ExternalLink className="w-3 h-3 opacity-40" /> Link Drive</span>
                                    <input className="bg-background border border-card-border rounded-lg px-2 py-1 text-[11px] outline-none text-foreground w-full"
                                        value={selectedTask.linkDrive} placeholder="URL..."
                                        onChange={e => setSelectedTask({ ...selectedTask, linkDrive: e.target.value })}
                                        onBlur={() => handleSaveTask(selectedTask)} />
                                </div>

                                {/* Ref Video */}
                                <div className="grid grid-cols-[140px_1fr] items-center py-2 border-b border-card-border/20 text-[12px]">
                                    <span className="text-muted flex items-center gap-1.5"><span className="opacity-40">&#127909;</span> Ref. Video</span>
                                    <input className="bg-background border border-card-border rounded-lg px-2 py-1 text-[11px] outline-none text-foreground w-full"
                                        value={selectedTask.refVideo} placeholder="URL video referencia..."
                                        onChange={e => setSelectedTask({ ...selectedTask, refVideo: e.target.value })}
                                        onBlur={() => handleSaveTask(selectedTask)} />
                                </div>

                                {/* Ref Landing */}
                                <div className="grid grid-cols-[140px_1fr] items-center py-2 border-b border-card-border/20 text-[12px]">
                                    <span className="text-muted flex items-center gap-1.5"><span className="opacity-40">&#127760;</span> Ref. Landing</span>
                                    <input className="bg-background border border-card-border rounded-lg px-2 py-1 text-[11px] outline-none text-foreground w-full"
                                        value={selectedTask.refLanding} placeholder="URL landing referencia..."
                                        onChange={e => setSelectedTask({ ...selectedTask, refLanding: e.target.value })}
                                        onBlur={() => handleSaveTask(selectedTask)} />
                                </div>

                                {/* Cuenta Publicitaria */}
                                <div className="grid grid-cols-[140px_1fr] items-center py-2 border-b border-card-border/20 text-[12px]">
                                    <span className="text-muted flex items-center gap-1.5"><span className="opacity-40">&#128196;</span> Cuenta Publi.</span>
                                    <input className="bg-background border border-card-border rounded-lg px-2 py-1 text-[11px] outline-none text-foreground w-full"
                                        value={selectedTask.cuentaPublicitaria} placeholder="Cuenta publicitaria..."
                                        onChange={e => setSelectedTask({ ...selectedTask, cuentaPublicitaria: e.target.value })}
                                        onBlur={() => handleSaveTask(selectedTask)} />
                                </div>

                                {/* Description */}
                                <textarea
                                    className="w-full bg-background border border-card-border rounded-xl p-3 mt-3 text-[12px] text-muted leading-relaxed outline-none resize-none min-h-[60px]"
                                    value={selectedTask.description}
                                    placeholder="Añade una descripción..."
                                    onChange={e => setSelectedTask({ ...selectedTask, description: e.target.value })}
                                    onBlur={() => handleSaveTask(selectedTask)}
                                />

                                {/* Subtasks */}
                                <div className="mt-4">
                                    <div className="text-[9px] font-bold uppercase tracking-widest text-muted/30 mb-2">
                                        Subtareas <span className="text-muted">{selectedTask.subtasks.filter(s => s.done).length}/{selectedTask.subtasks.length}</span>
                                    </div>
                                    {selectedTask.subtasks.map(sub => (
                                        <div key={sub.id} className="flex items-center gap-2 py-1.5 px-2 border border-card-border rounded-lg mb-1 hover:bg-hover-bg transition-all">
                                            <button onClick={() => handleToggleSubtask(sub.id)}
                                                className={`w-4 h-4 rounded shrink-0 border-2 flex items-center justify-center text-[8px] transition-all ${sub.done ? 'border-emerald-400 bg-emerald-400/15 text-emerald-400' : 'border-muted/30 text-transparent'}`}>
                                                &#10003;
                                            </button>
                                            <span className={`text-[12px] flex-1 ${sub.done ? 'line-through text-muted' : ''}`}>{sub.text}</span>
                                            {sub.assigneeType === 'agent' ? <AgentAvatar agentId={sub.assignee} /> : <PersonAvatar name={sub.assignee} />}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Detail tabs */}
                            <div className="flex gap-0.5 px-5 border-t border-b border-card-border">
                                {(['activity', 'comments', 'files'] as const).map(tab => (
                                    <button key={tab} onClick={() => setDetailTab(tab)}
                                        className={`px-3 py-2.5 text-[11px] font-semibold border-b-2 transition-all ${detailTab === tab ? 'text-accent border-accent' : 'text-muted border-transparent'}`}>
                                        {tab === 'activity' ? 'Actividad' : tab === 'comments' ? `Comentarios (${selectedTask.comments.length})` : `Archivos (${selectedTask.files.length})`}
                                    </button>
                                ))}
                            </div>

                            {/* Activity */}
                            {detailTab === 'activity' && (
                                <div className="px-5 py-4">
                                    {selectedTask.activity.length === 0 && <div className="text-[11px] text-muted/40 text-center py-4">Sin actividad registrada</div>}
                                    <div className="relative pl-4">
                                        {selectedTask.activity.length > 0 && <div className="absolute left-1.5 top-2 bottom-2 w-px bg-card-border" />}
                                        {selectedTask.activity.map(act => (
                                            <div key={act.id} className="relative flex gap-2 py-2">
                                                <div className="w-2 h-2 rounded-full absolute -left-[11px] top-3 z-10" style={{ background: act.type === 'agent' ? (getAgent(act.agentOrPerson)?.color || '#888') : '#4A9EFF' }} />
                                                <div className="text-[11px] text-muted leading-relaxed flex-1">
                                                    <strong className="text-foreground">{act.agentOrPerson}</strong> {act.text}
                                                </div>
                                                <span className="font-mono text-[9px] text-muted/30 shrink-0">{timeAgo(act.timestamp)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Comments */}
                            {detailTab === 'comments' && (
                                <div className="px-5 py-4 space-y-3">
                                    {selectedTask.comments.map(cmt => (
                                        <div key={cmt.id}>
                                            <div className="flex items-center gap-2 mb-1">
                                                {cmt.authorType === 'agent' ? <AgentAvatar agentId={cmt.author} /> : <PersonAvatar name={cmt.author} />}
                                                <span className="text-[11px] font-semibold">{cmt.author}</span>
                                                <span className="font-mono text-[9px] text-muted/30">{timeAgo(cmt.timestamp)}</span>
                                            </div>
                                            <div className="text-[12px] text-muted leading-relaxed px-3 py-2 bg-background border border-card-border rounded-lg">{cmt.text}</div>
                                        </div>
                                    ))}
                                    <div className="flex gap-2 pt-3 border-t border-card-border">
                                        <PersonAvatar name="GM" size="md" />
                                        <textarea className="flex-1 bg-background border border-card-border rounded-lg px-3 py-2 text-[12px] outline-none resize-none text-foreground placeholder:text-muted/30"
                                            value={newComment} onChange={e => setNewComment(e.target.value)}
                                            placeholder="Escribe un comentario..." rows={1} />
                                        <button onClick={handleAddComment} className="px-3 py-1.5 bg-accent text-white rounded-lg text-[11px] font-bold shrink-0">
                                            <Send className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Files */}
                            {detailTab === 'files' && (
                                <div className="px-5 py-4 space-y-2">
                                    {selectedTask.files.map(file => (
                                        <div key={file.id} className="flex items-center gap-2 p-2 bg-background border border-card-border rounded-lg hover:bg-hover-bg transition-all">
                                            <div className="w-8 h-8 rounded-lg bg-hover-bg flex items-center justify-center text-sm">
                                                <Paperclip className="w-4 h-4 text-muted/40" />
                                            </div>
                                            <div className="flex-1">
                                                <div className="text-[11px] font-semibold">{file.name}</div>
                                                <div className="text-[9px] text-muted/30">{file.uploadedBy} · {file.size}</div>
                                            </div>
                                        </div>
                                    ))}
                                    <div className="mt-2 p-4 border-2 border-dashed border-card-border rounded-xl text-center text-[11px] text-muted/30 cursor-pointer hover:border-accent/30 transition-all">
                                        Arrastra archivos o <span className="text-accent">click para subir</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ═══ FLOWCHART MODAL ═══ */}
            {flowTemplate && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center" onClick={() => setFlowTemplate(null)}>
                    <div className="bg-card border border-card-border rounded-2xl w-[820px] max-h-[88vh] overflow-y-auto shadow-2xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between px-5 py-4 border-b border-card-border">
                            <div className="flex items-center gap-3">
                                <AgentAvatar agentId={flowTemplate.agentId} size="md" />
                                <div>
                                    <div className="font-bold text-[14px]">{flowTemplate.name}</div>
                                    <div className="text-[10px] text-muted">{getAgent(flowTemplate.agentId)?.name} · {flowTemplate.steps.length} pasos</div>
                                </div>
                            </div>
                            <button onClick={() => setFlowTemplate(null)} className="w-7 h-7 rounded-lg border border-card-border flex items-center justify-center text-muted hover:text-red-400 hover:border-red-400/30 transition-all">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="p-5">
                            <div className="relative pl-7">
                                {flowTemplate.steps.map((step, i) => {
                                    const stepAgent = getAgent(step.agentId);
                                    return (
                                        <div key={i} className="relative mb-2">
                                            {/* Connector line */}
                                            {i < flowTemplate.steps.length - 1 && (
                                                <div className="absolute -left-[15px] top-8 bottom-[-8px] w-px bg-card-border" />
                                            )}
                                            {/* Step number */}
                                            <div className="absolute -left-7 top-3 w-5 h-5 rounded-md flex items-center justify-center font-mono text-[8px] font-bold text-white z-10"
                                                style={{ background: `linear-gradient(135deg, ${stepAgent?.color}, ${stepAgent?.color}99)` }}>
                                                {i + 1}
                                            </div>
                                            <div className="bg-background border border-card-border rounded-xl p-3 hover:border-accent/30 transition-all">
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="font-bold text-[12px]">{step.name}</span>
                                                    <div className="flex items-center gap-1 text-[9px] text-muted">
                                                        {stepAgent && <AgentAvatar agentId={stepAgent.id} />}
                                                        {stepAgent?.name}
                                                    </div>
                                                </div>
                                                <div className="text-[10px] text-muted leading-relaxed">{step.description}</div>
                                                <div className="flex flex-wrap gap-1 mt-2">
                                                    {step.outputs.map((o, j) => (
                                                        <span key={j} className="font-mono text-[8px] px-1.5 py-0.5 rounded bg-hover-bg border border-card-border text-muted">{o}</span>
                                                    ))}
                                                </div>
                                                {step.delegatedTo && (
                                                    <div className="mt-2 px-2 py-1.5 bg-yellow-400/[0.06] border border-yellow-400/10 rounded-lg text-[10px] text-yellow-400 flex items-center gap-1.5">
                                                        <Users className="w-3 h-3" /> → <strong>{step.delegatedTo.person}</strong>: {step.delegatedTo.task}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="flex items-center justify-between px-5 py-3 border-t border-card-border">
                            <div className="text-[10px] text-muted">
                                <strong className="text-foreground">Outputs:</strong> {flowTemplate.steps.flatMap(s => s.outputs).join(', ')}
                            </div>
                            <button className="px-5 py-2 bg-accent hover:bg-orange-600 text-white rounded-xl font-bold text-[11px] uppercase tracking-wider transition-all shadow-lg shadow-accent/25">
                                Ejecutar Flujo
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
