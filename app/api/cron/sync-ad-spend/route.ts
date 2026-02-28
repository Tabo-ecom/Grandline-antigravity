import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { decryptSettings } from '@/lib/api/crypto';
import { detectCountryFromCampaign } from '@/lib/utils/csv-parser';

// Meta API constants (mirror from lib/services/meta.ts to avoid client-side imports)
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

async function fetchAdSpend(token: string, accountId: string, startDate: string, endDate: string) {
    const accId = accountId.startsWith('act_') ? accountId : `act_${accountId}`;
    const timeRange = JSON.stringify({ since: startDate, until: endDate });
    const params = new URLSearchParams({
        fields: 'campaign_id,campaign_name,spend,impressions,clicks,inline_link_clicks,inline_link_click_ctr,cpc,date_start,date_stop,actions,action_values',
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

    return allRows;
}

async function fetchAccountCurrency(token: string, accountId: string): Promise<string> {
    try {
        const accId = accountId.startsWith('act_') ? accountId : `act_${accountId}`;
        const data = await metaFetch(
            `https://graph.facebook.com/${META_API_VERSION}/${accId}?fields=currency&access_token=${token}`
        );
        return data.currency || 'USD';
    } catch {
        return 'USD';
    }
}

function extractAction(actions: any[], type: string): number {
    if (!Array.isArray(actions)) return 0;
    const a = actions.find((a: any) => a.action_type === type);
    return a ? parseFloat(a.value) : 0;
}

export async function GET(req: NextRequest) {
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!adminDb) {
        return NextResponse.json({ error: 'Firebase Admin not configured' }, { status: 500 });
    }

    try {
        // Determine date range based on current hour
        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        const isMidnight = now.getUTCHours() === 0;
        const syncStart = isMidnight ? yesterdayStr : todayStr;
        const syncEnd = todayStr;

        // Get all users with Meta tokens configured
        const settingsSnapshot = await adminDb.collection('app_data')
            .where('key', '==', 'ad_settings')
            .get();

        const results: { userId: string; saved: number; error?: string }[] = [];

        for (const settingsDoc of settingsSnapshot.docs) {
            const data = settingsDoc.data();
            const userId = data.userId;
            if (!userId || !data.value) continue;

            try {
                const settings = decryptSettings(data.value);
                const fbToken = settings.fb_token;
                const fbAccounts = settings.fb_account_ids || [];
                if (!fbToken || fbAccounts.length === 0) continue;

                // Load user's campaign mappings for country detection
                const mappingsDoc = await adminDb.collection('app_data')
                    .doc(`campaign_mappings_${userId}`)
                    .get();
                const mappingsRaw = mappingsDoc.exists ? mappingsDoc.data()?.value : null;
                const mappings: { campaignName: string; productId: string; platform: string }[] =
                    Array.isArray(mappingsRaw) ? mappingsRaw : [];

                // Load products for country resolution
                const ordersSnapshot = await adminDb.collection('order_files')
                    .where('userId', '==', userId)
                    .limit(500)
                    .get();
                const productCountryMap = new Map<string, string>();
                ordersSnapshot.docs.forEach(d => {
                    const o = d.data();
                    if (o.productId && o.country) productCountryMap.set(o.productId, o.country);
                });

                // Fetch and save ad spend for each account
                const batch = adminDb.batch();
                let batchCount = 0;
                let userSaved = 0;

                for (const account of fbAccounts) {
                    try {
                        // Fetch the REAL currency from Meta API (not user settings)
                        const accountCurrency = await fetchAccountCurrency(fbToken, account.id);
                        const rows = await fetchAdSpend(fbToken, account.id, syncStart, syncEnd);

                        for (const row of rows) {
                            const spend = parseFloat(row.spend || 0);
                            if (spend <= 0) continue;

                            const cleanName = String(row.campaign_name || '').trim();
                            let country = 'Desconocido';

                            // Check mapping
                            const mapping = mappings.find(m =>
                                m.campaignName.trim().toLowerCase() === cleanName.toLowerCase() &&
                                m.platform === 'facebook'
                            );
                            if (mapping) {
                                const productCountry = productCountryMap.get(mapping.productId);
                                if (productCountry && productCountry !== 'Todos') country = productCountry;
                            }
                            if (country === 'Desconocido') {
                                country = detectCountryFromCampaign(cleanName) || 'Desconocido';
                            }

                            const normalizedDate = row.date_start?.split(' ')[0] || todayStr;
                            const sanitizedCampaign = (cleanName || 'global').replace(/\W/g, '');
                            const deterministicId = `${userId}_${normalizedDate}_facebook_${sanitizedCampaign}`;

                            batch.set(adminDb.doc(`marketing_history/${deterministicId}`), {
                                amount: spend,
                                currency: accountCurrency,
                                source: 'api',
                                platform: 'facebook',
                                updatedAt: Date.now(),
                                productId: 'global',
                                date: normalizedDate,
                                country,
                                campaignName: cleanName,
                                creator: 'cron',
                                userId,
                                id: deterministicId,
                                timestamp: adminDb.constructor.name === 'Firestore'
                                    ? new Date()
                                    : new Date(),
                                impressions: parseInt(row.impressions || 0),
                                clicks: parseInt(row.clicks || 0),
                                ctr: parseFloat(row.inline_link_click_ctr || 0),
                                cpc: parseFloat(row.cpc || 0),
                                conversions: extractAction(row.actions, 'purchase') || extractAction(row.actions, 'omni_purchase') || extractAction(row.actions, 'offsite_conversion.fb_pixel_purchase'),
                                revenue_attributed: extractAction(row.action_values, 'purchase') || extractAction(row.action_values, 'omni_purchase') || extractAction(row.action_values, 'offsite_conversion.fb_pixel_purchase'),
                                page_visits: extractAction(row.actions, 'landing_page_view') || extractAction(row.actions, 'link_click') || extractAction(row.actions, 'omni_view_content') || parseInt(row.inline_link_clicks || '0') || 0,
                                add_to_cart: extractAction(row.actions, 'add_to_cart') || extractAction(row.actions, 'omni_add_to_cart') || extractAction(row.actions, 'offsite_conversion.fb_pixel_add_to_cart'),
                            }, { merge: true });

                            batchCount++;
                            userSaved++;

                            // Admin SDK batch limit is 500
                            if (batchCount >= 450) {
                                await batch.commit();
                                batchCount = 0;
                            }
                        }
                    } catch (accErr: any) {
                        if (accErr instanceof MetaTokenExpiredError) {
                            results.push({ userId, saved: userSaved, error: 'Token expired' });
                            break;
                        }
                        console.error(`[Cron] Error syncing account ${account.id} for ${userId}:`, accErr.message);
                    }
                }

                if (batchCount > 0) await batch.commit();
                results.push({ userId, saved: userSaved });
            } catch (userErr: any) {
                console.error(`[Cron] Error processing user ${userId}:`, userErr.message);
                results.push({ userId, saved: 0, error: userErr.message });
            }
        }

        const totalSaved = results.reduce((sum, r) => sum + r.saved, 0);
        return NextResponse.json({
            success: true,
            syncRange: `${syncStart} → ${syncEnd}`,
            isMidnight: isMidnight,
            users: results.length,
            totalSaved,
            details: results,
        });
    } catch (error: any) {
        console.error('[Cron] sync-ad-spend error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
