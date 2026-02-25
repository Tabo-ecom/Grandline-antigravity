import { db } from '../firebase/config';
import { doc, getDoc, setDoc, query, collection, where, getDocs, Timestamp, deleteDoc, writeBatch } from 'firebase/firestore';
import { getAppData, setAppData, COLLECTIONS } from '../firebase/firestore';
import { toCOP, type ExchangeRates, isMatchingCountry, normalizeCountry } from '../utils/currency';
import { ProductGroup, getEffectiveProductId } from './productGroups';
import { authFetch } from '../api/client';
export * from './productGroups';

// Cache to persist data across navigation within the same session (SPA navigation)
// Moved from PublicidadPage to allow invalidation from other pages (like Import)
export const adCenterSessionCache: {
    coreData: {
        rates: any;
        adSettings: any;
        mappings: any;
        productGroups: any;
        aiSuggestions: any;
        allOrderFiles: any;
    } | null;
    apiHistory: Record<string, AdSpend[]>;
} = {
    coreData: null,
    apiHistory: {}
};

/**
 * Clear the Ad Center session cache to force a fresh reload of data
 */
export const clearAdCenterCache = () => {
    adCenterSessionCache.coreData = null;
    adCenterSessionCache.apiHistory = {};
};

export interface AdSpend {
    id?: string;
    campaignName?: string; // Added for granular mapping
    amount: number;
    currency: string;
    source: 'api' | 'manual';
    platform: 'facebook' | 'tiktok';
    updatedAt: number;
    productId: string;
    date: string;
    country: string;
    creator?: string;
    importId?: string; // Track which file/session imported this
    // Granular Metrics
    impressions?: number;
    clicks?: number;
    ctr?: number;
    cpc?: number;
    leads?: number;
    conversions?: number;
    reach?: number;
    revenue_attributed?: number;
    page_visits?: number;
    add_to_cart?: number;
}

export interface AdSpendImportLog {
    id: string;
    fileName: string;
    platform: 'facebook' | 'tiktok';
    uploaded_at: any; // Timestamp
    rowCount: number;
    userId: string;
    logType: 'ad_spend';
}

export interface CustomMetric {
    id: string;
    name: string;
    formula: string; // e.g. "{revenue_attributed} / {amount}"
    format: 'number' | 'currency' | 'percent';
    updatedAt: number;
}

export interface AdAccount {
    id: string;
    name: string;
}

export interface AdSettings {
    fb_token: string;
    fb_account_ids: AdAccount[];
    tt_token: string;
    tt_account_ids: AdAccount[];
    fb_currency?: string;
    tt_currency?: string;
    ai_provider?: 'gemini' | 'openai' | 'none';
    ai_api_key?: string;
    ai_auto_map?: boolean; // Enable automatic mapping
    google_api_key?: string;
    google_client_id?: string;
    custom_metrics?: CustomMetric[];
}

export interface CampaignMapping {
    campaignName: string;
    productId: string;
    productName?: string;
    platform: 'facebook' | 'tiktok';
    country?: string;
    updatedAt: number;
}

// ProductGroup moved to ./productGroups.ts

export interface AISuggestion {
    id: string;
    campaignName: string;
    platform: 'facebook' | 'tiktok';
    suggestedProductId: string;
    suggestedProductName?: string;
    suggestedProductCountry?: string; // Added for product country visibility
    country?: string; // Original country of the campaign data
    confidence: number;
    reasoning: string;
    status: 'pending' | 'accepted' | 'rejected';
    createdAt: number;
}

/**
 * Normalize date string to YYYY-MM-DD
 */
export function normalizeDate(dateStr: string): string {
    if (!dateStr) return '';

    // Handle YYYY-MM-DD (already correct)
    if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
        return dateStr.split(' ')[0];
    }

    // Handle DD/MM/YYYY or D/M/YYYY
    if (dateStr.includes('/')) {
        const parts = dateStr.split(' ')[0].split('/');
        if (parts.length === 3) {
            let [d, m, y] = parts;
            // Pad day and month
            if (d.length === 1) d = '0' + d;
            if (m.length === 1) m = '0' + m;
            // Handle YY vs YYYY
            if (y.length === 2) y = '20' + y;
            return `${y}-${m}-${d}`;
        }
    }

    // Fallback try native parse
    try {
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) {
            return d.toISOString().split('T')[0];
        }
    } catch (e) { }

    return dateStr;
}

