/**
 * Meta (Facebook) Marketing API Service
 *
 * Features:
 * - Retry with exponential backoff (429, 500+, network errors)
 * - Token expiry detection (error code 190)
 * - Automatic pagination for insights (>1000 results)
 * - In-memory cache for accounts, pixels, pages (10 min TTL)
 */

import { authFetch } from '@/lib/api/client';

// ─── Constants ───────────────────────────────────────────────────────
const META_API_VERSION = 'v21.0';
const META_INSIGHTS_VERSION = 'v21.0'; // Use same version for consistency
const MAX_RETRIES = 3;
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

// ─── Token Expiry Error ──────────────────────────────────────────────
export class MetaTokenExpiredError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'MetaTokenExpiredError';
    }
}

// ─── Retry with Exponential Backoff ──────────────────────────────────
async function metaFetchWithRetry(
    url: string,
    options?: RequestInit,
    context: string = 'Meta API',
    retries: number = MAX_RETRIES
): Promise<any> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const response = await fetch(url, options);
            const data = await response.json();

            // Handle Meta API errors
            if (data.error) {
                const errorCode = data.error.code;
                const errorSubcode = data.error.error_subcode;

                // Token expired/invalid — don't retry
                if (errorCode === 190 || errorSubcode === 463 || errorSubcode === 467) {
                    throw new MetaTokenExpiredError(
                        `Token expirado o inválido. Reconecta tu cuenta de Meta en Configuración. (${data.error.message})`
                    );
                }

                // Rate limited — retry with backoff
                if (errorCode === 4 || errorCode === 17 || errorCode === 32 || errorCode === 613) {
                    if (attempt < retries) {
                        const delay = Math.min(1000 * Math.pow(2, attempt + 1), 30000);
                        console.warn(`[Meta] Rate limited (code ${errorCode}), retrying in ${delay}ms... (attempt ${attempt + 1}/${retries})`);
                        await new Promise(r => setTimeout(r, delay));
                        continue;
                    }
                }

                // Other API errors — don't retry
                throw new Error(data.error.error_user_msg || data.error.message);
            }

            return data;
        } catch (error: any) {
            // Don't retry token errors
            if (error instanceof MetaTokenExpiredError) throw error;

            lastError = error;

            // Network errors or 500+ — retry with backoff
            if (attempt < retries && !(error.message?.includes('failed:'))) {
                const delay = Math.min(1000 * Math.pow(2, attempt), 15000);
                console.warn(`[Meta] ${context} failed (attempt ${attempt + 1}/${retries}), retrying in ${delay}ms...`, error.message);
                await new Promise(r => setTimeout(r, delay));
                continue;
            }
        }
    }

    throw lastError || new Error(`${context}: Failed after ${retries} retries`);
}

// ─── In-Memory Cache ─────────────────────────────────────────────────
interface CacheEntry<T> {
    data: T;
    timestamp: number;
    key: string;
}

const metaCache = new Map<string, CacheEntry<any>>();

function getCached<T>(key: string): T | null {
    const entry = metaCache.get(key);
    if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
        return entry.data;
    }
    metaCache.delete(key);
    return null;
}

function setCache<T>(key: string, data: T): void {
    metaCache.set(key, { data, timestamp: Date.now(), key });
}

/** Clear all Meta caches (call after account changes) */
export function clearMetaCache(): void {
    metaCache.clear();
}

// ─── Helper: Extract Action Totals ───────────────────────────────────
function extractActions(actions: any[] = [], type: string): number {
    const match = actions.find((a: any) => a.action_type === type);
    return match ? parseFloat(match.value) : 0;
}

// ─── Paginated Fetch for Insights ────────────────────────────────────
async function fetchAllInsightsPages(initialUrl: string, context: string): Promise<any[]> {
    const allData: any[] = [];
    let url: string | null = initialUrl;
    let pageCount = 0;
    const MAX_PAGES = 20; // Safety limit

    while (url && pageCount < MAX_PAGES) {
        const data = await metaFetchWithRetry(url, undefined, context);
        if (data.data) {
            allData.push(...data.data);
        }

        // Follow pagination cursor
        url = data.paging?.next || null;
        pageCount++;
    }

    return allData;
}

// ==========================================
// PUBLIC API — READ OPERATIONS
// ==========================================

