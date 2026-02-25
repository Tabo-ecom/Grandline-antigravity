import React from 'react';
import { Activity, ChevronDown, Loader2, Check, Zap } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/currency';
import { evaluateHealth, getHealthColor, findTarget } from '@/lib/utils/health';
import InfoTooltip from '@/components/common/InfoTooltip';

interface ProductMetric {
    id: string;
    name: string;
    orderCount: number;
    deliveryRate: number;
    cancelRate: number;
    transitRate: number;
    returnRate: number;
    profit: number;
    adSpend: number;
    netSales: number;
    roas: number;
    cpa: number;
    projectedProfit: number;
    projectionConfig: number;
}

interface CountryMetric {
    name: string;
    currency: string;
    orderCount: number;
    deliveryRate: number;
    cancelRate: number;
    transitRate: number;
    returnRate: number;
    cancelCount: number;
    sales: number;
    adSpend: number;
    profit: number;
    projectedProfit: number;
    projectionConfig: number;
    products: ProductMetric[];
}

function getFlagCode(countryName: string) {
    const map: Record<string, string> = {
        'Colombia': 'co', 'México': 'mx', 'Perú': 'pe', 'Ecuador': 'ec',
        'Panamá': 'pa', 'Chile': 'cl', 'España': 'es', 'Guatemala': 'gt',
    };
    return map[countryName] || 'un';
}

interface CountryTableProps {
    metricsByCountry: CountryMetric[];
    expandedCountry: string | null;
    setExpandedCountry: (country: string | null) => void;
    localOverrides: any;
    updateCountryOverride: (country: string, val: number) => void;
    updateProductOverride: (country: string, productId: string, val: number) => void;
    handleSaveProjections: () => void;
    isSavingProjections: boolean;
    saveSuccess: boolean;
    kpiTargets: any[];
}

