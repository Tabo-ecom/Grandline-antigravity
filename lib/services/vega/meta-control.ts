/**
 * Vega AI - Meta Campaign Control (WRITE operations)
 * Update budgets and pause/enable campaigns and ad sets via Meta API.
 */

const META_API_VERSION = 'v21.0';

export interface CampaignActionResult {
    success: boolean;
    entityId: string;
    action: string;
    error?: string;
}

async function metaPost(
    entityId: string,
    params: Record<string, string>,
    token: string,
): Promise<CampaignActionResult> {
    const url = `https://graph.facebook.com/${META_API_VERSION}/${entityId}`;

    const body = new URLSearchParams({ ...params, access_token: token });

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
    });

    const data = await res.json();

    if (data.error) {
        return {
            success: false,
            entityId,
            action: 'update',
            error: data.error.message || 'Meta API error',
        };
    }

    return { success: true, entityId, action: 'update' };
}

/** Update campaign daily budget (amount in local currency, converted to centavos) */
export async function updateCampaignBudget(
    token: string,
    campaignId: string,
    budgetLocalCurrency: number,
): Promise<CampaignActionResult> {
    const budgetCents = Math.round(budgetLocalCurrency * 100).toString();
    return metaPost(campaignId, { daily_budget: budgetCents }, token);
}

/** Update ad set daily budget (amount in local currency, converted to centavos) */
export async function updateAdSetBudget(
    token: string,
    adSetId: string,
    budgetLocalCurrency: number,
): Promise<CampaignActionResult> {
    const budgetCents = Math.round(budgetLocalCurrency * 100).toString();
    return metaPost(adSetId, { daily_budget: budgetCents }, token);
}

/** Pause or enable a campaign */
export async function updateCampaignStatus(
    token: string,
    campaignId: string,
    status: 'ACTIVE' | 'PAUSED',
): Promise<CampaignActionResult> {
    return metaPost(campaignId, { status }, token);
}

/** Pause or enable an ad set */
export async function updateAdSetStatus(
    token: string,
    adSetId: string,
    status: 'ACTIVE' | 'PAUSED',
): Promise<CampaignActionResult> {
    return metaPost(adSetId, { status }, token);
}