interface MetaAdAccount {
    id: string;
    account_id: string;
    name: string;
}

export async function fetchMetaAdAccounts(token: string): Promise<MetaAdAccount[]> {
    if (!token) return [];

    const cacheKey = `accounts_${token.slice(-8)}`;
    const cached = getCached<MetaAdAccount[]>(cacheKey);
    if (cached) return cached;

    const data = await metaFetchWithRetry(
        `https://graph.facebook.com/${META_API_VERSION}/me/adaccounts?fields=name,account_id&access_token=${token}&limit=100`,
        undefined,
        'Fetch ad accounts'
    );

    const accounts = data.data || [];
    setCache(cacheKey, accounts);
    return accounts;
}

export async function fetchMetaAdSpend(token: string, accountId: string, startDate: string, endDate: string): Promise<any[]> {
    if (!token || !accountId) return [];

    const timeRange = JSON.stringify({ since: startDate, until: endDate });
    const params = new URLSearchParams({
        fields: 'campaign_id,campaign_name,spend,impressions,clicks,inline_link_click_ctr,cpc,reach,actions,action_values,date_start,date_stop',
        time_range: timeRange,
        time_increment: '1',
        level: 'campaign',
        limit: '500',
        access_token: token
    });

    const url = `https://graph.facebook.com/${META_INSIGHTS_VERSION}/${accountId}/insights?${params.toString()}`;

    // Use pagination to get ALL results (not just first 500)
    const allItems = await fetchAllInsightsPages(url, 'Fetch ad spend');

    return allItems.map((item: any) => ({
        ...item,
        purchases: extractActions(item.actions, 'purchase') || extractActions(item.actions, 'offsite_conversion.fb_pixel_purchase'),
        revenue: extractActions(item.action_values, 'purchase') || extractActions(item.action_values, 'offsite_conversion.fb_pixel_purchase'),
        leads: extractActions(item.actions, 'lead') || extractActions(item.actions, 'offsite_conversion.fb_pixel_lead'),
        page_visits: extractActions(item.actions, 'landing_page_view') || extractActions(item.actions, 'link_click'),
        add_to_cart: extractActions(item.actions, 'add_to_cart') || extractActions(item.actions, 'offsite_conversion.fb_pixel_add_to_cart')
    }));
}

export async function fetchMetaAdCreatives(token: string, accountId: string, startDate: string, endDate: string): Promise<any[]> {
    if (!token || !accountId) return [];
    try {
        const timeRange = JSON.stringify({ since: startDate, until: endDate });
        const params = new URLSearchParams({
            fields: 'ad_id,ad_name,campaign_name,campaign_id,spend,impressions,clicks,inline_link_click_ctr,actions,action_values',
            time_range: timeRange,
            level: 'ad',
            limit: '100',
            access_token: token
        });

        const url = `https://graph.facebook.com/${META_INSIGHTS_VERSION}/${accountId}/insights?${params.toString()}`;
        const allItems = await fetchAllInsightsPages(url, 'Fetch ad creatives');

        return allItems.map((item: any) => ({
            id: item.ad_id,
            name: item.ad_name,
            campaign_name: item.campaign_name || '',
            campaign_id: item.campaign_id || '',
            spend: parseFloat(item.spend || 0),
            impressions: parseInt(item.impressions || 0),
            clicks: parseInt(item.clicks || 0),
            ctr: parseFloat(item.inline_link_click_ctr || 0),
            conversions: extractActions(item.actions, 'purchase') || extractActions(item.actions, 'offsite_conversion.fb_pixel_purchase'),
            revenue: extractActions(item.action_values, 'purchase') || extractActions(item.action_values, 'offsite_conversion.fb_pixel_purchase'),
            page_visits: extractActions(item.actions, 'landing_page_view') || extractActions(item.actions, 'link_click'),
            add_to_cart: extractActions(item.actions, 'add_to_cart') || extractActions(item.actions, 'offsite_conversion.fb_pixel_add_to_cart'),
            platform: 'facebook'
        }));
    } catch (error) {
        console.error('Error fetching Meta creatives:', error);
        if (error instanceof MetaTokenExpiredError) throw error;
        return [];
    }
}

/**
 * Fetch thumbnails for a list of Meta Ads (batched, max 50 per request)
 */
