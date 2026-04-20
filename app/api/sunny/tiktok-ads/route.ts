import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth, unauthorizedResponse } from '@/lib/api/auth';
import { decryptSettings } from '@/lib/api/crypto';

const TT_API_BASE = 'https://business-api.tiktok.com/open_api/v1.3';

/**
 * POST /api/sunny/tiktok-ads
 * Server-side proxy for TikTok Marketing API calls (campaign/adgroup/ad creation).
 * Body: { endpoint, body } — endpoint is relative path like '/campaign/create/'
 */
export async function POST(req: NextRequest) {
    try {
        const auth = await verifyAuth(req);
        if (!auth) return unauthorizedResponse();
        if (!adminDb) return NextResponse.json({ error: 'Server not configured' }, { status: 500 });

        const settingsSnap = await adminDb.collection('app_data').doc(`ad_settings_${auth.teamId}`).get();
        if (!settingsSnap.exists) return NextResponse.json({ error: 'No settings' }, { status: 400 });
        const settings = decryptSettings(settingsSnap.data()?.value || {});
        const token = settings.tt_token;
        if (!token) return NextResponse.json({ error: 'No TikTok token' }, { status: 400 });

        const { endpoint, body } = await req.json();

        // Whitelist allowed endpoints
        const allowedEndpoints = [
            '/campaign/create/',
            '/adgroup/create/',
            '/ad/create/',
            '/identity/create/',
        ];
        if (!allowedEndpoints.includes(endpoint)) {
            return NextResponse.json({ error: `Endpoint not allowed: ${endpoint}` }, { status: 400 });
        }

        const res = await fetch(`${TT_API_BASE}${endpoint}`, {
            method: 'POST',
            headers: {
                'Access-Token': token,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        const data = await res.json();

        if (data.code !== 0) {
            return NextResponse.json({
                error: data.message || `TikTok API error: ${data.code}`,
                tt_code: data.code,
                data: data.data,
            }, { status: 400 });
        }

        return NextResponse.json({ data: data.data });
    } catch (error: any) {
        console.error('[TikTok Ads Proxy] error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
