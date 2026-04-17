'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    LayoutDashboard,
    Map as MapIcon,
    Settings,
    LogOut,
    Upload,
    Globe,
    Zap,
    Rocket,
    Wallet,
    Bot,
    ChevronLeft,
    ChevronRight,
    ChevronDown,
    Sun,
    Moon,
    Lock,
    Package,
    ListTodo,
    Search,
    MessageSquare,
    FileText,
    Calendar,
    type LucideIcon
} from 'lucide-react';
import { useAuth } from '@/lib/context/AuthContext';
import { useTheme } from '@/lib/context/ThemeContext';
import type { UserProfile } from '@/lib/context/AuthContext';
import { getAllOrderFiles } from '@/lib/firebase/firestore';
import { isMatchingCountry } from '@/lib/utils/currency';
import { useSidebar } from '@/lib/context/SidebarContext';
import { usePlanAccess } from '@/lib/hooks/usePlanAccess';
import { db } from '@/lib/firebase/config';
import { collection, query, where, onSnapshot, orderBy, limit as fbLimit } from 'firebase/firestore';

interface NavItem {
    name: string;
    icon: LucideIcon;
    href: string;
    isotipo?: string;
    badge?: string;
}

interface NavSection {
    label: string;
    items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
    {
        label: 'Finanzas',
        items: [
            { name: 'Wheel', icon: LayoutDashboard, href: '/dashboard', isotipo: '/logos/wheel-isotipo.png' },
            { name: 'Berry', icon: Wallet, href: '/berry', isotipo: '/logos/berry-isotipo.png' },
            { name: 'Publicidad', icon: Zap, href: '/publicidad' },
            { name: 'Log Pose', icon: MapIcon, href: '/log-pose' },
        ],
    },
    {
        label: 'Operaciones',
        items: [
            { name: 'Sunny', icon: Rocket, href: '/sunny', isotipo: '/logos/sunny-isotipo.png' },
            { name: 'Vega AI', icon: Bot, href: '/vega-ai', isotipo: '/logos/vega-isotipo.png' },
            { name: 'Proveedor', icon: Package, href: '/proveedor' },
        ],
    },
    {
        label: 'Workspace',
        items: [
            { name: 'Tareas', icon: ListTodo, href: '/tareas' },
            { name: 'Docs', icon: FileText, href: '/docs' },
            { name: 'Chat', icon: MessageSquare, href: '/chat' },
            { name: 'Calendario', icon: Calendar, href: '/calendario' },
        ],
    },
];

const ALL_COUNTRIES = [
    { name: 'Colombia', code: 'CO', href: '/colombia', flag: '🇨🇴' },
    { name: 'Ecuador', code: 'EC', href: '/ecuador', flag: '🇪🇨' },
    { name: 'Panamá', code: 'PA', href: '/panama', flag: '🇵🇦' },
    { name: 'Guatemala', code: 'GT', href: '/guatemala', flag: '🇬🇹' },
    { name: 'México', code: 'MX', href: '/mexico', flag: '🇲🇽' },
    { name: 'Perú', code: 'PE', href: '/peru', flag: '🇵🇪' },
    { name: 'Chile', code: 'CL', href: '/chile', flag: '🇨🇱' },
    { name: 'Paraguay', code: 'PY', href: '/paraguay', flag: '🇵🇾' },
    { name: 'Argentina', code: 'AR', href: '/argentina', flag: '🇦🇷' },
    { name: 'España', code: 'ES', href: '/espana', flag: '🇪🇸' },
    { name: 'Costa Rica', code: 'CR', href: '/costa-rica', flag: '🇨🇷' },
];