export async function fetchMetaAdThumbnails(token: string, adIds: string[]): Promise<Record<string, string>> {
    if (!token || adIds.length === 0) return {};
    try {
        const thumbnails: Record<string, string> = {};

        // Process in batches of 50
        for (let i = 0; i < adIds.length; i += 50) {
            const batchIds = adIds.slice(i, i + 50);
            const batch = batchIds.map(id => ({
                method: 'GET',
                relative_url: `${id}?fields=creative{thumbnail_url,image_url,effective_image_url}`
            }));

            const data = await metaFetchWithRetry(
                `https://graph.facebook.com/${META_API_VERSION}/`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        access_token: token,
                        batch: JSON.stringify(batch)
                    })
                },
                `Fetch thumbnails batch ${i / 50 + 1}`
            );

            // The batch response is an array, not {data: ...}
            const results = Array.isArray(data) ? data : [];
            results.forEach((res: any, idx: number) => {
                if (res.code === 200) {
                    try {
                        const body = JSON.parse(res.body);
                        if (body.creative) {
                            const creative = body.creative;
                            const bestUrl =
                                creative.effective_image_url ||
                                creative.image_url ||
                                creative.thumbnail_url;
                            if (bestUrl) {
                                thumbnails[batchIds[idx]] = bestUrl;
                            }
                        }
                    } catch { /* ignore parse errors for individual batch items */ }
                }
            });

            // Small delay between batches to respect rate limits
            if (i + 50 < adIds.length) {
                await new Promise(r => setTimeout(r, 200));
            }
        }

        return thumbnails;
    } catch (error) {
        console.error('Error fetching Meta thumbnails:', error);
        if (error instanceof MetaTokenExpiredError) throw error;
        return {};
    }
}

export async function fetchMetaPixels(token: string, adAccountId: string): Promise<any[]> {
    if (!token || !adAccountId) return [];

    const cacheKey = `pixels_${adAccountId}`;
    const cached = getCached<any[]>(cacheKey);
    if (cached) return cached;

    try {
        const data = await metaFetchWithRetry(
            `https://graph.facebook.com/${META_API_VERSION}/${adAccountId}/adspixels?fields=name,id&access_token=${token}&limit=100`,
            undefined,
            'Fetch pixels'
        );
        const pixels = data.data || [];
        setCache(cacheKey, pixels);
        return pixels;
    } catch (error) {
        console.error('Error fetching Meta pixels:', error);
        if (error instanceof MetaTokenExpiredError) throw error;
        return [];
    }
}

// ==========================================
// HELPERS
// ==========================================

/**
 * Safe JSON parse from a fetch Response — avoids "Unexpected end of JSON input"
 */
async function safeResponseJson(response: Response, context: string): Promise<any> {
    const text = await response.text();
    if (!text) {
        throw new Error(`${context}: Empty response from server (status ${response.status})`);
    }
    try {
        return JSON.parse(text);
    } catch {
        throw new Error(`${context}: Invalid response (status ${response.status}): ${text.slice(0, 300)}`);
    }
}

// ==========================================
// CAMPAIGN CREATION (El Lanzador)
// ==========================================

export interface MetaCampaignConfig {
    accountId: string;
    name: string;
    objective: string; // 'OUTCOME_SALES' | 'OUTCOME_LEADS' | 'OUTCOME_TRAFFIC'
    status: 'PAUSED' | 'ACTIVE';
    specialAdCategories: string[];
    buyingType: 'AUCTION';
    budgetOptStrategy: 'CBO' | 'ABO' | 'ASC';
    dailyBudget?: number; // in cents (for CBO/ASC)
}

export interface MetaAdSetConfig {
    accountId: string;
    campaignId: string;
    name: string;
    status: 'PAUSED' | 'ACTIVE';
    dailyBudget?: number; // in cents (for ABO)
    billingEvent: 'IMPRESSIONS';
    optimizationGoal: 'OFFSITE_CONVERSIONS' | 'LANDING_PAGE_VIEWS' | 'LINK_CLICKS';
    bidStrategy?: 'LOWEST_COST_WITHOUT_CAP' | 'COST_CAP' | 'BID_CAP';
    bidAmount?: number; // in cents, required for COST_CAP/BID_CAP
    targeting?: {
        geoLocations: { countries: string[] };
        ageMin?: number;
        ageMax?: number;
        genders?: number[]; // 1=male, 2=female
        excludedGeoLocations?: { cities?: { key: string }[]; zips?: { key: string }[] };
    };
    pixelId?: string;
    promotedObject?: { pixelId: string; customEventType: string };
    startTime?: string; // ISO string
}

