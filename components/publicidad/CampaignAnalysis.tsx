import React, { useState, useMemo } from 'react';
import { formatCurrency } from '@/lib/utils/currency';
import { Facebook, Search, Filter, ChevronDown, ChevronRight, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import InfoTooltip from '@/components/common/InfoTooltip';
import { AdSpendHistory, CampaignMapping, CustomMetric } from '@/lib/services/marketing';
import { isEntregado } from '@/lib/utils/status';
import { evaluateCustomMetric, formatMetricValue } from '@/lib/utils/customMetrics';

// Simple TikTok Icon component
const TikTokIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
        <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.12-3.44-3.17-3.43-5.3-.05-1.07.08-2.14.51-3.14.46-1.05 1.18-1.96 2.06-2.65 1.01-.77 2.23-1.14 3.51-1.11.16 0 .31-.01.47 0 .01.59.01 1.18 0 1.77-.02 1.06-.03 2.12-.01 3.18-.59.18-1.29.13-1.83-.06-.82-.25-1.41-.88-1.74-1.68-.32-.82-.26-1.79.23-2.58.62-.9 1.71-1.31 2.82-1.22 1.56.09 2.5 1.03 2.5 2.51.01 4.54 0 9.07.02 13.61.02.16.02.32.02.48Z" />
    </svg>
);

// ─── Metric Column Definitions ────────────────────────────────────────────────

type MetricGroup = 'anuncio' | 'landing' | 'general';
type MetricFormat = 'currency' | 'percent' | 'number' | 'multiplier';

interface MetricColumnDef {
    key: string;
    label: string;
    shortLabel: string;
    group: MetricGroup;
    format: MetricFormat;
    invert?: boolean;
}

