import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse } from '@/lib/api/auth';

/**
 * GET /api/auth/tiktok/url
 * Generates TikTok OAuth URL server-side (avoids NEXT_PUBLIC_ env issues)
 */
export async function GET(req: NextRequest) {
    const auth = await verifyAuth(req);
    if (!auth) return unauthorizedResponse();

    const appId = process.env.TIKTOK_CLIENT_KEY || '';
    const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN || 'https://app.grandline.com.co';
    const redirectUri = `${appDomain}/api/auth/tiktok/callback`;

    const params = new URLSearchParams({
        app_id: appId,
        redirect_uri: redirectUri,
        state: auth.teamId,
    });

    const url = `https://business-api.tiktok.com/portal/auth?${params.toString()}`;
    return NextResponse.json({ url });
}