export interface MetaAdConfig {
    accountId: string;
    adSetId: string;
    name: string;
    status: 'PAUSED' | 'ACTIVE';
    creative: {
        pageId: string;
        imageHash?: string;
        videoId?: string;
        videoThumbnailUrl?: string;
        message: string;
        link: string;
        callToAction?: string;
    };
}

export interface MetaLaunchResult {
    campaignId: string;
    adSetId: string;
    adId: string;
}

/**
 * Wait for a video to be ready on Meta and return its thumbnail.
 * Meta needs time to process the video after upload.
 * Polls status every 3s, max ~30s. Returns thumbnail URL.
 */
async function waitForVideoReady(token: string, videoId: string): Promise<string> {
    let thumbnailUrl = '';
    for (let attempt = 0; attempt < 10; attempt++) {
        await new Promise(r => setTimeout(r, attempt === 0 ? 2000 : 3000));
        try {
            const resp = await fetch(
                `https://graph.facebook.com/${META_API_VERSION}/${videoId}?fields=status,picture&access_token=${token}`
            );
            const data = await resp.json();
            if (data.picture) thumbnailUrl = data.picture;

            const videoStatus = data.status?.video_status;
            if (videoStatus === 'ready') return thumbnailUrl;
            if (videoStatus === 'error') throw new Error(`Meta rejected the video (id: ${videoId})`);
        } catch (e: any) {
            if (e.message?.includes('rejected')) throw e;
        }
    }
    console.warn(`[Meta] Video ${videoId} still processing after 30s, proceeding anyway`);
    return thumbnailUrl;
}

