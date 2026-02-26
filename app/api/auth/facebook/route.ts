import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import crypto from 'crypto';
import { encrypt } from '@/lib/api/crypto';

const META_API_VERSION = 'v21.0';
const SCOPES = 'ads_management,ads_read,business_management';

/**
 * GET /api/auth/facebook — Initiate Facebook OAuth flow
 *
 * Reads Firebase ID token from cookie (set by client before redirect),
 * generates CSRF state, and redirects user to Facebook's authorization dialog.
 */
export async function GET(req: NextRequest) {
    const appId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID;
    if (!appId) {
        return NextResponse.json(
            { error: 'NEXT_PUBLIC_FACEBOOK_APP_ID no configurado' },
            { status: 500 }
        );
    }

    // Verify user via Firebase token stored in cookie
    const fbAuthToken = req.cookies.get('fb_auth_token')?.value;
    if (!fbAuthToken || !adminAuth) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    let uid: string;
    let teamId: string;
    try {
        const decoded = await adminAuth.verifyIdToken(fbAuthToken);
        uid = decoded.uid;
        teamId = uid;
        // Resolve team_id
        if (adminDb) {
            try {
                const profileDoc = await adminDb.collection('user_profiles').doc(uid).get();
                const profileData = profileDoc.data();
                if (profileData?.team_id) teamId = profileData.team_id;
            } catch {}
        }
    } catch {
        return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    // Generate CSRF token
    const csrfToken = crypto.randomBytes(32).toString('hex');

    // Build state payload with user context + CSRF
    const statePayload = JSON.stringify({
        csrf: csrfToken,
        uid,
        teamId,
        ts: Date.now(),
    });
    const encryptedState = encrypt(statePayload);

    // Build redirect URI from request origin
    const origin = req.nextUrl.origin;
    const redirectUri = `${origin}/api/auth/facebook/callback`;

    // Build Facebook authorization URL
    const fbAuthUrl = new URL(`https://www.facebook.com/${META_API_VERSION}/dialog/oauth`);
    fbAuthUrl.searchParams.set('client_id', appId);
    fbAuthUrl.searchParams.set('redirect_uri', redirectUri);
    fbAuthUrl.searchParams.set('scope', SCOPES);
    fbAuthUrl.searchParams.set('state', encryptedState);
    fbAuthUrl.searchParams.set('response_type', 'code');

    // Set state cookie for validation in callback, clear auth token cookie
    const response = NextResponse.redirect(fbAuthUrl.toString());
    response.cookies.set('fb_oauth_state', csrfToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 15, // 15 minutes
        path: '/',
    });
    // Clear the temporary auth token cookie
    response.cookies.set('fb_auth_token', '', { maxAge: 0, path: '/' });

    return response;
}