const GROUP_COLORS: Record<MetricGroup, { active: string; dot: string; label: string }> = {
    anuncio: { active: 'bg-orange-500/15 border-orange-500/30 text-orange-400', dot: 'bg-orange-400', label: 'Anuncio' },
    landing: { active: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400', dot: 'bg-emerald-400', label: 'Landing Page' },
    general: { active: 'bg-blue-500/15 border-blue-500/30 text-blue-400', dot: 'bg-blue-400', label: 'General' },
};

const METRIC_COLUMNS: MetricColumnDef[] = [
    // ANUNCIO
    { key: 'cpm', label: 'CPM', shortLabel: 'CPM', group: 'anuncio', format: 'currency', invert: true },
    { key: 'cpc', label: 'CPC', shortLabel: 'CPC', group: 'anuncio', format: 'currency', invert: true },
    { key: 'ctr', label: 'CTR', shortLabel: 'CTR', group: 'anuncio', format: 'percent' },
    { key: 'clicks', label: 'Clics Enlace', shortLabel: 'Clics', group: 'anuncio', format: 'number' },
    // LANDING PAGE
    { key: 'page_visits', label: 'Visitas Web', shortLabel: 'Visitas', group: 'landing', format: 'number' },
    { key: 'add_to_cart', label: 'Agregados Carrito', shortLabel: 'Carrito', group: 'landing', format: 'number' },
    { key: 'conversions', label: 'Compras (FB)', shortLabel: 'Compras', group: 'landing', format: 'number' },
    { key: 'conversion_rate', label: 'Conversión Rate', shortLabel: 'Conv %', group: 'landing', format: 'percent' },
    { key: 'landing_load_rate', label: '% Carga Landing', shortLabel: '% Carga', group: 'landing', format: 'percent' },
    { key: 'fb_cpa', label: 'Costo/Compra FB', shortLabel: 'CPA FB', group: 'landing', format: 'currency', invert: true },
    { key: 'real_cpa', label: 'Costo/Compra Real', shortLabel: 'CPA Real', group: 'landing', format: 'currency', invert: true },
    // GENERAL
    { key: 'roas_real', label: 'ROAS Real', shortLabel: 'ROAS', group: 'general', format: 'multiplier' },
    { key: 'fact_despachado', label: 'Facturado Neto Desp.', shortLabel: 'Fact. Desp.', group: 'general', format: 'currency' },
];

const DEFAULT_VISIBLE = new Set(['cpc', 'ctr', 'fb_cpa', 'real_cpa', 'roas_real', 'fact_despachado']);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getMetricValue(data: any, key: string): number {
    switch (key) {
        case 'cpm': return data.cpm || 0;
        case 'cpc': return data.cpc || 0;
        case 'ctr': return data.ctr || 0;
        case 'clicks': return data.clicks || 0;
        case 'page_visits': return data.page_visits || 0;
        case 'add_to_cart': return data.add_to_cart || 0;
        case 'conversions': return data.conversions || 0;
        case 'conversion_rate': return data.conversion_rate || 0;
        case 'landing_load_rate': return data.landing_load_rate || 0;
        case 'fb_cpa': return data.fb_cpa || 0;
        case 'real_cpa': return data.real_cpa || 0;
        case 'roas_real': return data.roas_real || 0;
        case 'fact_despachado': return data.facturado_despachado || 0;
        default: return data[key] || 0;
    }
}

function formatMetric(value: number, format: MetricFormat): string {
    if (!value || !isFinite(value)) return '-';
    switch (format) {
        case 'currency': return formatCurrency(value);
        case 'percent': return `${value.toFixed(2)}%`;
        case 'multiplier': return `${value.toFixed(2)}x`;
        case 'number': return value.toLocaleString('es-CO', { maximumFractionDigits: 0 });
    }
}

function metricColor(key: string, value: number, amount: number): string {
    if (!value || value === 0) return 'text-muted';
    switch (key) {
        case 'roas_real':
            return value > 2 ? 'text-emerald-400' : value < 1 && amount > 0 ? 'text-rose-400' : 'text-yellow-400';
        case 'real_cpa':
        case 'fb_cpa':
        case 'cpm':
        case 'cpc':
            return 'text-foreground/80';
        default:
            return 'text-foreground/80';
    }
}

function getGroupBg(col: MetricColumnDef): string {
    const group = col.key.startsWith('custom_') ? 'custom' : col.group;
    switch (group) {
        case 'anuncio': return 'bg-orange-500/5';
        case 'landing': return 'bg-emerald-500/5';
        case 'general': return 'bg-blue-500/5';
        default: return 'bg-violet-500/5';
    }
}

function getGroupDot(col: MetricColumnDef): string {
    const group = col.key.startsWith('custom_') ? 'custom' : col.group;
    switch (group) {
        case 'anuncio': return 'bg-orange-400';
        case 'landing': return 'bg-emerald-400';
        case 'general': return 'bg-blue-400';
        default: return 'bg-violet-400';
    }
}

function getStatusBadge(data: { amount: number; conversions: number; revenue_attributed: number; fb_cpa: number }): { color: string; text: string } {
    if (!data.amount || data.amount === 0) {
        return { color: 'bg-muted/10 text-muted border-card-border', text: 'Sin Gasto' };
    }
    // CPA FB as percentage of AOV FB (revenue per conversion from platform)
    const aovFb = data.conversions > 0 ? data.revenue_attributed / data.conversions : 0;
    if (!aovFb || aovFb <= 0) {
        return { color: 'bg-muted/10 text-muted border-card-border', text: 'Sin Data' };
    }
    const cpaRatio = data.fb_cpa / aovFb;
    if (cpaRatio >= 0.50) {
        return { color: 'bg-rose-500/10 text-rose-500 border-rose-500/20', text: 'Apagar' };
    }
    if (cpaRatio >= 0.35) {
        return { color: 'bg-orange-500/10 text-orange-500 border-orange-500/20', text: 'Alerta' };
    }
    if (cpaRatio >= 0.25) {
        return { color: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20', text: 'Observar' };
    }
    return { color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20', text: 'Escalar' };
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface CampaignAnalysisProps {
    rawHistory: AdSpendHistory[];
    mappings: CampaignMapping[];
    rawOrders: any[];
    globalCountryFilter: string;
    customMetrics?: CustomMetric[];
    startDate: string;
    endDate: string;
}

const GrowthBadge = ({ current, prev, invert = false, className = '' }: { current: number, prev: number, invert?: boolean, className?: string }) => {
    if (!prev || prev === 0) return null;
    const diff = current - prev;
    const pct = (diff / prev) * 100;
    if (Math.abs(pct) < 0.1) return null;
    const isPositive = pct > 0;
    const isGood = invert ? !isPositive : isPositive;
    return (
        <span className={`inline-flex items-center gap-0.5 text-[9px] font-bold ${isGood ? 'text-emerald-400' : 'text-rose-400'} ${className}`}>
            {isPositive ? <ArrowUpRight className="w-2.5 h-2.5" /> : <ArrowDownRight className="w-2.5 h-2.5" />}
            {Math.abs(pct).toFixed(1)}%
        </span>
    );
};

// ─── Component ────────────────────────────────────────────────────────────────

export const CampaignAnalysis: React.FC<CampaignAnalysisProps> = ({ rawHistory, mappings, rawOrders, globalCountryFilter, customMetrics = [], startDate, endDate }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [platformFilter, setPlatformFilter] = useState<'all' | 'facebook' | 'tiktok'>('all');
    const [expandedProducts, setExpandedProducts] = useState<Record<string, boolean>>({});
    const [visibleMetrics, setVisibleMetrics] = useState<Set<string>>(DEFAULT_VISIBLE);

    // Compute previous period for growth badges
    const { prevStartDate, prevEndDate } = useMemo(() => {
        if (!startDate || !endDate) return { prevStartDate: '', prevEndDate: '' };
        const sDate = new Date(startDate);
        const eDate = new Date(endDate);
        const diffTime = Math.abs(eDate.getTime() - sDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

        const prevE = new Date(sDate);
        prevE.setDate(prevE.getDate() - 1);
        const pEnd = prevE.toISOString().split('T')[0];

        const prevS = new Date(prevE);
        prevS.setDate(prevS.getDate() - diffDays + 1);
        const pStart = prevS.toISOString().split('T')[0];

        return { prevStartDate: pStart, prevEndDate: pEnd };
    }, [startDate, endDate]);

    // ─── Active columns (built-in + custom) ───
    const activeColumns = useMemo(() => {
        const built = METRIC_COLUMNS.filter(m => visibleMetrics.has(m.key));
        const custom: MetricColumnDef[] = customMetrics.map(cm => ({
            key: `custom_${cm.id}`,
            label: cm.name,
            shortLabel: cm.name.substring(0, 8),
            group: 'general' as MetricGroup,
            format: cm.format as MetricFormat,
        }));
        return [...built, ...custom.filter(c => visibleMetrics.has(c.key))];
    }, [visibleMetrics, customMetrics]);

    // ─── Group spans for header ───
    const groupSpans = useMemo(() => {
        const spans: { group: string; count: number; label: string; bg: string; text: string }[] = [];
        let prevGroup = '';

        activeColumns.forEach(col => {
            const group = col.key.startsWith('custom_') ? 'custom' : col.group;
            if (group !== prevGroup) {
                const config = group === 'anuncio'
                    ? { label: 'Anuncio', bg: 'bg-orange-500/5', text: 'text-orange-400' }
                    : group === 'landing'
                    ? { label: 'Página Web', bg: 'bg-emerald-500/5', text: 'text-emerald-400' }
                    : group === 'general'
                    ? { label: 'General', bg: 'bg-blue-500/5', text: 'text-blue-400' }
                    : { label: 'Custom', bg: 'bg-violet-500/5', text: 'text-violet-400' };
                spans.push({ group, count: 1, ...config });
                prevGroup = group;
            } else {
                spans[spans.length - 1].count++;
            }
        });

        return spans;
    }, [activeColumns]);

    // ─── Aggregation Logic ───
    const { products, summary } = useMemo(() => {
        const buildData = (sDate: string, eDate: string) => {
            const campaignMap = new Map<string, any>();
            const productSpendMap = new Map<string, number>();

            const filteredHistory = rawHistory.filter(h => {
                const dateKey = (h.date || '').split(' ')[0];
                const hasDate = (!sDate || dateKey >= sDate) && (!eDate || dateKey <= eDate);
                const hasCountry = !globalCountryFilter || globalCountryFilter === 'Todos' || h.country === globalCountryFilter;
                return hasDate && hasCountry;
            });

            const filteredOrders = rawOrders.filter(o => {
                const dateKey = o.FECHA;
                return (!sDate || dateKey >= sDate) && (!eDate || dateKey <= eDate);
            });

            // Pass 1: Campaign Aggregation
            filteredHistory.forEach(h => {
                const isMapped = mappings.find(m => m.campaignName === h.campaignName && m.platform === h.platform);
                const productId = isMapped ? isMapped.productId : 'Sin Mapear';
                const key = `${h.campaignName}_${h.platform}`;

                if (!campaignMap.has(key)) {
                    campaignMap.set(key, {
                        campaignName: h.campaignName || 'Manual Entry',
                        platform: h.platform,
                        country: h.country || 'Global',
                        productId,
                        isMapped: !!isMapped,
                        amount: 0, impressions: 0, clicks: 0, page_visits: 0,
                        add_to_cart: 0, conversions: 0, revenue_attributed: 0
                    });
                }

                const agg = campaignMap.get(key);
                agg.amount += (h.amount || 0);
                agg.impressions += (h.impressions || 0);
                agg.clicks += (h.clicks || 0);
                agg.page_visits += (h.page_visits || 0);
                agg.add_to_cart += (h.add_to_cart || 0);
                agg.conversions += (h.conversions || 0);
                agg.revenue_attributed += (h.revenue_attributed || 0);

                if (productId !== 'Sin Mapear') {
                    productSpendMap.set(productId, (productSpendMap.get(productId) || 0) + (h.amount || 0));
                }
            });

            // Pass 2: Product Orders & Revenue
            const productOrdersMap = new Map<string, number>();
            const productDispatchedOrdersMap = new Map<string, number>();
            const productRevenueMap = new Map<string, number>();
            const productGrossRevenueMap = new Map<string, number>();
            const productDispatchedRevenueMap = new Map<string, number>();
            const productIdToName = new Map<string, string>();

            filteredOrders.forEach(o => {
                const isDelivered = isEntregado(o.ESTATUS);
                const isDispatched = isDelivered || o.ESTATUS === 'DEVOLUCION' || o.ESTATUS?.includes('TRANSITO');
                const pid = o.PRODUCTO_ID?.toString();
                const pname = o.PRODUCTO;
                const revenue = Number(o["TOTAL DE LA ORDEN"]) || 0;

                const validMappings = mappings.filter(m => m.productId === pid || m.productId === pname);

                if (pid && pname) {
                    productIdToName.set(pid, pname);
                }

                // Deduplicate by product ID to avoid counting orders multiple times
                const uniquePids = new Set(validMappings.map(m => m.productId));
                uniquePids.forEach(mappedPid => {
                    productGrossRevenueMap.set(mappedPid, (productGrossRevenueMap.get(mappedPid) || 0) + revenue);
                    if (isDelivered) {
                        productOrdersMap.set(mappedPid, (productOrdersMap.get(mappedPid) || 0) + 1);
                        productRevenueMap.set(mappedPid, (productRevenueMap.get(mappedPid) || 0) + revenue);
                    }
                    if (isDispatched) {
                        productDispatchedOrdersMap.set(mappedPid, (productDispatchedOrdersMap.get(mappedPid) || 0) + 1);
                        productDispatchedRevenueMap.set(mappedPid, (productDispatchedRevenueMap.get(mappedPid) || 0) + revenue);
                    }
                });
            });

            // Pass 3: Map to Product Groups + compute derived metrics
            const productGroupMap = new Map<string, any>();

            Array.from(campaignMap.values()).forEach(camp => {
                // Campaign-level derived metrics
                camp.cpc = camp.clicks > 0 ? camp.amount / camp.clicks : 0;
                camp.ctr = camp.impressions > 0 ? (camp.clicks / camp.impressions) * 100 : 0;
                camp.cpm = camp.impressions > 0 ? (camp.amount / camp.impressions) * 1000 : 0;
                camp.fb_cpa = camp.conversions > 0 ? camp.amount / camp.conversions : 0;
                camp.conversion_rate = camp.page_visits > 0 ? (camp.conversions / camp.page_visits) * 100 : 0;
                camp.landing_load_rate = camp.clicks > 0 ? (camp.page_visits / camp.clicks) * 100 : 0;
                camp.real_cpa = 0; // Will be set from product level
                camp.roas_real = 0;
                camp.facturado_despachado = 0;

                const pid = camp.productId;
                if (!productGroupMap.has(pid)) {
                    let displayName = pid;
                    if (pid !== 'Sin Mapear') {
                        displayName = productIdToName.get(pid) || mappings.find(m => m.productId === pid)?.productName || pid;
                        if (displayName.includes(' - ')) {
                            displayName = displayName.split(' - ').slice(1).join(' - ');
                        }
                    }

                    productGroupMap.set(pid, {
                        productId: pid,
                        productName: displayName,
                        campaigns: [],
                        summary: {
                            amount: 0, impressions: 0, clicks: 0, page_visits: 0,
                            add_to_cart: 0, conversions: 0, revenue_attributed: 0,
                            cpm: 0, cpc: 0, ctr: 0, fb_cpa: 0, real_cpa: 0,
                            conversion_rate: 0, landing_load_rate: 0,
                            roas_real: 0, facturado_bruto: 0, facturado_real: 0, facturado_despachado: 0
                        }
                    });
                }

                const pGroup = productGroupMap.get(pid);
                pGroup.campaigns.push(camp);

                ['amount', 'impressions', 'clicks', 'page_visits', 'add_to_cart', 'conversions', 'revenue_attributed'].forEach(k => {
                    pGroup.summary[k] += camp[k];
                });
            });

            // Pass 4: Compute product-level metrics and propagate CPA Real to campaigns
            Array.from(productGroupMap.values()).forEach(pGroup => {
                const s = pGroup.summary;
                s.cpm = s.impressions > 0 ? (s.amount / s.impressions) * 1000 : 0;
                s.cpc = s.clicks > 0 ? s.amount / s.clicks : 0;
                s.ctr = s.impressions > 0 ? (s.clicks / s.impressions) * 100 : 0;
                s.fb_cpa = s.conversions > 0 ? s.amount / s.conversions : 0;
                s.conversion_rate = s.page_visits > 0 ? (s.conversions / s.page_visits) * 100 : 0;
                s.landing_load_rate = s.clicks > 0 ? (s.page_visits / s.clicks) * 100 : 0;

                if (pGroup.productId !== 'Sin Mapear') {
                    const dispatchedOrders = productDispatchedOrdersMap.get(pGroup.productId) || 0;
                    const rev = productRevenueMap.get(pGroup.productId) || 0;
                    const gross = productGrossRevenueMap.get(pGroup.productId) || 0;
                    const dispatched = productDispatchedRevenueMap.get(pGroup.productId) || 0;

                    // CPA Real Despachado = Total Product Spend / Total Dispatched Orders (SAME for all campaigns)
                    s.real_cpa = dispatchedOrders > 0 ? s.amount / dispatchedOrders : 0;
                    s.roas_real = s.amount > 0 ? dispatched / s.amount : 0;
                    s.facturado_real = rev;
                    s.facturado_bruto = gross;
                    s.facturado_despachado = dispatched;

                    // Propagate product-level CPA Real to ALL campaigns (same value)
                    pGroup.campaigns.forEach((c: any) => {
                        c.real_cpa = s.real_cpa;
                        c.roas_real = s.roas_real;
                        c.facturado_despachado = dispatched;
                    });
                }
            });

            return productGroupMap;
        };

        const currentData = buildData(startDate, endDate);
        const prevData = buildData(prevStartDate, prevEndDate);

        const resultProducts = Array.from(currentData.values()).map(p => {
            const prevP = prevData.get(p.productId);
            return {
                ...p,
                campaigns: p.campaigns.sort((a: any, b: any) => b.amount - a.amount).map((c: any) => {
                    const prevC = prevP?.campaigns.find((pc: any) => pc.campaignName === c.campaignName && pc.platform === c.platform);
                    return { ...c, _prev: prevC || null };
                }),
                summary: { ...p.summary },
                _prevSummary: prevP?.summary || null
            };
        }).sort((a, b) => b.summary.amount - a.summary.amount);

        const summaryData = {
            totalCampaigns: 0,
            totalProducts: resultProducts.length
        };
        resultProducts.forEach(p => summaryData.totalCampaigns += p.campaigns.length);

        return { products: resultProducts, summary: summaryData };
    }, [rawHistory, mappings, rawOrders, startDate, endDate, prevStartDate, prevEndDate, globalCountryFilter]);

    const filteredProducts = products.filter(p => {
        const matchesSearch = p.productId.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.campaigns.some((c: any) => c.campaignName.toLowerCase().includes(searchTerm.toLowerCase()));

        if (!matchesSearch) return false;

        if (platformFilter !== 'all') {
            const hasPlatform = p.campaigns.some((c: any) => c.platform === platformFilter);
            if (!hasPlatform) return false;
        }

        return true;
    }).map(p => ({
        ...p,
        campaigns: platformFilter === 'all' ? p.campaigns : p.campaigns.filter((c: any) => c.platform === platformFilter)
    }));

    const toggleExpand = (pid: string) => {
        setExpandedProducts(prev => ({ ...prev, [pid]: !prev[pid] }));
    };

    const toggleMetric = (key: string) => {
        setVisibleMetrics(prev => {
            const next = new Set(prev);
            if (next.has(key)) {
                if (next.size <= 1) return prev; // At least 1 must remain
                next.delete(key);
            } else {
                next.add(key);
            }
            return next;
        });
    };

    const toggleGroup = (group: MetricGroup) => {
        setVisibleMetrics(prev => {
            const groupKeys = METRIC_COLUMNS.filter(m => m.group === group).map(m => m.key);
            const allActive = groupKeys.every(k => prev.has(k));
            const next = new Set(prev);
            if (allActive) {
                groupKeys.forEach(k => next.delete(k));
                if (next.size === 0) return prev; // Don't leave empty
            } else {
                groupKeys.forEach(k => next.add(k));
            }
            return next;
        });
    };

    // Dynamic grid template with minimum widths to prevent compression
    const gridTemplate = `minmax(180px, 2fr) minmax(75px, 0.7fr) minmax(100px, 0.9fr) ${activeColumns.map(() => 'minmax(85px, 1fr)').join(' ')}`;
    const minTableWidth = 180 + 75 + 100 + activeColumns.length * 85 + (activeColumns.length + 2) * 12;

    return (
        <div className="bg-card border border-card-border overflow-hidden rounded-2xl flex flex-col shadow-sm" style={{ minHeight: 500 }}>
            {/* Header */}
            <div className="p-5 border-b border-card-border flex flex-col gap-4">
                <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
                    <div className="flex flex-col gap-2">
                        <h3 className="text-[11px] font-black text-muted uppercase tracking-widest flex items-center gap-1.5">Análisis de Campañas <InfoTooltip text="Desglose de campañas por producto con métricas de rendimiento. Expande un producto para ver sus campañas individuales." /></h3>
                        <div className="flex items-center gap-2">
                            <span className="text-[9px] font-bold text-muted bg-muted/10 px-1.5 py-0.5 rounded tabular-nums">
                                {summary.totalProducts} Productos
                            </span>
                            <span className="text-[9px] font-bold text-muted bg-muted/10 px-1.5 py-0.5 rounded tabular-nums">
                                {summary.totalCampaigns} Campañas
                            </span>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <div className="relative flex-1 min-w-[200px]">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                            <input
                                type="text"
                                placeholder="Buscar producto o campaña..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-card border border-card-border rounded-xl pl-9 pr-4 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-accent/50 transition-colors"
                            />
                        </div>

                        <div className="flex items-center bg-card border border-card-border rounded-xl p-1">
                            <button onClick={() => setPlatformFilter('all')} className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${platformFilter === 'all' ? 'bg-accent text-white' : 'text-muted hover:text-foreground'}`}>Todo</button>
                            <button onClick={() => setPlatformFilter('facebook')} className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-1 ${platformFilter === 'facebook' ? 'bg-blue-600 text-white' : 'text-muted hover:text-blue-400'}`}><Facebook className="w-3 h-3" /> FB</button>
                            <button onClick={() => setPlatformFilter('tiktok')} className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-1 ${platformFilter === 'tiktok' ? 'bg-[#00f2fe] text-black' : 'text-muted hover:text-[#00f2fe]'}`}><TikTokIcon className="w-3 h-3" /> TT</button>
                        </div>
                    </div>
                </div>

                {/* Metric Toggle Bar */}
                <div className="flex flex-wrap items-center gap-1.5">
                    {(['anuncio', 'landing', 'general'] as MetricGroup[]).map(group => {
                        const groupMetrics = METRIC_COLUMNS.filter(m => m.group === group);
                        const colors = GROUP_COLORS[group];
                        const allActive = groupMetrics.every(m => visibleMetrics.has(m.key));

                        return (
                            <React.Fragment key={group}>
                                <button
                                    onClick={() => toggleGroup(group)}
                                    className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all ${
                                        allActive ? colors.active : 'border-card-border text-muted hover:text-foreground'
                                    }`}
                                >
                                    {colors.label}
                                </button>
                                {groupMetrics.map(m => (
                                    <button
                                        key={m.key}
                                        onClick={() => toggleMetric(m.key)}
                                        className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider border transition-all ${
                                            visibleMetrics.has(m.key)
                                                ? colors.active
                                                : 'border-transparent text-muted/50 hover:text-muted'
                                        }`}
                                    >
                                        <span className={`w-1.5 h-1.5 rounded-full ${visibleMetrics.has(m.key) ? colors.dot : 'bg-muted/30'}`} />
                                        {m.shortLabel}
                                    </button>
                                ))}
                                {group !== 'general' && <div className="w-px h-4 bg-card-border mx-1" />}
                            </React.Fragment>
                        );
                    })}

                    {/* Custom Metrics */}
                    {customMetrics.length > 0 && (
                        <>
                            <div className="w-px h-4 bg-card-border mx-1" />
                            {customMetrics.map(cm => {
                                const key = `custom_${cm.id}`;
                                return (
                                    <button
                                        key={key}
                                        onClick={() => toggleMetric(key)}
                                        className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider border transition-all ${
                                            visibleMetrics.has(key)
                                                ? 'bg-violet-500/15 border-violet-500/30 text-violet-400'
                                                : 'border-transparent text-muted/50 hover:text-muted'
                                        }`}
                                    >
                                        <span className={`w-1.5 h-1.5 rounded-full ${visibleMetrics.has(key) ? 'bg-violet-400' : 'bg-muted/30'}`} />
                                        {cm.name.substring(0, 10)}
                                    </button>
                                );
                            })}
                        </>
                    )}
                </div>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto relative max-h-[700px]">
                {/* Sticky Header */}
                <div className="hidden lg:block sticky top-0 bg-card z-30 shadow-sm">
                    {/* Group Header Row */}
                    <div
                        className="grid gap-3 px-5 py-2 border-b border-card-border/50"
                        style={{ gridTemplateColumns: gridTemplate, minWidth: minTableWidth }}
                    >
                        <div style={{ gridColumn: 'span 3' }} />
                        {groupSpans.map((span, i) => (
                            <div
                                key={span.group}
                                style={{ gridColumn: `span ${span.count}` }}
                                className={`text-center text-[10px] font-black uppercase tracking-widest py-1 rounded-lg ${span.bg} ${span.text} ${i < groupSpans.length - 1 ? 'border-r border-card-border' : ''}`}
                            >
                                {span.label}
                            </div>
                        ))}
                    </div>
                    {/* Column Header Row */}
                    <div
                        className="grid gap-3 px-5 py-3 border-b border-card-border"
                        style={{ gridTemplateColumns: gridTemplate, minWidth: minTableWidth }}
                    >
                        <div className="text-[10px] font-black uppercase tracking-widest text-muted">Producto / Campaña</div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-muted text-center">Estado</div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-muted text-right">Gasto Ads</div>
                        {activeColumns.map(col => (
                            <div key={col.key} className={`flex items-center justify-end gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted truncate rounded px-1 py-0.5 ${getGroupBg(col)}`} title={col.label}>
                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${getGroupDot(col)}`} />
                                {col.shortLabel}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Rows */}
                <div className="space-y-2 p-4">
                    {(() => {
                        const renderProductRow = (p: any) => {
                            const isExpanded = expandedProducts[p.productId];
                            const s = p.summary;
                            const badge = getStatusBadge(s);

                            return (
                                <div key={p.productId} className="flex flex-col bg-card border border-card-border rounded-2xl overflow-hidden shadow-sm hover:border-accent/40 transition-colors">
                                    <div
                                        onClick={() => toggleExpand(p.productId)}
                                        className={`lg:grid items-center gap-3 px-5 py-3.5 cursor-pointer transition-colors ${isExpanded ? 'bg-hover-bg' : 'hover:bg-hover-bg'}`}
                                        style={{ gridTemplateColumns: gridTemplate, minWidth: minTableWidth }}
                                    >
                                        <div className="flex items-center gap-3 min-w-0 overflow-hidden">
                                            <div className="bg-card border border-card-border w-7 h-7 rounded-lg flex items-center justify-center shrink-0 shadow-sm">
                                                {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-muted" /> : <ChevronRight className="w-3.5 h-3.5 text-muted" />}
                                            </div>
                                            <div className="min-w-0">
                                                <h4 className="font-black text-sm text-foreground truncate">{p.productName}</h4>
                                                <p className="text-[10px] text-muted font-bold uppercase tracking-wider mt-0.5">{p.campaigns.length} Campañas</p>
                                            </div>
                                        </div>

                                        <div className="lg:text-center mt-2 lg:mt-0">
                                            <span className={`inline-block px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest border ${badge.color}`}>
                                                {badge.text}
                                            </span>
                                        </div>

                                        <div className="flex items-center justify-between lg:block lg:text-right mt-2 lg:mt-0">
                                            <span className="lg:hidden text-[10px] font-black text-muted uppercase">Gasto: </span>
                                            <div className="flex flex-col items-end">
                                                <span className="font-mono text-sm font-black text-orange-400">{formatCurrency(s.amount)}</span>
                                                {p._prevSummary && <GrowthBadge current={s.amount} prev={p._prevSummary.amount} invert className="mt-0.5" />}
                                            </div>
                                        </div>

                                        {activeColumns.map(col => {
                                            const val = getMetricValue(s, col.key);
                                            const prevVal = p._prevSummary ? getMetricValue(p._prevSummary, col.key) : 0;
                                            return (
                                                <div key={col.key} className={`flex items-center justify-between lg:block lg:text-right mt-1 lg:mt-0 rounded px-1 ${getGroupBg(col)}`}>
                                                    <span className="lg:hidden text-[9px] font-black text-muted uppercase">{col.shortLabel}: </span>
                                                    <div className="flex flex-col items-end">
                                                        <span className={`font-mono text-sm font-bold ${metricColor(col.key, val, s.amount)}`}>
                                                            {formatMetric(val, col.format)}
                                                        </span>
                                                        {prevVal > 0 && <GrowthBadge current={val} prev={prevVal} invert={col.invert} className="mt-0.5" />}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {isExpanded && (
                                        <div className="border-t border-card-border divide-y divide-card-border/50">
                                            {p.campaigns.map((c: any, i: number) => {
                                                const isFb = c.platform === 'facebook';
                                                const cBadge = getStatusBadge(c);

                                                return (
                                                    <div
                                                        key={`${p.productId}-${i}`}
                                                        className="lg:grid items-center gap-3 px-5 py-3 hover:bg-hover-bg transition-colors pl-7 lg:pl-8"
                                                        style={{ gridTemplateColumns: gridTemplate, minWidth: minTableWidth }}
                                                    >
                                                        <div className="flex items-center gap-2.5 min-w-0 overflow-hidden pr-2">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-card-border shrink-0" />
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center gap-2">
                                                                    {isFb ? <Facebook className="w-3.5 h-3.5 text-blue-400 shrink-0" /> : <TikTokIcon className="w-3.5 h-3.5 text-[#00f2fe] shrink-0" />}
                                                                    <h5 className="text-xs font-semibold text-foreground/80 truncate" title={c.campaignName}>{c.campaignName}</h5>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="lg:text-center mt-1 lg:mt-0">
                                                            <span className={`inline-block px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border ${cBadge.color}`}>
                                                                {cBadge.text}
                                                            </span>
                                                        </div>

                                                        <div className="flex items-center justify-between lg:block lg:text-right mt-1 lg:mt-0">
                                                            <span className="lg:hidden text-[9px] font-black text-muted uppercase">Gasto: </span>
                                                            <span className="font-mono text-xs font-semibold text-orange-400/80">{formatCurrency(c.amount)}</span>
                                                        </div>

                                                        {activeColumns.map(col => {
                                                            const val = getMetricValue(c, col.key);
                                                            const prevVal = c._prev ? getMetricValue(c._prev, col.key) : 0;

                                                            let displayVal = val;
                                                            let displayFormat = col.format;
                                                            if (col.key.startsWith('custom_')) {
                                                                const cmId = col.key.replace('custom_', '');
                                                                const cm = customMetrics.find(x => x.id === cmId);
                                                                if (cm) {
                                                                    displayVal = evaluateCustomMetric(cm.formula, c);
                                                                    displayFormat = cm.format as MetricFormat;
                                                                }
                                                            }

                                                            return (
                                                                <div key={col.key} className={`flex items-center justify-between lg:block lg:text-right mt-1 lg:mt-0 rounded px-1 ${getGroupBg(col)}`}>
                                                                    <span className="lg:hidden text-[9px] font-black text-muted uppercase">{col.shortLabel}: </span>
                                                                    <div className="flex flex-col items-end">
                                                                        <span className={`font-mono text-xs font-bold ${metricColor(col.key, displayVal, c.amount)}`}>
                                                                            {col.key.startsWith('custom_') ? formatMetricValue(displayVal, displayFormat as any) : formatMetric(displayVal, displayFormat)}
                                                                        </span>
                                                                        {prevVal > 0 && <GrowthBadge current={displayVal} prev={prevVal} invert={col.invert} className="mt-0.5" />}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        };

                        // Group by country when globalCountryFilter is 'Todos'
                        if (globalCountryFilter === 'Todos') {
                            const countryMap = new Map<string, typeof filteredProducts>();
                            filteredProducts.forEach(p => {
                                const countryCounts = new Map<string, number>();
                                p.campaigns.forEach((c: any) => {
                                    const cc = c.country || 'Global';
                                    countryCounts.set(cc, (countryCounts.get(cc) || 0) + (c.amount || 0));
                                });
                                let topCountry = 'Global';
                                let topAmount = 0;
                                countryCounts.forEach((amt, cc) => {
                                    if (amt > topAmount) { topAmount = amt; topCountry = cc; }
                                });
                                if (!countryMap.has(topCountry)) countryMap.set(topCountry, []);
                                countryMap.get(topCountry)!.push(p);
                            });
                            const sortedCountries = Array.from(countryMap.entries()).sort((a, b) => {
                                const totalA = a[1].reduce((sum, p) => sum + p.summary.amount, 0);
                                const totalB = b[1].reduce((sum, p) => sum + p.summary.amount, 0);
                                return totalB - totalA;
                            });
                            return (
                                <>
                                    {sortedCountries.map(([country, prods]) => (
                                        <div key={country} className="space-y-2">
                                            <div className="flex items-center gap-3 px-2 pt-3 pb-1">
                                                <span className="text-[10px] font-black text-accent uppercase tracking-widest">{country}</span>
                                                <div className="flex-1 h-px bg-card-border" />
                                                <span className="text-[9px] font-bold text-muted">{prods.length} productos · {formatCurrency(prods.reduce((s, p) => s + p.summary.amount, 0))}</span>
                                            </div>
                                            {prods.map(p => renderProductRow(p))}
                                        </div>
                                    ))}
                                </>
                            );
                        }
                        return <>{filteredProducts.map(p => renderProductRow(p))}</>;
                    })()}

                    {filteredProducts.length === 0 && (
                        <div className="px-6 py-20 text-center text-muted bg-card border border-card-border rounded-2xl">
                            <div className="flex flex-col items-center justify-center gap-3">
                                <Filter className="w-8 h-8 opacity-20" />
                                <p className="text-sm font-medium">No se encontraron productos para los filtros seleccionados.</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
