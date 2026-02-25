'use client';

import { useEffect } from 'react';

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error('Unhandled error:', error);
    }, [error]);

    return (
        <div className="flex h-screen items-center justify-center bg-background text-foreground">
            <div className="max-w-md text-center p-8 space-y-4">
                <div className="text-5xl">&#x26A0;&#xFE0F;</div>
                <h2 className="text-2xl font-black uppercase tracking-tighter">
                    Algo sali&oacute; mal
                </h2>
                <p className="text-sm text-muted">
                    Ocurri&oacute; un error inesperado. Intenta recargar la p&aacute;gina.
                </p>
                <div className="flex gap-3 justify-center">
                    <button
                        onClick={reset}
                        className="px-6 py-3 bg-accent text-white font-black uppercase text-xs rounded-xl hover:bg-accent/90 transition-colors"
                    >
                        Reintentar
                    </button>
                    <button
                        onClick={() => window.location.href = '/dashboard'}
                        className="px-6 py-3 bg-card text-foreground font-black uppercase text-xs rounded-xl border border-border hover:bg-card/80 transition-colors"
                    >
                        Ir al Dashboard
                    </button>
                </div>
            </div>
        </div>
    );
}
