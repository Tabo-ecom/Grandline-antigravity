import re

with open('app/dashboard/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix 1: CPA Entregado badge calculation
old_cpa_entregado_calc = '''                        const cpaEntregado = projectedDelivered > 0 ? (kpis?.g_ads || 0) / projectedDelivered : 0;
                        const adsPctFacturado = kpis?.fact_neto && kpis.fact_neto > 0 ? ((kpis.g_ads || 0) / kpis.fact_neto) * 100 : 0;'''

new_cpa_entregado_calc = '''                        const cpaEntregado = projectedDelivered > 0 ? (kpis?.g_ads || 0) / projectedDelivered : 0;
                        const aov = (kpis?.n_nc || 0) > 0 ? (kpis?.fact_neto || 0) / (kpis?.n_nc || 1) : 0;
                        const adsPctFacturado = aov > 0 ? (cpaEntregado / aov) * 100 : 0;'''

if old_cpa_entregado_calc in content:
    content = content.replace(old_cpa_entregado_calc, new_cpa_entregado_calc, 1)
    print("Fix 1: CPA Entregado badge formula updated OK")
else:
    print("Fix 1: CPA Entregado badge formula NOT FOUND")

# Fix 2: Sub-table flattened to tr elements
# We need to find the block starting with:
#                                     {/* Expanded Product Details */}
#                                     {expandedCountry === ctry.name && (
# and ending at the corresponding )} before </React.Fragment>

import sys
lines = content.split('\n')

start_idx = -1
end_idx = -1
for i, l in enumerate(lines):
    if '{/* Expanded Product Details */}' in l:
        start_idx = i
        break

if start_idx != -1:
    # find the end of the expandedCountry block before </React.Fragment>
    for i in range(start_idx, len(lines)):
        if '</React.Fragment>' in lines[i]:
            # The )} is likely right above it
            if ')}' in lines[i-1]:
                end_idx = i-1
            elif ')}' in lines[i-2]:
                end_idx = i-2
            break

if start_idx != -1 and end_idx != -1:
    print(f"Found Expanded Product Details at lines {start_idx} to {end_idx}")

    new_subtable = '''                                    {/* Expanded Product Details (Flattened) */}
                                    {expandedCountry === ctry.name && (
                                        <React.Fragment>
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
                                                        {/* Proj % */}
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
                                                        {/* Órdenes */}
                                                        <td className="px-5 py-3 text-center font-mono text-sm bg-blue-500/5">{prod.orderCount}</td>
                                                        {/* % Can */}
                                                        <td className="px-5 py-3 text-center font-mono text-xs text-red-400 bg-blue-500/5">{prod.cancelRate.toFixed(1)}%</td>
                                                        {/* % Ent */}
                                                        <td className="px-5 py-3 text-center font-mono text-xs text-emerald-400 bg-blue-500/5">{prod.deliveryRate.toFixed(1)}%</td>
                                                        {/* % Tránsito */}
                                                        <td className="px-5 py-3 text-center font-mono text-xs text-blue-400 bg-blue-500/5">{prod.transitRate.toFixed(1)}%</td>
                                                        {/* % Dev */}
                                                        <td className="px-5 py-3 text-center font-mono text-xs text-orange-400 bg-blue-500/5 border-r border-card-border">{prod.returnRate.toFixed(1)}%</td>
                                                        
                                                        {/* Financial */}
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
                                        </React.Fragment>
                                    )}'''

    lines = lines[:start_idx] + new_subtable.split('\n') + lines[end_idx+1:]
    content = '\n'.join(lines)
    print("Fix 2: Sub-table flattened to tr elements OK")
else:
    print("Fix 2: Could not find Expanded Product Details block")

with open('app/dashboard/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Saved to app/dashboard/page.tsx")
