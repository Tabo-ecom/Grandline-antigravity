import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { decrypt, encryptSettings, decryptSettings } from '@/lib/api/crypto';

const META_API_VERSION = 'v21.0';

/**
 * GET /api/auth/facebook/callback — Handle Facebook OAuth callback
 *
 * 1. Validate CSRF state
 * 2. Exchange code for short-lived token
 * 3. Exchange for long-lived token (60 days)
 * 4. Auto-fetch ad accounts
 * 5. Save encrypted token + accounts to Firestore
 * 6. Redirect to /settings?fb=connected
 */
export async function GET(req: NextRequest) {
    const { searchParams } = req.nextUrl;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const origin = req.nextUrl.origin;

    // User denied permissions
    if (error) {
        return NextResponse.redirect(`${origin}/settings?fb=denied`);
    }

    if (!code || !state) {
        return NextResponse.redirect(`${origin}/settings?fb=error&reason=missing_params`);
    }

    // ─── Validate CSRF ────────────────────────────────────────────────
    const csrfCookie = req.cookies.get('fb_oauth_state')?.value;
    if (!csrfCookie) {
        return NextResponse.redirect(`${origin}/settings?fb=error&reason=csrf_expired`);
    }

    // Decrypt state to extract user context
    let stateData: { csrf: string; uid: string; teamId: string; ts: number };
    try {
        const decryptedState = decrypt(state);
        stateData = JSON.parse(decryptedState);
    } catch {
        return NextResponse.redirect(`${origin}/settings?fb=error&reason=invalid_state`);
    }

    // Verify CSRF token matches cookie
    if (stateData.csrf !== csrfCookie) {
        return NextResponse.redirect(`${origin}/settings?fb=error&reason=csrf_mismatch`);
    }

    // Check state is not too old (15 min)
    if (Date.now() - stateData.ts > 15 * 60 * 1000) {
        return NextResponse.redirect(`${origin}/settings?fb=error&reason=state_expired`);
    }

    const appId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID;
    const appSecret = process.env.FACEBOOK_APP_SECRET;

    if (!appId || !appSecret) {
        return NextResponse.redirect(`${origin}/settings?fb=error&reason=server_config`);
    }

    const redirectUri = `${origin}/api/auth/facebook/callback`;

    try {
        // ─── Step 1: Exchange code for short-lived token ──────────────
        const tokenUrl = new URL(`https://graph.facebook.com/${META_API_VERSION}/oauth/access_token`);
        tokenUrl.searchParams.set('client_id', appId);
        tokenUrl.searchParams.set('redirect_uri', redirectUri);
        tokenUrl.searchParams.set('client_secret', appSecret);
        tokenUrl.searchParams.set('code', code);

        const tokenRes = await fetch(tokenUrl.toString());
        const tokenData = await tokenRes.json();

        if (tokenData.error) {
            console.error('Facebook token exchange error:', tokenData.error);
            return NextResponse.redirect(`${origin}/settings?fb=error&reason=token_exchange`);
        }

        const shortLivedToken = tokenData.access_token;

        // ─── Step 2: Exchange for long-lived token (60 days) ──────────
        const longTokenUrl = new URL(`https://graph.facebook.com/${META_API_VERSION}/oauth/access_token`);
        longTokenUrl.searchParams.set('grant_type', 'fb_exchange_token');
        longTokenUrl.searchParams.set('client_id', appId);
        longTokenUrl.searchParams.set('client_secret', appSecret);
        longTokenUrl.searchParams.set('fb_exchange_token', shortLivedToken);

        const longTokenRes = await fetch(longTokenUrl.toString());
        const longTokenData = await longTokenRes.json();

        const accessToken = longTokenData.access_token || shortLivedToken;

        // ─── Step 3: Auto-fetch ad accounts ───────────────────────────
        const accountsUrl = `https://graph.facebook.com/${META_API_VERSION}/me/adaccounts?fields=name,account_id,currency&access_token=${accessToken}&limit=100`;
        const accountsRes = await fetch(accountsUrl);
        const accountsData = await accountsRes.json();

        const adAccounts = (accountsData.data || []).map((acc: any) => ({
            id: acc.id,
            name: acc.name || acc.account_id,
        }));

        // Detect currency from first account
        const detectedCurrency = accountsData.data?.[0]?.currency || 'USD';

        // ─── Step 4: Save to Firestore ────────────────────────────────
        if (!adminDb) {
            return NextResponse.redirect(`${origin}/settings?fb=error&reason=server_config`);
        }

        const teamId = stateData.teamId;
        const settingsDocId = `ad_settings_${teamId}`;
        const docRef = adminDb.collection('app_data').doc(settingsDocId);

        // Read existing settings to preserve TikTok config, AI settings, etc.
        let existingSettings: Record<string, any> = {};
        const existingSnap = await docRef.get();
        if (existingSnap.exists) {
            const raw = existingSnap.data()?.value;
            if (raw) {
                existingSettings = decryptSettings(raw);
            }
        }

        // Merge: update Facebook fields, keep everything else
        const updatedSettings = {
            ...existingSettings,
            fb_token: accessToken,
            fb_account_ids: adAccounts,
            fb_currency: detectedCurrency,
        };

        const encrypted = encryptSettings(updatedSettings);

        await docRef.set({
            key: 'ad_settings',
            value: encrypted,
            userId: teamId,
            updated_at: new Date(),
        });

        // ─── Step 5: Redirect with success ────────────────────────────
        const response = NextResponse.redirect(`${origin}/settings?fb=connected`);
        // Clear the CSRF cookie
        response.cookies.set('fb_oauth_state', '', { maxAge: 0, path: '/' });
        return response;

    } catch (err: any) {
        console.error('Facebook OAuth callback error:', err);
        return NextResponse.redirect(`${origin}/settings?fb=error&reason=unknown`);
    }
}
