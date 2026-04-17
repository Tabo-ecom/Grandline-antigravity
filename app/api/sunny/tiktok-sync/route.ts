import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth, unauthorizedResponse } from '@/lib/api/auth';
import { decryptSettings } from '@/lib/api/crypto';
import { detectCountryFromCampaign } from '@/lib/utils/csv-parser';

/**
 * POST /api/sunny/tiktok-sync
 * Sync TikTok ad spend for the authenticated user.
 * Body: { startDate, endDate }
 */
export async function POST(req: NextRequest) {
    try {
        const auth = await verifyAuth(req);
        if (!auth) return unauthorizedResponse();
        if (!adminDb) return NextResponse.json({ error: 'Server not configured' }, { status: 500 });

        const { startDate, endDate } = await req.json();
        if (!startDate || !endDate) {
            return NextResponse.json({ error: 'startDate and endDate required' }, { status: 400 });
        }

        // Get settings
        const settingsSnap = await adminDb.collection('app_data').doc(`ad_settings_${auth.teamId}`).get();
        if (!settingsSnap.exists) return NextResponse.json({ error: 'No settings' }, { status: 400 });
        const settings = decryptSettings(settingsSnap.data()?.value || {});

        const ttToken = settings.tt_token;
        const ttAccounts = settings.tt_account_ids || [];
        if (!ttToken || ttAccounts.length === 0) {
            return NextResponse.json({ error: 'No hay token o cuentas de TikTok configuradas' }, { status: 400 });
        }

        // Load mappings
        const mappingsDoc = await adminDb.collection('app_data').doc(`campaign_mappings_${auth.teamId}`).get();
        const mappingsRaw = mappingsDoc.exists ? mappingsDoc.data()?.value : null;
        const mappings: { campaignName: string; productId: string; platform: string }[] =
            Array.isArray(mappingsRaw) ? mappingsRaw : [];

        const ordersSnapshot = await adminDb.collection('order_files')
            .where('userId', '==', auth.teamId).limit(500).get();
        const productCountryMap = new Map<string, string>();
        ordersSnapshot.docs.forEach(d => {
            const o = d.data();
            if (o.productId && o.country) productCountryMap.set(o.productId, o.country);
        });

        // Generate 30-day chunks
        const chunks: { start: string; end: string }[] = [];
        let chunkStart = new Date(startDate);
        const endDt = new Date(endDate);
        while (chunkStart <= endDt) {
            const chunkEnd = new Date(chunkStart);
            chunkEnd.setDate(chunkEnd.getDate() + 29);
            const endStr = chunkEnd > endDt ? endDate : chunkEnd.toISOString().split('T')[0];
            chunks.push({ start: chunkStart.toISOString().split('T')[0], end: endStr });
            chunkStart = new Date(chunkEnd);
            chunkStart.setDate(chunkStart.getDate() + 1);
        }

        let totalSaved = 0;

        for (const ttAccount of ttAccounts) {
            const advertiserId = ttAccount.id || ttAccount.advertiser_id;
            if (!advertiserId) continue;

            // Get campaign names
            const campaignNameMap = new Map<string, string>();
            const campaignsRes = await fetch(
                `https://business-api.tiktok.com/open_api/v1.3/campaign/get/?advertiser_id=${advertiserId}&page_size=1000`,
                { headers: { 'Access-Token': ttToken } }
            );
            const campaignsData = await campaignsRes.json();
            if (campaignsData.code === 0 && campaignsData.data?.list) {
                campaignsData.data.list.forEach((c: any) => {
                    campaignNameMap.set(String(c.campaign_id), c.campaign_name || '');
                });
            }

            for (const chunk of chunks) {
                try {
                    const ttParams = new URLSearchParams({
                        advertiser_id: advertiserId,
                        report_type: 'BASIC',
                        data_level: 'AUCTION_CAMPAIGN',
                        dimensions: JSON.stringify(['campaign_id', 'stat_time_day']),
                        metrics: JSON.stringify(['spend', 'impressions', 'clicks', 'conversion']),
                        start_date: chunk.start,
                        end_date: chunk.end,
                        page_size: '1000',
                    });

                    const ttRes = await fetch(
                        `https://business-api.tiktok.com/open_api/v1.3/report/integrated/get/?${ttParams.toString()}`,
                        { headers: { 'Access-Token': ttToken } }
                    );
                    const ttData = await ttRes.json();
                    if (ttData.code !== 0 || !ttData.data?.list) continue;

                    const batch = adminDb.batch();
                    let batchCount = 0;

                    for (const item of ttData.data.list) {
                        const metrics = item.metrics || {};
                        const dims = item.dimensions || {};
                        const spend = parseFloat(metrics.spend || 0);
                        if (spend <= 0) continue;

                        const campaignId = String(dims.campaign_id || '');
                        const cleanName = campaignNameMap.get(campaignId) || `Campaign ${campaignId}`;
                        let country = 'Desconocido';

                        const mapping = mappings.find(m =>
                            m.campaignName.trim().toLowerCase() === cleanName.toLowerCase() &&
                            m.platform === 'tiktok'
                        );
                        if (mapping) {
                            const productCountry = productCountryMap.get(mapping.productId);
                            if (productCountry && productCountry !== 'Todos') country = productCountry;
                        }
                        if (country === 'Desconocido') {
                            country = detectCountryFromCampaign(cleanName) || 'Desconocido';
                        }

                        const normalizedDate = dims.stat_time_day?.split(' ')[0] || endDate;
                        const sanitizedCampaign = (cleanName || 'global').replace(/\W/g, '');
                        const deterministicId = `${auth.teamId}_${normalizedDate}_tiktok_${sanitizedCampaign}`;

                        batch.set(adminDb.doc(`marketing_history/${deterministicId}`), {
                            amount: spend,
                            currency: settings.tt_currency || 'COP',
                            source: 'api',
                            platform: 'tiktok',
                            updatedAt: Date.now(),
                            productId: 'global',
                            date: normalizedDate,
                            country,
                            campaignName: cleanName,
                            creator: 'sync',
                            userId: auth.teamId,
                            id: deterministicId,
                            timestamp: new Date(),
                            impressions: parseInt(metrics.impressions || 0),
                            clicks: parseInt(metrics.clicks || 0),
                            conversions: parseInt(metrics.conversion || 0),
                        }, { merge: true });

                        batchCount++;
                        totalSaved++;

                        if (batchCount >= 450) {
                            await batch.commit();
                            batchCount = 0;
                        }
                    }

                    if (batchCount > 0) await batch.commit();
                } catch (e: any) {
                    console.error(`[TikTok Sync] Chunk error:`, e.message);
                }
            }
        }

        return NextResponse.json({ success: true, saved: totalSaved });
    } catch (error: any) {
        console.error('[TikTok Sync] error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
