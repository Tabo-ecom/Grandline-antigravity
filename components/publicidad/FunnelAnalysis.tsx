'use client';

import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, TrendingUp, TrendingDown, Minus, Eye, MousePointer, Globe, ShoppingCart, CreditCard, BarChart3 } from 'lucide-react';

interface AdSpendRecord {
    campaignName?: string;
    productId: string;
    amount: number;
    impressions?: number;
    clicks?: number;
    page_visits?: number;
    add_to_cart?: number;
    conversions?: number;
    revenue_attributed?: number;
    date: string;
    platform: string;
    country: string;
}

interface FunnelAnalysisProps {
    history: AdSpendRecord[];
    startDate: string;
    endDate: string;
    selectedProduct: string;
}

interface FunnelStep {
    key: string;
    label: string;
    icon: React.ElementType;
    value: number;
    prevValue: number; // for comparison
    color: string;
    costPer: number; // cost per action at this step
}

const fmt = (n: number) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toLocaleString('es-CO');
};

const fmtMoney = (n: number) => `$${fmt(n)}`;

const fmtPct = (n: number) => `${n.toFixed(1)}%`;

export function FunnelAnalysis({ history, startDate, endDate, selectedProduct }: FunnelAnalysisProps) {
    const [expandedProduct, setExpandedProduct] = useState<string | null>(null);

    // Group history by product
    const productData = useMemo(() => {
        const byProduct: Record<string, {
            spend: number; impressions: number; clicks: number;
            page_visits: number; add_to_cart: number; conversions: number;
            revenue: number; campaigns: Set<string>; records: AdSpendRecord[];
        }> = {};

        for (const h of history) {
            const pid = h.productId || 'Sin asignar';
            if (selectedProduct && selectedProduct !== 'Todos' && pid !== selectedProduct) continue;

            if (!byProduct[pid]) {
                byProduct[pid] = { spend: 0, impressions: 0, clicks: 0, page_visits: 0, add_to_cart: 0, conversions: 0, revenue: 0, campaigns: new Set(), records: [] };
            }
            const p = byProduct[pid];
            p.spend += h.amount || 0;
            p.impressions += h.impressions || 0;
            p.clicks += h.clicks || 0;
            p.page_visits += h.page_visits || 0;
            p.add_to_cart += h.add_to_cart || 0;
            p.conversions += h.conversions || 0;
            p.revenue += h.revenue_attributed || 0;
            if (h.campaignName) p.campaigns.add(h.campaignName);
            p.records.push(h);
        }

        return Object.entries(byProduct)
            .map(([name, data]) => ({ name, ...data, campaignCount: data.campaigns.size }))
            .sort((a, b) => b.spend - a.spend);
    }, [history, selectedProduct]);

    // Aggregated funnel (all products or selected)
    const totalFunnel = useMemo(() => {
        const totals = { spend: 0, impressions: 0, clicks: 0, page_visits: 0, add_to_cart: 0, conversions: 0, revenue: 0 };
        for (const p of productData) {
            totals.spend += p.spend;
            totals.impressions += p.impressions;
            totals.clicks += p.clicks;
            totals.page_visits += p.page_visits;
            totals.add_to_cart += p.add_to_cart;
            totals.conversions += p.conversions;
            totals.revenue += p.revenue;
        }
        return totals;
    }, [productData]);

    const buildFunnelSteps = (data: typeof totalFunnel): FunnelStep[] => {
        const spend = data.spend || 1;
        return [
            { key: 'impressions', label: 'Impresiones', icon: Eye, value: data.impressions, prevValue: 0, color: '#6366f1', costPer: data.impressions ? spend / data.impressions * 1000 : 0 },
            { key: 'clicks', label: 'Clics', icon: MousePointer, value: data.clicks, prevValue: data.impressions, color: '#3b82f6', costPer: data.clicks ? spend / data.clicks : 0 },
            { key: 'page_visits', label: 'Visitas Landing', icon: Globe, value: data.page_visits, prevValue: data.clicks, color: '#06b6d4', costPer: data.page_visits ? spend / data.page_visits : 0 },
            { key: 'add_to_cart', label: 'Agregar Carrito', icon: ShoppingCart, value: data.add_to_cart, prevValue: data.page_visits, color: '#f59e0b', costPer: data.add_to_cart ? spend / data.add_to_cart : 0 },
            { key: 'conversions', label: 'Compras', icon: CreditCard, value: data.conversions, prevValue: data.add_to_cart, color: '#22c55e', costPer: data.conversions ? spend / data.conversions : 0 },
        ];
    };

    const funnelSteps = buildFunnelSteps(totalFunnel);
    const maxValue = Math.max(...funnelSteps.map(s => s.value), 1);

    return (
        <div className="bg-card border border-card-border rounded-2xl overflow-hidden">
            {/* Header */}
            <div className="px-5 py-4 border-b border-card-border flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-500">
                        <BarChart3 className="w-4 h-4 text-white" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold">Embudo de Conversion</h3>
                        <p className="text-[10px] text-muted">De impresiones a compras — {productData.length} productos</p>
                    </div>
                </div>
                <div className="text-right">
                    <div className="text-lg font-black text-accent">{fmtMoney(totalFunnel.spend)}</div>
                    <div className="text-[10px] text-muted">Inversion total</div>
                </div>
            </div>

            {/* Main Funnel */}
            <div className="px-5 py-6">
                <div className="max-w-2xl mx-auto space-y-0">
                    {funnelSteps.map((step, idx) => {
                        const widthPct = Math.max(20, (step.value / maxValue) * 100);
                        const convRate = step.prevValue > 0 ? (step.value / step.prevValue * 100) : 0;
                        const Icon = step.icon;
                        const isLast = idx === funnelSteps.length - 1;

                        return (
                            <div key={step.key}>
                                {/* Step bar */}
                                <div className="flex items-center gap-4 group">
                                    {/* Icon */}
                                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${step.color}20` }}>
                                        <Icon className="w-4 h-4" style={{ color: step.color }} />
                                    </div>

                                    {/* Bar */}
                                    <div className="flex-1">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-xs font-bold">{step.label}</span>
                                            <div className="flex items-center gap-3">
                                                <span className="text-sm font-black" style={{ color: step.color }}>{fmt(step.value)}</span>
                                                {step.key === 'impressions' && (
                                                    <span className="text-[10px] text-muted">CPM: {fmtMoney(step.costPer)}</span>
                                                )}
                                                {step.key === 'clicks' && (
                                                    <span className="text-[10px] text-muted">CPC: {fmtMoney(step.costPer)}</span>
                                                )}
                                                {step.key === 'conversions' && (
                                                    <span className="text-[10px] text-muted">CPA: {fmtMoney(step.costPer)}</span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="h-8 bg-hover-bg rounded-lg overflow-hidden relative">
                                            <div
                                                className="h-full rounded-lg transition-all duration-700 ease-out flex items-center px-3"
                                                style={{ width: `${widthPct}%`, background: `linear-gradient(90deg, ${step.color}40, ${step.color}20)`, borderLeft: `3px solid ${step.color}` }}
                                            >
                                                {widthPct > 30 && (
                                                    <span className="text-[10px] font-bold" style={{ color: step.color }}>{fmt(step.value)}</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Conversion arrow between steps */}
                                {!isLast && (
                                    <div className="flex items-center gap-4 py-1">
                                        <div className="w-9 flex justify-center">
                                            <div className="w-px h-4 bg-card-border" />
                                        </div>
                                        <div className="flex items-center gap-2 text-[10px]">
                                            <span className={`font-bold ${convRate >= 5 ? 'text-green-400' : convRate >= 2 ? 'text-yellow-400' : 'text-red-400'}`}>
                                                ↓ {convRate > 0 ? fmtPct(convRate) : '—'}
                                            </span>
                                            <span className="text-muted/40">conversion</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* ROAS summary */}
                {totalFunnel.conversions > 0 && (
                    <div className="mt-6 flex items-center justify-center gap-6 py-3 bg-hover-bg/50 rounded-xl">
                        <div className="text-center">
                            <div className="text-2xl font-black text-green-400">{totalFunnel.revenue > 0 ? `${(totalFunnel.revenue / totalFunnel.spend).toFixed(2)}x` : '—'}</div>
                            <div className="text-[9px] text-muted uppercase tracking-widest">ROAS</div>
                        </div>
                        <div className="w-px h-10 bg-card-border" />
                        <div className="text-center">
                            <div className="text-2xl font-black text-accent">{fmtMoney(totalFunnel.spend / totalFunnel.conversions)}</div>
                            <div className="text-[9px] text-muted uppercase tracking-widest">CPA Final</div>
                        </div>
                        <div className="w-px h-10 bg-card-border" />
                        <div className="text-center">
                            <div className="text-2xl font-black text-foreground">{totalFunnel.impressions > 0 ? fmtPct(totalFunnel.conversions / totalFunnel.impressions * 100) : '—'}</div>
                            <div className="text-[9px] text-muted uppercase tracking-widest">Conv. Global</div>
                        </div>
                    </div>
                )}
            </div>

            {/* Per-product breakdown */}
            {productData.length > 1 && (
                <div className="border-t border-card-border">
                    <div className="px-5 py-3">
                        <span className="text-[10px] font-bold text-muted uppercase tracking-widest">Embudo por Producto</span>
                    </div>
                    {productData.map(product => {
                        const isExpanded = expandedProduct === product.name;
                        const steps = buildFunnelSteps(product);
                        const pMaxVal = Math.max(...steps.map(s => s.value), 1);
                        const roas = product.spend > 0 && product.revenue > 0 ? (product.revenue / product.spend).toFixed(2) : '—';

                        return (
                            <div key={product.name} className="border-t border-card-border/30">
                                <button
                                    onClick={() => setExpandedProduct(isExpanded ? null : product.name)}
                                    className="w-full px-5 py-3 flex items-center gap-3 hover:bg-hover-bg/30 transition-all text-left"
                                >
                                    {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-muted shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-muted shrink-0" />}
                                    <span className="text-xs font-bold flex-1">{product.name}</span>
                                    <span className="text-[10px] text-muted">{product.campaignCount} campañas</span>
                                    <span className="text-[10px] font-bold text-accent">{fmtMoney(product.spend)}</span>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${roas !== '—' && parseFloat(roas) >= 2 ? 'bg-green-500/10 text-green-400' : roas !== '—' ? 'bg-red-500/10 text-red-400' : 'text-muted'}`}>
                                        ROAS {roas}x
                                    </span>
                                </button>

                                {isExpanded && (
                                    <div className="px-5 pb-4 pl-12">
                                        {/* Mini funnel */}
                                        <div className="space-y-1.5">
                                            {steps.map((step, idx) => {
                                                const wPct = Math.max(15, (step.value / pMaxVal) * 100);
                                                const conv = step.prevValue > 0 ? (step.value / step.prevValue * 100) : 0;
                                                return (
                                                    <div key={step.key} className="flex items-center gap-3">
                                                        <span className="text-[10px] text-muted w-24 shrink-0">{step.label}</span>
                                                        <div className="flex-1 h-5 bg-hover-bg rounded overflow-hidden">
                                                            <div className="h-full rounded flex items-center px-2" style={{ width: `${wPct}%`, background: `${step.color}30` }}>
                                                                <span className="text-[9px] font-bold" style={{ color: step.color }}>{fmt(step.value)}</span>
                                                            </div>
                                                        </div>
                                                        {idx > 0 && <span className="text-[9px] text-muted w-12 text-right">{conv > 0 ? fmtPct(conv) : '—'}</span>}
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {/* Campaign list */}
                                        {product.campaignCount > 0 && (
                                            <div className="mt-3 pt-3 border-t border-card-border/20">
                                                <span className="text-[9px] text-muted uppercase tracking-widest">Campañas:</span>
                                                <div className="mt-1 flex flex-wrap gap-1">
                                                    {Array.from(product.campaigns).slice(0, 10).map(c => (
                                                        <span key={c} className="text-[9px] bg-hover-bg border border-card-border rounded px-2 py-0.5 text-muted truncate max-w-[200px]">{c}</span>
                                                    ))}
                                                    {product.campaignCount > 10 && <span className="text-[9px] text-muted">+{product.campaignCount - 10} mas</span>}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
