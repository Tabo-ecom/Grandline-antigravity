/**
 * TikTok Marketing API + Content Posting Service
 */

interface TikTokAdAccount {
    advertiser_id: string;
    advertiser_name: string;
}

interface TikTokOAuthStatus {
    connected: boolean;
    expired?: boolean;
    display_name?: string;
    avatar_url?: string;
    open_id?: string;
    connected_at?: string | null;
}

/* ─── OAuth Helpers ──────────────────────────────────────── */


/**
 * Fetch TikTok connection status from our API
 */
export async function getTikTokStatus(authFetch: (url: string, opts?: RequestInit) => Promise<Response>): Promise<TikTokOAuthStatus> {
    try {
        const res = await authFetch('/api/auth/tiktok');
        if (!res.ok) return { connected: false };
        return await res.json();
    } catch {
        return { connected: false };
    }
}

/**
 * Disconnect TikTok account
 */
export async function disconnectTikTok(authFetch: (url: string, opts?: RequestInit) => Promise<Response>): Promise<boolean> {
    try {
        const res = await authFetch('/api/auth/tiktok', { method: 'DELETE' });
        return res.ok;
    } catch {
        return false;
    }
}

/* ─── Content Posting API (via proxy) ────────────────────── */


/* ─── TikTok Marketing API — Campaign Creation ───────────── */

interface TikTokCampaignConfig {
    advertiserId: string;
    name: string;
    objectiveType: 'TRAFFIC' | 'CONVERSIONS' | 'REACH' | 'VIDEO_VIEWS';
    budgetMode: 'BUDGET_MODE_DAY' | 'BUDGET_MODE_TOTAL' | 'BUDGET_MODE_INFINITE';
    budget?: number; // in micro-currency (value * 1_000_000) for CBO
    status?: 'ENABLE' | 'DISABLE';
}

interface TikTokAdGroupConfig {
    advertiserId: string;
    campaignId: string;
    name: string;
    placementType?: 'PLACEMENT_TYPE_AUTOMATIC' | 'PLACEMENT_TYPE_NORMAL';
    placements?: string[];
    budget?: number; // daily budget in micro-currency for ABO
    budgetMode?: 'BUDGET_MODE_DAY' | 'BUDGET_MODE_TOTAL' | 'BUDGET_MODE_INFINITE';
    optimizationGoal?: 'CONVERT' | 'CLICK' | 'REACH' | 'VIDEO_VIEW';
    billingEvent?: 'CPC' | 'CPM' | 'OCPM';
    bidType?: 'BID_TYPE_NO_BID' | 'BID_TYPE_CUSTOM';
    scheduleStartTime: string; // "2026-04-07 05:00:00"
    locationIds: string[]; // country codes ["CO", "MX"]
    ageGroups?: string[]; // ["AGE_18_24", "AGE_25_34", ...]
    gender?: 'GENDER_UNLIMITED' | 'GENDER_MALE' | 'GENDER_FEMALE';
    pixelId?: string;
    optimizationEvent?: string;
}

interface TikTokAdConfig {
    advertiserId: string;
    adGroupId: string;
    name: string;
    adFormat?: 'SINGLE_VIDEO' | 'SINGLE_IMAGE';
    imageId?: string;
    videoId?: string;
    adText: string;
    callToAction?: string;
    landingPageUrl: string;
    identityType?: 'CUSTOMIZED_USER' | 'AUTH_CODE';
    displayName?: string;
}

export interface TikTokLaunchResult {
    campaignId: string;
    adGroupId: string;
    adId: string;
    accountName: string;
}

const TT_API_BASE = 'https://business-api.tiktok.com/open_api/v1.3';

async function ttApiCall(endpoint: string, _token: string, body: any): Promise<any> {
    // Uses server-side proxy to avoid CORS and keep token secure
    const { authFetch: af } = await import('@/lib/api/client');
    const res = await af('/api/sunny/tiktok-ads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint, body }),
    });
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data.error || `TikTok API error`);
    }
    return data.data;
}

