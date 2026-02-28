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
    Sun,
    Moon,
    Crown,
    Users
} from 'lucide-react';
import { useAuth } from '@/lib/context/AuthContext';
import { useTheme } from '@/lib/context/ThemeContext';
import type { UserProfile } from '@/lib/context/AuthContext';
import { getAllOrderFiles } from '@/lib/firebase/firestore';
import { isMatchingCountry } from '@/lib/utils/currency';
import { useSidebar } from '@/lib/context/SidebarContext';
import { usePlanAccess } from '@/lib/hooks/usePlanAccess';

const NAV_ITEMS = [
    { name: 'Wheel', icon: LayoutDashboard, href: '/dashboard', isotipo: '/logos/wheel-isotipo.png' },
    { name: 'Log Pose', icon: MapIcon, href: '/log-pose' },
    { name: 'Publicidad', icon: Zap, href: '/publicidad' },
    { name: 'Módulo Sunny', icon: Rocket, href: '/sunny', isotipo: '/logos/sunny-isotipo.png' },
    { name: 'Berry', icon: Wallet, href: '/berry', isotipo: '/logos/berry-isotipo.png' },
    { name: 'Vega AI', icon: Bot, href: '/vega-ai', isotipo: '/logos/vega-isotipo.png' },
];

const ALL_COUNTRIES = [
    { name: 'Colombia', code: 'CO', href: '/colombia', flag: '🇨🇴' },
    { name: 'Ecuador', code: 'EC', href: '/ecuador', flag: '🇪🇨' },
    { name: 'Panamá', code: 'PA', href: '/panama', flag: '🇵🇦' },
    { name: 'Guatemala', code: 'GT', href: '/guatemala', flag: '🇬🇹' },
];

