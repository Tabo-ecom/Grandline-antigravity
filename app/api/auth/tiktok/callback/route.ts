import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { encrypt } from '@/lib/api/crypto';

/**
 * GET /api/auth/tiktok/callback
 *
 * TikTok OAuth callback — exchanges auth code for access token,
 * stores encrypted token in Firestore, redirects back to Sunny.
 *
 * Query params from TikTok: code, state (userId)
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
        // Exchange auth code for access token
        const tokenRes = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_key: process.env.TIKTOK_CLIENT_KEY || '',
                client_secret: process.env.TIKTOK_CLIENT_SECRET || '',
                code,
                grant_type: 'authorization_code',
                redirect_uri: `${appDomain}/api/auth/tiktok/callback`,
            }),
        });

        const tokenData = await tokenRes.json();

        if (tokenData.error || !tokenData.access_token) {
            console.error('TikTok token exchange failed:', tokenData);
            return NextResponse.redirect(`${appDomain}/sunny?tiktok_error=token_exchange_failed`);
        }

        const {
            access_token,
            refresh_token,
            open_id,
            expires_in,
            refresh_expires_in,
        } = tokenData;

        // Fetch user info to display in UI
        const userInfoRes = await fetch('https://open.tiktokapis.com/v2/user/info/?fields=open_id,avatar_url,display_name', {
            headers: { 'Authorization': `Bearer ${access_token}` },
        });
        const userInfoData = await userInfoRes.json();
        const tiktokUser = userInfoData.data?.user || {};

        // Store TikTok OAuth data encrypted in Firestore
        if (!adminDb) {
            return NextResponse.redirect(`${appDomain}/sunny?tiktok_error=server_not_configured`);
        }

        const docRef = adminDb.collection('app_data').doc(`tiktok_oauth_${state}`);
        await docRef.set({
            key: 'tiktok_oauth',
            userId: state,
            access_token: encrypt(access_token),
            refresh_token: encrypt(refresh_token || ''),
            open_id,
            expires_at: Date.now() + (expires_in * 1000),
            refresh_expires_at: refresh_token ? Date.now() + ((refresh_expires_in || 86400 * 365) * 1000) : null,
            display_name: tiktokUser.display_name || '',
            avatar_url: tiktokUser.avatar_url || '',
            connected_at: new Date(),
            updated_at: new Date(),
        });

        return NextResponse.redirect(`${appDomain}/sunny?tiktok_connected=true`);
    } catch (err) {
        console.error('TikTok OAuth callback error:', err);
        return NextResponse.redirect(`${appDomain}/sunny?tiktok_error=server_error`);
    }
}
