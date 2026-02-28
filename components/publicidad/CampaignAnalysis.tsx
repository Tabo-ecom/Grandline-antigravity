import React, { useState, useMemo, useEffect, useRef } from 'react';
import { formatCurrency } from '@/lib/utils/currency';
import { Facebook, Search, Filter, ChevronDown, ArrowUpRight, ArrowDownRight, Loader2 } from 'lucide-react';
import InfoTooltip from '@/components/common/InfoTooltip';
import { AdSpendHistory, CampaignMapping, CustomMetric } from '@/lib/services/marketing';
import { isEntregado } from '@/lib/utils/status';
import { evaluateCustomMetric, formatMetricValue } from '@/lib/utils/customMetrics';
import { useHierarchyData, type AggregatedRow } from '@/lib/hooks/useHierarchyData';

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

const DEFAULT_VISIBLE = new Set(['cpc', 'ctr', 'clicks', 'real_cpa', 'roas_real', 'fact_despachado']);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function safeNum(v: any): number {
    const n = Number(v);
    return isFinite(n) ? n : 0;
}

function getMetricValue(data: any, key: string): number {
    switch (key) {
        case 'cpm': return safeNum(data.cpm);
        case 'cpc': return safeNum(data.cpc);
        case 'ctr': return safeNum(data.ctr);
        case 'clicks': return safeNum(data.clicks);
        case 'page_visits': return safeNum(data.page_visits);
        case 'add_to_cart': return safeNum(data.add_to_cart);
        case 'conversions': return safeNum(data.conversions);
        case 'conversion_rate': return safeNum(data.conversion_rate);
        case 'landing_load_rate': return safeNum(data.landing_load_rate);
        case 'fb_cpa': return safeNum(data.fb_cpa);
        case 'real_cpa': return safeNum(data.real_cpa);
        case 'roas_real': return safeNum(data.roas_real);
        case 'fact_despachado': return safeNum(data.facturado_despachado);
        default: return safeNum(data[key]);
    }
}