/**
 * Deduplicate ad spends using aggressive API preference and creator tracking.
 * This ensures data parity across all modules.
 */
export function deduplicateAdSpends(spends: AdSpend[]): AdSpend[] {
    const identityGroups: Record<string, AdSpend[]> = {};

    // 1. Group by Identity (Date + Platform + Campaign) — Country EXCLUDED to handle
    //    old entries with wrong country coexisting with corrected entries
    spends.forEach(s => {
        const normalizedDateKey = (s.date || '').split(' ')[0]; // Basic YYYY-MM-DD
        const sanitizedCampaign = (s.campaignName || 'global').replace(/\W/g, '').toLowerCase();
        const idKey = `${normalizedDateKey}_${s.platform}_${sanitizedCampaign}`;

        if (!identityGroups[idKey]) identityGroups[idKey] = [];
        identityGroups[idKey].push(s);
    });

    const dedupedResults: AdSpend[] = [];

    Object.values(identityGroups).forEach(group => {
        // 2. Priority: API > Manual
        const hasAPI = group.some(e => e.source === 'api');
        const sourceOfTruth = hasAPI ? group.filter(e => e.source === 'api') : group;

        // 3. Within source of truth, deduplicate by creator (handles multi-account collisions)
        const creatorMap: Record<string, AdSpend> = {};
        sourceOfTruth.forEach(e => {
            const cKey = (e.creator || 'admin').replace(/\W/g, '');
            if (!creatorMap[cKey] || (e.updatedAt && creatorMap[cKey].updatedAt && e.updatedAt > creatorMap[cKey].updatedAt)) {
                creatorMap[cKey] = e;
            }
        });

        dedupedResults.push(...Object.values(creatorMap));
    });

    return dedupedResults;
}

/**
 * Fix currency inconsistencies in ad spend data.
 * Uses a 3-layer strategy to ensure correct currencies:
 *
 * Layer 1: adSettings (fb_currency/tt_currency) as authoritative source
 * Layer 2: Per-campaign detection (if ANY entry is COP, all are COP)
 * Layer 3: Anomaly detection (daily spend > 5000 "USD" is almost certainly COP)
 *
 * This guarantees correct values even if adSettings is missing, not configured,
 * or entries lack a source field.
 */
export function fixAdSpendCurrencies(spends: AdSpend[], adSettings?: AdSettings | null): AdSpend[] {
    // Layer 1: Use adSettings as authoritative source for API entries
    const fbCurrency = adSettings?.fb_currency;
    const ttCurrency = adSettings?.tt_currency;

    // Layer 2: Per-campaign COP detection
    const campaignHasCOP: Record<string, boolean> = {};
    spends.forEach(s => {
        const key = (s.campaignName || '').trim().toLowerCase();
        if (s.currency === 'COP') {
            campaignHasCOP[key] = true;
        }
    });

    return spends.map(s => {
        if (s.currency === 'COP') return s; // Already COP, nothing to fix

        const campaignKey = (s.campaignName || '').trim().toLowerCase();

        // Layer 1: adSettings says this platform uses COP
        if (s.platform === 'facebook' && fbCurrency === 'COP') {
            return { ...s, currency: 'COP' };
        }
        if (s.platform === 'tiktok' && ttCurrency === 'COP') {
            return { ...s, currency: 'COP' };
        }

        // Layer 2: Another entry for same campaign is COP → this one should be too
        if (campaignHasCOP[campaignKey]) {
            return { ...s, currency: 'COP' };
        }

        // Layer 3: Anomaly detection — no single campaign spends >$5,000 USD/day
        // but 5,000 COP ($1.20 USD) is trivial. If amount > 5000 and currency
        // is USD, the amount is almost certainly already in COP.
        if (s.currency === 'USD' && s.amount > 5000) {
            return { ...s, currency: 'COP' };
        }

        return s;
    });
}

/**
 * Get full ad spend history across all sources and countries
 */
