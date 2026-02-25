import Link from 'next/link';

export default function NotFound() {
    return (
        <div className="flex h-screen items-center justify-center bg-background text-foreground">
            <div className="max-w-md text-center p-8 space-y-4">
                <div className="text-6xl font-black tracking-tighter text-accent">404</div>
                <h2 className="text-2xl font-black uppercase tracking-tighter">
                    P&aacute;gina no encontrada
                </h2>
                <p className="text-sm text-muted">
                    La ruta que buscas no existe en el Grand Line.
                </p>
                <Link
                    href="/dashboard"
                    className="inline-block px-6 py-3 bg-accent text-white font-black uppercase text-xs rounded-xl hover:bg-accent/90 transition-colors"
                >
                    Volver al Dashboard
                </Link>
            </div>
        </div>
    );
}
