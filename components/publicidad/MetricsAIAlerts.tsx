'use client';

import React, { useMemo, useState } from 'react';
import { Bot, ChevronDown, ChevronRight, TrendingUp, TrendingDown, Target, DollarSign, MousePointer, ShoppingCart, Eye, Zap, Package } from 'lucide-react';

interface AdSpendRecord {
    amount: number;
    impressions?: number;
    clicks?: number;
    page_visits?: number;
    add_to_cart?: number;
    conversions?: number;
    revenue_attributed?: number;
    date: string;
    productId: string;
    campaignName?: string;
}

interface MetricsAIAlertsProps {
    history: AdSpendRecord[];
    selectedProduct: string;
}

interface Alert {
    id: string;
    type: 'danger' | 'warning' | 'success' | 'info';
    icon: React.ElementType;
    title: string;
    description: string;
    metric: string;
    value3d: number;
    value7d: number;
    change: number;
    product?: string;
}

function getDateNDaysAgo(n: number): string {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function aggregate(records: AdSpendRecord[]) {
    const t = { spend: 0, impressions: 0, clicks: 0, page_visits: 0, add_to_cart: 0, conversions: 0, revenue: 0, days: new Set<string>() };
    for (const r of records) {
        t.spend += r.amount || 0; t.impressions += r.impressions || 0; t.clicks += r.clicks || 0;
        t.page_visits += r.page_visits || 0; t.add_to_cart += r.add_to_cart || 0;
        t.conversions += r.conversions || 0; t.revenue += r.revenue_attributed || 0; t.days.add(r.date);
    }
    const days = Math.max(t.days.size, 1);
    return {
        ...t, days,
        ctr: t.impressions > 0 ? (t.clicks / t.impressions * 100) : 0,
        cpc: t.clicks > 0 ? t.spend / t.clicks : 0,
        cpa: t.conversions > 0 ? t.spend / t.conversions : 0,
        roas: t.spend > 0 ? t.revenue / t.spend : 0,
        landing_rate: t.clicks > 0 ? (t.page_visits / t.clicks * 100) : 0,
        daily_spend: t.spend / days,
        daily_conv: t.conversions / days,
    };
}

function generateAlerts(records: AdSpendRecord[], productName?: string): Alert[] {
    const today = getDateNDaysAgo(0);
    const date3 = getDateNDaysAgo(3);
    const date7 = getDateNDaysAgo(7);
    const d3 = aggregate(records.filter(h => h.date >= date3 && h.date <= today));
    const d7 = aggregate(records.filter(h => h.date >= date7 && h.date <= today));
    const alerts: Alert[] = [];
    const pct = (a: number, b: number) => b > 0 ? ((a - b) / b * 100) : 0;
    const prefix = productName ? `[${productName}] ` : '';

    if (d3.cpa > 0 && d7.cpa > 0) {
        const c = pct(d3.cpa, d7.cpa);
        if (c > 20) alerts.push({ id: `cpa-${productName}`, type: 'danger', icon: DollarSign, title: `${prefix}CPA subiendo`, description: `CPA subio ${Math.abs(c).toFixed(0)}% (3d vs 7d). Revisa creativos y audiencias.`, metric: 'CPA', value3d: d3.cpa, value7d: d7.cpa, change: c, product: productName });
        else if (c < -15) alerts.push({ id: `cpa-ok-${productName}`, type: 'success', icon: DollarSign, title: `${prefix}CPA mejorando`, description: `CPA bajo ${Math.abs(c).toFixed(0)}%. Anuncios mas eficientes.`, metric: 'CPA', value3d: d3.cpa, value7d: d7.cpa, change: c, product: productName });
    }
    if (d3.ctr > 0 && d7.ctr > 0) {
        const c = pct(d3.ctr, d7.ctr);
        if (d3.ctr < 1) alerts.push({ id: `ctr-low-${productName}`, type: 'danger', icon: MousePointer, title: `${prefix}CTR muy bajo`, description: `CTR ${d3.ctr.toFixed(2)}% < 1%. Creativos no generan interes.`, metric: 'CTR', value3d: d3.ctr, value7d: d7.ctr, change: c, product: productName });
        else if (c < -20) alerts.push({ id: `ctr-drop-${productName}`, type: 'warning', icon: MousePointer, title: `${prefix}CTR cayendo`, description: `CTR bajo ${Math.abs(c).toFixed(0)}%. Posible fatiga — rota creativos.`, metric: 'CTR', value3d: d3.ctr, value7d: d7.ctr, change: c, product: productName });
        else if (d3.ctr > 3) alerts.push({ id: `ctr-good-${productName}`, type: 'success', icon: MousePointer, title: `${prefix}CTR excelente`, description: `CTR ${d3.ctr.toFixed(2)}% — creativos funcionando bien.`, metric: 'CTR', value3d: d3.ctr, value7d: d7.ctr, change: c, product: productName });
    }
    if (d3.roas > 0 && d7.roas > 0) {
        const c = pct(d3.roas, d7.roas);
        if (d3.roas < 1.5) alerts.push({ id: `roas-low-${productName}`, type: 'danger', icon: Target, title: `${prefix}ROAS critico`, description: `ROAS ${d3.roas.toFixed(2)}x — perdiendo dinero. Pausa campañas con ROAS < 1.`, metric: 'ROAS', value3d: d3.roas, value7d: d7.roas, change: c, product: productName });
        else if (d3.roas >= 3) alerts.push({ id: `roas-great-${productName}`, type: 'success', icon: Target, title: `${prefix}ROAS excelente`, description: `ROAS ${d3.roas.toFixed(2)}x — triplicando inversion. Escalar.`, metric: 'ROAS', value3d: d3.roas, value7d: d7.roas, change: c, product: productName });
        else if (c < -25) alerts.push({ id: `roas-drop-${productName}`, type: 'warning', icon: Target, title: `${prefix}ROAS cayendo`, description: `ROAS bajo ${Math.abs(c).toFixed(0)}% en 3 dias.`, metric: 'ROAS', value3d: d3.roas, value7d: d7.roas, change: c, product: productName });
    }
    if (d3.landing_rate > 0 && d3.landing_rate < 60) {
        alerts.push({ id: `landing-${productName}`, type: 'warning', icon: Eye, title: `${prefix}Landing lenta`, description: `Solo ${d3.landing_rate.toFixed(0)}% de clics cargan. Optimiza velocidad.`, metric: 'Landing', value3d: d3.landing_rate, value7d: d7.landing_rate, change: pct(d3.landing_rate, d7.landing_rate), product: productName });
    }
    if (d3.daily_conv > 0 && d7.daily_conv > 0) {
        const c = pct(d3.daily_conv, d7.daily_conv);
        if (c < -30) alerts.push({ id: `conv-drop-${productName}`, type: 'danger', icon: TrendingDown, title: `${prefix}Conversiones cayendo`, description: `Conversiones/dia bajaron ${Math.abs(c).toFixed(0)}%.`, metric: 'Conv/dia', value3d: d3.daily_conv, value7d: d7.daily_conv, change: c, product: productName });
        else if (c > 20) alerts.push({ id: `conv-up-${productName}`, type: 'success', icon: TrendingUp, title: `${prefix}Conversiones subiendo`, description: `Conversiones/dia subieron ${c.toFixed(0)}%. Buen momento para escalar.`, metric: 'Conv/dia', value3d: d3.daily_conv, value7d: d7.daily_conv, change: c, product: productName });
    }
    return alerts;
}

export function MetricsAIAlerts({ history, selectedProduct }: MetricsAIAlertsProps) {
    const [expanded, setExpanded] = useState(true);

    const alerts = useMemo(() => {
        if (!history.length) return [];

        if (selectedProduct && selectedProduct !== 'Todos') {
            // Single product — show alerts for that product
            return generateAlerts(history.filter(h => h.productId === selectedProduct), selectedProduct);
        }

        // All products — generate alerts for top products by spend
        const spendByProduct: Record<string, { spend: number; records: AdSpendRecord[] }> = {};
        for (const h of history) {
            const pid = h.productId || 'Sin asignar';
            if (!spendByProduct[pid]) spendByProduct[pid] = { spend: 0, records: [] };
            spendByProduct[pid].spend += h.amount || 0;
            spendByProduct[pid].records.push(h);
        }

        // Top 8 products by spend
        const topProducts = Object.entries(spendByProduct)
            .filter(([name]) => name !== 'Sin asignar')
            .sort((a, b) => b[1].spend - a[1].spend)
            .slice(0, 8);

        const allAlerts: Alert[] = [];
        for (const [name, data] of topProducts) {
            allAlerts.push(...generateAlerts(data.records, name));
        }

        // Sort: danger > warning > info > success
        const order = { danger: 0, warning: 1, info: 2, success: 3 };
        return allAlerts.sort((a, b) => order[a.type] - order[b.type]);
    }, [history, selectedProduct]);

    const typeColors = {
        danger: { bg: 'bg-red-500/10', border: 'border-red-500/20', text: 'text-red-400', dot: 'bg-red-500' },
        warning: { bg: 'bg-amber-500/10', border: 'border-amber-500/20', text: 'text-amber-400', dot: 'bg-amber-500' },
        success: { bg: 'bg-green-500/10', border: 'border-green-500/20', text: 'text-green-400', dot: 'bg-green-500' },
        info: { bg: 'bg-blue-500/10', border: 'border-blue-500/20', text: 'text-blue-400', dot: 'bg-blue-500' },
    };

    const dangerCount = alerts.filter(a => a.type === 'danger').length;
    const warningCount = alerts.filter(a => a.type === 'warning').length;

    return (
        <div className="bg-card border border-card-border rounded-2xl overflow-hidden">
            <button onClick={() => setExpanded(!expanded)} className="w-full px-5 py-4 flex items-center justify-between hover:bg-hover-bg/30 transition-all">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-500">
                        <Bot className="w-4 h-4 text-white" />
                    </div>
                    <div className="text-left">
                        <h3 className="text-sm font-bold">VEGA — Analisis de Metricas</h3>
                        <p className="text-[10px] text-muted">3 dias vs 7 dias · {selectedProduct && selectedProduct !== 'Todos' ? selectedProduct : 'Top productos por inversion'}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {dangerCount > 0 && <span className="text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded-md">{dangerCount} critico{dangerCount > 1 ? 's' : ''}</span>}
                    {warningCount > 0 && <span className="text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-md">{warningCount} alerta{warningCount > 1 ? 's' : ''}</span>}
                    {alerts.length === 0 && <span className="text-[10px] text-muted">Sin alertas</span>}
                    {expanded ? <ChevronDown className="w-4 h-4 text-muted" /> : <ChevronRight className="w-4 h-4 text-muted" />}
                </div>
            </button>

            {expanded && alerts.length > 0 && (
                <div className="px-5 pb-4 space-y-2">
                    {alerts.map(alert => {
                        const colors = typeColors[alert.type];
                        const Icon = alert.icon;
                        const fmtVal = (v: number) => {
                            if (alert.metric === 'CPA' || alert.metric === 'Gasto/dia') return `$${v.toLocaleString('es-CO', { maximumFractionDigits: 0 })}`;
                            if (alert.metric === 'ROAS') return `${v.toFixed(2)}x`;
                            return `${v.toFixed(1)}%`;
                        };
                        return (
                            <div key={alert.id} className={`${colors.bg} border ${colors.border} rounded-xl p-3`}>
                                <div className="flex items-start gap-3">
                                    <div className={`w-7 h-7 rounded-lg ${colors.bg} flex items-center justify-center shrink-0 mt-0.5`}>
                                        <Icon className={`w-3.5 h-3.5 ${colors.text}`} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <span className={`text-xs font-bold ${colors.text}`}>{alert.title}</span>
                                        </div>
                                        <p className="text-[11px] text-foreground/70 leading-relaxed">{alert.description}</p>
                                        <div className="flex items-center gap-4 mt-1.5">
                                            <span className="text-[10px]"><span className="text-muted">3d: </span><span className="font-bold">{fmtVal(alert.value3d)}</span></span>
                                            <span className="text-[10px]"><span className="text-muted">7d: </span><span className="font-bold">{fmtVal(alert.value7d)}</span></span>
                                            {alert.change !== 0 && (
                                                <span className={`text-[10px] font-bold flex items-center gap-0.5 ${alert.change > 0 ? 'text-red-400' : 'text-green-400'}`}>
                                                    {alert.change > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                                    {Math.abs(alert.change).toFixed(0)}%
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {expanded && alerts.length === 0 && (
                <div className="px-5 pb-4 text-center py-4 text-muted/40 text-xs">
                    Sin datos suficientes para generar alertas (necesita 3+ dias).
                </div>
            )}
        </div>
    );
}