export async function createTikTokCampaign(token: string, config: TikTokCampaignConfig): Promise<string> {
    const body: any = {
        advertiser_id: config.advertiserId,
        campaign_name: config.name,
        objective_type: config.objectiveType,
        budget_mode: config.budgetMode,
    };
    if (config.budget && config.budgetMode !== 'BUDGET_MODE_INFINITE') {
        body.budget = config.budget;
    }
    if (config.status) {
        body.operation_status = config.status;
    }
    const data = await ttApiCall('/campaign/create/', token, body);
    return data.campaign_id;
}

export async function createTikTokAdGroup(token: string, config: TikTokAdGroupConfig): Promise<string> {
    const body: any = {
        advertiser_id: config.advertiserId,
        campaign_id: config.campaignId,
        adgroup_name: config.name,
        placement_type: config.placementType || 'PLACEMENT_TYPE_AUTOMATIC',
        budget_mode: config.budgetMode || 'BUDGET_MODE_INFINITE',
        optimization_goal: config.optimizationGoal || 'CLICK',
        billing_event: config.billingEvent || 'OCPM',
        bid_type: config.bidType || 'BID_TYPE_NO_BID',
        schedule_type: 'SCHEDULE_FROM_NOW',
        schedule_start_time: config.scheduleStartTime,
        location_ids: config.locationIds,
    };
    if (config.budget && config.budgetMode === 'BUDGET_MODE_DAY') {
        body.budget = config.budget;
    }
    if (config.ageGroups?.length) body.age_groups = config.ageGroups;
    if (config.gender) body.gender = config.gender;
    // TikTok pixel_id must be numeric — skip if alphanumeric dataset ID
    if (config.pixelId && /^\d+$/.test(config.pixelId)) {
        body.pixel_id = config.pixelId;
        body.optimization_event = config.optimizationEvent || 'ON_WEB_ORDER';
    }
    const data = await ttApiCall('/adgroup/create/', token, body);
    return data.adgroup_id;
}

export async function createTikTokAd(token: string, config: TikTokAdConfig): Promise<string> {
    const body: any = {
        advertiser_id: config.advertiserId,
        adgroup_id: config.adGroupId,
        ad_name: config.name,
        ad_format: config.adFormat || 'SINGLE_VIDEO',
        ad_text: config.adText,
        landing_page_url: config.landingPageUrl,
        call_to_action: config.callToAction || 'SHOP_NOW',
        identity_type: config.identityType || 'CUSTOMIZED_USER',
    };
    if (config.videoId) body.video_id = config.videoId;
    if (config.imageId) body.image_ids = [config.imageId];
    if (config.displayName) body.display_name = config.displayName;
    const data = await ttApiCall('/ad/create/', token, body);
    return data.ad_ids?.[0] || data.ad_id;
}

export async function uploadTikTokVideo(_token: string, advertiserId: string, file: File): Promise<string> {
    // Upload to Firebase Storage first, then tell TikTok to download from URL
    // This bypasses both Vercel 4.5MB limit AND TikTok CORS restrictions
    const { storage } = await import('@/lib/firebase/config');
    const { ref, uploadBytes, getDownloadURL, deleteObject } = await import('firebase/storage');

    const fileName = `tiktok-uploads/${Date.now()}-${file.name}`;
    const storageRef = ref(storage, fileName);

    // Upload to Firebase Storage
    await uploadBytes(storageRef, file);
    const downloadUrl = await getDownloadURL(storageRef);

    // Tell TikTok to download from URL via server proxy
    const { authFetch: af } = await import('@/lib/api/client');
    const res = await af('/api/sunny/tiktok-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            advertiser_id: advertiserId,
            type: 'video',
            url: downloadUrl,
            fileName: file.name,
        }),
    });
    const data = await res.json();

    // Clean up Firebase Storage
    deleteObject(storageRef).catch(() => {});

    if (!res.ok) throw new Error(data.error || 'Error uploading video to TikTok');
    return data.id;
}

