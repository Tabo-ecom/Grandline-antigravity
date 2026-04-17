import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth, unauthorizedResponse } from '@/lib/api/auth';
import { decryptSettings } from '@/lib/api/crypto';

/**
 * GET /api/auth/tiktok/debug — Debug TikTok connection state
 */
export async function GET(req: NextRequest) {
    try {
        const auth = await verifyAuth(req);
        if (!auth) return unauthorizedResponse();
        if (!adminDb) return NextResponse.json({ error: 'No DB' }, { status: 500 });

        // Check tiktok_oauth doc
        const oauthSnap = await adminDb.collection('app_data').doc(`tiktok_oauth_${auth.teamId}`).get();
        const oauthData = oauthSnap.exists ? oauthSnap.data() : null;

        // Check ad_settings doc
        const settingsSnap = await adminDb.collection('app_data').doc(`ad_settings_${auth.teamId}`).get();
        let settingsData: any = null;
        if (settingsSnap.exists) {
            const raw = settingsSnap.data()?.value;
            if (raw) {
                const decrypted = decryptSettings(raw);
                settingsData = {
                    has_tt_token: !!decrypted.tt_token,
                    tt_token_length: decrypted.tt_token?.length || 0,
                    tt_account_ids: decrypted.tt_account_ids || [],
                    has_fb_token: !!decrypted.fb_token,
                    fb_account_ids_count: decrypted.fb_account_ids?.length || 0,
                };
            }
        }

        return NextResponse.json({
            teamId: auth.teamId,
            oauth: oauthData ? {
                has_access_token: !!oauthData.access_token,
                advertiser_ids: oauthData.advertiser_ids || [],
                connected_at: oauthData.connected_at,
            } : null,
            settings: settingsData,
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