function formatMetric(value: number, format: MetricFormat): string {
    const n = Number(value);
    if (n === 0 || !isFinite(n)) return '-';
    switch (format) {
        case 'currency': return formatCurrency(n);
        case 'percent': return `${n.toFixed(2)}%`;
        case 'multiplier': return `${n.toFixed(2)}x`;
        case 'number': return n.toLocaleString('es-CO', { maximumFractionDigits: 0 });
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

function getStatusBadge(data: { amount: number; conversions: number; revenue_attributed: number; fb_cpa: number; roas_real?: number; real_cpa?: number; facturado_despachado?: number }): { color: string; text: string } {
    if (!data.amount || data.amount === 0) {
        return { color: 'bg-muted/10 text-muted border-card-border', text: 'Sin Gasto' };
    }

    // Strategy 1: Use FB pixel data (CPA / AOV ratio)
    const aovFb = data.conversions > 0 ? data.revenue_attributed / data.conversions : 0;
    if (aovFb > 0) {
        const cpaRatio = data.fb_cpa / aovFb;
        if (cpaRatio >= 0.50) return { color: 'bg-rose-500/10 text-rose-500 border-rose-500/20', text: 'Apagar' };
        if (cpaRatio >= 0.35) return { color: 'bg-orange-500/10 text-orange-500 border-orange-500/20', text: 'Alerta' };
        if (cpaRatio >= 0.25) return { color: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20', text: 'Observar' };
        return { color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20', text: 'Escalar' };
    }

    // Strategy 2: Fallback to ROAS Real (from actual orders)
    const roas = data.roas_real || 0;
    if (roas > 0) {
        if (roas >= 3) return { color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20', text: 'Escalar' };
        if (roas >= 2) return { color: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20', text: 'Observar' };
        if (roas >= 1) return { color: 'bg-orange-500/10 text-orange-500 border-orange-500/20', text: 'Alerta' };
        return { color: 'bg-rose-500/10 text-rose-500 border-rose-500/20', text: 'Apagar' };
    }

    return { color: 'bg-muted/10 text-muted border-card-border', text: 'Sin Data' };
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
    fbToken?: string | null;
    fbAccountIds?: string[];
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

type ActiveTab = 'campaigns' | 'adsets' | 'ads';

export const CampaignAnalysis: React.FC<CampaignAnalysisProps> = ({ rawHistory, mappings, rawOrders, globalCountryFilter, customMetrics = [], startDate, endDate, fbToken = null, fbAccountIds: fbAccountIdsProp = [] }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [platformFilter, setPlatformFilter] = useState<'all' | 'facebook' | 'tiktok'>('all');
    const [visibleMetrics, setVisibleMetrics] = useState<Set<string>>(DEFAULT_VISIBLE);

    // Stabilize fbAccountIds reference to prevent unnecessary re-renders
    const fbAccountIds = useMemo(() => fbAccountIdsProp, [fbAccountIdsProp.join(',')]);

    // Tab navigation
    const [activeTab, setActiveTab] = useState<ActiveTab>('campaigns');
    const [selectedProduct, setSelectedProduct] = useState<string>('all');
    const [selectedCampaigns, setSelectedCampaigns] = useState<Set<string>>(new Set());
    const [selectedAdSets, setSelectedAdSets] = useState<Set<string>>(new Set());

    // Dropdowns
    const [isMetricDropdownOpen, setIsMetricDropdownOpen] = useState(false);
    const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);
    const metricDropdownRef = useRef<HTMLDivElement>(null);
    const productDropdownRef = useRef<HTMLDivElement>(null);

    // Hierarchy data hook for on-demand ad sets and ads
    const {
        adsetsByCampaign, adsetsByCampaignName, adsByAdSet,
        loadAdSets, loadAds,
        isLoadingAdSets, isLoadingAds,
        adSetsLoaded, adsLoaded,
        adSetsError, adsError,
    } = useHierarchyData({ fbToken, fbAccountIds, startDate, endDate });

    // Close dropdowns on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (metricDropdownRef.current && !metricDropdownRef.current.contains(e.target as Node)) setIsMetricDropdownOpen(false);
            if (productDropdownRef.current && !productDropdownRef.current.contains(e.target as Node)) setIsProductDropdownOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // Load ad sets when switching to adsets tab
    useEffect(() => {
        if (activeTab === 'adsets' && !adSetsLoaded && !isLoadingAdSets && fbToken) loadAdSets();
    }, [activeTab, adSetsLoaded, isLoadingAdSets, fbToken]);

    // Load ads when switching to ads tab
    useEffect(() => {
        if (activeTab === 'ads' && !adsLoaded && !isLoadingAds && fbToken) loadAds();
    }, [activeTab, adsLoaded, isLoadingAds, fbToken]);

    // Clear selections when product filter changes
    const prevProduct = useRef(selectedProduct);
    useEffect(() => {
        if (prevProduct.current !== selectedProduct) {
            prevProduct.current = selectedProduct;
            setSelectedCampaigns(new Set());
            setSelectedAdSets(new Set());
            setActiveTab('campaigns');
        }
    }, [selectedProduct]);

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

    // ─── Aggregation Logic (same 4-pass pipeline) ───
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
                        campaign_id: (h as any).campaign_id || '',
                        amount: 0, impressions: 0, clicks: 0, page_visits: 0,
                        add_to_cart: 0, conversions: 0, revenue_attributed: 0
                    });
                } else if (!campaignMap.get(key).campaign_id && (h as any).campaign_id) {
                    campaignMap.get(key).campaign_id = (h as any).campaign_id;
                }

                const agg = campaignMap.get(key);
                agg.amount += (Number(h.amount) || 0);
                agg.impressions += (Number(h.impressions) || 0);
                agg.clicks += (Number(h.clicks) || 0);
                agg.page_visits += (Number(h.page_visits) || 0);
                agg.add_to_cart += (Number(h.add_to_cart) || 0);
                agg.conversions += (Number(h.conversions) || 0);
                agg.revenue_attributed += (Number(h.revenue_attributed) || 0);

                if (productId !== 'Sin Mapear') {
                    productSpendMap.set(productId, (productSpendMap.get(productId) || 0) + (Number(h.amount) || 0));
                }
            });

            // Pass 1b: Fallback — use clicks as page_visits when no pixel data
            campaignMap.forEach(agg => {
                if (agg.page_visits === 0 && agg.clicks > 0) {
                    agg.page_visits = agg.clicks;
                    agg._pvFromClicks = true;
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
                if (pid && pname) productIdToName.set(pid, pname);

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
                const cAmt = Number(camp.amount) || 0;
                const cImp = Number(camp.impressions) || 0;
                const cClk = Number(camp.clicks) || 0;
                const cConv = Number(camp.conversions) || 0;
                const cPv = Number(camp.page_visits) || 0;
                camp.cpc = cClk > 0 ? cAmt / cClk : 0;
                camp.ctr = cImp > 0 ? (cClk / cImp) * 100 : 0;
                camp.cpm = cImp > 0 ? (cAmt / cImp) * 1000 : 0;
                camp.fb_cpa = cConv > 0 ? cAmt / cConv : 0;
                camp.conversion_rate = cPv > 0 ? (cConv / cPv) * 100 : 0;
                camp.landing_load_rate = (!camp._pvFromClicks && cClk > 0) ? (cPv / cClk) * 100 : 0;
                camp.real_cpa = 0;
                camp.roas_real = 0;
                camp.facturado_despachado = 0;

                const pid = camp.productId;
                if (!productGroupMap.has(pid)) {
                    let displayName = pid;
                    if (pid !== 'Sin Mapear') {
                        displayName = productIdToName.get(pid) || mappings.find(m => m.productId === pid)?.productName || pid;
                        if (displayName.includes(' - ')) displayName = displayName.split(' - ').slice(1).join(' - ');
                    }
                    productGroupMap.set(pid, {
                        productId: pid, productName: displayName, campaigns: [],
                        summary: { amount: 0, impressions: 0, clicks: 0, page_visits: 0, add_to_cart: 0, conversions: 0, revenue_attributed: 0, cpm: 0, cpc: 0, ctr: 0, fb_cpa: 0, real_cpa: 0, conversion_rate: 0, landing_load_rate: 0, roas_real: 0, facturado_bruto: 0, facturado_real: 0, facturado_despachado: 0 }
                    });
                }

                const pGroup = productGroupMap.get(pid);
                pGroup.campaigns.push(camp);
                ['amount', 'impressions', 'clicks', 'page_visits', 'add_to_cart', 'conversions', 'revenue_attributed'].forEach(k => {
                    pGroup.summary[k] += (Number(camp[k]) || 0);
                });
                if (camp._pvFromClicks) pGroup._pvFromClicks = true;
            });

            // Pass 4: Compute product-level metrics and propagate to campaigns
            Array.from(productGroupMap.values()).forEach(pGroup => {
                const s = pGroup.summary;
                const amt = Number(s.amount) || 0;
                const imp = Number(s.impressions) || 0;
                const clk = Number(s.clicks) || 0;
                const conv = Number(s.conversions) || 0;
                const pv = Number(s.page_visits) || 0;

                s.cpm = imp > 0 ? (amt / imp) * 1000 : 0;
                s.cpc = clk > 0 ? amt / clk : 0;
                s.ctr = imp > 0 ? (clk / imp) * 100 : 0;
                s.fb_cpa = conv > 0 ? amt / conv : 0;
                s.conversion_rate = pv > 0 ? (conv / pv) * 100 : 0;
                s.landing_load_rate = (!pGroup._pvFromClicks && clk > 0) ? (pv / clk) * 100 : 0;

                if (pGroup.productId !== 'Sin Mapear') {
                    const dispatchedOrders = Number(productDispatchedOrdersMap.get(pGroup.productId)) || 0;
                    const deliveredOrders = Number(productOrdersMap.get(pGroup.productId)) || 0;
                    const rev = Number(productRevenueMap.get(pGroup.productId)) || 0;
                    const gross = Number(productGrossRevenueMap.get(pGroup.productId)) || 0;
                    const dispatched = Number(productDispatchedRevenueMap.get(pGroup.productId)) || 0;

                    if (s.conversions === 0 && deliveredOrders > 0) { s.conversions = deliveredOrders; s.revenue_attributed = rev; }
                    const effConv = Number(s.conversions) || 0;
                    const effPv = Number(s.page_visits) || 0;
                    s.fb_cpa = effConv > 0 ? amt / effConv : 0;
                    s.conversion_rate = effPv > 0 ? (effConv / effPv) * 100 : 0;
                    s.real_cpa = dispatchedOrders > 0 ? amt / dispatchedOrders : 0;
                    s.roas_real = amt > 0 ? dispatched / amt : 0;
                    s.facturado_real = rev;
                    s.facturado_bruto = gross;
                    s.facturado_despachado = dispatched;

                    pGroup.campaigns.forEach((c: any) => {
                        c.real_cpa = s.real_cpa;
                        c.roas_real = s.roas_real;
                        c.facturado_despachado = dispatched;
                        if (c.conversions === 0 && deliveredOrders > 0) {
                            c.conversions = deliveredOrders;
                            c.revenue_attributed = rev;
                            const cPv = Number(c.page_visits) || 0;
                            c.fb_cpa = deliveredOrders > 0 ? (Number(c.amount) || 0) / deliveredOrders : 0;
                            c.conversion_rate = cPv > 0 ? (deliveredOrders / cPv) * 100 : 0;
                        }
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

        const summaryData = { totalCampaigns: 0, totalProducts: resultProducts.length };
        resultProducts.forEach(p => summaryData.totalCampaigns += p.campaigns.length);
        return { products: resultProducts, summary: summaryData };
    }, [rawHistory, mappings, rawOrders, startDate, endDate, prevStartDate, prevEndDate, globalCountryFilter]);

    // ─── Filtered products (search + platform) ───
    const filteredProducts = useMemo(() => products.filter(p => {
        const matchesSearch = !searchTerm || p.productId.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.campaigns.some((c: any) => c.campaignName.toLowerCase().includes(searchTerm.toLowerCase()));
        if (!matchesSearch) return false;
        if (platformFilter !== 'all' && !p.campaigns.some((c: any) => c.platform === platformFilter)) return false;
        return true;
    }).map(p => ({
        ...p,
        campaigns: platformFilter === 'all' ? p.campaigns : p.campaigns.filter((c: any) => c.platform === platformFilter)
    })), [products, searchTerm, platformFilter]);

    // ─── Product options for dropdown ───
    const productOptions = useMemo(() =>
        products.filter(p => p.productId !== 'Sin Mapear').map(p => ({ id: p.productId, name: p.productName })),
    [products]);

    // ─── Flat campaigns (filtered by product) ───
    const flatCampaigns = useMemo(() => {
        const campaigns: any[] = [];
        const productsToUse = selectedProduct === 'all'
            ? filteredProducts
            : filteredProducts.filter(p => p.productId === selectedProduct);

        productsToUse.forEach(p => {
            p.campaigns.forEach((c: any) => {
                // Apply search within campaigns tab
                if (activeTab === 'campaigns' && searchTerm) {
                    const term = searchTerm.toLowerCase();
                    if (!c.campaignName.toLowerCase().includes(term) && !p.productName.toLowerCase().includes(term)) return;
                }
                campaigns.push({
                    ...c,
                    _productName: p.productName,
                    _productId: p.productId,
                    _key: `${c.campaignName}_${c.platform}`,
                });
            });
        });
        return campaigns.sort((a, b) => b.amount - a.amount);
    }, [filteredProducts, selectedProduct, activeTab, searchTerm]);

    // ─── Ad sets for selected campaigns ───
    const currentAdSets = useMemo(() => {
        if (selectedCampaigns.size === 0) return [];
        const adSets: any[] = [];
        flatCampaigns.forEach(c => {
            if (!selectedCampaigns.has(c._key)) return;
            const sets = adsetsByCampaign[c.campaign_id] || adsetsByCampaignName[c.campaignName] || [];
            sets.forEach((adset: AggregatedRow) => {
                // Apply search within adsets tab
                if (activeTab === 'adsets' && searchTerm && !adset.name.toLowerCase().includes(searchTerm.toLowerCase())) return;
                adSets.push({
                    ...adset,
                    _campaignName: c.campaignName,
                    _productMetrics: { real_cpa: c.real_cpa || 0, roas_real: c.roas_real || 0, facturado_despachado: c.facturado_despachado || 0 },
                });
            });
        });
        return adSets.sort((a, b) => b.amount - a.amount);
    }, [selectedCampaigns, flatCampaigns, adsetsByCampaign, adsetsByCampaignName, activeTab, searchTerm]);

    // ─── Ads for selected ad sets ───
    const currentAds = useMemo(() => {
        if (selectedAdSets.size === 0) return [];
        const ads: any[] = [];
        currentAdSets.forEach(adset => {
            if (!selectedAdSets.has(adset.id)) return;
            const adList = adsByAdSet[adset.id] || [];
            adList.forEach((ad: AggregatedRow) => {
                if (activeTab === 'ads' && searchTerm && !ad.name.toLowerCase().includes(searchTerm.toLowerCase())) return;
                ads.push({
                    ...ad,
                    _adsetName: adset.name,
                    _productMetrics: adset._productMetrics,
                });
            });
        });
        return ads.sort((a, b) => b.amount - a.amount);
    }, [selectedAdSets, currentAdSets, adsByAdSet, activeTab, searchTerm]);

    // ─── Selection helpers ───
    const toggleCampaignSelection = (key: string) => {
        setSelectedCampaigns(prev => {
            const next = new Set(prev);
            next.has(key) ? next.delete(key) : next.add(key);
            return next;
        });
    };

    const toggleAdSetSelection = (id: string) => {
        setSelectedAdSets(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const fbCampaigns = flatCampaigns.filter(c => c.platform === 'facebook' && !!fbToken);
    const allCampaignsSelected = fbCampaigns.length > 0 && fbCampaigns.every(c => selectedCampaigns.has(c._key));
    const toggleSelectAllCampaigns = () => {
        if (allCampaignsSelected) {
            setSelectedCampaigns(new Set());
        } else {
            setSelectedCampaigns(new Set(fbCampaigns.map(c => c._key)));
        }
    };

    const allAdSetsSelected = currentAdSets.length > 0 && currentAdSets.every(a => selectedAdSets.has(a.id));
    const toggleSelectAllAdSets = () => {
        if (allAdSetsSelected) {
            setSelectedAdSets(new Set());
        } else {
            setSelectedAdSets(new Set(currentAdSets.map(a => a.id)));
        }
    };

    const toggleMetric = (key: string) => {
        setVisibleMetrics(prev => {
            const next = new Set(prev);
            if (next.has(key)) { if (next.size <= 1) return prev; next.delete(key); } else { next.add(key); }
            return next;
        });
    };

    const toggleGroup = (group: MetricGroup) => {
        setVisibleMetrics(prev => {
            const groupKeys = METRIC_COLUMNS.filter(m => m.group === group).map(m => m.key);
            const allActive = groupKeys.every(k => prev.has(k));
            const next = new Set(prev);
            if (allActive) { groupKeys.forEach(k => next.delete(k)); if (next.size === 0) return prev; }
            else { groupKeys.forEach(k => next.add(k)); }
            return next;
        });
    };

    // ─── Grid template (with checkbox column) ───
    const showCheckbox = activeTab !== 'ads';
    const gridTemplate = `${showCheckbox ? '32px ' : ''}minmax(180px, 2fr) minmax(75px, 0.7fr) minmax(100px, 0.9fr) ${activeColumns.map(() => 'minmax(100px, 1fr)').join(' ')}`;
    const minTableWidth = (showCheckbox ? 32 : 0) + 180 + 75 + 100 + activeColumns.length * 110 + (activeColumns.length + 2) * 12 + 40;

    // Tab labels & counts
    const tabConfig: { key: ActiveTab; label: string; count: number; disabled: boolean; badge?: string }[] = [
        { key: 'campaigns', label: 'Campanas', count: flatCampaigns.length, disabled: false },
        { key: 'adsets', label: 'Conjuntos', count: currentAdSets.length, disabled: selectedCampaigns.size === 0, badge: selectedCampaigns.size > 0 ? `${selectedCampaigns.size} sel.` : undefined },
        { key: 'ads', label: 'Anuncios', count: currentAds.length, disabled: selectedAdSets.size === 0, badge: selectedAdSets.size > 0 ? `${selectedAdSets.size} sel.` : undefined },
    ];

    // Header labels per tab
    const firstColLabel = activeTab === 'campaigns' ? 'Campana' : activeTab === 'adsets' ? 'Conjunto de Anuncios' : 'Anuncio';

    // Current data source for active tab
    const currentRows = activeTab === 'campaigns' ? flatCampaigns : activeTab === 'adsets' ? currentAdSets : currentAds;

    return (
        <div className="bg-card border border-card-border rounded-2xl flex flex-col shadow-sm" style={{ minHeight: 500 }}>
            {/* Header */}
            <div className="p-5 border-b border-card-border flex flex-col gap-4">
                <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
                    <div className="flex flex-col gap-2">
                        <h3 className="text-[11px] font-black text-muted uppercase tracking-widest flex items-center gap-1.5">
                            Analisis de Campanas <InfoTooltip text="Vista tipo Facebook Ads Manager. Selecciona campanas para ver conjuntos de anuncios, luego selecciona conjuntos para ver anuncios." />
                        </h3>
                        <div className="flex items-center gap-2">
                            <span className="text-[9px] font-bold text-muted bg-muted/10 px-1.5 py-0.5 rounded tabular-nums">{summary.totalProducts} Productos</span>
                            <span className="text-[9px] font-bold text-muted bg-muted/10 px-1.5 py-0.5 rounded tabular-nums">{summary.totalCampaigns} Campanas</span>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        {/* Product dropdown */}
                        <div className="relative" ref={productDropdownRef}>
                            <button onClick={() => setIsProductDropdownOpen(!isProductDropdownOpen)}
                                className="flex items-center gap-2 bg-card border border-card-border rounded-xl px-3 py-2 text-xs font-bold hover:border-accent/50 transition-colors">
                                <Filter className="w-3.5 h-3.5 text-muted" />
                                <span className="max-w-[150px] truncate">{selectedProduct === 'all' ? 'Todos los Productos' : productOptions.find(p => p.id === selectedProduct)?.name || selectedProduct}</span>
                                <ChevronDown className="w-3 h-3 text-muted" />
                            </button>
                            {isProductDropdownOpen && (
                                <div className="absolute top-full left-0 mt-1 bg-card border border-card-border rounded-xl shadow-lg z-50 w-64 max-h-60 overflow-y-auto">
                                    <div onClick={() => { setSelectedProduct('all'); setIsProductDropdownOpen(false); }}
                                        className={`px-3 py-2 text-xs cursor-pointer hover:bg-hover-bg transition-colors ${selectedProduct === 'all' ? 'text-accent font-bold' : 'text-foreground/80'}`}>
                                        Todos los Productos
                                    </div>
                                    {productOptions.map(p => (
                                        <div key={p.id} onClick={() => { setSelectedProduct(p.id); setIsProductDropdownOpen(false); }}
                                            className={`px-3 py-2 text-xs cursor-pointer hover:bg-hover-bg transition-colors truncate ${selectedProduct === p.id ? 'text-accent font-bold' : 'text-foreground/80'}`}>
                                            {p.name}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Search */}
                        <div className="relative flex-1 min-w-[180px]">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                            <input type="text" placeholder={activeTab === 'campaigns' ? 'Buscar campana...' : activeTab === 'adsets' ? 'Buscar conjunto...' : 'Buscar anuncio...'}
                                value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-card border border-card-border rounded-xl pl-9 pr-4 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-accent/50 transition-colors" />
                        </div>

                        {/* Platform filter */}
                        <div className="flex items-center bg-card border border-card-border rounded-xl p-1">
                            <button onClick={() => setPlatformFilter('all')} className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${platformFilter === 'all' ? 'bg-accent text-white' : 'text-muted hover:text-foreground'}`}>Todo</button>
                            <button onClick={() => setPlatformFilter('facebook')} className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-1 ${platformFilter === 'facebook' ? 'bg-blue-600 text-white' : 'text-muted hover:text-blue-400'}`}><Facebook className="w-3 h-3" /> FB</button>
                            <button onClick={() => setPlatformFilter('tiktok')} className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-1 ${platformFilter === 'tiktok' ? 'bg-[#00f2fe] text-black' : 'text-muted hover:text-[#00f2fe]'}`}><TikTokIcon className="w-3 h-3" /> TT</button>
                        </div>

                        {/* Metric dropdown */}
                        <div className="relative" ref={metricDropdownRef}>
                            <button onClick={() => setIsMetricDropdownOpen(!isMetricDropdownOpen)}
                                className="flex items-center gap-2 bg-card border border-card-border rounded-xl px-3 py-2 text-xs font-bold hover:border-accent/50 transition-colors">
                                <span>Metricas</span>
                                <span className="px-1.5 py-0.5 rounded bg-accent/20 text-accent text-[9px] font-black">{visibleMetrics.size}</span>
                                <ChevronDown className="w-3 h-3 text-muted" />
                            </button>
                            {isMetricDropdownOpen && (
                                <div className="absolute top-full right-0 mt-1 bg-card border border-card-border rounded-xl shadow-lg z-50 w-72 max-h-80 overflow-y-auto p-3">
                                    {(['anuncio', 'landing', 'general'] as MetricGroup[]).map(group => {
                                        const groupMetrics = METRIC_COLUMNS.filter(m => m.group === group);
                                        const colors = GROUP_COLORS[group];
                                        const allActive = groupMetrics.every(m => visibleMetrics.has(m.key));
                                        return (
                                            <div key={group} className="mb-3">
                                                <label className="flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-hover-bg rounded">
                                                    <input type="checkbox" checked={allActive} onChange={() => toggleGroup(group)} className="accent-current w-3.5 h-3.5" />
                                                    <span className={`text-[10px] font-black uppercase tracking-widest ${group === 'anuncio' ? 'text-orange-400' : group === 'landing' ? 'text-emerald-400' : 'text-blue-400'}`}>{colors.label}</span>
                                                </label>
                                                {groupMetrics.map(m => (
                                                    <label key={m.key} className="flex items-center gap-2 px-4 py-1 cursor-pointer hover:bg-hover-bg rounded">
                                                        <input type="checkbox" checked={visibleMetrics.has(m.key)} onChange={() => toggleMetric(m.key)} className="w-3.5 h-3.5" />
                                                        <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
                                                        <span className="text-xs text-foreground/80">{m.label}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        );
                                    })}
                                    {customMetrics.length > 0 && (
                                        <div className="mb-3 border-t border-card-border pt-2">
                                            <span className="px-2 text-[10px] font-black uppercase tracking-widest text-violet-400">Custom</span>
                                            {customMetrics.map(cm => {
                                                const key = `custom_${cm.id}`;
                                                return (
                                                    <label key={key} className="flex items-center gap-2 px-4 py-1 cursor-pointer hover:bg-hover-bg rounded">
                                                        <input type="checkbox" checked={visibleMetrics.has(key)} onChange={() => toggleMetric(key)} className="w-3.5 h-3.5" />
                                                        <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />
                                                        <span className="text-xs text-foreground/80">{cm.name}</span>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Tab Bar */}
            <div className="flex items-center border-b border-card-border px-5 overflow-x-auto">
                {tabConfig.map(tab => (
                    <button key={tab.key} onClick={() => !tab.disabled && setActiveTab(tab.key)}
                        className={`px-4 py-3 text-[11px] font-black uppercase tracking-widest border-b-2 transition-all whitespace-nowrap ${
                            activeTab === tab.key ? 'border-accent text-accent' : 'border-transparent text-muted hover:text-foreground'
                        } ${tab.disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}>
                        {tab.label}
                        <span className="ml-1.5 px-1.5 py-0.5 rounded bg-muted/10 text-[9px] tabular-nums">{tab.count}</span>
                        {tab.badge && (
                            <span className="ml-1 px-1.5 py-0.5 rounded bg-accent/20 text-accent text-[9px]">{tab.badge}</span>
                        )}
                    </button>
                ))}
            </div>

            {/* Table */}
            <div className="flex-1 overflow-x-auto overflow-y-auto relative max-h-[700px] min-w-0">
                {/* Sticky Header */}
                <div className="hidden lg:block sticky top-0 bg-card z-30 shadow-sm">
                    {/* Group Header Row */}
                    <div className="grid gap-3 px-5 py-2 border-b border-card-border/50" style={{ gridTemplateColumns: gridTemplate, minWidth: minTableWidth }}>
                        <div style={{ gridColumn: `span ${showCheckbox ? 4 : 3}` }} />
                        {groupSpans.map((span, i) => (
                            <div key={span.group} style={{ gridColumn: `span ${span.count}` }}
                                className={`text-center text-[10px] font-black uppercase tracking-widest py-1 rounded-lg ${span.bg} ${span.text} ${i < groupSpans.length - 1 ? 'border-r border-card-border' : ''}`}>
                                {span.label}
                            </div>
                        ))}
                    </div>
                    {/* Column Header Row */}
                    <div className="grid gap-3 px-5 py-3 border-b border-card-border" style={{ gridTemplateColumns: gridTemplate, minWidth: minTableWidth }}>
                        {showCheckbox && (
                            <div className="flex items-center justify-center">
                                <input type="checkbox"
                                    checked={activeTab === 'campaigns' ? allCampaignsSelected : allAdSetsSelected}
                                    onChange={activeTab === 'campaigns' ? toggleSelectAllCampaigns : toggleSelectAllAdSets}
                                    className="w-3.5 h-3.5 cursor-pointer" />
                            </div>
                        )}
                        <div className="text-[10px] font-black uppercase tracking-widest text-muted">{firstColLabel}</div>
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
                <div className="divide-y divide-card-border/30">
                    {/* Empty states */}
                    {activeTab === 'adsets' && selectedCampaigns.size === 0 && (
                        <div className="px-6 py-20 text-center text-muted">
                            <div className="flex flex-col items-center justify-center gap-3">
                                <Filter className="w-8 h-8 opacity-20" />
                                <p className="text-sm font-medium">Selecciona campanas de Facebook para ver sus conjuntos de anuncios.</p>
                            </div>
                        </div>
                    )}
                    {activeTab === 'adsets' && selectedCampaigns.size > 0 && isLoadingAdSets && !adSetsLoaded && (
                        <div className="px-6 py-20 text-center text-muted">
                            <div className="flex flex-col items-center justify-center gap-3">
                                <Loader2 className="w-6 h-6 animate-spin" />
                                <p className="text-sm font-medium">Cargando conjuntos de anuncios...</p>
                            </div>
                        </div>
                    )}
                    {activeTab === 'adsets' && selectedCampaigns.size > 0 && adSetsError && (
                        <div className="px-6 py-10 text-center text-rose-400 text-sm font-medium">{adSetsError}</div>
                    )}
                    {activeTab === 'ads' && selectedAdSets.size === 0 && (
                        <div className="px-6 py-20 text-center text-muted">
                            <div className="flex flex-col items-center justify-center gap-3">
                                <Filter className="w-8 h-8 opacity-20" />
                                <p className="text-sm font-medium">Selecciona conjuntos para ver los anuncios.</p>
                            </div>
                        </div>
                    )}
                    {activeTab === 'ads' && selectedAdSets.size > 0 && isLoadingAds && !adsLoaded && (
                        <div className="px-6 py-20 text-center text-muted">
                            <div className="flex flex-col items-center justify-center gap-3">
                                <Loader2 className="w-6 h-6 animate-spin" />
                                <p className="text-sm font-medium">Cargando anuncios...</p>
                            </div>
                        </div>
                    )}
                    {activeTab === 'ads' && selectedAdSets.size > 0 && adsError && (
                        <div className="px-6 py-10 text-center text-rose-400 text-sm font-medium">{adsError}</div>
                    )}

                    {/* Data rows */}
                    {currentRows.length === 0 && activeTab === 'campaigns' && (
                        <div className="px-6 py-20 text-center text-muted">
                            <div className="flex flex-col items-center justify-center gap-3">
                                <Filter className="w-8 h-8 opacity-20" />
                                <p className="text-sm font-medium">No se encontraron campanas para los filtros seleccionados.</p>
                            </div>
                        </div>
                    )}
                    {activeTab === 'adsets' && selectedCampaigns.size > 0 && adSetsLoaded && !adSetsError && currentAdSets.length === 0 && (
                        <div className="px-6 py-20 text-center text-muted">
                            <div className="flex flex-col items-center justify-center gap-3">
                                <Filter className="w-8 h-8 opacity-20" />
                                <p className="text-sm font-medium">Sin conjuntos de anuncios para las campanas seleccionadas.</p>
                            </div>
                        </div>
                    )}
                    {activeTab === 'ads' && selectedAdSets.size > 0 && adsLoaded && !adsError && currentAds.length === 0 && (
                        <div className="px-6 py-20 text-center text-muted">
                            <div className="flex flex-col items-center justify-center gap-3">
                                <Filter className="w-8 h-8 opacity-20" />
                                <p className="text-sm font-medium">Sin anuncios para los conjuntos seleccionados.</p>
                            </div>
                        </div>
                    )}

                    {/* Campaign rows */}
                    {activeTab === 'campaigns' && flatCampaigns.map((c) => {
                        const isFb = c.platform === 'facebook';
                        const canSelect = isFb && !!fbToken;
                        const isSelected = selectedCampaigns.has(c._key);
                        const badge = getStatusBadge({ ...c, roas_real: c.roas_real, real_cpa: c.real_cpa, facturado_despachado: c.facturado_despachado });

                        return (
                            <div key={c._key}
                                className={`lg:grid items-center gap-3 px-5 py-3 hover:bg-hover-bg transition-colors ${isSelected ? 'bg-accent/5' : ''}`}
                                style={{ gridTemplateColumns: gridTemplate, minWidth: minTableWidth }}>
                                {/* Checkbox */}
                                <div className="flex items-center justify-center">
                                    {canSelect ? (
                                        <input type="checkbox" checked={isSelected} onChange={() => toggleCampaignSelection(c._key)} className="w-3.5 h-3.5 cursor-pointer" />
                                    ) : <span className="w-3.5 h-3.5" />}
                                </div>
                                {/* Name */}
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        {isFb ? <Facebook className="w-3.5 h-3.5 text-blue-400 shrink-0" /> : <TikTokIcon className="w-3.5 h-3.5 text-[#00f2fe] shrink-0" />}
                                        <h5 className="text-xs font-semibold text-foreground/80 truncate" title={c.campaignName}>{c.campaignName}</h5>
                                    </div>
                                    <p className="text-[9px] text-muted ml-5 truncate">{c._productName}</p>
                                </div>
                                {/* Status */}
                                <div className="lg:text-center mt-1 lg:mt-0">
                                    <span className={`inline-block px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border ${badge.color}`}>{badge.text}</span>
                                </div>
                                {/* Spend */}
                                <div className="flex items-center justify-between lg:block lg:text-right mt-1 lg:mt-0">
                                    <span className="lg:hidden text-[9px] font-black text-muted uppercase">Gasto: </span>
                                    <div className="flex flex-col items-end">
                                        <span className="font-mono text-xs font-semibold text-orange-400">{formatCurrency(c.amount)}</span>
                                        {c._prev && <GrowthBadge current={c.amount} prev={c._prev.amount} invert className="mt-0.5" />}
                                    </div>
                                </div>
                                {/* Metrics */}
                                {activeColumns.map(col => {
                                    let val = getMetricValue(c, col.key);
                                    let fmt = col.format;
                                    const prevVal = c._prev ? getMetricValue(c._prev, col.key) : 0;
                                    if (col.key.startsWith('custom_')) {
                                        const cmId = col.key.replace('custom_', '');
                                        const cm = customMetrics.find(x => x.id === cmId);
                                        if (cm) { val = evaluateCustomMetric(cm.formula, c); fmt = cm.format as MetricFormat; }
                                    }
                                    return (
                                        <div key={col.key} className={`flex items-center justify-between lg:block lg:text-right mt-1 lg:mt-0 rounded px-1 ${getGroupBg(col)}`}>
                                            <span className="lg:hidden text-[9px] font-black text-muted uppercase">{col.shortLabel}: </span>
                                            <div className="flex flex-col items-end">
                                                <span className={`font-mono text-xs font-bold ${metricColor(col.key, val, c.amount)}`}>
                                                    {col.key.startsWith('custom_') ? formatMetricValue(val, fmt as any) : formatMetric(val, fmt)}
                                                </span>
                                                {prevVal > 0 && <GrowthBadge current={val} prev={prevVal} invert={col.invert} className="mt-0.5" />}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })}

                    {/* Ad Set rows */}
                    {activeTab === 'adsets' && adSetsLoaded && !adSetsError && currentAdSets.map((adset) => {
                        const isSelected = selectedAdSets.has(adset.id);
                        const adsetData = { ...adset, ...adset._productMetrics };
                        const badge = getStatusBadge({ ...adsetData });

                        return (
                            <div key={adset.id}
                                className={`lg:grid items-center gap-3 px-5 py-3 hover:bg-hover-bg transition-colors ${isSelected ? 'bg-accent/5' : ''}`}
                                style={{ gridTemplateColumns: gridTemplate, minWidth: minTableWidth }}>
                                {/* Checkbox */}
                                <div className="flex items-center justify-center">
                                    <input type="checkbox" checked={isSelected} onChange={() => toggleAdSetSelection(adset.id)} className="w-3.5 h-3.5 cursor-pointer" />
                                </div>
                                {/* Name */}
                                <div className="min-w-0">
                                    <h5 className="text-xs font-medium text-foreground/80 truncate" title={adset.name}>{adset.name}</h5>
                                    <p className="text-[9px] text-muted truncate">{adset._campaignName}</p>
                                </div>
                                {/* Status */}
                                <div className="lg:text-center mt-1 lg:mt-0">
                                    <span className={`inline-block px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border ${badge.color}`}>{badge.text}</span>
                                </div>
                                {/* Spend */}
                                <div className="flex items-center justify-between lg:block lg:text-right mt-1 lg:mt-0">
                                    <span className="lg:hidden text-[9px] font-black text-muted uppercase">Gasto: </span>
                                    <span className="font-mono text-xs font-medium text-orange-400/80">{formatCurrency(adset.amount)}</span>
                                </div>
                                {/* Metrics */}
                                {activeColumns.map(col => {
                                    const val = getMetricValue(adsetData, col.key);
                                    return (
                                        <div key={col.key} className={`flex items-center justify-between lg:block lg:text-right mt-1 lg:mt-0 rounded px-1 ${getGroupBg(col)}`}>
                                            <span className="lg:hidden text-[9px] font-black text-muted uppercase">{col.shortLabel}: </span>
                                            <span className={`font-mono text-xs font-medium ${metricColor(col.key, val, adset.amount)}`}>{formatMetric(val, col.format)}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })}

                    {/* Ad rows */}
                    {activeTab === 'ads' && adsLoaded && !adsError && currentAds.map((ad) => {
                        const adData = { ...ad, ...ad._productMetrics };
                        const badge = getStatusBadge({ ...adData });

                        return (
                            <div key={ad.id}
                                className="lg:grid items-center gap-3 px-5 py-3 hover:bg-hover-bg transition-colors"
                                style={{ gridTemplateColumns: gridTemplate, minWidth: minTableWidth }}>
                                {/* Name */}
                                <div className="min-w-0">
                                    <h5 className="text-xs font-normal text-foreground/70 truncate" title={ad.name}>{ad.name}</h5>
                                    <p className="text-[9px] text-muted truncate">{ad._adsetName}</p>
                                </div>
                                {/* Status */}
                                <div className="lg:text-center mt-1 lg:mt-0">
                                    <span className={`inline-block px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border ${badge.color}`}>{badge.text}</span>
                                </div>
                                {/* Spend */}
                                <div className="flex items-center justify-between lg:block lg:text-right mt-1 lg:mt-0">
                                    <span className="lg:hidden text-[9px] font-black text-muted uppercase">Gasto: </span>
                                    <span className="font-mono text-xs font-normal text-orange-400/60">{formatCurrency(ad.amount)}</span>
                                </div>
                                {/* Metrics */}
                                {activeColumns.map(col => {
                                    const val = getMetricValue(adData, col.key);
                                    return (
                                        <div key={col.key} className={`flex items-center justify-between lg:block lg:text-right mt-1 lg:mt-0 rounded px-1 ${getGroupBg(col)}`}>
                                            <span className="lg:hidden text-[9px] font-black text-muted uppercase">{col.shortLabel}: </span>
                                            <span className={`font-mono text-xs font-normal ${metricColor(col.key, val, ad.amount)}`}>{formatMetric(val, col.format)}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
