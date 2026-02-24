import re

new_content = """import React from 'react';
import { KPIResults } from '@/lib/calculations/kpis';
import { formatCurrency } from '@/lib/utils/currency';
import { Target, TrendingUp, TrendingDown, DollarSign, BarChart3, MousePointer2, Receipt } from 'lucide-react';

interface GlobalSummaryProps {
    kpis: KPIResults | null;
    prevKpis?: KPIResults | null;
}

function GrowthBadge({ current, previous, invert }: { current: number; previous: number; invert?: boolean }) {
    if (!previous || previous === 0) return null;
    const change = ((current - previous) / Math.abs(previous)) * 100;
    if (Math.abs(change) < 0.1) return null;
    // invert: for metrics where lower is better (CPA, Ad spend)
    const isPositive = invert ? change < 0 : change > 0;
    return (
        <div className={`flex items-center gap-1 text-[10px] font-bold mt-1 ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
            {change > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {Math.abs(change).toFixed(1)}% vs periodo anterior
        </div>
    );
}

export const GlobalSummary: React.FC<GlobalSummaryProps> = ({
    kpis,
    prevKpis
}) => {
    if (!kpis) return null;

    const adsPctRevenue = kpis.fact_neto > 0 ? ((kpis.g_ads / kpis.fact_neto) * 100) : 0;
    const prevAdsPctRevenue = prevKpis && prevKpis.fact_neto > 0 ? ((prevKpis.g_ads / prevKpis.fact_neto) * 100) : 0;

    const profitMargin = kpis.fact_neto > 0 ? ((kpis.u_real / kpis.fact_neto) * 100) : 0;
    const ingRealMargin = kpis.fact_neto > 0 ? ((kpis.ing_real / kpis.fact_neto) * 100) : 0;

    // CPA Color Logic
    const cpaColor = adsPctRevenue > 25 ? 'text-red-400' : adsPctRevenue >= 20 ? 'text-orange-400' : 'text-emerald-400';

    const aov = kpis.n_nc > 0 ? kpis.fact_despachada / kpis.n_nc : 0;
    const prevAov = prevKpis && prevKpis.n_nc > 0 ? prevKpis.fact_despachada / prevKpis.n_nc : 0;

    const cards = [
        { label: 'Gasto Total', value: formatCurrency(kpis.g_ads), participation: null, icon: DollarSign, color: 'text-orange-400', current: kpis.g_ads, prev: prevKpis?.g_ads || 0, invert: true, subtitle: null },
        { label: 'Facturado Despachado', value: formatCurrency(kpis.fact_despachada), participation: ingRealMargin, icon: TrendingUp, color: 'text-emerald-400', current: kpis.fact_despachada, prev: prevKpis?.fact_despachada || 0, subtitle: `${kpis.n_nc} órdenes despachadas` },
        { label: 'A.O.V.', value: formatCurrency(aov), participation: null, icon: Receipt, color: 'text-blue-400', current: aov, prev: prevAov, subtitle: null },
        { label: 'ROAS Real', value: `${kpis.roas_real.toFixed(2)}x`, participation: null, icon: Target, color: 'text-purple-400', current: kpis.roas_real, prev: prevKpis?.roas_real || 0, subtitle: null },
        { label: 'CPA', value: formatCurrency(kpis.cpa), participation: adsPctRevenue, icon: BarChart3, color: cpaColor, current: kpis.cpa, prev: prevKpis?.cpa || 0, invert: true, subtitle: null },
        { label: 'Utilidad Proyectada', value: formatCurrency(kpis.utilidad_proyectada || 0), participation: profitMargin, icon: MousePointer2, color: 'text-amber-400', current: kpis.utilidad_proyectada || 0, prev: prevKpis?.utilidad_proyectada || 0, subtitle: null },
    ];

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {cards.map((card, idx) => (
                    <div key={idx} className="bg-card border border-card-border rounded-2xl p-4 hover:border-accent/30 transition-all group shadow-sm flex flex-col justify-between">
                        <div>
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-black text-muted uppercase tracking-widest">{card.label}</span>
                                    {card.participation !== null && (
                                        <span className="text-[9px] font-bold text-muted bg-muted/10 px-1.5 py-0.5 rounded tabular-nums">
                                            {card.participation.toFixed(1)}%
                                        </span>
                                    )}
                                </div>
                                <div className={`w-8 h-8 rounded-xl flex items-center justify-center bg-muted/10`}>
                                    <card.icon className={`w-4 h-4 ${card.color}`} />
                                </div>
                            </div>
                            <div className={`text-xl font-black tracking-tight ${card.color}`}>{card.value}</div>
                            {card.subtitle && (
                                <div className="text-[9px] font-bold text-muted uppercase tracking-wider mt-1.5">
                                    {card.subtitle}
                                </div>
                            )}
                        </div>
                        <div className="mt-2">
                            {prevKpis && <GrowthBadge current={card.current} previous={card.prev} invert={card.invert} />}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
"""

with open('components/publicidad/GlobalSummary.tsx', 'w', encoding='utf-8') as f:
    f.write(new_content)

print("Patched GlobalSummary.tsx")

