import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth, unauthorizedResponse } from '@/lib/api/auth';
import { decrypt } from '@/lib/api/crypto';

/**
 * GET /api/auth/tiktok/test
 * Tests the stored TikTok token against the advertiser endpoint
 */
export async function GET(req: NextRequest) {
    try {
        if (!adminDb) return NextResponse.json({ error: 'No DB' }, { status: 500 });

        // Hardcoded for debug — will remove after
        const auth = { teamId: 'jbNZO8GwmTWw07RiK5DVgbYiGh33' };
        const appId = process.env.TIKTOK_CLIENT_KEY || '';
        const secret = process.env.TIKTOK_CLIENT_SECRET || '';

        // Read token from oauth doc
        const oauthSnap = await adminDb.collection('app_data').doc(`tiktok_oauth_${auth.teamId}`).get();
        const oauthRawToken = oauthSnap.exists ? decrypt(oauthSnap.data()?.access_token || '') : null;

        // Read token from ad_settings
        const { decryptSettings } = await import('@/lib/api/crypto');
        const settingsSnap = await adminDb.collection('app_data').doc(`ad_settings_${auth.teamId}`).get();
        let settingsToken: string | null = null;
        if (settingsSnap.exists) {
            const raw = settingsSnap.data()?.value;
            if (raw) {
                const s = decryptSettings(raw);
                settingsToken = s.tt_token || null;
            }
        }

        // Test oauth token
        let oauthResult = null;
        if (oauthRawToken) {
            const url = `https://business-api.tiktok.com/open_api/v1.3/oauth2/advertiser/get/?app_id=${appId}&secret=${secret}&access_token=${oauthRawToken}`;
            const res = await fetch(url);
            oauthResult = await res.json();
        }

        // Test settings token
        let settingsResult = null;
        if (settingsToken) {
            const url = `https://business-api.tiktok.com/open_api/v1.3/oauth2/advertiser/get/?app_id=${appId}&secret=${secret}&access_token=${settingsToken}`;
            const res = await fetch(url);
            settingsResult = await res.json();
        }

        // Also try with Access-Token header instead of query param
        let headerResult = null;
        if (oauthRawToken) {
            const res = await fetch('https://business-api.tiktok.com/open_api/v1.3/oauth2/advertiser/get/', {
                headers: { 'Access-Token': oauthRawToken },
            });
            headerResult = await res.json();
        }

        // Read debug doc from last OAuth
        const debugSnap = await adminDb.collection('app_data').doc(`tiktok_debug_${auth.teamId}`).get();
        const debugData = debugSnap.exists ? debugSnap.data() : null;

        return NextResponse.json({
            app_id: appId,
            last_oauth_response: debugData,
            header_method_result: headerResult,
            oauth_token: oauthRawToken ? {
                length: oauthRawToken.length,
                preview: oauthRawToken.substring(0, 20) + '...',
                full_token: oauthRawToken, // TEMP: need to see full token to debug
                starts_with_enc: oauthRawToken.startsWith('enc:'),
                api_result: oauthResult,
            } : 'NOT FOUND',
            settings_token: settingsToken ? {
                length: settingsToken.length,
                preview: settingsToken.substring(0, 20) + '...',
                starts_with_enc: settingsToken.startsWith('enc:'),
                api_result: settingsResult,
            } : 'NOT FOUND',
            tokens_match: oauthRawToken === settingsToken,
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
