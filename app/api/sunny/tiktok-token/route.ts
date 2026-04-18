import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth, unauthorizedResponse } from '@/lib/api/auth';
import { decryptSettings } from '@/lib/api/crypto';

/**
 * GET /api/sunny/tiktok-token
 * Returns the TikTok access token for authenticated user.
 * Used by client to upload files directly to TikTok (bypasses Vercel 4.5MB body limit).
 */
export async function GET(req: NextRequest) {
    try {
        const auth = await verifyAuth(req);
        if (!auth) return unauthorizedResponse();
        if (!adminDb) return NextResponse.json({ error: 'Server not configured' }, { status: 500 });

        const settingsSnap = await adminDb.collection('app_data').doc(`ad_settings_${auth.teamId}`).get();
        if (!settingsSnap.exists) return NextResponse.json({ error: 'No settings' }, { status: 400 });

        const settings = decryptSettings(settingsSnap.data()?.value || {});
        const token = settings.tt_token;
        if (!token) return NextResponse.json({ error: 'No TikTok token' }, { status: 400 });

        return NextResponse.json({ token });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