export async function getAdSpendHistory(userId: string = ''): Promise<AdSpend[]> {
    let snapshot;
    // Try userId-filtered query first, fall back to all docs (legacy)
    if (userId) {
        const q = query(
            collection(db, 'marketing_history'),
            where('userId', '==', userId)
        );
        snapshot = await getDocs(q);
    }
    if (!snapshot || snapshot.docs.length === 0) {
        snapshot = await getDocs(collection(db, 'marketing_history'));
    }
    const adSettings = await getAdSettings(userId);
    const raw = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
    } as AdSpend)).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    return fixAdSpendCurrencies(raw, adSettings);
}

export type AdSpendHistory = AdSpend;

/**
 * List all spend entries across all countries
 */
export async function listAllAdSpends(userId: string = ''): Promise<AdSpend[]> {
    return getAdSpendHistory(userId);
}

/**
 * Get aggregated metrics for ad spend, optionally filtered by country and/or product
 */
export async function getAdSpendMetrics(
    spends: AdSpend[],
    mappings: CampaignMapping[],
    rates: ExchangeRates | null,
    filters: { country?: string; product?: string } = {},
    productGroups: ProductGroup[] = []
): Promise<{
    totalSpend: number;
    spendByProduct: Record<string, number>;
    spendByDay: Record<string, number>;
}> {
    // Centralized deduplication
    let filtered = deduplicateAdSpends(spends);

    // 1. Filter by Country if key provided
    if (filters.country && filters.country !== 'all') {
        const targetCountry = filters.country;
        filtered = filtered.filter(s => isMatchingCountry(s.country, targetCountry));
    }

    // 2. Build mapping index: campaignName|platform -> productId (CASE-INSENSITIVE)
    const campaignToProductMap = new Map<string, string>();
    mappings.forEach(m => {
        campaignToProductMap.set(`${m.campaignName}|${m.platform}`.toLowerCase(), m.productId);
    });

    const spendByProduct: Record<string, number> = {};
    const spendByDay: Record<string, number> = {};
    let totalSpend = 0;

    filtered.forEach(spend => {
        // Strict Reactive Mapping with Fallback:
        // 1. Manual Mapping takes priority
        // 2. Fallback to stored productId (supports pre-resolved data from Publicidad)
        let prodId = spend.productId;

        if (spend.source === 'api' || !prodId || prodId === 'global' || prodId === '') {
            const mapped = campaignToProductMap.get(`${spend.campaignName}|${spend.platform}`.toLowerCase());
            if (mapped) {
                prodId = mapped;
            } else if (prodId && prodId !== 'global' && prodId !== '') {
                // Keep existing prodId (pre-resolved from caller or AI/Regex)
            } else {
                prodId = '';
            }
        }

        // Apply Product Group resolution
        const effectiveId = getEffectiveProductId(prodId || 'unknown', productGroups);

        // 3. Filter by Product if requested
        if (filters.product && filters.product !== 'all' && effectiveId !== filters.product) {
            return;
        }

        // Include this spend in aggregations
        const normalizedAmount = rates ? toCOP(spend.amount, spend.currency, rates) : spend.amount;
        totalSpend += normalizedAmount;

        const aggregationKey = effectiveId || 'unknown';
        spendByProduct[aggregationKey] = (spendByProduct[aggregationKey] || 0) + normalizedAmount;

        // Aggregate by day
        spendByDay[spend.date] = (spendByDay[spend.date] || 0) + normalizedAmount;
    });

    return { totalSpend, spendByProduct, spendByDay };
}

/**
 * Get ad spend for a specific country, date and optionally product
 */
export async function getAdSpend(
    country: string,
    date: string,
    productId: string = 'global',
    platform: 'facebook' | 'tiktok' = 'facebook',
    userId: string
): Promise<AdSpend> {
    if (!userId) throw new Error("userId required for getAdSpend");
    const key = `ad_spend_${country.toLowerCase()}_${date}_${productId}_${platform}`;
    const data = await getAppData<AdSpend>(key, userId);

    if (data) {
        return data;
    }

    return {
        amount: 0,
        currency: 'USD',
        source: 'manual',
        platform,
        updatedAt: Date.now(),
        productId,
        date,
        country
    };
}

/**
 * Save ad spend (manual or API)
 */
