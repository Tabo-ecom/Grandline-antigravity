'use client';

import { useState, useCallback, useRef } from 'react';
import { fetchMetaAdSetInsights, fetchMetaAdLevelInsights } from '@/lib/services/meta';

// ─── Types ──────────────────────────────────────────────────────────

export interface AggregatedRow {
    id: string;
    name: string;
    campaign_id?: string;
    campaign_name?: string;
    adset_id?: string;
    adset_name?: string;
    amount: number;
    impressions: number;
    clicks: number;
    page_visits: number;
    add_to_cart: number;
    conversions: number;
    revenue_attributed: number;
    cpm: number;
    cpc: number;
    ctr: number;
    fb_cpa: number;
    conversion_rate: number;
    landing_load_rate: number;
    _pvFromClicks?: boolean;
}

function aggregateRows(items: any[], groupKey: string, nameKey: string, extraKeys: string[] = []): AggregatedRow[] {
    const map = new Map<string, any>();

    items.forEach(item => {
        const id = item[groupKey];
        if (!id) return;

        if (!map.has(id)) {
            const base: any = {
                id,
                name: item[nameKey] || id,
                amount: 0, impressions: 0, clicks: 0,
                page_visits: 0, add_to_cart: 0,
                conversions: 0, revenue_attributed: 0,
            };
            extraKeys.forEach(k => { base[k] = item[k] || ''; });
            map.set(id, base);
        }

        const agg = map.get(id);
        agg.amount += (Number(item.spend) || 0);
        agg.impressions += (Number(item.impressions) || 0);
        agg.clicks += (Number(item.clicks) || 0);
        agg.page_visits += (Number(item.page_visits) || 0);
        agg.add_to_cart += (Number(item.add_to_cart) || 0);
        agg.conversions += (Number(item.purchases) || 0);
        agg.revenue_attributed += (Number(item.revenue) || 0);
    });

    // Compute derived metrics
    return Array.from(map.values()).map(agg => {
        const amt = agg.amount;
        const imp = agg.impressions;
        const clk = agg.clicks;
        const conv = agg.conversions;
        const pv = agg.page_visits;

        // Fallback: clicks as page_visits
        if (pv === 0 && clk > 0) {
            agg.page_visits = clk;
            agg._pvFromClicks = true;
        }

        const effPv = agg.page_visits;

        return {
            ...agg,
            cpm: imp > 0 ? (amt / imp) * 1000 : 0,
            cpc: clk > 0 ? amt / clk : 0,
            ctr: imp > 0 ? (clk / imp) * 100 : 0,
            fb_cpa: conv > 0 ? amt / conv : 0,
            conversion_rate: effPv > 0 ? (conv / effPv) * 100 : 0,
            landing_load_rate: (!agg._pvFromClicks && clk > 0) ? (effPv / clk) * 100 : 0,
        } as AggregatedRow;
    }).sort((a, b) => b.amount - a.amount);
}

// ─── Hook ───────────────────────────────────────────────────────────

interface UseHierarchyDataProps {
    fbToken: string | null;
    fbAccountIds: string[];
    startDate: string;
    endDate: string;
}

export interface UseHierarchyDataReturn {
    adsetsByCampaign: Record<string, AggregatedRow[]>;
    adsetsByCampaignName: Record<string, AggregatedRow[]>;
    adsByAdSet: Record<string, AggregatedRow[]>;
    loadAdSets: () => Promise<void>;
    loadAds: () => Promise<void>;
    isLoadingAdSets: boolean;
    isLoadingAds: boolean;
    adSetsLoaded: boolean;
    adsLoaded: boolean;
    adSetsError: string | null;
    adsError: string | null;
}