export default function Sidebar() {
    const pathname = usePathname();
    const { user, profile, effectiveUid, signOut } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const { collapsed, toggleCollapsed } = useSidebar();
    const { canAccess } = usePlanAccess();
    const [activeCountries, setActiveCountries] = React.useState<typeof ALL_COUNTRIES>([]);
    const [loadingCountries, setLoadingCountries] = React.useState(true);

    // Collapsible sections — persist in localStorage
    const [collapsedSections, setCollapsedSections] = React.useState<Record<string, boolean>>(() => {
        if (typeof window === 'undefined') return {};
        try {
            const saved = localStorage.getItem('gl-sidebar-sections');
            return saved ? JSON.parse(saved) : {};
        } catch { return {}; }
    });

    const toggleSection = React.useCallback((label: string) => {
        setCollapsedSections(prev => {
            const next = { ...prev, [label]: !prev[label] };
            localStorage.setItem('gl-sidebar-sections', JSON.stringify(next));
            return next;
        });
    }, []);

    // ── Unread notifications ──
    const [unreadChat, setUnreadChat] = React.useState(0);
    const lastSeenRef = React.useRef(Date.now());

    React.useEffect(() => {
        if (!effectiveUid) return;
        // Listen to recent chat messages across all channels for this team
        const q = query(
            collection(db, 'chat_messages'),
            where('channel_id', '!=', ''),
            orderBy('channel_id'),
            orderBy('timestamp', 'desc'),
            fbLimit(50)
        );
        // Simpler approach: track last seen time and count newer messages
        const checkUnread = () => {
            const lastSeen = parseInt(localStorage.getItem('gl-chat-last-seen') || '0') || Date.now();
            lastSeenRef.current = lastSeen;
        };
        checkUnread();

        // Listen for new messages
        const unsub = onSnapshot(
            query(collection(db, 'chat_messages'), orderBy('timestamp', 'desc'), fbLimit(20)),
            (snap) => {
                const newMsgs = snap.docs.filter(d => {
                    const data = d.data();
                    return data.timestamp > lastSeenRef.current && data.author_uid !== user?.uid;
                });
                setUnreadChat(newMsgs.length);
            },
            () => {} // ignore errors silently
        );

        return () => unsub();
    }, [effectiveUid, user?.uid]);

    // Mark chat as seen when navigating to /chat
    React.useEffect(() => {
        if (pathname === '/chat') {
            localStorage.setItem('gl-chat-last-seen', String(Date.now()));
            lastSeenRef.current = Date.now();
            setUnreadChat(0);
        }
    }, [pathname]);

    React.useEffect(() => {
        async function loadActiveTerritories() {
            try {
                const files = await getAllOrderFiles(effectiveUid || '');
                const uniqueCountryHints = Array.from(new Set(files.map(f => f.country).filter(Boolean)));

                const filtered = ALL_COUNTRIES.filter(country =>
                    uniqueCountryHints.some(hint => isMatchingCountry(hint!, country.name))
                );

                setActiveCountries(filtered);
            } catch (error) {
                console.error('Error loading sidebar countries:', error);
            } finally {
                setLoadingCountries(false);
            }
        }
        loadActiveTerritories();
    }, []);

    const { mobileOpen, setMobileOpen } = useSidebar();

    // Close mobile sidebar on route change
    React.useEffect(() => {
        setMobileOpen(false);
    }, [pathname, setMobileOpen]);

    return (
        <>
        {/* Mobile overlay */}
        {mobileOpen && (
            <div className="fixed inset-0 bg-black/60 z-[59] md:hidden" onClick={() => setMobileOpen(false)} />
        )}
        <aside
            className={`
                ${collapsed ? 'w-16' : 'w-64'}
                bg-sidebar/95 backdrop-blur-xl border-r border-sidebar-border flex flex-col h-screen fixed left-0 top-0 z-[60] transition-all duration-300 ease-in-out overflow-hidden
                max-md:w-72 max-md:${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
            `}
            style={{ transform: typeof window !== 'undefined' && window.innerWidth < 768 ? (mobileOpen ? 'translateX(0)' : 'translateX(-100%)') : undefined }}
        >
            {/* Logo + Toggle */}
            <div className="p-4 border-b border-sidebar-border flex items-center justify-between shrink-0">
                {!collapsed && (
                    <div className="flex items-center gap-3 min-w-0">
                        <img src="/logos/grandline-isotipo.png" alt="Grand Line" className="w-7 h-7 shrink-0 hidden dark:block" />
                        <img src="/logos/grandline-isotipo-dark.png" alt="Grand Line" className="w-7 h-7 shrink-0 block dark:hidden" />
                        <div className="min-w-0">
                            <h1 className="text-sm font-bold tracking-tighter text-foreground">GRAND LINE</h1>
                            <p className="text-[10px] text-muted font-mono tracking-widest uppercase">Command Center</p>
                        </div>
                    </div>
                )}
                {collapsed && (
                    <div className="w-full flex justify-center">
                        <img src="/logos/grandline-isotipo.png" alt="Grand Line" className="w-6 h-6 hidden dark:block" />
                        <img src="/logos/grandline-isotipo-dark.png" alt="Grand Line" className="w-6 h-6 block dark:hidden" />
                    </div>
                )}
                <button
                    onClick={toggleCollapsed}
                    className={`shrink-0 w-7 h-7 rounded-lg bg-hover-bg border border-sidebar-border flex items-center justify-center text-muted hover:text-foreground hover:bg-hover-bg transition-all ${collapsed ? 'hidden' : 'ml-2'}`}
                    title={collapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
                >
                    <ChevronLeft className="w-3.5 h-3.5" />
                </button>
            </div>

            {/* Expand button when collapsed */}
            {collapsed && (
                <button
                    onClick={toggleCollapsed}
                    className="mx-auto mt-2 w-8 h-8 rounded-lg bg-hover-bg border border-sidebar-border flex items-center justify-center text-muted hover:text-foreground transition-all shrink-0"
                    title="Expandir sidebar"
                >
                    <ChevronRight className="w-3.5 h-3.5" />
                </button>
            )}

            {/* Search bar */}
            <div className="px-3 pt-3 pb-1 shrink-0">
                <button
                    onClick={() => {
                        window.dispatchEvent(new CustomEvent('open-global-search'));
                    }}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-sm transition-all bg-hover-bg/50 border border-sidebar-border hover:border-[#d75c33]/30 hover:bg-hover-bg text-muted hover:text-foreground/80 ${collapsed ? 'justify-center' : ''}`}
                    title={collapsed ? 'Buscar... (⌘K)' : undefined}
                >
                    <Search className="w-3.5 h-3.5 shrink-0" />
                    {!collapsed && (
                        <>
                            <span className="flex-1 text-left text-xs">Buscar...</span>
                            <kbd className="text-[10px] bg-background/50 px-1.5 py-0.5 rounded border border-sidebar-border font-mono">⌘K</kbd>
                        </>
                    )}
                </button>
            </div>

            {/* Navigation */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 space-y-4">
                {NAV_SECTIONS.map((section, sIdx) => {
                    const isSectionCollapsed = collapsedSections[section.label];
                    return (
                    <div key={section.label}>
                        {!collapsed && sIdx > 0 && <div className="border-t border-sidebar-border mb-2" />}
                        {!collapsed && (
                            <button
                                onClick={() => toggleSection(section.label)}
                                className="w-full flex items-center justify-between px-2 mb-1 group/label"
                            >
                                <span className="text-[10px] font-bold text-muted uppercase tracking-[0.2em]">
                                    {section.label}
                                </span>
                                <ChevronDown className={`w-3 h-3 text-muted/50 group-hover/label:text-muted transition-transform duration-200 ${isSectionCollapsed ? '-rotate-90' : ''}`} />
                            </button>
                        )}
                        {!isSectionCollapsed && (
                        <nav className="space-y-0.5">
                            {section.items.filter((item) => {
                                if ((profile as UserProfile)?.role === 'admin') return true;
                                const modules = (profile as UserProfile)?.allowed_modules;
                                if (!modules || modules.length === 0) return true;
                                return modules.includes(item.href.replace('/', ''));
                            }).map((item) => {
                                const moduleId = item.href.replace('/', '');
                                const isActive = pathname === item.href;
                                const isLocked = !canAccess(moduleId);
                                return (
                                    <Link
                                        key={item.name}
                                        href={item.href}
                                        title={collapsed ? item.name + (isLocked ? ' (Bloqueado)' : '') : undefined}
                                        className={`flex items-center gap-3 px-2.5 py-2 rounded-xl text-sm font-medium transition-all group ${isActive
                                            ? 'bg-[#d75c33]/10 text-[#d75c33] border border-[#d75c33]/20'
                                            : isLocked
                                                ? 'text-muted/50 hover:text-muted hover:bg-hover-bg/50 border border-transparent'
                                                : 'text-muted hover:text-foreground hover:bg-hover-bg border border-transparent'
                                            } ${collapsed ? 'justify-center' : ''}`}
                                    >
                                        {item.isotipo ? (
                                            <>
                                                <img src={item.isotipo} alt={item.name} className={`w-5 h-5 shrink-0 transition-opacity hidden dark:block ${isActive ? 'opacity-100' : isLocked ? 'opacity-20' : 'opacity-40 group-hover:opacity-70'}`} />
                                                <img src={item.isotipo.replace('.png', '-dark.png')} alt={item.name} className={`w-5 h-5 shrink-0 transition-opacity block dark:hidden ${isActive ? 'opacity-100' : isLocked ? 'opacity-20' : 'opacity-40 group-hover:opacity-70'}`} />
                                            </>
                                        ) : (
                                            <item.icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#d75c33]' : isLocked ? 'text-muted/40' : 'text-muted group-hover:text-foreground/80'}`} />
                                        )}
                                        {!collapsed && (
                                            <span className="truncate flex-1">{item.name}</span>
                                        )}
                                        {!collapsed && isLocked && (
                                            <Lock className="w-3 h-3 text-muted/40 shrink-0" />
                                        )}
                                        {item.href === '/chat' && unreadChat > 0 && (
                                            <span className="bg-[#d75c33] text-white text-[9px] font-bold min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1 shrink-0 animate-pulse">
                                                {unreadChat > 9 ? '9+' : unreadChat}
                                            </span>
                                        )}
                                    </Link>
                                );
                            })}
                        </nav>
                        )}
                    </div>
                    );
                })}

                {/* Logistica — hide if viewer doesn't have access */}
                {((profile as UserProfile)?.role === 'admin' || !(profile as UserProfile)?.allowed_modules?.length || (profile as UserProfile)?.allowed_modules?.includes('logistica')) && (
                <div>
                    {!collapsed && <div className="border-t border-sidebar-border mb-2" />}
                    {!collapsed && (
                        <button
                            onClick={() => toggleSection('Territorios')}
                            className="w-full flex items-center justify-between px-2 mb-1 group/label"
                        >
                            <span className="text-[10px] font-bold text-muted uppercase tracking-[0.2em]">
                                Logistica
                            </span>
                            <ChevronDown className={`w-3 h-3 text-muted/50 group-hover/label:text-muted transition-transform duration-200 ${collapsedSections['Logistica'] ? '-rotate-90' : ''}`} />
                        </button>
                    )}
                    {!collapsedSections['Logistica'] && (
                    <nav className="space-y-1">
                        {loadingCountries ? (
                            <div className="px-3 py-4 flex items-center justify-center">
                                <span className="text-[10px] text-gray-600 font-mono animate-pulse uppercase">
                                    {collapsed ? '...' : 'Sincronizando...'}
                                </span>
                            </div>
                        ) : activeCountries.length > 0 ? (
                            activeCountries.map((country) => {
                                const isActive = pathname.startsWith(country.href);
                                return (
                                    <Link
                                        key={country.name}
                                        href={`${country.href}/operacion`}
                                        title={collapsed ? country.name : undefined}
                                        className={`flex items-center justify-between px-2.5 py-2.5 rounded-xl text-sm font-medium transition-all group ${isActive
                                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                            : 'text-muted hover:text-foreground hover:bg-hover-bg border border-transparent'
                                            } ${collapsed ? 'justify-center' : ''}`}
                                    >
                                        <div className={`flex items-center gap-3 ${collapsed ? 'justify-center' : ''}`}>
                                            {collapsed ? (
                                                <span className="text-base">{country.flag}</span>
                                            ) : (
                                                <>
                                                    <Globe className={`w-4 h-4 shrink-0 ${isActive ? 'text-blue-400' : 'text-muted group-hover:text-foreground/80'}`} />
                                                    <span className="truncate">{country.name}</span>
                                                </>
                                            )}
                                        </div>
                                        {!collapsed && (
                                            <span className="text-[10px] bg-hover-bg px-1.5 py-0.5 rounded text-muted font-mono shrink-0">
                                                {country.code}
                                            </span>
                                        )}
                                    </Link>
                                );
                            })
                        ) : (
                            !collapsed && (
                                <div className="px-3 py-4 border border-dashed border-sidebar-border rounded-xl">
                                    <p className="text-[10px] text-muted italic leading-tight text-center">
                                        No hay territorios activos. Sube datos para activarlos.
                                    </p>
                                </div>
                            )
                        )}
                    </nav>
                    )}
                </div>
                )}
            </div>

            {/* Theme Toggle & External/Settings */}
            <div className={`border-t border-sidebar-border bg-sidebar shrink-0 ${collapsed ? 'p-2' : 'p-3'}`}>
                {/* Theme Toggle Button */}
                <button
                    onClick={toggleTheme}
                    className={`w-full flex items-center gap-3 px-2.5 py-2.5 rounded-xl text-sm font-medium transition-all mb-1 text-muted hover:text-foreground hover:bg-hover-bg border border-transparent ${collapsed ? 'justify-center' : ''}`}
                    title={collapsed ? `Cambiar a modo ${theme === 'dark' ? 'claro' : 'oscuro'}` : undefined}
                >
                    {theme === 'dark' ? <Sun className="w-4 h-4 shrink-0" /> : <Moon className="w-4 h-4 shrink-0" />}
                    {!collapsed && <span>Modo {theme === 'dark' ? 'Claro' : 'Oscuro'}</span>}
                </button>

                {((profile as UserProfile)?.role === 'admin' || !(profile as UserProfile)?.allowed_modules?.length || (profile as UserProfile)?.allowed_modules?.includes('import')) && (
                    <Link
                        href="/import"
                        title={collapsed ? 'Importar Datos' : undefined}
                        className={`flex items-center gap-3 px-2.5 py-2.5 rounded-xl text-sm font-medium transition-all mb-1 ${pathname === '/import'
                            ? 'bg-accent/10 text-accent border border-accent/20'
                            : 'text-muted hover:text-foreground hover:bg-hover-bg border border-transparent'
                            } ${collapsed ? 'justify-center' : ''}`}
                    >
                        <Upload className="w-4 h-4 shrink-0" />
                        {!collapsed && <span>Importar Datos</span>}
                    </Link>
                )}
                {(profile as UserProfile)?.role === 'admin' && (
                    <Link
                        href="/settings"
                        title={collapsed ? 'Configuracion' : undefined}
                        className={`flex items-center gap-3 px-2.5 py-2.5 rounded-xl text-sm font-medium transition-all mb-1 ${pathname === '/settings' || pathname === '/usuarios' || pathname === '/planes'
                            ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                            : 'text-muted hover:text-foreground hover:bg-hover-bg border border-transparent'
                            } ${collapsed ? 'justify-center' : ''}`}
                    >
                        <Settings className="w-4 h-4 shrink-0" />
                        {!collapsed && <span>Configuracion</span>}
                    </Link>
                )}

                {/* User avatar + logout */}
                {!collapsed && (
                    <div className="mt-3 flex items-center gap-3 px-2 py-2 border-t border-sidebar-border pt-3">
                        <Link href="/perfil" className="shrink-0">
                            {(profile as UserProfile)?.avatar_url ? (
                                <img src={(profile as UserProfile).avatar_url} alt="Avatar" className="w-8 h-8 rounded-full object-cover border border-sidebar-border" />
                            ) : (
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#d75c33] to-blue-500 flex items-center justify-center text-xs font-bold font-mono text-white">
                                    {user?.email?.charAt(0).toUpperCase() || 'A'}
                                </div>
                            )}
                        </Link>
                        <Link href="/perfil" className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-foreground truncate">
                                {(profile as UserProfile)?.display_name || user?.email?.split('@')[0] || 'Admiral'}
                            </p>
                            <p className="text-[10px] text-muted uppercase tracking-tighter">
                                {(profile as UserProfile)?.role || 'Viewer'} Mode
                            </p>
                        </Link>
                        <button
                            onClick={() => signOut()}
                            title="Cerrar Sesion"
                            className="p-1.5 rounded-lg text-muted hover:text-red-400 hover:bg-red-400/10 transition-all shrink-0"
                        >
                            <LogOut className="w-4 h-4" />
                        </button>
                    </div>
                )}

                {collapsed && (
                    <div className="mt-2 flex flex-col items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#d75c33] to-blue-500 flex items-center justify-center text-xs font-bold font-mono text-white"
                            title={user?.email || 'Admiral'}>
                            {user?.email?.charAt(0).toUpperCase() || 'A'}
                        </div>
                        <button
                            onClick={() => signOut()}
                            title="Cerrar Sesion"
                            className="p-1.5 rounded-lg text-muted hover:text-red-400 hover:bg-red-400/10 transition-all"
                        >
                            <LogOut className="w-3.5 h-3.5" />
                        </button>
                    </div>
                )}
            </div>
        </aside>
        </>
    );
}