export async function saveAdSpend(
    country: string,
    date: string,
    amount: number,
    currency: string,
    platform: 'facebook' | 'tiktok',
    productId: string = 'global',
    campaignName: string | undefined,
    userId: string,
    source: 'manual' | 'api' = 'manual',
    creator: string = 'admin',
    metrics: Partial<AdSpend> = {},
    importId?: string
) {
    if (!userId) throw new Error("userId required for saveAdSpend");
    const normalizedDate = normalizeDate(date);
    const spendData: AdSpend & { userId: string } = {
        amount,
        currency,
        source,
        platform,
        updatedAt: Date.now(),
        productId,
        date: normalizedDate,
        country,
        campaignName,
        creator,
        importId,
        userId,
        ...metrics
    };

    const cleanSpendData = Object.fromEntries(
        Object.entries(spendData).filter(([_, v]) => v !== undefined)
    ) as AdSpend & { userId: string };

    const normCountry = normalizeCountry(country);
    const key = `ad_spend_${normCountry}_${normalizedDate}_${productId}_${platform}${campaignName ? `_${campaignName.replace(/\W/g, '')}` : ''}`;
    await setAppData(key, cleanSpendData, userId);

    const sanitizedCampaign = (campaignName || 'global').replace(/\W/g, '');
    const deterministicId = `${userId}_${normalizedDate}_${platform}_${sanitizedCampaign}`;
    const historyRef = doc(db, 'marketing_history', deterministicId);

    await setDoc(historyRef, {
        ...cleanSpendData,
        id: historyRef.id,
        timestamp: Timestamp.now()
    }, { merge: true });

    const ALL_COUNTRIES = ['colombia', 'ecuador', 'panama', 'guatemala', 'desconocido'];
    const cleanupPromises = ALL_COUNTRIES.map(async (c) => {
        const oldId = `${userId}_${normalizedDate}_${c}_${platform}_${sanitizedCampaign}`;
        if (oldId !== deterministicId) {
            try { await deleteDoc(doc(db, 'marketing_history', oldId)); } catch (_) { }
        }
    });
    await Promise.all(cleanupPromises);
}

/**
 * Bulk save ad spend rows using Firestore writeBatch for performance.
 * Writes only to marketing_history (skips app_data and cleanup for speed).
 * ~3000x fewer Firestore operations than individual saveAdSpend calls.
 */
export interface BulkAdSpendRow {
    country: string;
    date: string;
    amount: number;
    currency: string;
    platform: 'facebook' | 'tiktok';
    campaignName: string;
    userId: string;
    metrics?: Record<string, any>;
}

export async function saveBulkAdSpend(rows: BulkAdSpendRow[]): Promise<number> {
    if (rows.length === 0) return 0;
    const BATCH_SIZE = 450;
    let saved = 0;

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const chunk = rows.slice(i, i + BATCH_SIZE);
        const batch = writeBatch(db);

        for (const row of chunk) {
            const normalizedDate = normalizeDate(row.date);
            const sanitizedCampaign = (row.campaignName || 'global').replace(/\W/g, '');
            const deterministicId = `${row.userId}_${normalizedDate}_${row.platform}_${sanitizedCampaign}`;
            const historyRef = doc(db, 'marketing_history', deterministicId);

            batch.set(historyRef, {
                amount: row.amount,
                currency: row.currency,
                source: 'api',
                platform: row.platform,
                updatedAt: Date.now(),
                productId: 'global',
                date: normalizedDate,
                country: row.country,
                campaignName: row.campaignName,
                creator: 'admin',
                userId: row.userId,
                id: deterministicId,
                timestamp: Timestamp.now(),
                ...(row.metrics || {}),
            }, { merge: true });
        }

        await batch.commit();
        saved += chunk.length;
    }
    return saved;
}

/**
 * Delete all marketing_history entries for a user (to allow clean re-sync).
 * Campaign mappings in app_data are NOT affected.
 */
export async function clearAdSpendHistory(userId: string): Promise<number> {
    const q = query(collection(db, 'marketing_history'), where('userId', '==', userId));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return 0;

    const BATCH_SIZE = 450;
    let deleted = 0;
    const docs = snapshot.docs;

    for (let i = 0; i < docs.length; i += BATCH_SIZE) {
        const chunk = docs.slice(i, i + BATCH_SIZE);
        const batch = writeBatch(db);
        for (const d of chunk) {
            batch.delete(d.ref);
        }
        await batch.commit();
        deleted += chunk.length;
    }
    return deleted;
}