/** Helper: POST to Meta via proxy (form-urlencoded, small payloads) */
async function metaProxyPost(endpoint: string, params: Record<string, string>): Promise<any> {
    const ep = encodeURIComponent(endpoint);
    const response = await authFetch(`/api/sunny/meta-proxy?endpoint=${ep}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(params).toString(),
    });
    return safeResponseJson(response, `Meta API ${endpoint}`);
}

/** Helper: POST a chunk to Meta via proxy (multipart, ≤4MB) */
async function metaProxyUploadChunk(endpoint: string, formData: FormData): Promise<any> {
    const ep = encodeURIComponent(endpoint);
    const response = await authFetch(`/api/sunny/meta-proxy?endpoint=${ep}`, {
        method: 'POST',
        body: formData,
    });
    return safeResponseJson(response, `Meta API chunk ${endpoint}`);
}

export type UploadProgressCallback = (fileName: string, percent: number) => void;

/**
 * Upload an image to Meta from a URL (Google Drive)
 */
export async function uploadMetaAdImageFromUrl(token: string, accountId: string, url: string): Promise<string> {
    const data = await metaProxyPost(`/${META_API_VERSION}/${accountId}/adimages`, { access_token: token, url });
    if (data.error) throw new Error(`Image upload from URL failed: ${data.error.message || data.error}`);
    const images = data.images;
    const firstKey = Object.keys(images)[0];
    return images[firstKey].hash;
}

/**
 * Upload a video to Meta from a URL (Google Drive)
 */
export async function uploadMetaAdVideoFromUrl(
    token: string, accountId: string, url: string, title: string,
    onProgress?: UploadProgressCallback
): Promise<{ videoId: string; thumbnailUrl: string }> {
    if (onProgress) onProgress(title, 10);
    const data = await metaProxyPost(`/${META_API_VERSION}/${accountId}/advideos`, {
        access_token: token, file_url: url, title,
    });
    if (data.error) throw new Error(`Video upload from URL failed: ${data.error.message || data.error}`);
    if (onProgress) onProgress(title, 50);

    const thumbnailUrl = await waitForVideoReady(token, data.id);
    if (onProgress) onProgress(title, 100);
    return { videoId: data.id, thumbnailUrl };
}

/**
 * Upload an image to Meta — via proxy (images are small, no chunking needed)
 */
export async function uploadMetaAdImage(token: string, accountId: string, imageFile: File): Promise<string> {
    const formData = new FormData();
    formData.append('access_token', token);
    formData.append('filename', imageFile);

    const data = await metaProxyUploadChunk(`/${META_API_VERSION}/${accountId}/adimages`, formData);
    if (data.error) throw new Error(`Image upload failed: ${data.error.message || data.error}`);
    const images = data.images;
    const firstKey = Object.keys(images)[0];
    return images[firstKey].hash;
}

const CHUNK_SIZE = 3 * 1024 * 1024; // 3MB chunks (Vercel serverless body limit ~4.5MB)

/**
 * Upload a video to Meta using chunked upload (start → transfer chunks → finish).
 * Each chunk goes through our proxy (≤4MB per request), avoiding body size limits.
 * Calls onProgress with upload percentage.
 */
export async function uploadMetaAdVideo(
    token: string, accountId: string, videoFile: File,
    onProgress?: UploadProgressCallback
): Promise<{ videoId: string; thumbnailUrl: string }> {
    const fileSize = videoFile.size;
    const endpoint = `/${META_API_VERSION}/${accountId}/advideos`;

    // Phase 1: START
    if (onProgress) onProgress(videoFile.name, 0);
    const startData = await metaProxyPost(endpoint, {
        access_token: token,
        upload_phase: 'start',
        file_size: fileSize.toString(),
    });
    if (startData.error) throw new Error(`Video upload start failed: ${startData.error.message || startData.error}`);

    const { upload_session_id, video_id } = startData;
    let startOffset = parseInt(startData.start_offset || '0');
    let endOffset = parseInt(startData.end_offset || fileSize.toString());

    // Phase 2: TRANSFER chunks (cap each chunk to CHUNK_SIZE to stay under Vercel body limit)
    while (startOffset < fileSize) {
        const cappedEnd = Math.min(endOffset, startOffset + CHUNK_SIZE);
        const chunk = videoFile.slice(startOffset, cappedEnd);
        const chunkForm = new FormData();
        chunkForm.append('access_token', token);
        chunkForm.append('upload_phase', 'transfer');
        chunkForm.append('upload_session_id', upload_session_id);
        chunkForm.append('start_offset', startOffset.toString());
        chunkForm.append('video_file_chunk', chunk, videoFile.name);

        const transferData = await metaProxyUploadChunk(endpoint, chunkForm);
        if (transferData.error) throw new Error(`Video chunk upload failed: ${transferData.error.message || transferData.error}`);

        startOffset = parseInt(transferData.start_offset);
        endOffset = parseInt(transferData.end_offset);

        const percent = Math.min(Math.round((startOffset / fileSize) * 90), 90);
        if (onProgress) onProgress(videoFile.name, percent);
    }

    // Phase 3: FINISH
    const finishData = await metaProxyPost(endpoint, {
        access_token: token,
        upload_phase: 'finish',
        upload_session_id,
        title: videoFile.name,
    });
    if (finishData.error) throw new Error(`Video upload finish failed: ${finishData.error.message || finishData.error}`);

    if (onProgress) onProgress(videoFile.name, 95);

    // Wait for processing
    const thumbnailUrl = await waitForVideoReady(token, video_id);
    if (onProgress) onProgress(videoFile.name, 100);

    return { videoId: video_id, thumbnailUrl };
}

/**
 * Create a Campaign on Meta
 */
export async function createMetaCampaign(token: string, config: MetaCampaignConfig): Promise<string> {
    // Meta requires ["NONE"] when no special ad categories apply
    const specialCategories = config.specialAdCategories.length > 0
        ? config.specialAdCategories
        : ['NONE'];

    const params: Record<string, string> = {
        access_token: token,
        name: config.name,
        objective: config.objective,
        status: config.status,
        special_ad_categories: JSON.stringify(specialCategories),
        buying_type: config.buyingType,
    };

    // CBO/ASC: set budget and bid strategy at campaign level
    if ((config.budgetOptStrategy === 'CBO' || config.budgetOptStrategy === 'ASC') && config.dailyBudget) {
        params['daily_budget'] = Math.round(config.dailyBudget).toString();
        params['bid_strategy'] = 'LOWEST_COST_WITHOUT_CAP';
    }

    // ASC: Advantage+ Shopping Campaign
    if (config.budgetOptStrategy === 'ASC') {
        params['smart_promotion_type'] = 'GUIDED_CREATION';
    }

    const response = await fetch(`https://graph.facebook.com/${META_API_VERSION}/${config.accountId}/campaigns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(params).toString()
    });

    const data = await safeResponseJson(response, 'Campaign creation');
    if (data.error) {
        const detail = data.error.error_user_msg || data.error.message;
        throw new Error(`Campaign creation failed: ${detail} (code: ${data.error.code}, subcode: ${data.error.error_subcode || 'none'})`);
    }
    return data.id;
}

