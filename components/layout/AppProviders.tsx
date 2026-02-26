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
};

function ProtectedContent({ children }: { children: React.ReactNode }) {
    const { user, profile, loading } = useAuth();
    const { collapsed } = useSidebar();
    const router = useRouter();
    const pathname = usePathname();

    React.useEffect(() => {
        if (!loading && user && profile) {
            if (ADMIN_ONLY_ROUTES.includes(pathname) && profile.role !== 'admin') {
                router.push('/dashboard');
                return;
            }
            if (profile.role !== 'admin' && profile.allowed_modules && profile.allowed_modules.length > 0) {
                const moduleId = MODULE_ROUTE_MAP[pathname];
                if (moduleId && !profile.allowed_modules.includes(moduleId)) {
                    router.push('/dashboard');
                }
            }
        }
    }, [user, loading, pathname, profile, router]);

    return (
        <div className="min-h-screen bg-background text-foreground flex transition-all duration-300">
            <Sidebar />
            <main
                className={`flex-1 ${collapsed ? 'ml-16' : 'ml-64'} p-4 md:p-6 relative transition-all duration-300 ease-in-out min-w-0`}
            >
                <div className="fixed top-[-10%] right-[-5%] w-[50%] h-[50%] bg-blue-500/5 rounded-full blur-[120px] pointer-events-none"></div>
                <div className="fixed bottom-[-10%] left-[20%] w-[30%] h-[30%] bg-[#d75c33]/5 rounded-full blur-[120px] pointer-events-none"></div>
                <div className="relative z-10 w-full min-w-0">
                    {children}
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
                        <VegaChatBubble />
                        <OnboardingFlow />
                    </VegaProvider>
                </SunnyProvider>
            </SidebarProvider>
        </FilterProvider>
    );
}