/**
 * Save manual ad spend entry
 */
export async function saveManualAdSpend(data: {
    country: string;
    date: string;
    amount: number;
    currency: string;
    platform: 'facebook' | 'tiktok';
    productId: string;
    userId: string;
}) {
    await saveAdSpend(
        data.country,
        data.date,
        data.amount,
        data.currency,
        data.platform,
        data.productId,
        'manual_entry',
        data.userId,
        'manual',
        'admin',
        {}
    );
}

/**
 * Delete a specific history entry
 */
export async function deleteAdSpend(id: string) {
    await deleteDoc(doc(db, 'marketing_history', id));
}

/**
 * Get import history for ad spend (TikTok, etc.)
 */
export async function getAdSpendImportHistory(userId: string): Promise<AdSpendImportLog[]> {
    if (!userId) return [];
    const q = query(
        collection(db, 'import_logs'),
        where('logType', '==', 'ad_spend'),
        where('userId', '==', userId)
    );
    try {
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as AdSpendImportLog));
    } catch (error) {
        console.warn('Error fetching ad spend history:', error);
        const fallbackQ = query(collection(db, 'import_logs'), where('logType', '==', 'ad_spend'), where('userId', '==', userId));
        const fallbackSnap = await getDocs(fallbackQ);
        return fallbackSnap.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as AdSpendImportLog))
            .sort((a, b) => {
                const da = a.uploaded_at?.toDate?.()?.getTime() || 0;
                const db = b.uploaded_at?.toDate?.()?.getTime() || 0;
                return db - da;
            });
    }
}

/**
 * Delete an entire import and all associated spend records
 */
export async function deleteAdSpendImport(importId: string) {
    // 1. Delete all records in marketing_history that matching this importId
    const q = query(collection(db, 'marketing_history'), where('importId', '==', importId));
    const snapshot = await getDocs(q);

    const deletePromises = snapshot.docs.map(d => deleteDoc(doc(db, 'marketing_history', d.id)));
    await Promise.all(deletePromises);

    // 2. Delete the log itself
    await deleteDoc(doc(db, 'import_logs', importId));

    clearAdCenterCache();
}

/**
 * List all spend entries for a country to show history
 */
export async function listAdSpends(country: string, userId: string = ''): Promise<AdSpend[]> {
    let snapshot;
    // Try userId-filtered first, fall back to legacy (no userId field)
    if (userId) {
        try {
            const q = query(
                collection(db, 'marketing_history'),
                where('country', 'in', [country, 'Desconocido', 'Todos']),
                where('userId', '==', userId)
            );
            snapshot = await getDocs(q);
        } catch { /* index may not exist yet */ }
    }
    if (!snapshot || snapshot.docs.length === 0) {
        const fallbackQ = query(
            collection(db, 'marketing_history'),
            where('country', 'in', [country, 'Desconocido', 'Todos'])
        );
        snapshot = await getDocs(fallbackQ);
    }
    const adSettings = await getAdSettings(userId);
    const raw = snapshot.docs
        .map(d => d.data() as AdSpend)
        .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    return fixAdSpendCurrencies(raw, adSettings);
}

/**
 * Extract base name from a product/campaign string (Legacy logic from app.py)
 */
export function extraerBase(name: string): string {
    if (!name) return '';
    // Process string like app.py: upper, replace - with space, remove digits and common words
    let processed = name.toUpperCase().trim().replace(/\s*-\s*/g, ' ');
    const commonWords = ["X", "DE", "EL", "LA", "EN", "CON", "PARA", "POR"];
    const words = processed.split(/\s+/)
        .filter(w => !/^\d+$/.test(w) && !commonWords.includes(w));

    return words.slice(0, 2).join(' ') || name;
}

/**
 * Campaign Mapping Services
 */