/**
 * Create an Ad Set on Meta
 */
export async function createMetaAdSet(token: string, config: MetaAdSetConfig): Promise<string> {
    const params: Record<string, string> = {
        access_token: token,
        name: config.name,
        campaign_id: config.campaignId,
        status: config.status,
        billing_event: config.billingEvent,
        optimization_goal: config.optimizationGoal,
    };

    // ASC campaigns omit targeting — Meta handles it automatically
    if (config.targeting) {
        const targeting: Record<string, any> = {
            geo_locations: {
                countries: config.targeting.geoLocations.countries
            },
        };

        if (config.targeting.ageMin) targeting.age_min = config.targeting.ageMin;
        if (config.targeting.ageMax) targeting.age_max = config.targeting.ageMax;
        if (config.targeting.genders) targeting.genders = config.targeting.genders;
        if (config.targeting.excludedGeoLocations) {
            targeting.excluded_geo_locations = config.targeting.excludedGeoLocations;
        }

        params['targeting'] = JSON.stringify(targeting);
    }

    // ABO: set budget at ad set level
    if (config.dailyBudget) {
        params['daily_budget'] = config.dailyBudget.toString();
    }

    // Bid strategy — required for OFFSITE_CONVERSIONS
    if (config.bidStrategy) {
        params['bid_strategy'] = config.bidStrategy;
        if (config.bidAmount) {
            params['bid_amount'] = config.bidAmount.toString();
        }
    } else if (config.optimizationGoal === 'OFFSITE_CONVERSIONS') {
        params['bid_strategy'] = 'LOWEST_COST_WITHOUT_CAP';
    }

    if (config.promotedObject) {
        params['promoted_object'] = JSON.stringify({
            pixel_id: config.promotedObject.pixelId,
            custom_event_type: config.promotedObject.customEventType
        });
    }

    if (config.startTime) {
        params['start_time'] = config.startTime;
    }

    const response = await fetch(`https://graph.facebook.com/${META_API_VERSION}/${config.accountId}/adsets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(params).toString()
    });

    const data = await safeResponseJson(response, 'Ad Set creation');
    if (data.error) {
        const detail = data.error.error_user_msg || data.error.message;
        throw new Error(`Ad Set creation failed: ${detail} (code: ${data.error.code}, subcode: ${data.error.error_subcode || 'none'})`);
    }
    return data.id;
}

/**
 * Create an Ad on Meta
 */
export async function createMetaAd(token: string, config: MetaAdConfig): Promise<string> {
    const creativeSpec: Record<string, any> = {
        object_story_spec: {
            page_id: config.creative.pageId,
        }
    };

    // Build the creative spec
    if (config.creative.videoId) {
        // Meta REQUIRES image_hash or image_url in video_data
        // If we don't have a thumbnail yet, fetch it now
        let thumbnailUrl = config.creative.videoThumbnailUrl || '';
        if (!thumbnailUrl && !config.creative.imageHash) {
            thumbnailUrl = await waitForVideoReady(token, config.creative.videoId);
        }

        const videoData: Record<string, any> = {
            video_id: config.creative.videoId,
            message: config.creative.message,
            call_to_action: {
                type: config.creative.callToAction || 'SHOP_NOW',
                value: { link: config.creative.link }
            }
        };
        if (config.creative.imageHash) {
            videoData.image_hash = config.creative.imageHash;
        } else if (thumbnailUrl) {
            videoData.image_url = thumbnailUrl;
        }
        creativeSpec.object_story_spec.video_data = videoData;
    } else if (config.creative.imageHash) {
        creativeSpec.object_story_spec.link_data = {
            image_hash: config.creative.imageHash,
            link: config.creative.link,
            message: config.creative.message,
            call_to_action: {
                type: config.creative.callToAction || 'SHOP_NOW',
                value: { link: config.creative.link }
            }
        };
    } else {
        // No creative file — text-only ad with link
        creativeSpec.object_story_spec.link_data = {
            link: config.creative.link,
            message: config.creative.message,
            call_to_action: {
                type: config.creative.callToAction || 'SHOP_NOW',
                value: { link: config.creative.link }
            }
        };
    }

    const params: Record<string, string> = {
        access_token: token,
        name: config.name,
        adset_id: config.adSetId,
        status: config.status,
        creative: JSON.stringify(creativeSpec),
    };

    const response = await fetch(`https://graph.facebook.com/${META_API_VERSION}/${config.accountId}/ads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(params).toString()
    });

    const data = await safeResponseJson(response, 'Ad creation');
    if (data.error) {
        const detail = data.error.error_user_msg || data.error.message;
        throw new Error(`Ad creation failed: ${detail} (code: ${data.error.code}, subcode: ${data.error.error_subcode || 'none'})`);
    }
    return data.id;
}