export function useHierarchyData({ fbToken, fbAccountIds, startDate, endDate }: UseHierarchyDataProps): UseHierarchyDataReturn {
    const [adsetsByCampaign, setAdsetsByCampaign] = useState<Record<string, AggregatedRow[]>>({});
    const [adsetsByCampaignName, setAdsetsByCampaignName] = useState<Record<string, AggregatedRow[]>>({});
    const [adsByAdSet, setAdsByAdSet] = useState<Record<string, AggregatedRow[]>>({});
    const [isLoadingAdSets, setIsLoadingAdSets] = useState(false);
    const [isLoadingAds, setIsLoadingAds] = useState(false);
    const [adSetsLoaded, setAdSetsLoaded] = useState(false);
    const [adsLoaded, setAdsLoaded] = useState(false);
    const [adSetsError, setAdSetsError] = useState<string | null>(null);
    const [adsError, setAdsError] = useState<string | null>(null);

    // Refs for guards — always current, no stale closures
    const isLoadingAdSetsRef = useRef(false);
    const isLoadingAdsRef = useRef(false);
    const adSetsLoadedRef = useRef(false);
    const adsLoadedRef = useRef(false);

    // Sync refs with state
    adSetsLoadedRef.current = adSetsLoaded;
    adsLoadedRef.current = adsLoaded;

    // Cache key to detect when dates change
    const cacheKeyRef = useRef('');
    const currentKey = `${startDate}_${endDate}_${fbAccountIds.join(',')}`;

    // Reset cache when key changes
    if (cacheKeyRef.current !== currentKey) {
        cacheKeyRef.current = currentKey;
        if (adSetsLoaded) {
            setAdsetsByCampaign({});
            setAdsetsByCampaignName({});
            setAdSetsLoaded(false);
            setAdSetsError(null);
            adSetsLoadedRef.current = false;
        }
        if (adsLoaded) {
            setAdsByAdSet({});
            setAdsLoaded(false);
            setAdsError(null);
            adsLoadedRef.current = false;
        }
    }

    // Stable refs for props used in callbacks
    const fbTokenRef = useRef(fbToken);
    fbTokenRef.current = fbToken;
    const fbAccountIdsRef = useRef(fbAccountIds);
    fbAccountIdsRef.current = fbAccountIds;
    const startDateRef = useRef(startDate);
    startDateRef.current = startDate;
    const endDateRef = useRef(endDate);
    endDateRef.current = endDate;

    const loadAdSets = useCallback(async () => {
        const token = fbTokenRef.current;
        const accountIds = fbAccountIdsRef.current;
        if (!token || accountIds.length === 0 || adSetsLoadedRef.current || isLoadingAdSetsRef.current) return;

        isLoadingAdSetsRef.current = true;
        setIsLoadingAdSets(true);
        setAdSetsError(null);
        try {
            const allItems: any[] = [];
            for (const accountId of accountIds) {
                const items = await fetchMetaAdSetInsights(token, accountId, startDateRef.current, endDateRef.current);
                allItems.push(...items);
            }

            // Aggregate by adset_id
            const aggregated = aggregateRows(allItems, 'adset_id', 'adset_name', ['campaign_id', 'campaign_name']);

            // Index by campaign_id AND campaign_name (for fallback)
            const byCampaign: Record<string, AggregatedRow[]> = {};
            const byCampaignName: Record<string, AggregatedRow[]> = {};
            aggregated.forEach(row => {
                const cid = (row as any).campaign_id || '';
                const cname = ((row as any).campaign_name || '').trim();
                if (cid) {
                    if (!byCampaign[cid]) byCampaign[cid] = [];
                    byCampaign[cid].push(row);
                }
                if (cname) {
                    if (!byCampaignName[cname]) byCampaignName[cname] = [];
                    byCampaignName[cname].push(row);
                }
            });

            setAdsetsByCampaign(byCampaign);
            setAdsetsByCampaignName(byCampaignName);
            setAdSetsLoaded(true);
            adSetsLoadedRef.current = true;
        } catch (err: any) {
            console.error('[useHierarchyData] Error loading ad sets:', err);
            setAdSetsError(err?.message || 'Error cargando conjuntos de anuncios');
        } finally {
            isLoadingAdSetsRef.current = false;
            setIsLoadingAdSets(false);
        }
    }, []); // No deps — reads from refs

    const loadAds = useCallback(async () => {
        const token = fbTokenRef.current;
        const accountIds = fbAccountIdsRef.current;
        if (!token || accountIds.length === 0 || adsLoadedRef.current || isLoadingAdsRef.current) return;

        isLoadingAdsRef.current = true;
        setIsLoadingAds(true);
        setAdsError(null);
        try {
            const allItems: any[] = [];
            for (const accountId of accountIds) {
                const items = await fetchMetaAdLevelInsights(token, accountId, startDateRef.current, endDateRef.current);
                allItems.push(...items);
            }

            // Aggregate by ad_id
            const aggregated = aggregateRows(allItems, 'ad_id', 'ad_name', ['adset_id', 'adset_name', 'campaign_id', 'campaign_name']);

            // Index by adset_id
            const byAdSet: Record<string, AggregatedRow[]> = {};
            aggregated.forEach(row => {
                const asid = (row as any).adset_id || '';
                if (!byAdSet[asid]) byAdSet[asid] = [];
                byAdSet[asid].push(row);
            });

            setAdsByAdSet(byAdSet);
            setAdsLoaded(true);
            adsLoadedRef.current = true;
        } catch (err: any) {
            console.error('[useHierarchyData] Error loading ads:', err);
            setAdsError(err?.message || 'Error cargando anuncios');
        } finally {
            isLoadingAdsRef.current = false;
            setIsLoadingAds(false);
        }
    }, []); // No deps — reads from refs

    return {
        adsetsByCampaign,
        adsetsByCampaignName,
        adsByAdSet,
        loadAdSets,
        loadAds,
        isLoadingAdSets,
        isLoadingAds,
        adSetsLoaded,
        adsLoaded,
        adSetsError,
        adsError,
    };
}
