import React from 'react';
import { KPIResults } from '@/lib/calculations/kpis';
import { formatCurrency } from '@/lib/utils/currency';
import { Target, TrendingUp, TrendingDown, DollarSign, MousePointer2, Receipt, Zap, Megaphone } from 'lucide-react';

interface GlobalSummaryProps {
    kpis: KPIResults & { cpaFacebook?: number; utilidad_proyectada?: number } | null;
    prevKpis?: KPIResults & { cpaFacebook?: number; utilidad_proyectada?: number } | null;
}

export const GlobalSummary: React.FC<GlobalSummaryProps> = ({
    kpis,
    prevKpis
}) => {
    if (!kpis) return null;

    const adsPctRevenue = kpis.fact_neto > 0 ? ((kpis.g_ads / kpis.fact_neto) * 100) : 0;
    const utilidadProy = kpis.utilidad_proyectada ?? kpis.u_real;
    const profitMargin = kpis.fact_despachada > 0 ? ((utilidadProy / kpis.fact_despachada) * 100) : 0;

    const aov = kpis.n_nc > 0 ? kpis.fact_despachada / kpis.n_nc : 0;
    const prevAov = prevKpis && prevKpis.n_nc > 0 ? prevKpis.fact_despachada / prevKpis.n_nc : 0;

    const cpaRealDesp = kpis.n_nc > 0 ? kpis.g_ads / kpis.n_nc : 0;
    const prevCpaRealDesp = prevKpis && prevKpis.n_nc > 0 ? prevKpis.g_ads / prevKpis.n_nc : 0;
    const cpaDespPctFact = kpis.fact_despachada > 0 ? ((cpaRealDesp / aov) * 100) : 0;

    const cpaFb = kpis.cpaFacebook || 0;
    const prevCpaFb = prevKpis?.cpaFacebook || 0;
    const cpaFbPctAov = aov > 0 ? ((cpaFb / aov) * 100) : 0;

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {/* Gasto Total */}
            {(() => {
                const growthPct = prevKpis && prevKpis.g_ads > 0
                    ? (((kpis.g_ads) - prevKpis.g_ads) / Math.abs(prevKpis.g_ads)) * 100 : null;
                return (
                    <div className="bg-card border border-card-border rounded-2xl p-4 hover:border-accent/30 transition-all shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-[10px] font-black text-muted uppercase tracking-widest">Gasto Total</span>
                            <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-orange-500/10 shrink-0">
                                <DollarSign className="w-4 h-4 text-orange-400" />
                            </div>
                        </div>
                        <p className="text-2xl font-black tracking-tight text-orange-400 font-mono">{formatCurrency(kpis.g_ads)}</p>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <span className="text-xs text-muted">s/ Facturado</span>
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-black border font-mono ${
                                adsPctRevenue <= 20 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                    : adsPctRevenue <= 30 ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                                        : 'bg-red-500/10 text-red-400 border-red-500/20'
                            }`}>{adsPctRevenue.toFixed(1)}%</span>
                        </div>
                        {growthPct !== null && Math.abs(growthPct) >= 0.1 && (
                            <div className={`flex items-center gap-1 mt-1.5 text-[10px] font-bold ${growthPct < 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {growthPct < 0 ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
                                {Math.abs(growthPct).toFixed(1)}% vs periodo anterior
                            </div>
                        )}
                    </div>
                );
            })()}

            {/* Facturado Despachado */}
            {(() => {
                const growthPct = prevKpis && prevKpis.fact_despachada > 0
                    ? (((kpis.fact_despachada) - prevKpis.fact_despachada) / Math.abs(prevKpis.fact_despachada)) * 100 : null;
                return (
                    <div className="bg-card border border-card-border rounded-2xl p-4 hover:border-accent/30 transition-all shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-[10px] font-black text-muted uppercase tracking-widest">Facturado Despachado</span>
                            <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-emerald-500/10 shrink-0">
                                <TrendingUp className="w-4 h-4 text-emerald-500" />
                            </div>
                        </div>
                        <p className="text-2xl font-black tracking-tight text-emerald-500 font-mono">{formatCurrency(kpis.fact_despachada)}</p>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <span className="text-xs text-muted">Real: <span className="text-foreground/70 font-mono">{formatCurrency(kpis.ing_real)}</span></span>
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">AOV {formatCurrency(aov)}</span>
                        </div>
                        {growthPct !== null && Math.abs(growthPct) >= 0.1 && (
                            <div className={`flex items-center gap-1 mt-1.5 text-[10px] font-bold ${growthPct > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {growthPct > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                {Math.abs(growthPct).toFixed(1)}% vs periodo anterior
                            </div>
                        )}
                    </div>
                );
            })()}

            {/* ROAS Real */}
            {(() => {
                const growthPct = prevKpis && prevKpis.roas_real > 0
                    ? (((kpis.roas_real) - prevKpis.roas_real) / Math.abs(prevKpis.roas_real)) * 100 : null;
                return (
                    <div className="bg-card border border-card-border rounded-2xl p-4 hover:border-accent/30 transition-all shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-[10px] font-black text-muted uppercase tracking-widest">ROAS Real</span>
                            <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-purple-500/10 shrink-0">
                                <Target className="w-4 h-4 text-purple-400" />
                            </div>
                        </div>
                        <p className="text-2xl font-black tracking-tight text-purple-400 font-mono">{kpis.roas_real.toFixed(2)}x</p>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <span className="text-xs text-muted">Bruto: <span className="text-foreground/70 font-mono">{kpis.roas_bruto.toFixed(2)}x</span></span>
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-black border font-mono ${
                                kpis.roas_real >= 3 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                    : kpis.roas_real >= 2 ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                                        : 'bg-red-500/10 text-red-400 border-red-500/20'
                            }`}>{kpis.roas_real >= 3 ? 'BUENO' : kpis.roas_real >= 2 ? 'MEDIO' : 'BAJO'}</span>
                        </div>
                        {growthPct !== null && Math.abs(growthPct) >= 0.1 && (
                            <div className={`flex items-center gap-1 mt-1.5 text-[10px] font-bold ${growthPct > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {growthPct > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                {Math.abs(growthPct).toFixed(1)}% vs periodo anterior
                            </div>
                        )}
                    </div>
                );
            })()}

            {/* A.O.V. */}
            {(() => {
                const growthPct = prevAov && prevAov > 0
                    ? ((aov - prevAov) / Math.abs(prevAov)) * 100 : null;
                return (
                    <div className="bg-card border border-card-border rounded-2xl p-4 hover:border-accent/30 transition-all shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-[10px] font-black text-muted uppercase tracking-widest">A.O.V.</span>
                            <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-blue-500/10 shrink-0">
                                <Receipt className="w-4 h-4 text-blue-400" />
                            </div>
                        </div>
                        <p className="text-2xl font-black tracking-tight text-blue-400 font-mono">{formatCurrency(aov)}</p>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <span className="text-xs text-muted">Desp: <span className="text-foreground/70 font-mono">{kpis.n_nc}</span></span>
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono">{kpis.n_nc} ords</span>
                        </div>
                        {growthPct !== null && Math.abs(growthPct) >= 0.1 && (
                            <div className={`flex items-center gap-1 mt-1.5 text-[10px] font-bold ${growthPct > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {growthPct > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                {Math.abs(growthPct).toFixed(1)}% vs periodo anterior
                            </div>
                        )}
                    </div>
                );
            })()}

            {/* CPA Facebook */}
            {(() => {
                const growthPct = prevCpaFb && prevCpaFb > 0
                    ? ((cpaFb - prevCpaFb) / Math.abs(prevCpaFb)) * 100 : null;
                return (
                    <div className="bg-card border border-card-border rounded-2xl p-4 hover:border-accent/30 transition-all shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-[10px] font-black text-muted uppercase tracking-widest">CPA Facebook</span>
                            <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-sky-500/10 shrink-0">
                                <Megaphone className="w-4 h-4 text-sky-400" />
                            </div>
                        </div>
                        <p className="text-2xl font-black tracking-tight text-sky-400 font-mono">{formatCurrency(cpaFb)}</p>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <span className="text-xs text-muted">Meta Ads</span>
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-black border font-mono ${
                                cpaFbPctAov <= 20 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                    : cpaFbPctAov <= 35 ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                                        : 'bg-red-500/10 text-red-400 border-red-500/20'
                            }`}>{cpaFbPctAov.toFixed(1)}% AOV</span>
                        </div>
                        {growthPct !== null && Math.abs(growthPct) >= 0.1 && (
                            <div className={`flex items-center gap-1 mt-1.5 text-[10px] font-bold ${growthPct < 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {growthPct < 0 ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
                                {Math.abs(growthPct).toFixed(1)}% vs periodo anterior
                            </div>
                        )}
                    </div>
                );
            })()}

            {/* CPA Real Despachado */}
            {(() => {
                const growthPct = prevCpaRealDesp && prevCpaRealDesp > 0
                    ? ((cpaRealDesp - prevCpaRealDesp) / Math.abs(prevCpaRealDesp)) * 100 : null;
                return (
                    <div className="bg-card border border-card-border rounded-2xl p-4 hover:border-accent/30 transition-all shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-[10px] font-black text-muted uppercase tracking-widest">CPA Despachado</span>
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                                cpaDespPctFact <= 20 ? 'bg-emerald-500/10' : cpaDespPctFact <= 30 ? 'bg-amber-500/10' : 'bg-red-500/10'
                            }`}>
                                <Zap className={`w-4 h-4 ${
                                    cpaDespPctFact <= 20 ? 'text-emerald-400' : cpaDespPctFact <= 30 ? 'text-amber-500' : 'text-red-400'
                                }`} />
                            </div>
                        </div>
                        <p className={`text-2xl font-black tracking-tight font-mono ${
                            cpaDespPctFact <= 20 ? 'text-emerald-400' : cpaDespPctFact <= 30 ? 'text-amber-500' : 'text-red-400'
                        }`}>{formatCurrency(cpaRealDesp)}</p>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <span className="text-xs text-muted">Ads / Desp.</span>
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-black border font-mono ${
                                cpaDespPctFact <= 20 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                    : cpaDespPctFact <= 30 ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                                        : 'bg-red-500/10 text-red-400 border-red-500/20'
                            }`}>{cpaDespPctFact.toFixed(1)}% AOV</span>
                        </div>
                        {growthPct !== null && Math.abs(growthPct) >= 0.1 && (
                            <div className={`flex items-center gap-1 mt-1.5 text-[10px] font-bold ${growthPct < 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {growthPct < 0 ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
                                {Math.abs(growthPct).toFixed(1)}% vs periodo anterior
                            </div>
                        )}
                    </div>
                );
            })()}

            {/* Utilidad Proyectada */}
            {(() => {
                const prevUtilidad = prevKpis?.utilidad_proyectada ?? prevKpis?.u_real ?? 0;
                const growthPct = prevUtilidad && Math.abs(prevUtilidad) > 0
                    ? ((utilidadProy - prevUtilidad) / Math.abs(prevUtilidad)) * 100 : null;
                const isProfit = utilidadProy >= 0;
                return (
                    <div className="bg-card border border-card-border rounded-2xl p-4 hover:border-accent/30 transition-all shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-[10px] font-black text-muted uppercase tracking-widest">Utilidad Proyectada</span>
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${isProfit ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
                                <MousePointer2 className={`w-4 h-4 ${isProfit ? 'text-emerald-500' : 'text-red-400'}`} />
                            </div>
                        </div>
                        <p className={`text-2xl font-black tracking-tight font-mono ${isProfit ? 'text-emerald-500' : 'text-red-400'}`}>{formatCurrency(utilidadProy)}</p>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <span className="text-xs text-muted">Margen</span>
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-black border font-mono ${
                                isProfit && profitMargin > 15 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                    : isProfit ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                                        : 'bg-red-500/10 text-red-400 border-red-500/20'
                            }`}>{profitMargin.toFixed(1)}%</span>
                        </div>
                        {growthPct !== null && Math.abs(growthPct) >= 0.1 && (
                            <div className={`flex items-center gap-1 mt-1.5 text-[10px] font-bold ${growthPct > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {growthPct > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                {Math.abs(growthPct).toFixed(1)}% vs periodo anterior
                            </div>
                        )}
                    </div>
                );
            })()}
        </div>
    );
};