/**
 * Full campaign launch: Campaign → Ad Set → Upload Creative → Ad
 */
export async function launchMetaCampaign(
    token: string,
    campaign: MetaCampaignConfig,
    adSet: Omit<MetaAdSetConfig, 'campaignId'>,
    ad: Omit<MetaAdConfig, 'adSetId'>,
    creativeFile?: File
): Promise<MetaLaunchResult> {
    // 1. Create Campaign
    const campaignId = await createMetaCampaign(token, campaign);

    // 2. Create Ad Set
    const adSetId = await createMetaAdSet(token, { ...adSet, campaignId });

    // 3. Upload creative file if provided
    let imageHash: string | undefined;
    let videoId: string | undefined;
    let videoThumbnailUrl: string | undefined;

    if (creativeFile) {
        if (creativeFile.type.startsWith('video/')) {
            const result = await uploadMetaAdVideo(token, campaign.accountId, creativeFile);
            videoId = result.videoId;
            videoThumbnailUrl = result.thumbnailUrl;
        } else {
            imageHash = await uploadMetaAdImage(token, campaign.accountId, creativeFile);
        }
    }

    // 4. Create Ad
    const adConfig: MetaAdConfig = {
        ...ad,
        adSetId,
        creative: {
            ...ad.creative,
            imageHash: imageHash || ad.creative.imageHash,
            videoId: videoId || ad.creative.videoId,
            videoThumbnailUrl: videoThumbnailUrl || ad.creative.videoThumbnailUrl,
        }
    };
    const adId = await createMetaAd(token, adConfig);

    return { campaignId, adSetId, adId };
}

/**
 * Create a Flexible Ad (asset_feed_spec) with multiple images/videos/texts in one ad
 */
export interface FlexibleAdConfig {
    accountId: string;
    adSetId: string;
    name: string;
    status: 'PAUSED' | 'ACTIVE';
    pageId: string;
    link: string;
    imageHashes?: string[];
    videoIds?: string[];
    bodies: string[];
    callToAction?: string;
}