export async function getCampaignMappings(userId: string = ''): Promise<CampaignMapping[]> {
    const data = await getAppData<any>('campaign_mappings', userId);
    if (!data) return [];

    // Legacy support: if it's a dictionary (ProductName -> [CampaignNames])
    if (data && typeof data === 'object' && !Array.isArray(data)) {
        const migrated: CampaignMapping[] = [];
        Object.entries(data).forEach(([productId, campaigns]) => {
            if (Array.isArray(campaigns)) {
                campaigns.forEach(campaignName => {
                    migrated.push({
                        campaignName,
                        productId,
                        platform: 'facebook', // Default legacy to facebook
                        updatedAt: Date.now()
                    });
                });
            }
        });
        return migrated;
    }

    return Array.isArray(data) ? data : [];
}

export async function saveCampaignMapping(mapping: CampaignMapping, userId: string) {
    if (!userId) return;
    const current = await getCampaignMappings(userId);
    const filtered = current.filter(m => !(m.campaignName === mapping.campaignName && m.platform === mapping.platform));
    await setAppData('campaign_mappings', [...filtered, mapping], userId);
    clearAdCenterCache();
}

export async function addCampaignMapping(mapping: CampaignMapping, userId: string) {
    await saveCampaignMapping(mapping, userId);
}

export async function addMultipleCampaignMappings(newMappings: CampaignMapping[], userId: string) {
    if (!userId) return;
    const current = await getCampaignMappings(userId);
    const filtered = current.filter(m =>
        !newMappings.some(newM => newM.campaignName === m.campaignName && newM.platform === m.platform)
    );
    await setAppData('campaign_mappings', [...filtered, ...newMappings], userId);
    clearAdCenterCache();
}

export async function deleteCampaignMapping(campaignName: string, platform: 'facebook' | 'tiktok', userId: string) {
    if (!userId) return;
    const current = await getCampaignMappings(userId);
    const filtered = current.filter(m => !(m.campaignName === campaignName && m.platform === platform));
    await setAppData('campaign_mappings', filtered, userId);
    clearAdCenterCache();
}

export async function updateCampaignMapping(campaignName: string, platform: 'facebook' | 'tiktok', newProductId: string, userId: string, country?: string) {
    if (!userId) return;
    const current = await getCampaignMappings(userId);
    const filtered = current.filter(m => !(m.campaignName === campaignName && m.platform === platform));
    const newMapping: CampaignMapping = {
        campaignName,
        platform,
        productId: newProductId,
        country,
        updatedAt: Date.now()
    };
    await setAppData('campaign_mappings', [...filtered, newMapping], userId);
    clearAdCenterCache();
}

/**
 * Save ad settings via server API (tokens encrypted server-side).
 * Falls back to direct Firestore write if API fails.
 */
export async function saveAdSettings(settings: AdSettings, _userId?: string): Promise<void> {
    try {
        const res = await authFetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ settings }),
        });
        if (!res.ok) throw new Error('API save failed');
    } catch {
        // Fallback: direct Firestore write (no encryption)
        if (_userId) await setAppData('ad_settings', settings, _userId);
    }
}

export async function clearAllMappings(userId: string) {
    if (!userId) return;
    await setAppData('campaign_mappings', [], userId);
    clearAdCenterCache();
}

// Product Group Services moved to ./productGroups.ts

/**
 * AI Suggestion Services
 */
export async function getAISuggestions(userId: string = ''): Promise<AISuggestion[]> {
    if (!userId) return [];
    const data = await getAppData<AISuggestion[]>('ai_suggestions', userId);
    return Array.isArray(data) ? data : [];
}

