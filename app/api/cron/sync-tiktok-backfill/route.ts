import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { decryptSettings } from '@/lib/api/crypto';
import { detectCountryFromCampaign } from '@/lib/utils/csv-parser';

/**
 * GET /api/cron/sync-tiktok-backfill
 * One-time backfill of TikTok ad spend from Jan 1 2026 to today.
 * TikTok API has a 30-day max per query, so we chunk the date range.
 */
export async function GET(req: NextRequest) {
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!adminDb) {
        return NextResponse.json({ error: 'Firebase Admin not configured' }, { status: 500 });
    }

    try {
        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];
        const startDate = '2026-01-01';

        // Generate 30-day chunks from Jan 1 to today
        const chunks: { start: string; end: string }[] = [];
        let chunkStart = new Date(startDate);
        while (chunkStart < now) {
            const chunkEnd = new Date(chunkStart);
            chunkEnd.setDate(chunkEnd.getDate() + 29); // 30 days max
            const endStr = chunkEnd > now ? todayStr : chunkEnd.toISOString().split('T')[0];
            chunks.push({ start: chunkStart.toISOString().split('T')[0], end: endStr });
            chunkStart = new Date(chunkEnd);
            chunkStart.setDate(chunkStart.getDate() + 1);
        }

        const settingsSnapshot = await adminDb.collection('app_data')
            .where('key', '==', 'ad_settings')
            .get();

        const results: { userId: string; saved: number; chunks: number; error?: string }[] = [];

        for (const settingsDoc of settingsSnapshot.docs) {
            const data = settingsDoc.data();
            const userId = data.userId;
            if (!userId || !data.value) continue;

            try {
                const settings = decryptSettings(data.value);
                const ttToken = settings.tt_token;
                const ttAccounts = settings.tt_account_ids || [];
                if (!ttToken || ttAccounts.length === 0) continue;

                // Load campaign mappings
                const mappingsDoc = await adminDb.collection('app_data').doc(`campaign_mappings_${userId}`).get();
                const mappingsRaw = mappingsDoc.exists ? mappingsDoc.data()?.value : null;
                const mappings: { campaignName: string; productId: string; platform: string }[] =
                    Array.isArray(mappingsRaw) ? mappingsRaw : [];

                const ordersSnapshot = await adminDb.collection('order_files')
                    .where('userId', '==', userId).limit(500).get();
                const productCountryMap = new Map<string, string>();
                ordersSnapshot.docs.forEach(d => {
                    const o = d.data();
                    if (o.productId && o.country) productCountryMap.set(o.productId, o.country);
                });

                let userSaved = 0;
                let chunksProcessed = 0;

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

                    // Process each 30-day chunk
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
                            chunksProcessed++;

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

                                const normalizedDate = dims.stat_time_day?.split(' ')[0] || todayStr;
                                const sanitizedCampaign = (cleanName || 'global').replace(/\W/g, '');
                                const deterministicId = `${userId}_${normalizedDate}_tiktok_${sanitizedCampaign}`;

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
                                    creator: 'cron',
                                    userId,
                                    id: deterministicId,
                                    timestamp: new Date(),
                                    impressions: parseInt(metrics.impressions || 0),
                                    clicks: parseInt(metrics.clicks || 0),
                                    ctr: 0,
                                    cpc: 0,
                                    conversions: parseInt(metrics.conversion || 0),
                                    revenue_attributed: 0,
                                }, { merge: true });

                                batchCount++;
                                userSaved++;

                                if (batchCount >= 450) {
                                    await batch.commit();
                                    batchCount = 0;
                                }
                            }

                            if (batchCount > 0) await batch.commit();
                        } catch (chunkErr: any) {
                            console.error(`[Backfill] Chunk ${chunk.start}-${chunk.end} error:`, chunkErr.message);
                        }
                    }
                }

                results.push({ userId, saved: userSaved, chunks: chunksProcessed });
            } catch (userErr: any) {
                console.error(`[Backfill] User ${userId} error:`, userErr.message);
                results.push({ userId, saved: 0, chunks: 0, error: userErr.message });
            }
        }

        const totalSaved = results.reduce((sum, r) => sum + r.saved, 0);
        return NextResponse.json({
            success: true,
            syncRange: `${startDate} → ${todayStr}`,
            chunks: chunks.length,
            users: results.length,
            totalSaved,
            details: results,
        });
    } catch (error: any) {
        console.error('[Backfill] error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