export default function CountryTable({
    metricsByCountry,
    expandedCountry,
    setExpandedCountry,
    localOverrides,
    updateCountryOverride,
    updateProductOverride,
    handleSaveProjections,
    isSavingProjections,
    saveSuccess,
    kpiTargets,
}: CountryTableProps) {
    return (
        <div className="bg-card border border-card-border rounded-2xl shadow-sm">
            <div className="p-6 border-b border-card-border flex justify-between items-center">
                <div className="flex items-center justify-between w-full">
                    <h2 className="text-xl font-black uppercase tracking-tighter flex items-center gap-3">
                        <Activity className="w-6 h-6 text-indigo-500" />
                        Operación Global
                        <InfoTooltip text="Desglose por país con métricas de logística y finanzas. Proj % = tasa de entrega proyectada para calcular utilidad." />
                    </h2>
                    {localOverrides && (
                        <button
                            onClick={handleSaveProjections}
                            disabled={isSavingProjections}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${saveSuccess ? 'bg-emerald-500 text-white' : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'} disabled:opacity-50`}
                        >
                            {isSavingProjections ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                            ) : saveSuccess ? (
                                <Check className="w-3 h-3" />
                            ) : (
                                <Zap className="w-3 h-3" />
                            )}
                            {saveSuccess ? 'Guardado' : isSavingProjections ? 'Guardando...' : 'Guardar Brújula'}
                        </button>
                    )}
                </div>
            </div>
            <div className="overflow-x-auto max-h-[650px] overflow-y-auto">
                <table className="w-full text-left border-collapse" style={{ tableLayout: 'fixed', minWidth: '1100px' }}>
                    <colgroup>
                        <col style={{ width: '130px' }} />
                        <col style={{ width: '90px' }} />
                        <col style={{ width: '80px' }} />
                        <col style={{ width: '80px' }} />
                        <col style={{ width: '90px' }} />
                        <col style={{ width: '80px' }} />
                        <col style={{ width: '80px' }} />
                        <col style={{ width: '120px' }} />
                        <col style={{ width: '120px' }} />
                        <col style={{ width: '110px' }} />
                        <col style={{ width: '110px' }} />
                        <col style={{ width: '110px' }} />
                        <col style={{ width: '110px' }} />
                        <col style={{ width: '44px' }} />
                    </colgroup>
                    <thead className="sticky top-0 z-20">
                        <tr className="bg-card border-b border-card-border">
                            <th className="px-5 py-2 border-r border-card-border bg-card"></th>
                            <th colSpan={6} className="px-5 py-2 text-center text-[10px] font-black uppercase text-blue-400 tracking-widest border-r border-card-border bg-blue-500/5">
                                Grupo Logística
                            </th>
                            <th colSpan={6} className="px-5 py-2 text-center text-[10px] font-black uppercase text-emerald-400 tracking-widest bg-emerald-500/5">
                                Grupo Financiero
                            </th>
                            <th className="px-5 py-2 bg-card"></th>
                        </tr>
                        <tr className="bg-card text-muted uppercase text-[9px] font-black tracking-widest border-b border-card-border">
                            <th className="px-5 py-3.5 border-r border-card-border sticky left-0 z-30 bg-card">País</th>
                            <th className="px-5 py-3.5 text-center bg-blue-500/5 whitespace-nowrap border-l border-blue-500/20">Proj %</th>
                            <th className="px-5 py-3.5 text-center bg-blue-500/5">Órdenes</th>
                            <th className="px-5 py-3.5 text-center bg-blue-500/5">% Canc.</th>
                            <th className="px-5 py-3.5 text-center bg-blue-500/5">% Entrega</th>
                            <th className="px-5 py-3.5 text-center bg-blue-500/5">% Tránsito</th>
                            <th className="px-5 py-3.5 text-center border-r border-card-border bg-blue-500/5">% Dev.</th>
                            <th className="px-5 py-3.5 text-right bg-emerald-500/5">Venta Desp.</th>
                            <th className="px-5 py-3.5 text-right bg-emerald-500/5">Ads (Part.)</th>
                            <th className="px-5 py-3.5 text-right bg-emerald-500/5">CPA Desp.</th>
                            <th className="px-5 py-3.5 text-right bg-emerald-500/5">CPA Ent.</th>
                            <th className="px-5 py-3.5 text-right bg-emerald-500/5">Utd. Real</th>
                            <th className="px-5 py-3.5 text-right bg-emerald-500/5">Utd. Proy.</th>
                            <th className="px-5 py-3.5"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-card-border">
                        {metricsByCountry.map((ctry: CountryMetric) => {
                            const dispatched = ctry.products.reduce((s: number, p: ProductMetric) => s + p.orderCount, 0);
                            const adPart = ctry.sales > 0 ? (ctry.adSpend / ctry.sales) * 100 : 0;
                            const cpa = dispatched > 0 ? ctry.adSpend / dispatched : 0;
                            return (
                                <React.Fragment key={ctry.name}>
                                    <tr className="hover:bg-hover-bg transition-colors group cursor-pointer" onClick={() => setExpandedCountry(expandedCountry === ctry.name ? null : ctry.name)}>
                                        <td className="px-5 py-4 font-bold text-foreground border-r border-card-border sticky left-0 z-20 bg-card group-hover:bg-hover-bg">
                                            <div className="flex items-center gap-2.5 text-sm">
                                                <img src={`https://flagcdn.com/w20/${getFlagCode(ctry.name)}.png`} alt={ctry.name} className="w-5 h-3 rounded-sm object-cover" />
                                                {ctry.name}
                                            </div>
                                        </td>
                                        <td className="px-5 py-4 text-center border-l border-blue-500/20 bg-blue-500/5">
                                            <div className="flex items-center justify-center gap-1">
                                                <input
                                                    type="number"
                                                    value={localOverrides?.countries?.[ctry.name]?.delivery_percent ?? ctry.projectionConfig}
                                                    onChange={(e) => updateCountryOverride(ctry.name, parseFloat(e.target.value))}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="w-12 bg-transparent border-b border-transparent hover:border-muted focus:border-indigo-500 focus:outline-none text-center font-mono text-sm transition-colors"
                                                />
                                                <span className="text-[10px] text-muted">%</span>
                                            </div>
                                        </td>
                                        <td className="px-5 py-4 text-center font-mono text-foreground/80 text-sm bg-blue-500/5">{ctry.orderCount}</td>
                                        <td className="px-5 py-4 text-center bg-blue-500/5">
                                            <span className={`font-mono font-bold text-xs ${getHealthColor(findTarget(kpiTargets, 'tasa_can') ? evaluateHealth(ctry.cancelRate, findTarget(kpiTargets, 'tasa_can')!) : ctry.cancelRate > 30 ? 'bad' : ctry.cancelRate > 15 ? 'warning' : 'good')}`}>
                                                {ctry.cancelRate.toFixed(1)}%
                                            </span>
                                        </td>
                                        <td className="px-5 py-4 text-center bg-blue-500/5">
                                            <span className={`font-mono font-bold text-xs ${getHealthColor(findTarget(kpiTargets, 'tasa_ent') ? evaluateHealth(ctry.deliveryRate, findTarget(kpiTargets, 'tasa_ent')!) : ctry.deliveryRate > 70 ? 'good' : ctry.deliveryRate > 50 ? 'warning' : 'bad')}`}>
                                                {ctry.deliveryRate.toFixed(1)}%
                                            </span>
                                        </td>
                                        <td className="px-5 py-4 text-center text-xs font-mono text-blue-400 bg-blue-500/5">{ctry.transitRate.toFixed(1)}%</td>
                                        <td className="px-5 py-4 text-center text-xs font-mono text-amber-500 border-r border-card-border bg-blue-500/5">{ctry.returnRate.toFixed(1)}%</td>
                                        <td className="px-5 py-4 text-right font-mono text-foreground/80 text-sm bg-emerald-500/5">{formatCurrency(ctry.sales)}</td>
                                        <td className="px-5 py-4 text-right bg-emerald-500/5">
                                            <div className="flex flex-col items-end gap-0.5">
                                                <span className="font-mono text-rose-400 text-sm">{formatCurrency(ctry.adSpend)}</span>
                                                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${findTarget(kpiTargets, 'perc_ads_revenue') ? (evaluateHealth(adPart, findTarget(kpiTargets, 'perc_ads_revenue')!) === 'good' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-400') : adPart > 25 ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-500'}`}>
                                                    {adPart.toFixed(1)}% PART.
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-5 py-4 text-right bg-emerald-500/5">
                                            <div className="flex flex-col items-end gap-0.5">
                                                <span className="font-mono text-purple-400 text-sm">{formatCurrency(cpa)}</span>
                                                <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400">CPA DESP.</span>
                                            </div>
                                        </td>
                                        {(() => {
                                            const deliveryRate = (localOverrides?.countries?.[ctry.name]?.delivery_percent ?? ctry.projectionConfig) / 100;
                                            const projDelivered = dispatched * deliveryRate;
                                            const cpaEnt = projDelivered > 0 ? ctry.adSpend / projDelivered : 0;
                                            return (
                                                <td className="px-5 py-4 text-right bg-emerald-500/5">
                                                    <div className="flex flex-col items-end gap-0.5">
                                                        <span className="font-mono text-indigo-400 text-sm">{formatCurrency(cpaEnt)}</span>
                                                        <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400">CPA ENT.</span>
                                                    </div>
                                                </td>
                                            );
                                        })()}
                                        <td className="px-5 py-4 text-right bg-emerald-500/5">
                                            <div className="flex flex-col items-end gap-0.5">
                                                <span className={`font-mono font-bold text-sm ${ctry.profit >= 0 ? 'text-foreground' : 'text-red-400'}`}>{formatCurrency(ctry.profit)}</span>
                                                {ctry.sales > 0 && <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${ctry.profit >= 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-400'}`}>{((ctry.profit / ctry.sales) * 100).toFixed(1)}% MARGEN</span>}
                                            </div>
                                        </td>
                                        <td className="px-5 py-4 text-right bg-emerald-500/5">
                                            <div className="flex flex-col items-end gap-0.5">
                                                <span className={`font-mono text-sm font-bold ${ctry.projectedProfit >= 0 ? 'text-blue-400' : 'text-red-400'}`}>{formatCurrency(ctry.projectedProfit)}</span>
                                                {ctry.sales > 0 && <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${ctry.projectedProfit >= 0 ? 'bg-blue-500/10 text-blue-400' : 'bg-red-500/10 text-red-400'}`}>{((ctry.projectedProfit / ctry.sales) * 100).toFixed(1)}% MARGEN</span>}
                                            </div>
                                        </td>
                                        <td className="px-5 py-4 text-center">
                                            <ChevronDown className={`w-4 h-4 text-muted transition-transform ${expandedCountry === ctry.name ? 'rotate-180' : ''}`} />
                                        </td>
                                    </tr>
                                    {expandedCountry === ctry.name && (
                                        <>
                                            <tr className="bg-hover-bg/30">
                                                <td colSpan={14} className="px-6 py-2 text-[10px] font-black uppercase text-muted tracking-widest border-b border-card-border sticky left-0 z-10 bg-hover-bg/30">
                                                    Detalle de Operación: {ctry.name}
                                                </td>
                                            </tr>
                                            {ctry.products.map((prod: ProductMetric, idx: number) => {
                                                const pAdPart = prod.netSales > 0 ? (prod.adSpend / prod.netSales) * 100 : 0;
                                                const pCpa = prod.orderCount > 0 ? prod.adSpend / prod.orderCount : 0;
                                                const prodDeliveryPct = (localOverrides?.products?.[ctry.name]?.[prod.id] ?? prod.projectionConfig) / 100;
                                                const pCpaEnt = prod.orderCount > 0 && prodDeliveryPct > 0 ? prod.adSpend / (prod.orderCount * prodDeliveryPct) : 0;
                                                return (
                                                    <tr key={idx} className="border-b border-card-border last:border-0 hover:bg-white/5 transition-colors group/row bg-card/40">
                                                        <td className="px-5 py-3 font-medium text-foreground/80 sticky left-0 z-20 bg-card group-hover/row:bg-hover-bg overflow-hidden text-ellipsis whitespace-nowrap transition-colors pl-8" title={prod.name}>
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-1 h-3 rounded-full bg-border"></div>
                                                                <span className="truncate max-w-[150px]">{prod.name}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-5 py-3 text-center bg-blue-500/5">
                                                            <div className="flex items-center justify-center gap-1">
                                                                <input
                                                                    type="number"
                                                                    value={localOverrides?.products?.[ctry.name]?.[prod.id] ?? prod.projectionConfig}
                                                                    onChange={(e) => updateProductOverride(ctry.name, prod.id, parseFloat(e.target.value))}
                                                                    className="w-10 bg-transparent border-b border-transparent hover:border-muted focus:border-indigo-500 focus:outline-none text-center font-mono transition-colors"
                                                                />
                                                                <span className="text-[9px] text-muted">%</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-5 py-3 text-center font-mono text-sm bg-blue-500/5">{prod.orderCount}</td>
                                                        <td className="px-5 py-3 text-center font-mono text-xs text-red-400 bg-blue-500/5">{prod.cancelRate.toFixed(1)}%</td>
                                                        <td className="px-5 py-3 text-center font-mono text-xs text-emerald-400 bg-blue-500/5">{prod.deliveryRate.toFixed(1)}%</td>
                                                        <td className="px-5 py-3 text-center font-mono text-xs text-blue-400 bg-blue-500/5">{prod.transitRate.toFixed(1)}%</td>
                                                        <td className="px-5 py-3 text-center font-mono text-xs text-orange-400 bg-blue-500/5 border-r border-card-border">{prod.returnRate.toFixed(1)}%</td>
                                                        <td className="px-5 py-3 text-right font-mono text-foreground/80 text-sm bg-emerald-500/5">{formatCurrency(prod.netSales)}</td>
                                                        <td className="px-5 py-3 text-right bg-emerald-500/5">
                                                            <div className="flex flex-col items-end gap-0.5">
                                                                <span className="font-mono text-rose-400 text-sm">{formatCurrency(prod.adSpend)}</span>
                                                                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${pAdPart > 25 ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-500'}`}>
                                                                    {pAdPart.toFixed(1)}% PART.
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="px-5 py-3 text-right bg-emerald-500/5">
                                                            <div className="flex flex-col items-end gap-0.5">
                                                                <span className="font-mono text-purple-400 text-sm">{formatCurrency(pCpa)}</span>
                                                                <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400">CPA DESP.</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-5 py-3 text-right bg-emerald-500/5">
                                                            <div className="flex flex-col items-end gap-0.5">
                                                                <span className="font-mono text-indigo-400 text-sm">{formatCurrency(pCpaEnt)}</span>
                                                                <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400">CPA ENT.</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-5 py-3 text-right bg-emerald-500/5">
                                                            <div className="flex flex-col items-end gap-0.5">
                                                                <span className={`font-mono text-sm ${prod.profit >= 0 ? 'text-foreground' : 'text-red-400'}`}>{formatCurrency(prod.profit)}</span>
                                                                {prod.netSales > 0 && <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${prod.profit >= 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-400'}`}>{((prod.profit / prod.netSales) * 100).toFixed(1)}% MARG.</span>}
                                                            </div>
                                                        </td>
                                                        <td className="px-5 py-3 text-right bg-emerald-500/5">
                                                            <div className="flex flex-col items-end gap-0.5">
                                                                <span className={`font-mono font-bold text-sm ${prod.projectedProfit >= 0 ? 'text-blue-400' : 'text-red-400'}`}>{formatCurrency(prod.projectedProfit)}</span>
                                                                {prod.netSales > 0 && <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${prod.projectedProfit >= 0 ? 'bg-blue-500/10 text-blue-400' : 'bg-red-500/10 text-red-400'}`}>{((prod.projectedProfit / prod.netSales) * 100).toFixed(1)}% MARG.</span>}
                                                            </div>
                                                        </td>
                                                        <td className="px-5 py-3 text-center"></td>
                                                    </tr>
                                                );
                                            })}
                                        </>
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
