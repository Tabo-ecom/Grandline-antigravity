'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { AuthProvider, useAuth } from '@/lib/context/AuthContext';
import { ThemeProvider } from '@/lib/context/ThemeContext';
import { usePathname, useRouter } from 'next/navigation';
import { MODULE_REQUIRED_PLAN } from '@/lib/hooks/usePlanAccess';

const AppProviders = dynamic(() => import('./AppProviders'), {
    ssr: false,
    loading: () => (
        <div className="flex h-screen items-center justify-center bg-background text-foreground transition-all duration-300">
            <div className="flex flex-col items-center gap-4">
                <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#d75c33] border-t-transparent"></div>
                <p className="font-medium animate-pulse">NAVEGANDO HACIA EL GRAND LINE...</p>
            </div>
        </div>
    ),
});

function AuthGuard({ children }: { children: React.ReactNode }) {
    const { user, profile, loading } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const [isLandingDomain, setIsLandingDomain] = React.useState<boolean | null>(null);

    React.useEffect(() => {
        const hostname = window.location.hostname;
        const isApp = hostname.startsWith('app.') || hostname === 'localhost';
        setIsLandingDomain(!isApp);
    }, []);

    const isPublicPage = pathname === '/' || pathname === '/login';

    React.useEffect(() => {
        if (isLandingDomain === null || loading) return;

        // Landing domain (grandline.com.co): only serve landing page, redirect everything else to app subdomain
        if (isLandingDomain) {
            if (pathname !== '/') {
                window.location.href = `https://app.grandline.com.co${pathname}`;
            }
            return;
        }

        // App domain (app.grandline.com.co): normal auth routing
        if (!user && !isPublicPage) {
            router.push('/login');
        } else if (user && (pathname === '/login' || pathname === '/')) {
            router.push('/dashboard');
        }
    }, [user, loading, pathname, isPublicPage, router, isLandingDomain]);

    // Wait for domain detection
    if (isLandingDomain === null) return null;

    // Landing domain — always show landing page at /
    if (isLandingDomain) {
        if (pathname === '/') return <>{children}</>;
        return null; // redirecting to app subdomain
    }

    // App domain — loading state
    if (loading && !isPublicPage) {
        return (
            <div className="flex h-screen items-center justify-center bg-background text-foreground transition-all duration-300">
                <div className="flex flex-col items-center gap-4">
                    <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#d75c33] border-t-transparent"></div>
                    <p className="font-medium animate-pulse">NAVEGANDO HACIA EL GRAND LINE...</p>
                </div>
            </div>
        );
    }

    // Public pages — render directly without heavy providers
    if (isPublicPage && !user) return <>{children}</>;

    // Redirecting — show nothing
    if (!user && !isPublicPage) return null;
    if (user && (pathname === '/login' || pathname === '/')) return <>{children}</>;

    // Plan-based access check: block modules the user's plan doesn't include
    const moduleId = pathname.replace('/', '').split('/')[0]; // e.g. "sunny", "berry", "vega-ai"
    const requiredPlan = MODULE_REQUIRED_PLAN[moduleId];

    if (requiredPlan && profile) {
        const PLAN_LEVEL: Record<string, number> = { free: 0, rookie: 1, supernova: 2, yonko: 3 };
        const userPlan = profile.plan || 'free';
        const isActive = profile.subscriptionStatus === 'active' || profile.subscriptionStatus === 'trialing';
        const hasAdminBypass = profile.role === 'admin' && !profile.plan;

        if (!hasAdminBypass && (!isActive || (PLAN_LEVEL[userPlan] ?? 0) < (PLAN_LEVEL[requiredPlan] ?? 0))) {
            return (
                <AppProviders>
                    <div className="flex h-screen items-center justify-center bg-background text-foreground">
                        <div className="max-w-md text-center p-8 space-y-4">
                            <div className="text-5xl">🔒</div>
                            <h2 className="text-2xl font-black uppercase tracking-tighter">Módulo Bloqueado</h2>
                            <p className="text-sm text-muted">
                                Este módulo requiere el plan <span className="font-bold text-accent capitalize">{requiredPlan}</span> o superior.
                                {!isActive && userPlan !== 'free' && ' Tu suscripción no está activa.'}
                            </p>
                            <button
                                onClick={() => router.push('/planes')}
                                className="px-6 py-3 bg-accent text-white font-black uppercase text-xs rounded-xl hover:bg-accent/90 transition-colors"
                            >
                                Ver Planes
                            </button>
                        </div>
                    </div>
                </AppProviders>
            );
        }
    }

    // Protected pages — load all providers dynamically
    return <AppProviders>{children}</AppProviders>;
}

export default function ProtectedLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <AuthProvider>
            <ThemeProvider>
                <AuthGuard>{children}</AuthGuard>
            </ThemeProvider>
        </AuthProvider>
    );
}
