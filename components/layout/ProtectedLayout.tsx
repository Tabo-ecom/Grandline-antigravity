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

    const isPublicPage = pathname === '/' || pathname === '/login' || pathname === '/diagnostico';

    React.useEffect(() => {
        if (isLandingDomain === null || loading) return;

        // Landing domain (grandline.com.co): only serve landing page, redirect everything else to app subdomain
        if (isLandingDomain) {
            if (pathname !== '/' && pathname !== '/diagnostico') {
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

    // Landing domain — always show landing page and public pages
    if (isLandingDomain) {
        if (pathname === '/' || pathname === '/diagnostico') return <>{children}</>;
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

    // Public pages that should NEVER load AppProviders (even when logged in)
    if (pathname === '/diagnostico') return <>{children}</>;

    // Plan-based access check
    const moduleId = pathname.replace('/', '').split('/')[0];
    const requiredPlan = MODULE_REQUIRED_PLAN[moduleId];
    let planBanner: React.ReactNode = null;

    if (requiredPlan) {
        // No profile yet (new registration) → redirect to plan selection
        if (!profile) {
            return (
                <div className="flex h-screen items-center justify-center bg-background text-foreground">
                    <div className="max-w-md text-center p-8 space-y-4">
                        <div className="text-5xl">🚀</div>
                        <h2 className="text-2xl font-black uppercase tracking-tighter">Elige tu Plan</h2>
                        <p className="text-sm text-muted">
                            Para acceder a Grand Line, primero selecciona el plan que mejor se adapte a tu operación.
                        </p>
                        <button
                            onClick={() => router.push('/planes')}
                            className="px-6 py-3 bg-accent text-white font-black uppercase text-xs rounded-xl hover:bg-accent/90 transition-colors"
                        >
                            Ver Planes
                        </button>
                    </div>
                </div>
            );
        }

        const PLAN_LEVEL: Record<string, number> = { free: 0, rookie: 1, supernova: 2, yonko: 3 };
        const userPlan = profile.plan || 'free';
        const isActive = profile.subscriptionStatus === 'active' || profile.subscriptionStatus === 'trialing';
        const hasAdminBypass = profile.role === 'admin' && !profile.plan;

        if (!hasAdminBypass && (!isActive || (PLAN_LEVEL[userPlan] ?? 0) < (PLAN_LEVEL[requiredPlan] ?? 0))) {
            const planLabels: Record<string, string> = { rookie: 'Rookie', supernova: 'Supernova', yonko: 'Yonko' };
            planBanner = (
                <div className="fixed top-0 left-0 right-0 z-[100] pointer-events-none">
                    <div className="pointer-events-auto mx-auto max-w-2xl mt-4 px-4">
                        <div className="bg-gradient-to-r from-amber-500/95 to-orange-500/95 backdrop-blur-xl text-white rounded-2xl px-6 py-4 shadow-2xl shadow-amber-500/30 flex items-center gap-4">
                            <div className="text-3xl shrink-0">🔒</div>
                            <div className="flex-1 min-w-0">
                                <h3 className="font-black text-sm uppercase tracking-tight">
                                    Módulo requiere plan {planLabels[requiredPlan] || requiredPlan}
                                </h3>
                                <p className="text-white/80 text-xs mt-0.5">
                                    {!isActive && userPlan !== 'free'
                                        ? 'Tu suscripción no está activa. Renueva para acceder.'
                                        : 'Mejora tu plan para desbloquear este módulo.'}
                                </p>
                            </div>
                            <button
                                onClick={() => router.push('/planes')}
                                className="shrink-0 px-5 py-2.5 bg-white text-amber-600 font-black uppercase text-[11px] rounded-xl hover:bg-white/90 transition-colors shadow-lg"
                            >
                                Cambiar Plan
                            </button>
                        </div>
                    </div>
                </div>
            );
        }
    }

    // Protected pages — load all providers dynamically
    return (
        <AppProviders>
            {planBanner}
            {children}
        </AppProviders>
    );
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
