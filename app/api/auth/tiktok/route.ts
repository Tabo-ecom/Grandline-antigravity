import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth, unauthorizedResponse } from '@/lib/api/auth';

/**
 * GET /api/auth/tiktok — Get TikTok connection status
 */
export async function GET(req: NextRequest) {
    try {
        const auth = await verifyAuth(req);
        if (!auth) return unauthorizedResponse();
        if (!adminDb) return NextResponse.json({ error: 'Server not configured' }, { status: 500 });

        const docRef = adminDb.collection('app_data').doc(`tiktok_oauth_${auth.teamId}`);
        const snap = await docRef.get();

        if (!snap.exists) {
            return NextResponse.json({ connected: false });
        }

        const data = snap.data()!;
        const expired = data.expires_at && Date.now() > data.expires_at;

        return NextResponse.json({
            connected: true,
            expired,
            display_name: data.display_name || '',
            avatar_url: data.avatar_url || '',
            open_id: data.open_id || '',
            connected_at: data.connected_at?.toDate?.()?.toISOString() || null,
        });
    } catch (error) {
        console.error('Error reading TikTok status:', error);
        return NextResponse.json({ error: 'Error' }, { status: 500 });
    }
}

/**
 * DELETE /api/auth/tiktok — Disconnect TikTok account
 */
export async function DELETE(req: NextRequest) {
    try {
        const auth = await verifyAuth(req);
        if (!auth) return unauthorizedResponse();
        if (!adminDb) return NextResponse.json({ error: 'Server not configured' }, { status: 500 });

        const docRef = adminDb.collection('app_data').doc(`tiktok_oauth_${auth.teamId}`);
        await docRef.delete();

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error disconnecting TikTok:', error);
        return NextResponse.json({ error: 'Error' }, { status: 500 });
    }
}
