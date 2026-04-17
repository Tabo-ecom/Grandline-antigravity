'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
    Search,
    LayoutDashboard,
    Wallet,
    Zap,
    Map as MapIcon,
    Rocket,
    Bot,
    Package,
    ListTodo,
    FileText,
    MessageSquare,
    Calendar,
    Upload,
    Settings,
    Users,
    CreditCard,
    Globe,
    type LucideIcon,
} from 'lucide-react';

interface SearchItem {
    id: string;
    title: string;
    subtitle?: string;
    icon: LucideIcon;
    href: string;
    group: string;
    keywords?: string[];
}

const SEARCH_ITEMS: SearchItem[] = [
    // Analytics
    { id: 'wheel', title: 'Wheel — Dashboard', subtitle: 'KPIs, ventas, metricas', icon: LayoutDashboard, href: '/dashboard', group: 'Finanzas', keywords: ['dashboard', 'kpi', 'ventas', 'metricas', 'wheel'] },
    { id: 'berry', title: 'Berry — Finanzas', subtitle: 'P&L, gastos, utilidad', icon: Wallet, href: '/berry', group: 'Finanzas', keywords: ['berry', 'finanzas', 'pl', 'gastos', 'utilidad', 'perdidas'] },
    { id: 'publicidad', title: 'Publicidad', subtitle: 'Facebook Ads, TikTok Ads, ROAS', icon: Zap, href: '/publicidad', group: 'Finanzas', keywords: ['publicidad', 'ads', 'facebook', 'tiktok', 'roas', 'campanas'] },
    { id: 'logpose', title: 'Log Pose — Simulador', subtitle: 'Proyecciones, calculadora', icon: MapIcon, href: '/log-pose', group: 'Finanzas', keywords: ['log pose', 'simulador', 'proyecciones', 'calculadora'] },

    // Operaciones
    { id: 'sunny', title: 'Sunny — Lanzador', subtitle: 'Crear campanas Facebook', icon: Rocket, href: '/sunny', group: 'Operaciones', keywords: ['sunny', 'lanzador', 'campanas', 'crear', 'facebook'] },
    { id: 'vega', title: 'Vega AI', subtitle: 'Pythagoras, Edison, Shaka', icon: Bot, href: '/vega-ai', group: 'Operaciones', keywords: ['vega', 'ia', 'pythagoras', 'edison', 'shaka', 'investigacion', 'landing'] },
    { id: 'proveedor', title: 'Proveedor', subtitle: 'Gestion de proveedores', icon: Package, href: '/proveedor', group: 'Operaciones', keywords: ['proveedor', 'productos', 'inventario'] },

    // Workspace
    { id: 'tareas', title: 'Tareas', subtitle: 'Kanban, to-do, asignaciones', icon: ListTodo, href: '/tareas', group: 'Workspace', keywords: ['tareas', 'kanban', 'todo', 'pendientes'] },
    { id: 'docs', title: 'Docs', subtitle: 'Documentos, SOPs, wiki', icon: FileText, href: '/docs', group: 'Workspace', keywords: ['docs', 'documentos', 'wiki', 'sop', 'procesos'] },
    { id: 'chat', title: 'Chat', subtitle: 'Mensajes, canales, equipo', icon: MessageSquare, href: '/chat', group: 'Workspace', keywords: ['chat', 'mensajes', 'canales', 'equipo'] },
    { id: 'calendario', title: 'Calendario', subtitle: 'Eventos, reuniones, deadlines', icon: Calendar, href: '/calendario', group: 'Workspace', keywords: ['calendario', 'eventos', 'reuniones', 'deadlines', 'google meet'] },

    // Utilidades
    { id: 'import', title: 'Importar Datos', subtitle: 'Subir CSV/XLSX de Dropi', icon: Upload, href: '/import', group: 'Utilidades', keywords: ['importar', 'datos', 'csv', 'xlsx', 'dropi', 'subir'] },
    { id: 'settings', title: 'Configuracion', subtitle: 'Integraciones, API keys', icon: Settings, href: '/settings', group: 'Utilidades', keywords: ['configuracion', 'settings', 'api', 'keys', 'integraciones'] },
    { id: 'usuarios', title: 'Usuarios', subtitle: 'Equipo, roles, permisos', icon: Users, href: '/usuarios', group: 'Utilidades', keywords: ['usuarios', 'equipo', 'roles', 'permisos'] },
    { id: 'planes', title: 'Planes y Facturacion', subtitle: 'Suscripcion, Stripe', icon: CreditCard, href: '/planes', group: 'Utilidades', keywords: ['planes', 'facturacion', 'stripe', 'suscripcion', 'pago'] },
];

