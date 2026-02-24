/**
 * TikTok Marketing API Service
 */

interface TikTokAdAccount {
    advertiser_id: string;
    advertiser_name: string;
}

export async function fetchTikTokAdAccounts(token: string): Promise<TikTokAdAccount[]> {
    if (!token) return [];

    try {
        // TikTok requires advertiser_info with developer app context usually, 
        // but for a user with an access_token, we can try to fetch the list of authorized advertisers.
        const response = await fetch(`https://business-api.tiktok.com/open_api/v1.3/oauth2/advertiser/get/?access_token=${token}`);
        const data = await response.json();

        if (data.code !== 0) {
            throw new Error(data.message || 'Error fetching TikTok accounts');
        }

        return data.data?.list || [];
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
