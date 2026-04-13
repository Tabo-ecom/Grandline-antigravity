'use client';

import React, { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { AuthProvider, useAuth } from '@/lib/context/AuthContext';
import { ThemeProvider } from '@/lib/context/ThemeContext';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { MODULE_REQUIRED_PLAN } from '@/lib/hooks/usePlanAccess';
import { MODULE_TUTORIALS } from '@/lib/config/tutorials';
import { authFetch } from '@/lib/api/client';
import { getUserProfile } from '@/lib/firebase/firestore';
import { Lock, Play, Check, ArrowRight } from 'lucide-react';

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
    const { user, profile, loading, refreshProfile } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [isLandingDomain, setIsLandingDomain] = React.useState<boolean | null>(null);
    const [verifyingSession, setVerifyingSession] = React.useState(false);
    const verifiedRef = React.useRef(false);

    React.useEffect(() => {
        const hostname = window.location.hostname;
        const isApp = hostname.startsWith('app.') || hostname === 'localhost';
        setIsLandingDomain(!isApp);
    }, []);

    const isPublicPage = pathname === '/' || pathname === '/login' || pathname === '/diagnostico' || pathname === '/terms' || pathname === '/privacy';

    // Verify Stripe session after checkout redirect (race condition fix)
    const sessionId = searchParams.get('session_id');
    React.useEffect(() => {
        if (!sessionId || !user || verifiedRef.current) return;

        // If profile already has an active subscription, just clean URL
        if (profile?.subscriptionStatus === 'active' || profile?.subscriptionStatus === 'trialing') {
            verifiedRef.current = true;
            router.replace(pathname);
            return;
        }

        verifiedRef.current = true;
        setVerifyingSession(true);

        const syncSubscription = async () => {
            // Step 1: Try instant sync via verify-session API
            try {
                await authFetch('/api/stripe/verify-session', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sessionId }),
                });
            } catch (err) {
                console.error('Verify session API error:', err);
            }

            // Step 2: Poll Firestore until profile has active subscription (or timeout)
            // This handles: verify-session success, webhook processing, or both
            const MAX_ATTEMPTS = 12;
            for (let i = 0; i < MAX_ATTEMPTS; i++) {
                try {
                    const freshProfile = await getUserProfile(user.uid);
                    if (freshProfile?.subscriptionStatus === 'active' || freshProfile?.subscriptionStatus === 'trialing') {
                        await refreshProfile(); // Sync React state
                        return; // Success
                    }
                } catch {}
                await new Promise(r => setTimeout(r, 2000));
            }

            // Fallback: final refresh attempt
            await refreshProfile();
        };

        syncSubscription().finally(() => {
            setVerifyingSession(false);
            router.replace(pathname);
        });
    }, [sessionId, user]);

    React.useEffect(() => {
        if (isLandingDomain === null || loading) return;

        // Landing domain (grandline.com.co): only serve landing page, redirect everything else to app subdomain
        if (isLandingDomain) {
            if (pathname !== '/' && pathname !== '/diagnostico' && pathname !== '/terms' && pathname !== '/privacy') {
                window.location.href = `https://app.grandline.com.co${pathname}${window.location.search}`;
            }
            return;
        }

        // App domain (app.grandline.com.co): normal auth routing
        if (!user && !isPublicPage) {
            router.push('/login');
        } else if (user && pathname === '/') {
            router.push('/dashboard');
        }
    }, [user, loading, pathname, isPublicPage, router, isLandingDomain]);

    // Wait for domain detection
    if (isLandingDomain === null) return null;

    // Landing domain — always show landing page and public pages
    if (isLandingDomain) {
        if (pathname === '/' || pathname === '/diagnostico' || pathname === '/terms' || pathname === '/privacy') return <>{children}</>;
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
    if (user && pathname === '/') return <>{children}</>;
    // Login page: user is being signed out, show the login form
    if (pathname === '/login') return <>{children}</>;

    // Public pages that should NEVER load AppProviders (even when logged in)
    if (pathname === '/diagnostico') return <>{children}</>;

    // Plan-based access check
    const moduleId = pathname.replace('/', '').split('/')[0];
    const requiredPlan = MODULE_REQUIRED_PLAN[moduleId];

    if (requiredPlan) {
        // Verifying Stripe session or session_id present — show loading instead of plan gate
        const pendingVerification = verifyingSession || (sessionId && !verifiedRef.current);
        if (pendingVerification) {
            return (
                <div className="flex h-screen items-center justify-center bg-background text-foreground transition-all duration-300">
                    <div className="flex flex-col items-center gap-4">
                        <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#d75c33] border-t-transparent"></div>
                        <p className="font-medium animate-pulse">Activando tu suscripción...</p>
                    </div>
                </div>
            );
        }

        // No profile yet (new registration) → redirect to WhatsApp for plan activation
        if (!profile) {
            const userEmail = user?.email || '';
            const waUrl = `https://wa.me/573153920396?text=${encodeURIComponent(`Hola! Me registré en Grand Line con el correo ${userEmail} y quiero activar mi plan.`)}`;
            return (
                <div className="flex h-screen items-center justify-center bg-background text-foreground">
                    <div className="max-w-md text-center p-8 space-y-4">
                        <div className="text-5xl">🚀</div>
                        <h2 className="text-2xl font-black uppercase tracking-tighter">Activa tu Plan</h2>
                        <p className="text-sm text-muted">
                            Para activar tu cuenta de Grand Line, escríbenos por WhatsApp y te ayudamos a configurar tu plan.
                        </p>
                        <a
                            href={waUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-block px-6 py-3 bg-[#25D366] text-white font-black uppercase text-xs rounded-xl hover:bg-[#25D366]/90 transition-colors"
                        >
                            Escribir por WhatsApp
                        </a>
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
            const tutorial = MODULE_TUTORIALS[`/${moduleId}`];

            const getEmbedUrl = (url: string) => {
                const match = url.match(/(?:youtu\.be\/|youtube\.com\/watch\?v=)([^&]+)/);
                return match ? `https://www.youtube.com/embed/${match[1]}` : url;
            };

            return (
                <AppProviders>
                    <div className="flex-1 flex items-center justify-center min-h-screen bg-background p-4 sm:p-8">
                        <div className="w-full max-w-2xl space-y-6">
                            {/* Header */}
                            <div className="text-center space-y-2">
                                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 text-xs font-bold uppercase tracking-wider">
                                    <Lock className="w-3.5 h-3.5" />
                                    Requiere plan {planLabels[requiredPlan] || requiredPlan}
                                </div>
                                <h2 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
                                    {tutorial?.title || `Módulo ${moduleId}`}
                                </h2>
                                {tutorial?.description && (
                                    <p className="text-muted text-sm">{tutorial.description}</p>
                                )}
                            </div>

                            {/* Video */}
                            {tutorial?.videos?.[0] && (
                                <div className="relative w-full aspect-video rounded-2xl overflow-hidden border border-card-border shadow-2xl shadow-black/20">
                                    <iframe
                                        src={getEmbedUrl(tutorial.videos[0].url)}
                                        title={tutorial.videos[0].title}
                                        className="absolute inset-0 w-full h-full"
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                        allowFullScreen
                                    />
                                </div>
                            )}

                            {/* Additional videos */}
                            {tutorial?.videos && tutorial.videos.length > 1 && (
                                <div className="grid grid-cols-2 gap-3">
                                    {tutorial.videos.slice(1).map((video) => (
                                        <div key={video.url} className="relative aspect-video rounded-xl overflow-hidden border border-card-border">
                                            <iframe
                                                src={getEmbedUrl(video.url)}
                                                title={video.title}
                                                className="absolute inset-0 w-full h-full"
                                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                                allowFullScreen
                                            />
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Steps / Benefits */}
                            {tutorial?.steps && tutorial.steps.length > 0 && (
                                <div className="bg-card border border-card-border rounded-2xl p-6">
                                    <h3 className="text-sm font-bold text-foreground uppercase tracking-wider mb-4">
                                        Lo que puedes hacer con este módulo
                                    </h3>
                                    <ul className="space-y-3">
                                        {tutorial.steps.map((step, i) => (
                                            <li key={i} className="flex items-start gap-3 text-sm text-muted">
                                                <Check className="w-4 h-4 mt-0.5 shrink-0 text-accent" />
                                                <span>{step}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* CTA */}
                            <div className="text-center space-y-3">
                                <a
                                    href={`https://wa.me/573153920396?text=${encodeURIComponent(`Hola! Quiero desbloquear el plan ${planLabels[requiredPlan] || requiredPlan} en Grand Line. Mi correo es ${user?.email || ''}.`)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 px-8 py-4 bg-[#25D366] text-white font-black uppercase text-sm rounded-2xl hover:opacity-90 transition-all shadow-xl shadow-[#25D366]/25"
                                >
                                    Desbloquear con plan {planLabels[requiredPlan] || requiredPlan}
                                    <ArrowRight className="w-4 h-4" />
                                </a>
                                <p className="text-xs text-muted">
                                    {!isActive && userPlan !== 'free'
                                        ? 'Tu suscripción no está activa. Escríbenos para reactivar tu acceso.'
                                        : 'Escríbenos por WhatsApp para mejorar tu plan.'}
                                </p>
                            </div>
                        </div>
                    </div>
                </AppProviders>
            );
        }
    }

    // Protected pages — load all providers dynamically
    return (
        <AppProviders>
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
                <Suspense fallback={
                    <div className="flex h-screen items-center justify-center bg-background text-foreground transition-all duration-300">
                        <div className="flex flex-col items-center gap-4">
                            <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#d75c33] border-t-transparent"></div>
                            <p className="font-medium animate-pulse">NAVEGANDO HACIA EL GRAND LINE...</p>
                        </div>
                    </div>
                }>
                    <AuthGuard>{children}</AuthGuard>
                </Suspense>
            </ThemeProvider>
        </AuthProvider>
    );
}
