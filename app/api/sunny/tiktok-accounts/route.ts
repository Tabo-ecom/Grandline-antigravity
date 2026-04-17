import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse } from '@/lib/api/auth';
import { adminDb } from '@/lib/firebase/admin';
import { decryptSettings } from '@/lib/api/crypto';

/**
 * GET /api/sunny/tiktok-accounts
 * Server-side proxy to fetch TikTok advertiser accounts (avoids CORS)
 */
export async function GET(req: NextRequest) {
    try {
        const auth = await verifyAuth(req);
        if (!auth) return unauthorizedResponse();
        if (!adminDb) return NextResponse.json({ error: 'Server not configured' }, { status: 500 });

        // Get tt_token from ad_settings
        const settingsSnap = await adminDb.collection('app_data').doc(`ad_settings_${auth.teamId}`).get();
        if (!settingsSnap.exists) {
            return NextResponse.json({ error: 'No hay configuración guardada' }, { status: 400 });
        }

        const raw = settingsSnap.data()?.value;
        if (!raw) return NextResponse.json({ error: 'Settings vacíos' }, { status: 400 });

        const settings = decryptSettings(raw);
        const token = settings.tt_token;

        // Debug: log what we have
        console.log('[TikTok Accounts] token length:', token?.length, 'starts with:', token?.substring(0, 15));

        if (!token) {
            return NextResponse.json({
                error: 'No hay token de TikTok',
                debug: { settings_keys: Object.keys(settings) }
            }, { status: 400 });
        }

        // Read advertiser_ids from OAuth data (already stored during callback)
        const oauthSnap = await adminDb.collection('app_data').doc(`tiktok_oauth_${auth.teamId}`).get();
        const oauthData = oauthSnap.exists ? oauthSnap.data() : null;
        const advertiserIds: string[] = (oauthData?.advertiser_ids || []).map((id: any) => id.toString());

        if (advertiserIds.length === 0) {
            return NextResponse.json({ accounts: [], message: 'No advertiser IDs from OAuth. Reconnect TikTok.' });
        }

        // Fetch advertiser names using Access-Token header
        let accounts: { advertiser_id: string; advertiser_name: string }[] = [];
        try {
            const idsParam = encodeURIComponent(JSON.stringify(advertiserIds));
            const fieldsParam = encodeURIComponent(JSON.stringify(["advertiser_id", "name"]));
            const infoRes = await fetch(
                `https://business-api.tiktok.com/open_api/v1.3/advertiser/info/?advertiser_ids=${idsParam}&fields=${fieldsParam}`,
                { headers: { 'Access-Token': token } }
            );
            const infoData = await infoRes.json();

            if (infoData.code === 0 && infoData.data?.list) {
                accounts = infoData.data.list.map((a: any) => ({
                    advertiser_id: a.advertiser_id?.toString() || '',
                    advertiser_name: a.name || `Ad Account ${a.advertiser_id}`,
                }));
            } else {
                // Fallback: use IDs without names
                accounts = advertiserIds.map(id => ({ advertiser_id: id, advertiser_name: `Ad Account ${id}` }));
            }
        } catch {
            accounts = advertiserIds.map(id => ({ advertiser_id: id, advertiser_name: `Ad Account ${id}` }));
        }

        return NextResponse.json({ accounts });
    } catch (error: any) {
        console.error('TikTok accounts proxy error:', error);
        return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
    }
}
