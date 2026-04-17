import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForTokens, getMeliUser } from '@/lib/services/mercadolibre';
import { adminDb } from '@/lib/firebase/admin';

/**
 * OAuth callback from MercadoLibre.
 * Exchanges code for tokens, fetches user info, saves to Firestore.
 * Redirects back to settings page.
 */
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error || !code) {
        return NextResponse.redirect(new URL('/settings?meli=error', req.url));
    }

    try {
        // Exchange code for tokens
        const tokens = await exchangeCodeForTokens(code);

        // Get user info from MeLi
        const meliUser = await getMeliUser(tokens.access_token);

        // Save to Firestore — we need to link this to the Grand Line user
        // For now, save by MeLi user ID and the GL user will claim it
        if (adminDb) {
            await adminDb.collection('meli_connections').doc(String(tokens.user_id)).set({
                access_token: tokens.access_token,
                refresh_token: tokens.refresh_token,
                user_id: tokens.user_id,
                expires_at: tokens.expires_at,
                nickname: meliUser.nickname,
                email: meliUser.email,
                first_name: meliUser.first_name,
                last_name: meliUser.last_name,
                seller_level: meliUser.seller_reputation?.level_id || '',
                connected_at: Date.now(),
                updated_at: Date.now(),
            }, { merge: true });
        }

        // Redirect back to settings with success
        return NextResponse.redirect(new URL(`/settings?meli=connected&meli_user=${meliUser.nickname}`, req.url));
    } catch (err: any) {
        console.error('MeLi callback error:', err.message);
        return NextResponse.redirect(new URL(`/settings?meli=error&msg=${encodeURIComponent(err.message)}`, req.url));
    }
}
