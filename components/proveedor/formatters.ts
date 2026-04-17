// Shared formatters for Proveedor module
export const fmtCOP = (v: number) => {
    if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
    if (Math.abs(v) >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
    return `$${v.toLocaleString('es-CO')}`;
};
export const fmtFull = (v: number) => `$${v.toLocaleString('es-CO', { maximumFractionDigits: 0 })}`;
export const fmtPct = (v: number) => `${v.toFixed(1)}%`;
export const fmtNum = (v: number) => v.toLocaleString('es-CO');