export async function saveAISuggestion(suggestion: Omit<AISuggestion, 'id' | 'createdAt'>, userId: string) {
    if (!userId) return;
    const current = await getAISuggestions(userId);
    const newSuggestion: AISuggestion = {
        ...suggestion,
        id: `ai_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        createdAt: Date.now()
    };
    await setAppData('ai_suggestions', [...current, newSuggestion], userId);
    return newSuggestion;
}

export async function updateAISuggestionStatus(id: string, status: 'accepted' | 'rejected', userId: string) {
    if (!userId) return;
    const current = await getAISuggestions(userId);
    const updated = current.map(s => s.id === id ? { ...s, status } : s);
    await setAppData('ai_suggestions', updated, userId);
}

export async function deleteAISuggestion(id: string, userId: string) {
    if (!userId) return;
    const current = await getAISuggestions(userId);
    const filtered = current.filter(s => s.id !== id);
    await setAppData('ai_suggestions', filtered, userId);
}

export async function clearAllAISuggestions(userId: string) {
    if (!userId) return;
    await setAppData('ai_suggestions', [], userId);
}

import { mapCampaignsToProducts, type AIMapperConfig, type CampaignInfo, type ProductInfo } from './ai-mapper';

/**
 * AI Suggestion Generation
 */
export async function generateMappingSuggestions(
    campaigns: CampaignInfo[],
    availableProducts: ProductInfo[],
    existingMappings: { campaignName: string, productId: string }[] | undefined,
    userId: string
): Promise<AISuggestion[]> {
    const settings = await getAdSettings(userId);
    if (!settings || !settings.ai_api_key || settings.ai_provider === 'none') {
        console.warn('AI Settings not configured for suggestions');
        return [];
    }

    const config: AIMapperConfig = {
        provider: settings.ai_provider as any,
        apiKey: settings.ai_api_key
    };

    const suggestions = await mapCampaignsToProducts(config, campaigns, availableProducts, existingMappings);

    return suggestions.map(s => {
        const originalCampaign = campaigns.find(c => c.name === s.campaignName);
        const suggestedProduct = availableProducts.find(p => p.id === s.suggestedProductId);
        return {
            id: `ai_${Date.now()}_${Math.random().toString(36).substring(7)}`,
            campaignName: s.campaignName,
            platform: originalCampaign?.platform || 'facebook',
            country: originalCampaign?.country,
            suggestedProductId: s.suggestedProductId,
            suggestedProductName: suggestedProduct?.name || s.suggestedProductId,
            suggestedProductCountry: s.suggestedProductCountry || suggestedProduct?.country,
            confidence: s.confidence,
            reasoning: s.reasoning,
            status: 'pending',
            createdAt: Date.now()
        };
    });
}

/** Normalize account arrays from legacy string format to object format */
function mapAccounts(list: any[]): AdAccount[] {
    if (!Array.isArray(list)) return [];
    const results: Record<string, { acc: AdAccount, isObject: boolean }> = {};

    list.forEach(item => {
        const isObject = typeof item === 'object' && item !== null;
        const acc: AdAccount = isObject
            ? item
            : { id: String(item), name: String(item).replace('act_', '') };

        const existing = results[acc.id];
        const hasLetters = /[a-zA-Z]/.test(acc.name);
        const existingHasLetters = existing ? /[a-zA-Z]/.test(existing.acc.name) : false;

        if (!existing || (isObject && !existing.isObject) || (hasLetters && !existingHasLetters)) {
            results[acc.id] = { acc, isObject };
        }
    });

    return Object.values(results).map(r => r.acc);
}

/** Normalize raw settings data into AdSettings */
function normalizeSettings(settings: any): AdSettings {
    return {
        fb_token: settings.fb_token || '',
        fb_account_ids: mapAccounts(settings.fb_account_ids),
        tt_token: settings.tt_token || '',
        tt_account_ids: mapAccounts(settings.tt_account_ids),
        fb_currency: settings.fb_currency || 'USD',
        tt_currency: settings.tt_currency || 'USD',
        ai_provider: settings.ai_provider || 'none',
        ai_api_key: settings.ai_api_key || '',
        ai_auto_map: settings.ai_auto_map !== undefined ? settings.ai_auto_map : false,
        google_api_key: settings.google_api_key || '',
        google_client_id: settings.google_client_id || '',
        custom_metrics: settings.custom_metrics,
    };
}

/**
 * Get ad settings via server API (tokens decrypted server-side).
 * Falls back to direct Firestore read if API fails.
 */
export async function getAdSettings(userId: string = ''): Promise<AdSettings | null> {
    try {
        const res = await authFetch('/api/settings');
        if (res.ok) {
            const data = await res.json();
            if (data.settings) return normalizeSettings(data.settings);
            return null;
        }
    } catch {
        // Fallback below
    }

    // Fallback: direct Firestore read (for cases where API is unavailable)
    const settings = await getAppData<any>('ad_settings', userId);
    if (settings) return normalizeSettings(settings);
    return null;
}
