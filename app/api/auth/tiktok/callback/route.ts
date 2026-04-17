import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { encrypt, encryptSettings, decryptSettings } from '@/lib/api/crypto';

/**
 * GET /api/auth/tiktok/callback
 *
 * TikTok OAuth callback — exchanges auth code for access token.
 * Works for both Login Kit and Marketing API.
 * Stores token in tiktok_oauth doc AND in ad_settings (for Lanzador).
 */
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state'); // userId passed during OAuth init
    const error = searchParams.get('error');

    const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN || 'https://app.grandline.com.co';

    if (error || !code || !state) {
        return NextResponse.redirect(`${appDomain}/sunny?tiktok_error=${error || 'missing_params'}`);
    }

    try {
        // Exchange auth code for access token (Marketing API endpoint)
        const tokenRes = await fetch('https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                app_id: process.env.TIKTOK_CLIENT_KEY || '',
                secret: process.env.TIKTOK_CLIENT_SECRET || '',
                auth_code: code,
            }),
        });

        const tokenText = await tokenRes.text();
        console.log('[TikTok Callback] Raw token response:', tokenText);

        let tokenData: any;
        try { tokenData = JSON.parse(tokenText); } catch {
            console.error('[TikTok Callback] Invalid JSON:', tokenText);
            return NextResponse.redirect(`${appDomain}/settings?tiktok_error=invalid_response`);
        }

        if (tokenData.code !== 0 || !tokenData.data?.access_token) {
            console.error('TikTok token exchange failed:', tokenData);
            // Return JSON for debugging instead of redirect
            return NextResponse.json({
                error: 'Token exchange failed',
                tiktok_response: tokenData,
                app_id_used: process.env.TIKTOK_CLIENT_KEY,
                secret_length: (process.env.TIKTOK_CLIENT_SECRET || '').length,
            });
        }

        const {
            access_token,
            advertiser_ids,
        } = tokenData.data;

        // Store raw response for debugging
        if (adminDb) {
            await adminDb.collection('app_data').doc(`tiktok_debug_${state}`).set({
                raw_response: tokenText,
                parsed_data: tokenData.data,
                access_token_length: access_token?.length,
                timestamp: new Date(),
            });
        }

        if (!adminDb) {
            return NextResponse.redirect(`${appDomain}/sunny?tiktok_error=server_not_configured`);
        }

        // Fetch advertiser names
        let ttAccountIds: { id: string; name: string }[] = [];
        if (advertiser_ids?.length) {
            try {
                const idsParam = encodeURIComponent(JSON.stringify(advertiser_ids.map((id: any) => id.toString())));
                const fieldsParam = encodeURIComponent(JSON.stringify(["advertiser_id", "name"]));
                const accRes = await fetch(`https://business-api.tiktok.com/open_api/v1.3/advertiser/info/?advertiser_ids=${idsParam}&fields=${fieldsParam}`, {
                    headers: { 'Access-Token': access_token },
                });
                const accData = await accRes.json();
                if (accData.code === 0 && accData.data?.list) {
                    ttAccountIds = accData.data.list.map((a: any) => ({
                        id: a.advertiser_id?.toString() || '',
                        name: a.name || `Ad Account ${a.advertiser_id}`,
                    }));
                }
            } catch (e) {
                console.error('Error fetching advertiser info:', e);
                ttAccountIds = advertiser_ids.map((id: any) => ({ id: id.toString(), name: `Ad Account ${id}` }));
            }
        }

        // Store TikTok OAuth data
        const oauthRef = adminDb.collection('app_data').doc(`tiktok_oauth_${state}`);
        await oauthRef.set({
            key: 'tiktok_oauth',
            userId: state,
            access_token: encrypt(access_token),
            advertiser_ids: advertiser_ids || [],
            connected_at: new Date(),
            updated_at: new Date(),
        });

        // Also save token in ad_settings so the Lanzador can use it
        const settingsRef = adminDb.collection('app_data').doc(`ad_settings_${state}`);
        const settingsSnap = await settingsRef.get();
        let currentSettings: Record<string, any> = {};

        if (settingsSnap.exists) {
            const raw = settingsSnap.data()?.value;
            if (raw) currentSettings = decryptSettings(raw);
        }

        currentSettings.tt_token = access_token;
        currentSettings.tt_account_ids = ttAccountIds;

        await settingsRef.set({
            key: 'ad_settings',
            value: encryptSettings(currentSettings),
            userId: state,
            updated_at: new Date(),
        });

        return NextResponse.redirect(`${appDomain}/settings?tiktok_connected=true`);
    } catch (err) {
        console.error('TikTok OAuth callback error:', err);
        return NextResponse.redirect(`${appDomain}/sunny?tiktok_error=server_error`);
    }
}
