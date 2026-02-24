'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { AuthProvider, useAuth } from '@/lib/context/AuthContext';
import { ThemeProvider } from '@/lib/context/ThemeContext';
import { usePathname, useRouter } from 'next/navigation';

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
    const { user, loading } = useAuth();
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
