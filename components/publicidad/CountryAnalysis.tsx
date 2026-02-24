import React from 'react';
import { KPIResults } from '@/lib/calculations/kpis';
import { formatCurrency } from '@/lib/utils/currency';
import { Globe } from 'lucide-react';

interface CountryAnalysisProps {
    data: Array<{
        countryName: string;
        kpis: KPIResults;
    }>;
}

export const CountryAnalysis: React.FC<CountryAnalysisProps> = ({ data }) => {
    // Solo mostramos los países que tienen data (Gasto o Ingreso) para no saturar si es horizontal
    const activeCountries = data.filter(c => c.kpis.g_ads > 0 || c.kpis.ing_real > 0);

    return (
        <div className="bg-card border border-card-border rounded-2xl p-5 w-full shadow-sm">
            <h3 className="text-[11px] font-black text-muted uppercase tracking-widest mb-6">Eficiencia por País</h3>

            {activeCountries.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {activeCountries.map((c, idx) => (
                        <div key={idx} className="p-4 bg-card border border-card-border rounded-2xl hover:border-accent/30 transition-all">
                            <div className="flex justify-between items-center mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-blue-500/10">
                                        <Globe className="w-4 h-4 text-blue-400" />
                                    </div>
                                    <span className="text-[10px] font-black text-foreground uppercase tracking-widest">{c.countryName}</span>
                                </div>
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded tabular-nums ${c.kpis.roas_real >= 2 ? 'text-emerald-400 bg-emerald-500/10' : 'text-orange-400 bg-orange-500/10'}`}>
                                    ROAS {c.kpis.roas_real.toFixed(2)}x
                                </span>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-1">Inversión</p>
                                    <p className="text-xs font-mono text-foreground font-bold">{formatCurrency(c.kpis.g_ads)}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-1">Ventas Real</p>
                                    <p className="text-xs font-mono text-emerald-400 font-bold">{formatCurrency(c.kpis.ing_real)}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center py-6">
                    <p className="text-muted text-[10px] uppercase font-black tracking-widest">No hay datos de eficiencia por país en este periodo</p>
                </div>
            )}
        </div>
    );
};
