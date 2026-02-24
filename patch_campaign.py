import re

with open('app/dashboard/page.tsx', 'r') as f:
    pass # just testing if I should use python. Yes, let's write to components/publicidad/CampaignAnalysis.tsx

with open('components/publicidad/CampaignAnalysis.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the table part with the new card-based layout

# The table starts at:
#             <div className="flex-1 overflow-auto relative">
#                 <table className="w-full text-left border-collapse min-w-[1200px]">

# We will replace everything from `<div className="flex-1 overflow-auto relative">` to the end of the return statement.

new_ui = """            <div className="flex-1 overflow-auto relative px-4 pb-4">
                {/* Header Row */}
                <div className="hidden lg:grid grid-cols-[1.5fr_1fr_1fr_1fr_1fr_1fr_1fr] lg:grid-cols-[2.5fr_0.8fr_0.8fr_1fr_1fr_1fr_1fr] gap-4 px-6 py-4 border-b border-card-border sticky top-0 bg-card/95 backdrop-blur-sm z-30 mb-2 rounded-t-2xl">
                    <div className="text-[10px] font-black uppercase tracking-widest text-muted">Producto / Campaña</div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-muted text-center">Estado (Vega)</div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-muted text-right">Compras (Reales)</div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-muted text-right">Gasto Ads</div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-muted text-right">ROAS Real</div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-muted text-right">CPA Real</div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-muted text-right">Fact. Dropi</div>
                </div>

                <div className="space-y-3">
                    {filteredProducts.map(p => {
                        const isExpanded = expandedProducts[p.productId];
                        
                        const comprasReales = p.summary.real_cpa > 0 ? Math.round(p.summary.amount / p.summary.real_cpa) : 0;
                        const roasReal = p.summary.amount > 0 ? p.summary.facturado_despachado / p.summary.amount : 0;
                        
                        let badgeColor = 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
                        let badgeText = '🟡 Observar';
                        if (roasReal > 2) { badgeColor = 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'; badgeText = '🟢 Escalar'; }
                        else if (roasReal < 1 && p.summary.amount > 0) { badgeColor = 'bg-rose-500/10 text-rose-500 border-rose-500/20'; badgeText = '🔴 Kill Switch'; }
                        else if (p.summary.amount === 0) { badgeColor = 'bg-muted/10 text-muted border-card-border'; badgeText = '⚪ Sin Gasto'; }

                        return (
                            <div key={p.productId} className="flex flex-col bg-card border border-card-border rounded-2xl overflow-hidden shadow-sm hover:border-accent/40 transition-colors">
                                {/* Parent Row */}
                                <div 
                                    onClick={() => toggleExpand(p.productId)}
                                    className={`grid block lg:grid lg:grid-cols-[2.5fr_0.8fr_0.8fr_1fr_1fr_1fr_1fr] items-center gap-4 px-6 py-4 cursor-pointer transition-colors ${isExpanded ? 'bg-hover-bg' : 'hover:bg-hover-bg'}`}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="bg-card border border-card-border w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-sm">
                                            {isExpanded ? <ChevronDown className="w-4 h-4 text-muted" /> : <ChevronRight className="w-4 h-4 text-muted" />}
                                        </div>
                                        <div className="min-w-0">
                                            <h4 className="font-black text-sm text-foreground truncate">{p.productName}</h4>
                                            <p className="text-[10px] text-muted font-bold uppercase tracking-wider mt-0.5">{p.campaigns.length} Campañas</p>
                                        </div>
                                    </div>

                                    <div className="lg:text-center mt-2 lg:mt-0">
                                        <span className={`inline-block px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${badgeColor}`}>
                                            {badgeText}
                                        </span>
                                    </div>

                                    <div className="flex items-center justify-between lg:block lg:text-right mt-2 lg:mt-0">
                                        <span className="lg:hidden text-[10px] font-black text-muted uppercase">Compras: </span>
                                        <span className="font-mono text-sm font-bold text-foreground/80">{comprasReales}</span>
                                    </div>

                                    <div className="flex items-center justify-between lg:block lg:text-right mt-2 lg:mt-0">
                                        <span className="lg:hidden text-[10px] font-black text-muted uppercase">Gasto: </span>
                                        <div className="flex flex-col items-end">
                                            <span className="font-mono text-sm font-black text-orange-400">{formatCurrency(p.summary.amount)}</span>
                                            <GrowthBadge current={p.summary.amount} prev={p.summary.diff_amount} invert className="mt-0.5" />
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between lg:block lg:text-right mt-2 lg:mt-0">
                                        <span className="lg:hidden text-[10px] font-black text-muted uppercase">ROAS Real: </span>
                                        <span className={`font-mono text-sm font-black ${roasReal > 2 ? 'text-emerald-400' : roasReal < 1 && p.summary.amount > 0 ? 'text-rose-400' : 'text-yellow-400'}`}>
                                            {roasReal > 0 ? `${roasReal.toFixed(2)}x` : '-'}
                                        </span>
                                    </div>

                                    <div className="flex items-center justify-between lg:block lg:text-right mt-2 lg:mt-0">
                                        <span className="lg:hidden text-[10px] font-black text-muted uppercase">CPA Real: </span>
                                        <div className="flex flex-col items-end">
                                            <span className="font-mono text-sm font-black text-emerald-400">{p.summary.real_cpa > 0 ? formatCurrency(p.summary.real_cpa) : '-'}</span>
                                            <GrowthBadge current={p.summary.real_cpa} prev={p.summary.diff_real_cpa} invert className="mt-0.5" />
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between lg:block lg:text-right mt-2 lg:mt-0">
                                        <span className="lg:hidden text-[10px] font-black text-muted uppercase">Fact.: </span>
                                        <span className="font-mono text-sm font-black text-foreground/80">{formatCurrency(p.summary.facturado_despachado)}</span>
                                    </div>
                                </div>

                                {/* Expanded Campaigns */}
                                {isExpanded && (
                                    <div className="bg-[#0a0f16]/50 border-t border-card-border divide-y divide-[#ffffff0a]">
                                        {p.campaigns.map((c: any, i: number) => {
                                            const isFb = c.platform === 'facebook';
                                            const campCompras = c.real_cpa > 0 ? Math.round(c.amount / c.real_cpa) : 0;
                                            const campRoas = c.amount > 0 && c.cpa_pct > 0 ? 100 / c.cpa_pct : 0;
                                            
                                            let cBadgeColor = 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
                                            let cBadgeText = '🟡 Observar';
                                            if (campRoas > 2) { cBadgeColor = 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'; cBadgeText = '🟢 Escalar'; }
                                            else if (campRoas < 1 && c.amount > 0) { cBadgeColor = 'bg-rose-500/10 text-rose-500 border-rose-500/20'; cBadgeText = '🔴 Kill Switch'; }
                                            else if (c.amount === 0) { cBadgeColor = 'bg-muted/10 text-muted border-card-border'; cBadgeText = '⚪ Sin Gasto'; }

                                            return (
                                                <div key={`${p.productId}-${i}`} className="grid block lg:grid lg:grid-cols-[2.5fr_0.8fr_0.8fr_1fr_1fr_1fr_1fr] items-center gap-4 px-6 py-3.5 hover:bg-hover-bg transition-colors pl-8 lg:pl-10">
                                                    <div className="flex items-center gap-3 w-full min-w-0 pr-4">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-card-border shrink-0"></div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                {isFb ? <Facebook className="w-3.5 h-3.5 text-blue-400 shrink-0" /> : <TikTokIcon className="w-3.5 h-3.5 text-[#00f2fe] shrink-0" />}
                                                                <h5 className="text-xs font-semibold text-foreground/80 truncate" title={c.campaignName}>{c.campaignName}</h5>
                                                            </div>
                                                            <div className="flex items-center gap-3 mt-1 text-[9px] font-mono text-muted">
                                                                <span title="Click-Through Rate">CTR: {c.ctr.toFixed(2)}%</span>
                                                                <span title="Cost Per Click">CPC: {formatCurrency(c.cpc)}</span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="lg:text-center mt-2 lg:mt-0">
                                                        <span className={`inline-block px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border ${cBadgeColor}`}>
                                                            {cBadgeText}
                                                        </span>
                                                    </div>

                                                    <div className="flex items-center justify-between lg:block lg:text-right mt-1 lg:mt-0">
                                                        <span className="lg:hidden text-[9px] font-black text-muted uppercase">Compras: </span>
                                                        <span className="font-mono text-xs text-foreground/70">{campCompras}</span>
                                                    </div>

                                                    <div className="flex items-center justify-between lg:block lg:text-right mt-1 lg:mt-0">
                                                        <span className="lg:hidden text-[9px] font-black text-muted uppercase">Gasto: </span>
                                                        <span className="font-mono text-xs font-semibold text-orange-400/80">{formatCurrency(c.amount)}</span>
                                                    </div>

                                                    <div className="flex items-center justify-between lg:block lg:text-right mt-1 lg:mt-0">
                                                        <span className="lg:hidden text-[9px] font-black text-muted uppercase">ROAS Real: </span>
                                                        <span className={`font-mono text-xs font-bold ${campRoas > 2 ? 'text-emerald-400/80' : campRoas < 1 && c.amount > 0 ? 'text-rose-400/80' : 'text-yellow-400/80'}`}>
                                                            {campRoas > 0 ? `${campRoas.toFixed(2)}x` : '-'}
                                                        </span>
                                                    </div>

                                                    <div className="flex items-center justify-between lg:block lg:text-right mt-1 lg:mt-0">
                                                        <span className="lg:hidden text-[9px] font-black text-muted uppercase">CPA Real: </span>
                                                        <span className="font-mono text-xs font-bold text-emerald-400/80">{c.real_cpa > 0 ? formatCurrency(c.real_cpa) : '-'}</span>
                                                    </div>

                                                    <div className="flex items-center justify-between lg:block lg:text-right mt-1 lg:mt-0">
                                                        {c.cpa_pct > 0 ? (
                                                            <span className="font-mono text-[10px] bg-card p-1 rounded border border-card-border text-foreground/60">{c.cpa_pct.toFixed(1)}% ADS</span>
                                                        ) : (
                                                            <span className="text-muted text-xs">-</span>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {filteredProducts.length === 0 && (
                        <div className="px-6 py-20 text-center text-muted bg-card border border-card-border rounded-2xl">
                            <div className="flex flex-col items-center justify-center gap-3">
                                <Filter className="w-8 h-8 opacity-20" />
                                <p className="text-sm font-medium">No se encontraron productos para los filtros seleccionados ({dateRange}).</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
"""

parts = content.split('<div className="flex-1 overflow-auto relative">')

if len(parts) == 2:
    new_content = parts[0] + new_ui
    with open('components/publicidad/CampaignAnalysis.tsx', 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("Replaced CampaignAnalysis successfully")
else:
    print("Could not find split target in CampaignAnalysis")