export async function createMetaFlexibleAd(token: string, config: FlexibleAdConfig): Promise<string> {
    const assetFeedSpec: Record<string, any> = {
        bodies: config.bodies.map(text => ({ text })),
        link_urls: [{ website_url: config.link }],
        call_to_action_types: [config.callToAction || 'SHOP_NOW'],
    };

    if (config.imageHashes && config.imageHashes.length > 0) {
        assetFeedSpec.images = config.imageHashes.map(hash => ({ hash }));
    }

    if (config.videoIds && config.videoIds.length > 0) {
        assetFeedSpec.videos = config.videoIds.map(id => ({ video_id: id }));
    }

    const creativeSpec = {
        object_story_spec: {
            page_id: config.pageId,
        },
        asset_feed_spec: assetFeedSpec,
    };

    const params: Record<string, string> = {
        access_token: token,
        name: config.name,
        adset_id: config.adSetId,
        status: config.status,
        creative: JSON.stringify(creativeSpec),
    };

    const response = await fetch(`https://graph.facebook.com/${META_API_VERSION}/${config.accountId}/ads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(params).toString()
    });

    const data = await safeResponseJson(response, 'Flexible Ad creation');
    if (data.error) {
        const detail = data.error.error_user_msg || data.error.message;
        throw new Error(`Flexible Ad creation failed: ${detail} (code: ${data.error.code}, subcode: ${data.error.error_subcode || 'none'})`);
    }
    return data.id;
}

/** Helper: GET from Meta via proxy (for search, reads, etc.) */
async function metaProxyGet(endpoint: string, params: Record<string, string>): Promise<any> {
    const searchParams = new URLSearchParams({ endpoint, ...params });
    const response = await authFetch(`/api/sunny/meta-proxy?${searchParams.toString()}`);
    return safeResponseJson(response, `Meta API GET ${endpoint}`);
}

/**
 * Search Meta's location database to get proper location keys for targeting
 */
export async function searchMetaLocations(token: string, query: string, type: string = 'adcity'): Promise<{ key: string; name: string; type: string }[]> {
    try {
        const data = await metaProxyGet(`/${META_API_VERSION}/search`, {
            access_token: token,
            q: query,
            type: type,
            limit: '5',
        });
        if (data.error) {
            console.warn(`[Meta] Location search failed for "${query}":`, data.error.message);
            return [];
        }
        return (data.data || []).map((loc: any) => ({
            key: loc.key,
            name: loc.name,
            type: loc.type,
        }));
    } catch (e: any) {
        console.warn(`[Meta] Location search error for "${query}":`, e.message);
        return [];
    }
}

/**
 * Convert freeform location names to Meta location keys for exclusion targeting
 */
export async function resolveExclusionLocations(
    token: string,
    locationNames: string[]
): Promise<{ cities: { key: string }[] } | undefined> {
    const cities: { key: string }[] = [];

    // Resolve all location names in parallel
    const results = await Promise.all(
        locationNames.map(name => searchMetaLocations(token, name.trim(), 'adcity'))
    );

    for (const matches of results) {
        if (matches.length > 0) {
            cities.push({ key: matches[0].key });
        }
    }

    if (cities.length === 0) return undefined;
    return { cities };
}

/**
 * Fetch existing campaigns from a Meta ad account (for publishing to existing campaign)
 */
export async function fetchMetaCampaigns(token: string, accountId: string): Promise<{ id: string; name: string; status: string }[]> {
    if (!token || !accountId) return [];
    try {
        const data = await metaProxyGet(`/${META_API_VERSION}/${accountId}/campaigns`, {
            access_token: token,
            fields: 'name,status',
            limit: '50',
            filtering: JSON.stringify([{ field: 'effective_status', operator: 'IN', value: ['ACTIVE', 'PAUSED'] }]),
        });
        if (data.error) throw new Error(data.error.message);
        return (data.data || []).map((c: any) => ({ id: c.id, name: c.name, status: c.status }));
    } catch (error) {
        console.error('Error fetching Meta campaigns:', error);
        return [];
    }
}

/**
 * Fetch existing ad sets from a campaign (for publishing to existing campaign)
 */
export async function fetchMetaAdSets(token: string, campaignId: string): Promise<{ id: string; name: string; status: string }[]> {
    if (!token || !campaignId) return [];
    try {
        const data = await metaProxyGet(`/${META_API_VERSION}/${campaignId}/adsets`, {
            access_token: token,
            fields: 'name,status',
            limit: '50',
        });
        if (data.error) throw new Error(data.error.message);
        return (data.data || []).map((s: any) => ({ id: s.id, name: s.name, status: s.status }));
    } catch (error) {
        console.error('Error fetching Meta ad sets:', error);
        return [];
    }
}

export async function fetchMetaPages(token: string): Promise<any[]> {
    if (!token) return [];

    const cacheKey = `pages_${token.slice(-8)}`;
    const cached = getCached<any[]>(cacheKey);
    if (cached) return cached;

    try {
        const data = await metaFetchWithRetry(
            `https://graph.facebook.com/${META_API_VERSION}/me/accounts?fields=name,id&access_token=${token}&limit=100`,
            undefined,
            'Fetch pages'
        );
        const pages = data.data || [];
        setCache(cacheKey, pages);
        return pages;
    } catch (error) {
        console.error('Error fetching Meta pages:', error);
        if (error instanceof MetaTokenExpiredError) throw error;
        return [];
    }
}
