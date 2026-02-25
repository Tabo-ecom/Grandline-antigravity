import React from 'react';
import { KPIResults } from '@/lib/calculations/kpis';
import { formatCurrency } from '@/lib/utils/currency';
import { Target, TrendingUp, TrendingDown, DollarSign, MousePointer2, Zap, Megaphone } from 'lucide-react';
import InfoTooltip from '@/components/common/InfoTooltip';

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

    const cpaRealDesp = kpis.n_nc > 0 ? kpis.g_ads / kpis.n_nc : 0;
    const prevCpaRealDesp = prevKpis && prevKpis.n_nc > 0 ? prevKpis.g_ads / prevKpis.n_nc : 0;
    const cpaDespPctFact = kpis.fact_despachada > 0 ? ((cpaRealDesp / aov) * 100) : 0;

    const cpaFb = kpis.cpaFacebook || 0;
    const prevCpaFb = prevKpis?.cpaFacebook || 0;
    const cpaFbPctAov = aov > 0 ? ((cpaFb / aov) * 100) : 0;

    return (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {/* Gasto Total */}
            {(() => {
                const growthPct = prevKpis && prevKpis.g_ads > 0
                    ? (((kpis.g_ads) - prevKpis.g_ads) / Math.abs(prevKpis.g_ads)) * 100 : null;
                return (
                    <div className="bg-card border border-card-border rounded-2xl p-4 hover:border-accent/30 transition-all shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-[10px] font-black text-muted uppercase tracking-widest flex items-center gap-1.5">Gasto Total <InfoTooltip text="Inversión total en publicidad (Facebook + TikTok) para el periodo seleccionado." /></span>
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

            {/* ROAS + Facturado Despachado (Combined) */}
            {(() => {
                const growthRoas = prevKpis && prevKpis.roas_real > 0
                    ? (((kpis.roas_real) - prevKpis.roas_real) / Math.abs(prevKpis.roas_real)) * 100 : null;
                const growthFact = prevKpis && prevKpis.fact_despachada > 0
                    ? (((kpis.fact_despachada) - prevKpis.fact_despachada) / Math.abs(prevKpis.fact_despachada)) * 100 : null;
                return (
                    <div className="bg-card border border-card-border rounded-2xl p-4 hover:border-accent/30 transition-all shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-[10px] font-black text-muted uppercase tracking-widest flex items-center gap-1.5">ROAS / Facturado <InfoTooltip text="ROAS = Facturado / Gasto en Ads. Mide cuánto se genera por cada peso invertido. Fact. Desp. = total facturado de órdenes no canceladas." /></span>
                            <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-purple-500/10 shrink-0">
                                <Target className="w-4 h-4 text-purple-400" />
                            </div>
                        </div>
                        <div className="flex items-baseline gap-2">
                            <p className="text-2xl font-black tracking-tight text-purple-400 font-mono">{kpis.roas_real.toFixed(2)}x</p>
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-black border font-mono ${
                                kpis.roas_real >= 3 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                    : kpis.roas_real >= 2 ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                                        : 'bg-red-500/10 text-red-400 border-red-500/20'
                            }`}>{kpis.roas_real >= 3 ? 'BUENO' : kpis.roas_real >= 2 ? 'MEDIO' : 'BAJO'}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-card-border/50">
                            <span className="text-[10px] font-black text-muted uppercase tracking-wider">Fact. Desp.</span>
                            <span className="font-mono text-sm font-black text-emerald-500">{formatCurrency(kpis.fact_despachada)}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                            {growthRoas !== null && Math.abs(growthRoas) >= 0.1 && (
                                <div className={`flex items-center gap-0.5 text-[9px] font-bold ${growthRoas > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                    {growthRoas > 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                                    ROAS {Math.abs(growthRoas).toFixed(1)}%
                                </div>
                            )}
                            {growthFact !== null && Math.abs(growthFact) >= 0.1 && (
                                <div className={`flex items-center gap-0.5 text-[9px] font-bold ${growthFact > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                    {growthFact > 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                                    Fact. {Math.abs(growthFact).toFixed(1)}%
                                </div>
                            )}
                        </div>
                    </div>
                );
            })()}

            {/* CPA Facebook + CPA Despachado (Combined) */}
            {(() => {
                const growthFb = prevCpaFb && prevCpaFb > 0
                    ? ((cpaFb - prevCpaFb) / Math.abs(prevCpaFb)) * 100 : null;
                const growthDesp = prevCpaRealDesp && prevCpaRealDesp > 0
                    ? ((cpaRealDesp - prevCpaRealDesp) / Math.abs(prevCpaRealDesp)) * 100 : null;
                return (
                    <div className="bg-card border border-card-border rounded-2xl p-4 hover:border-accent/30 transition-all shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-[10px] font-black text-muted uppercase tracking-widest flex items-center gap-1.5">CPA FB / Despachado <InfoTooltip text="CPA Facebook: costo por compra reportado por Meta. CPA Despachado: gasto total en ads / órdenes despachadas. % AOV indica proporción sobre el valor promedio de orden." /></span>
                            <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-sky-500/10 shrink-0">
                                <Megaphone className="w-4 h-4 text-sky-400" />
                            </div>
                        </div>
                        <div className="flex items-baseline gap-3">
                            <div>
                                <p className="text-[9px] font-black text-muted uppercase tracking-wider mb-0.5">Facebook</p>
                                <p className="text-xl font-black tracking-tight text-sky-400 font-mono">{formatCurrency(cpaFb)}</p>
                            </div>
                            <div className="w-px h-8 bg-card-border" />
                            <div>
                                <p className="text-[9px] font-black text-muted uppercase tracking-wider mb-0.5">Despachado</p>
                                <p className={`text-xl font-black tracking-tight font-mono ${
                                    cpaDespPctFact <= 20 ? 'text-emerald-400' : cpaDespPctFact <= 30 ? 'text-amber-500' : 'text-red-400'
                                }`}>{formatCurrency(cpaRealDesp)}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-black border font-mono ${
                                cpaFbPctAov <= 20 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                    : cpaFbPctAov <= 35 ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                                        : 'bg-red-500/10 text-red-400 border-red-500/20'
                            }`}>FB {cpaFbPctAov.toFixed(1)}% AOV</span>
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-black border font-mono ${
                                cpaDespPctFact <= 20 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                    : cpaDespPctFact <= 30 ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                                        : 'bg-red-500/10 text-red-400 border-red-500/20'
                            }`}>Desp {cpaDespPctFact.toFixed(1)}% AOV</span>
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                            {growthFb !== null && Math.abs(growthFb) >= 0.1 && (
                                <div className={`flex items-center gap-0.5 text-[9px] font-bold ${growthFb < 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                    {growthFb < 0 ? <TrendingDown className="w-2.5 h-2.5" /> : <TrendingUp className="w-2.5 h-2.5" />}
                                    FB {Math.abs(growthFb).toFixed(1)}%
                                </div>
                            )}
                            {growthDesp !== null && Math.abs(growthDesp) >= 0.1 && (
                                <div className={`flex items-center gap-0.5 text-[9px] font-bold ${growthDesp < 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                    {growthDesp < 0 ? <TrendingDown className="w-2.5 h-2.5" /> : <TrendingUp className="w-2.5 h-2.5" />}
                                    Desp {Math.abs(growthDesp).toFixed(1)}%
                                </div>
                            )}
                        </div>
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
                            <span className="text-[10px] font-black text-muted uppercase tracking-widest flex items-center gap-1.5">Utilidad Proyectada <InfoTooltip text="Ganancia estimada: ingresos - costos de producto - flete - ads, ajustado por la tasa de entrega proyectada." /></span>
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

            {/* Órdenes Despachadas */}
            {(() => {
                const prevDesp = prevKpis?.n_nc || 0;
                const growthPct = prevDesp > 0
                    ? ((kpis.n_nc - prevDesp) / Math.abs(prevDesp)) * 100 : null;
                return (
                    <div className="bg-card border border-card-border rounded-2xl p-4 hover:border-accent/30 transition-all shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-[10px] font-black text-muted uppercase tracking-widest flex items-center gap-1.5">Órdenes Desp. <InfoTooltip text="Total de órdenes no canceladas despachadas en el periodo. AOV = valor promedio por orden despachada." /></span>
                            <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-blue-500/10 shrink-0">
                                <Zap className="w-4 h-4 text-blue-400" />
                            </div>
                        </div>
                        <p className="text-2xl font-black tracking-tight text-blue-400 font-mono">{kpis.n_nc}</p>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <span className="text-xs text-muted">AOV</span>
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono">{formatCurrency(aov)}</span>
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
