/**
 * Vega AI - Server-side Meta API Fetch
 * Fetches LIVE ad insights directly from Meta API (not Firestore cache).
 * Used by ad performance reports that need real-time data.
 */

const META_API_VERSION = 'v21.0';
const MAX_RETRIES = 2;

class MetaTokenExpiredError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'MetaTokenExpiredError';
    }
}

async function metaFetch(url: string, retries = MAX_RETRIES): Promise<any> {
    for (let attempt = 0; attempt <= retries; attempt++) {
        const response = await fetch(url);
        const data = await response.json();

        if (data.error) {
            if (data.error.code === 190) throw new MetaTokenExpiredError(data.error.message);
            if ([4, 17, 32, 613].includes(data.error.code) && attempt < retries) {
                await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt + 1)));
                continue;
            }
            throw new Error(`Meta API: ${data.error.message}`);
        }
        return data;
    }
}

function extractAction(actions: any[], types: string[]): number {
    if (!Array.isArray(actions)) return 0;
    for (const type of types) {
        const a = actions.find((a: any) => a.action_type === type);
        if (a) return parseFloat(a.value) || 0;
    }
    return 0;
}

const PURCHASE_TYPES = ['purchase', 'omni_purchase', 'offsite_conversion.fb_pixel_purchase'];
const ADD_TO_CART_TYPES = ['add_to_cart', 'omni_add_to_cart', 'offsite_conversion.fb_pixel_add_to_cart'];

export interface CampaignInsight {
    campaignId: string;
    campaignName: string;
    spend: number;
    impressions: number;
    clicks: number;
    conversions: number;
    revenue: number;
    cpa: number;
    roas: number;
    ctr: number;
    addToCart: number;
    date: string;
    currency: string;
}

/** Fetch today's live campaign insights from Meta API */
export async function fetchTodayAdInsights(
    token: string,
    accountId: string,
): Promise<CampaignInsight[]> {
    const accId = accountId.startsWith('act_') ? accountId : `act_${accountId}`;
    const today = new Date().toISOString().split('T')[0];
    const timeRange = JSON.stringify({ since: today, until: today });

    // Fetch account currency
    let currency = 'USD';
    try {
        const currData = await metaFetch(
            `https://graph.facebook.com/${META_API_VERSION}/${accId}?fields=currency&access_token=${token}`,
        );
        currency = currData.currency || 'USD';
    } catch { /* default USD */ }

    // Fetch campaign insights
    const params = new URLSearchParams({
        fields: 'campaign_id,campaign_name,spend,impressions,clicks,inline_link_clicks,inline_link_click_ctr,cpc,actions,action_values,date_start',
        time_range: timeRange,
        time_increment: '1',
        level: 'campaign',
        limit: '500',
        access_token: token,
    });

    const allRows: any[] = [];
    let url: string | null = `https://graph.facebook.com/${META_API_VERSION}/${accId}/insights?${params}`;
    let pages = 0;

    while (url && pages < 20) {
        const data = await metaFetch(url);
        if (data.data) allRows.push(...data.data);
        url = data.paging?.next || null;
        pages++;
    }

    return allRows.map((row: any) => {
        const spend = parseFloat(row.spend || '0');
        const conversions = extractAction(row.actions, PURCHASE_TYPES);
        const revenue = extractAction(row.action_values, PURCHASE_TYPES);
        const addToCart = extractAction(row.actions, ADD_TO_CART_TYPES);

        return {
            campaignId: row.campaign_id || '',
            campaignName: row.campaign_name || '',
            spend,
            impressions: parseInt(row.impressions || '0'),
            clicks: parseInt(row.clicks || '0'),
            conversions,
            revenue,
            cpa: conversions > 0 ? spend / conversions : 0,
            roas: spend > 0 ? revenue / spend : 0,
            ctr: parseFloat(row.inline_link_click_ctr || '0'),
            addToCart,
            date: row.date_start || today,
            currency,
        };
    });
}

export { MetaTokenExpiredError };