export default function GlobalSearch() {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const resultsRef = useRef<HTMLDivElement>(null);
    const router = useRouter();

    // Listen for custom event from sidebar button
    useEffect(() => {
        const handler = () => setOpen(true);
        window.addEventListener('open-global-search', handler);
        return () => window.removeEventListener('open-global-search', handler);
    }, []);

    // Cmd+K / Ctrl+K shortcut
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setOpen(prev => !prev);
            }
            if (e.key === 'Escape') {
                setOpen(false);
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, []);

    // Focus input when opened
    useEffect(() => {
        if (open) {
            setQuery('');
            setSelectedIndex(0);
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [open]);

    const filtered = React.useMemo(() => {
        if (!query.trim()) return SEARCH_ITEMS;
        const q = query.toLowerCase().trim();
        return SEARCH_ITEMS.filter(item =>
            item.title.toLowerCase().includes(q) ||
            item.subtitle?.toLowerCase().includes(q) ||
            item.keywords?.some(k => k.includes(q))
        );
    }, [query]);

    const grouped = React.useMemo(() => {
        const groups: Record<string, SearchItem[]> = {};
        for (const item of filtered) {
            if (!groups[item.group]) groups[item.group] = [];
            groups[item.group].push(item);
        }
        return groups;
    }, [filtered]);

    const flatList = filtered;

    const navigate = useCallback((item: SearchItem) => {
        setOpen(false);
        router.push(item.href);
    }, [router]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev => Math.min(prev + 1, flatList.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => Math.max(prev - 1, 0));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (flatList[selectedIndex]) navigate(flatList[selectedIndex]);
        }
    };

    // Scroll selected item into view
    useEffect(() => {
        if (resultsRef.current) {
            const el = resultsRef.current.querySelector(`[data-index="${selectedIndex}"]`);
            el?.scrollIntoView({ block: 'nearest' });
        }
    }, [selectedIndex]);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[15vh]">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={() => setOpen(false)}
            />

            {/* Modal */}
            <div className="relative w-full max-w-[640px] mx-4 bg-card border border-card-border rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 fade-in duration-150">
                {/* Search Input */}
                <div className="flex items-center gap-3 px-5 py-4 border-b border-card-border">
                    <Search className="w-5 h-5 text-muted shrink-0" />
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={e => { setQuery(e.target.value); setSelectedIndex(0); }}
                        onKeyDown={handleKeyDown}
                        placeholder="Buscar modulos, paginas, acciones..."
                        className="flex-1 bg-transparent border-none outline-none text-foreground placeholder:text-muted text-sm font-medium"
                    />
                    <kbd className="text-[10px] bg-hover-bg px-2 py-1 rounded border border-card-border font-mono text-muted">
                        ESC
                    </kbd>
                </div>

                {/* Results */}
                <div ref={resultsRef} className="max-h-[400px] overflow-y-auto py-2">
                    {flatList.length === 0 ? (
                        <div className="px-5 py-8 text-center">
                            <p className="text-sm text-muted">No se encontraron resultados para &quot;{query}&quot;</p>
                        </div>
                    ) : (
                        Object.entries(grouped).map(([group, items]) => (
                            <div key={group} className="px-2 mb-1">
                                <div className="px-3 py-1.5">
                                    <span className="text-[10px] font-bold text-muted uppercase tracking-[0.2em]">
                                        {group}
                                    </span>
                                </div>
                                {items.map(item => {
                                    const globalIdx = flatList.indexOf(item);
                                    const isSelected = globalIdx === selectedIndex;
                                    return (
                                        <button
                                            key={item.id}
                                            data-index={globalIdx}
                                            onClick={() => navigate(item)}
                                            onMouseEnter={() => setSelectedIndex(globalIdx)}
                                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${
                                                isSelected
                                                    ? 'bg-[#d75c33]/10 text-[#d75c33]'
                                                    : 'text-foreground hover:bg-hover-bg'
                                            }`}
                                        >
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                                isSelected ? 'bg-[#d75c33]/20' : 'bg-hover-bg'
                                            }`}>
                                                <item.icon className="w-4 h-4" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium truncate">{item.title}</p>
                                                {item.subtitle && (
                                                    <p className={`text-xs truncate ${isSelected ? 'text-[#d75c33]/60' : 'text-muted'}`}>
                                                        {item.subtitle}
                                                    </p>
                                                )}
                                            </div>
                                            {isSelected && (
                                                <kbd className="text-[10px] bg-[#d75c33]/20 text-[#d75c33] px-2 py-0.5 rounded font-mono shrink-0">
                                                    Enter
                                                </kbd>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        ))
                    )}
                </div>

                {/* Footer */}
                <div className="px-5 py-3 border-t border-card-border flex items-center gap-4 text-[10px] text-muted">
                    <span className="flex items-center gap-1"><kbd className="bg-hover-bg px-1.5 py-0.5 rounded border border-card-border font-mono">↑↓</kbd> Navegar</span>
                    <span className="flex items-center gap-1"><kbd className="bg-hover-bg px-1.5 py-0.5 rounded border border-card-border font-mono">Enter</kbd> Ir</span>
                    <span className="flex items-center gap-1"><kbd className="bg-hover-bg px-1.5 py-0.5 rounded border border-card-border font-mono">Esc</kbd> Cerrar</span>
                </div>
            </div>
        </div>
    );
}
