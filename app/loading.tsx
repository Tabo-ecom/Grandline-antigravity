export default function Loading() {
    return (
        <div className="flex h-screen items-center justify-center bg-background text-foreground transition-all duration-300">
            <div className="flex flex-col items-center gap-4">
                <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#d75c33] border-t-transparent"></div>
                <p className="font-medium animate-pulse">NAVEGANDO HACIA EL GRAND LINE...</p>
            </div>
        </div>
    );
}