export async function uploadTikTokImage(_token: string, advertiserId: string, file: File): Promise<string> {
    const { storage } = await import('@/lib/firebase/config');
    const { ref, uploadBytes, getDownloadURL, deleteObject } = await import('firebase/storage');

    const fileName = `tiktok-uploads/${Date.now()}-${file.name}`;
    const storageRef = ref(storage, fileName);

    await uploadBytes(storageRef, file);
    const downloadUrl = await getDownloadURL(storageRef);

    const { authFetch: af } = await import('@/lib/api/client');
    const res = await af('/api/sunny/tiktok-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            advertiser_id: advertiserId,
            type: 'image',
            url: downloadUrl,
        }),
    });
    const data = await res.json();

    deleteObject(storageRef).catch(() => {});

    if (!res.ok) throw new Error(data.error || 'Error uploading image to TikTok');
    return data.id;
}

/** Map country name to TikTok numeric location ID (geo_id) */
export function getTikTokLocationId(country: string): string {
    const map: Record<string, string> = {
        'Colombia': '3686110',
        'México': '3996063', 'Mexico': '3996063',
        'Ecuador': '3658394',
        'Perú': '3932488', 'Peru': '3932488',
        'Chile': '3895114',
        'Argentina': '3865483',
        'Paraguay': '3437598',
        'Guatemala': '3595528',
        'Panamá': '3703430', 'Panama': '3703430',
        'Costa Rica': '3624060',
    };
    return map[country] || '3686110'; // Default: Colombia
}

/** Map demographics age range to TikTok age groups */
export function getTikTokAgeGroups(ageMin: number, ageMax: number): string[] {
    const groups: string[] = [];
    const ranges = [
        { id: 'AGE_13_17', min: 13, max: 17 },
        { id: 'AGE_18_24', min: 18, max: 24 },
        { id: 'AGE_25_34', min: 25, max: 34 },
        { id: 'AGE_35_44', min: 35, max: 44 },
        { id: 'AGE_45_54', min: 45, max: 54 },
        { id: 'AGE_55_100', min: 55, max: 100 },
    ];
    for (const r of ranges) {
        if (r.max >= ageMin && r.min <= ageMax) groups.push(r.id);
    }
    return groups;
}

export async function fetchTikTokAdAccounts(_token?: string): Promise<TikTokAdAccount[]> {
    try {
        // Use server-side proxy to avoid CORS — token is read from Firestore server-side
        const { authFetch: af } = await import('@/lib/api/client');
        const res = await af('/api/sunny/tiktok-accounts');
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Error fetching TikTok accounts');
        }
        const data = await res.json();
        return data.accounts || [];
    } catch (error) {
        console.error('Error fetching TikTok accounts:', error);
        throw error;
    }
}

export async function fetchTikTokAdSpend(token: string, advertiserId: string, startDate: string, endDate: string): Promise<any[]> {
    if (!token || !advertiserId) return [];
    try {
        // Build URL with properly encoded parameters
        const params = new URLSearchParams({
            advertiser_id: advertiserId,
            report_type: 'BASIC',
            data_level: 'AUCTION_CAMPAIGN',
            dimensions: JSON.stringify(['campaign_id', 'campaign_name', 'stat_time_day']),
            metrics: JSON.stringify(['spend', 'impressions', 'clicks', 'ctr', 'cpc', 'reach', 'conversion', 'total_purchase_amount']),
            start_date: startDate,
            end_date: endDate,
            page_size: '1000',
            access_token: token
        });

        const url = `https://business-api.tiktok.com/open_api/v1.3/report/integrated/get/?${params.toString()}`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.code !== 0) {
            throw new Error(data.message || 'Error fetching TikTok spend');
        }

        // Flatten metrics to top level to match Meta format and dashboard expectations
        return (data.data?.list || []).map((item: any) => ({
            ...item,
            ...item.metrics,
            campaign_name: item.dimensions?.campaign_name || item.campaign_name,
            campaign_id: item.dimensions?.campaign_id || item.campaign_id,
            stat_time_day: item.dimensions?.stat_time_day || item.stat_time_day
        }));
    } catch (error) {
        console.error('Error fetching TikTok spend:', error);
        throw error;
    }
}

