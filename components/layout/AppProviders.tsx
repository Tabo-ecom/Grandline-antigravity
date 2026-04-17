'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { FilterProvider } from '@/lib/context/FilterContext';
import { SidebarProvider, useSidebar } from '@/lib/context/SidebarContext';
import { SunnyProvider } from '@/lib/context/SunnyContext';
import { VegaProvider } from '@/lib/context/VegaContext';
import { useAuth } from '@/lib/context/AuthContext';
import { usePathname, useRouter } from 'next/navigation';
import Sidebar from './Sidebar';

const VegaChatBubble = dynamic(
    () => import('@/components/vega/VegaChatBubble').then(m => ({ default: m.VegaChatBubble })),
    { ssr: false }
);

const GlobalSearch = dynamic(
    () => import('@/components/common/GlobalSearch'),
    { ssr: false }
);

const PushNotifications = dynamic(
    () => import('@/components/common/PushNotifications'),
    { ssr: false }
);

const OnboardingFlow = dynamic(
    () => import('@/components/onboarding/OnboardingFlow'),
    { ssr: false }
);

const ADMIN_ONLY_ROUTES = ['/settings', '/usuarios'];
const MODULE_ROUTE_MAP: Record<string, string> = {
    '/dashboard': 'dashboard',
    '/log-pose': 'log-pose',
    '/publicidad': 'publicidad',
    '/sunny': 'sunny',
    '/berry': 'berry',
    '/vega-ai': 'vega-ai',
    '/import': 'import',
    '/proveedor': 'proveedor',
    '/tareas': 'tareas',
    '/docs': 'docs',
    '/chat': 'chat',
    '/calendario': 'calendario',
};

function ProtectedContent({ children }: { children: React.ReactNode }) {
    const { user, profile, loading } = useAuth();
    const { collapsed } = useSidebar();
    const router = useRouter();
    const pathname = usePathname();

    const isActive = profile?.subscriptionStatus === 'active' || profile?.subscriptionStatus === 'trialing';
    const hideSidebar = pathname === '/planes' && !isActive;

    React.useEffect(() => {
        if (!loading && user && profile) {
            const firstAllowed = profile.allowed_modules?.length ? `/${profile.allowed_modules[0]}` : '/dashboard';
            if (ADMIN_ONLY_ROUTES.includes(pathname) && profile.role !== 'admin') {
                router.push(firstAllowed);
                return;
            }
            if (profile.role !== 'admin' && profile.allowed_modules && profile.allowed_modules.length > 0) {
                const moduleId = MODULE_ROUTE_MAP[pathname];
                if (moduleId && !profile.allowed_modules.includes(moduleId)) {
                    router.push(firstAllowed);
                }
            }
        }
    }, [user, loading, pathname, profile, router]);

    const { setMobileOpen } = useSidebar();

    return (
        <div className="min-h-screen bg-background text-foreground flex transition-all duration-300">
            {!hideSidebar && <Sidebar />}
            <main
                className={`flex-1 ${hideSidebar ? 'ml-0' : collapsed ? 'md:ml-16' : 'md:ml-64'} ml-0 relative transition-all duration-300 ease-in-out min-w-0`}
            >
                {/* Mobile header */}
                {!hideSidebar && (
                    <div className="md:hidden sticky top-0 z-40 bg-sidebar/95 backdrop-blur-xl border-b border-sidebar-border px-4 py-2.5 flex items-center gap-3">
                        <button onClick={() => setMobileOpen(true)} className="w-8 h-8 rounded-lg bg-hover-bg border border-sidebar-border flex items-center justify-center text-muted">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                        </button>
                        <img src="/logos/grandline-isotipo.png" alt="GL" className="w-6 h-6 hidden dark:block" />
                        <img src="/logos/grandline-isotipo-dark.png" alt="GL" className="w-6 h-6 block dark:hidden" />
                        <span className="text-xs font-bold tracking-tight">GRAND LINE</span>
                    </div>
                )}
                <div className="p-3 md:p-6">
                    <div className="fixed top-[-10%] right-[-5%] w-[50%] h-[50%] bg-blue-500/5 rounded-full blur-[120px] pointer-events-none"></div>
                    <div className="fixed bottom-[-10%] left-[20%] w-[30%] h-[30%] bg-[#d75c33]/5 rounded-full blur-[120px] pointer-events-none"></div>
                    <div className="relative z-10 w-full min-w-0">
                        {children}
                    </div>
                </div>
            </main>
        </div>
    );
}

export default function AppProviders({ children }: { children: React.ReactNode }) {
    return (
        <FilterProvider>
            <SidebarProvider>
                <SunnyProvider>
                    <VegaProvider>
                        <ProtectedContent>
                            {children}
                        </ProtectedContent>
                        <GlobalSearch />
                        <PushNotifications />
                        <VegaChatBubble />
                        <OnboardingFlow />
                    </VegaProvider>
                </SunnyProvider>
            </SidebarProvider>
        </FilterProvider>
    );
}
