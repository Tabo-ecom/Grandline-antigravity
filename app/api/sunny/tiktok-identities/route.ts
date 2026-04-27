import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth, unauthorizedResponse } from '@/lib/api/auth';
import { decryptSettings } from '@/lib/api/crypto';

const TT_API_BASE = 'https://business-api.tiktok.com/open_api/v1.3';

/**
 * GET /api/sunny/tiktok-identities?advertiser_id=XXX
 * Lists all available identities for an advertiser (to find correct identity_id)
 */
export async function GET(req: NextRequest) {
    try {
        const auth = await verifyAuth(req);
        if (!auth) return unauthorizedResponse();
        if (!adminDb) return NextResponse.json({ error: 'Server not configured' }, { status: 500 });

        const advertiserId = req.nextUrl.searchParams.get('advertiser_id');
        if (!advertiserId) return NextResponse.json({ error: 'advertiser_id required' }, { status: 400 });

        const settingsSnap = await adminDb.collection('app_data').doc(`ad_settings_${auth.teamId}`).get();
        if (!settingsSnap.exists) return NextResponse.json({ error: 'No settings' }, { status: 400 });
        const settings = decryptSettings(settingsSnap.data()?.value || {});
        const token = settings.tt_token;
        if (!token) return NextResponse.json({ error: 'No TikTok token' }, { status: 400 });

        // Fetch all identity types
        const results: any[] = [];
        for (const identityType of ['TT_USER', 'BC_AUTH_TT', 'AUTH_CODE', 'CUSTOMIZED_USER']) {
            try {
                const url = `${TT_API_BASE}/identity/get/?advertiser_id=${advertiserId}&identity_type=${identityType}`;
                const res = await fetch(url, {
                    headers: { 'Access-Token': token },
                });
                const data = await res.json();
                if (data.code === 0 && data.data?.identity_list) {
                    for (const id of data.data.identity_list) {
                        results.push({ ...id, identity_type: identityType });
                    }
                }
            } catch {
                // Skip failed types
            }
        }

        return NextResponse.json({ identities: results });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