export async function fetchTikTokAdCreatives(token: string, advertiserId: string, startDate: string, endDate: string): Promise<any[]> {
    if (!token || !advertiserId) return [];
    try {
        const params = new URLSearchParams({
            advertiser_id: advertiserId,
            report_type: 'BASIC',
            data_level: 'AUCTION_AD',
            dimensions: JSON.stringify(['ad_id', 'ad_name', 'campaign_name']),
            metrics: JSON.stringify(['spend', 'impressions', 'clicks', 'ctr', 'conversion', 'total_purchase_amount']),
            start_date: startDate,
            end_date: endDate,
            page_size: '50',
            access_token: token
        });

        const url = `https://business-api.tiktok.com/open_api/v1.3/report/integrated/get/?${params.toString()}`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.code !== 0) throw new Error(data.message || 'Error fetching TikTok levels');

        return (data.data?.list || []).map((item: any) => {
            const metrics = item.metrics || {};
            return {
                id: item.dimensions?.ad_id || item.ad_id,
                name: item.dimensions?.ad_name || item.ad_name,
                campaign_name: item.dimensions?.campaign_name || item.campaign_name || '',
                spend: parseFloat(metrics.spend || item.spend || 0),
                impressions: parseInt(metrics.impressions || item.impressions || 0),
                clicks: parseInt(metrics.clicks || item.clicks || 0),
                ctr: parseFloat(metrics.ctr || item.ctr || 0) * 100,
                conversions: parseInt(metrics.conversion || item.conversion || 0),
                revenue: parseFloat(metrics.total_purchase_amount || item.total_purchase_amount || 0),
                platform: 'tiktok'
            };
        });
    } catch (error) {
        console.error('Error fetching TikTok creatives:', error);
        return [];
    }
}

/**
 * Fetch thumbnails/covers for TikTok Ads
 */
export async function fetchTikTokAdThumbnails(token: string, advertiserId: string, adIds: string[]): Promise<Record<string, string>> {
    if (!token || !advertiserId || adIds.length === 0) return {};
    try {
        // TikTok doesn't have a batch ad-query like Meta, but we can try to get ad info
        // or just use the cover_image_url from the integrated report if we had it.
        // For now, if we don't have it in the initial report, we can fetch ad details.
        const params = new URLSearchParams({
            advertiser_id: advertiserId,
            ad_ids: JSON.stringify(adIds),
            fields: JSON.stringify(['ad_id', 'image_url', 'video_id']),
            access_token: token
        });

        const url = `https://business-api.tiktok.com/open_api/v1.3/ad/get/?${params.toString()}`;
        const response = await fetch(url);
        const data = await response.json();

        const thumbnails: Record<string, string> = {};
        if (data.code === 0 && data.data?.list) {
            data.data.list.forEach((ad: any) => {
                if (ad.creative) {
                    const creative = ad.creative;
                    // Prefer high-res image_url, then video thumbnail, then small thumbnail_url
                    const bestUrl =
                        creative.image_url ||
                        creative.video_id?.thumbnails?.data?.[0]?.uri ||
                        creative.thumbnail_url;

                    if (bestUrl) {
                        thumbnails[ad.ad_id] = bestUrl;
                    }
                }
            });
        }
        return thumbnails;
    } catch (error) {
        console.error('Error fetching TikTok thumbnails:', error);
        return {};
    }
}