export default function Sidebar() {
    const pathname = usePathname();
    const { user, profile, effectiveUid, signOut } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const { collapsed, toggleCollapsed } = useSidebar();
    const { canAccess } = usePlanAccess();
    const [activeCountries, setActiveCountries] = React.useState<typeof ALL_COUNTRIES>([]);
    const [loadingCountries, setLoadingCountries] = React.useState(true);

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

    return (
        <aside
            className={`${collapsed ? 'w-16' : 'w-64'} bg-sidebar/80 backdrop-blur-xl border-r border-sidebar-border flex flex-col h-screen fixed left-0 top-0 z-50 transition-all duration-300 ease-in-out overflow-hidden`}
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

            {/* Navigation */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 space-y-6">
                <div>
                    {!collapsed && (
                        <label className="text-[10px] font-bold text-muted uppercase tracking-[0.2em] mb-3 block px-2">
                            Main Fleet
                        </label>
                    )}
                    <nav className="space-y-1">
                        {NAV_ITEMS.filter((item) => {
                            const moduleId = item.href.replace('/', '');
                            // Plan-based access
                            if (!canAccess(moduleId)) return false;
                            // Viewer module restrictions
                            if ((profile as UserProfile)?.role === 'admin') return true;
                            const modules = (profile as UserProfile)?.allowed_modules;
                            if (!modules || modules.length === 0) return true;
                            return modules.includes(moduleId);
                        }).map((item) => {
                            const isActive = pathname === item.href;
                            return (
                                <Link
                                    key={item.name}
                                    href={item.href}
                                    title={collapsed ? item.name : undefined}
                                    className={`flex items-center gap-3 px-2.5 py-2.5 rounded-xl text-sm font-medium transition-all group ${isActive
                                        ? 'bg-[#d75c33]/10 text-[#d75c33] border border-[#d75c33]/20'
                                        : 'text-muted hover:text-foreground hover:bg-hover-bg border border-transparent'
                                        } ${collapsed ? 'justify-center' : ''}`}
                                >
                                    {item.isotipo ? (
                                        <>
                                            <img src={item.isotipo} alt={item.name} className={`w-5 h-5 shrink-0 transition-opacity hidden dark:block ${isActive ? 'opacity-100' : 'opacity-40 group-hover:opacity-70'}`} />
                                            <img src={item.isotipo.replace('.png', '-dark.png')} alt={item.name} className={`w-5 h-5 shrink-0 transition-opacity block dark:hidden ${isActive ? 'opacity-100' : 'opacity-40 group-hover:opacity-70'}`} />
                                        </>
                                    ) : (
                                        <item.icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#d75c33]' : 'text-muted group-hover:text-foreground/80'}`} />
                                    )}
                                    {!collapsed && <span className="truncate">{item.name}</span>}
                                </Link>
                            );
                        })}
                    </nav>
                </div>

                <div>
                    {!collapsed && (
                        <label className="text-[10px] font-bold text-muted uppercase tracking-[0.2em] mb-3 block px-2">
                            Territories
                        </label>
                    )}
                    {!collapsed && <div className="border-t border-sidebar-border mb-3" />}
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
                </div>
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

                {canAccess('import') && ((profile as UserProfile)?.role === 'admin' || !(profile as UserProfile)?.allowed_modules?.length || (profile as UserProfile)?.allowed_modules?.includes('import')) && (
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
                <Link
                    href="/planes"
                    title={collapsed ? 'Planes' : undefined}
                    className={`flex items-center gap-3 px-2.5 py-2.5 rounded-xl text-sm font-medium transition-all mb-1 ${pathname === '/planes'
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        : 'text-muted hover:text-foreground hover:bg-hover-bg border border-transparent'
                        } ${collapsed ? 'justify-center' : ''}`}
                >
                    <Crown className="w-4 h-4 shrink-0" />
                    {!collapsed && <span>Planes</span>}
                </Link>
                {(profile as UserProfile)?.role === 'admin' && (
                    <Link
                        href="/settings"
                        title={collapsed ? 'Configuración' : undefined}
                        className={`flex items-center gap-3 px-2.5 py-2.5 rounded-xl text-sm font-medium transition-all mb-1 ${pathname === '/settings'
                            ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                            : 'text-muted hover:text-foreground hover:bg-hover-bg border border-transparent'
                            } ${collapsed ? 'justify-center' : ''}`}
                    >
                        <Settings className="w-4 h-4 shrink-0" />
                        {!collapsed && <span>Configuración</span>}
                    </Link>
                )}
                {(profile as UserProfile)?.role === 'admin' && (
                    <Link
                        href="/usuarios"
                        title={collapsed ? 'Usuarios' : undefined}
                        className={`flex items-center gap-3 px-2.5 py-2.5 rounded-xl text-sm font-medium transition-all mb-1 ${pathname === '/usuarios'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'text-muted hover:text-foreground hover:bg-hover-bg border border-transparent'
                            } ${collapsed ? 'justify-center' : ''}`}
                    >
                        <Users className="w-4 h-4 shrink-0" />
                        {!collapsed && <span>Usuarios</span>}
                    </Link>
                )}
                <button
                    onClick={() => signOut()}
                    title={collapsed ? 'Cerrar Sesión' : undefined}
                    className={`w-full flex items-center gap-3 px-2.5 py-2.5 rounded-xl text-sm font-medium text-muted hover:text-red-400 hover:bg-red-400/5 transition-all group ${collapsed ? 'justify-center' : ''}`}
                >
                    <LogOut className="w-4 h-4 shrink-0 text-muted group-hover:text-red-400" />
                    {!collapsed && <span>Cerrar Sesión</span>}
                </button>

                {!collapsed && (
                    <div className="mt-3 flex items-center gap-3 px-2 py-2 border-t border-sidebar-border pt-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#d75c33] to-blue-500 flex items-center justify-center text-xs font-bold font-mono shrink-0 text-white">
                            {user?.email?.charAt(0).toUpperCase() || 'A'}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-foreground truncate">
                                {(profile as UserProfile)?.display_name || user?.email?.split('@')[0] || 'Admiral'}
                            </p>
                            <p className="text-[10px] text-muted uppercase tracking-tighter">
                                {(profile as UserProfile)?.role || 'Viewer'} Mode
                            </p>
                        </div>
                    </div>
                )}

                {collapsed && (
                    <div className="mt-2 flex justify-center">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#d75c33] to-blue-500 flex items-center justify-center text-xs font-bold font-mono"
                            title={user?.email || 'Admiral'}>
                            {user?.email?.charAt(0).toUpperCase() || 'A'}
                        </div>
                    </div>
                )}
            </div>
        </aside>
    );
}
