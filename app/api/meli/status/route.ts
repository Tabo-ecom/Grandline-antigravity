import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse } from '@/lib/api/auth';
import { adminDb } from '@/lib/firebase/admin';

export async function GET(req: NextRequest) {
    try {
        const auth = await verifyAuth(req);
        if (!auth) return unauthorizedResponse();
        if (!adminDb) return NextResponse.json({ connected: false });

        const snap = await adminDb.collection('meli_connections').get();
        if (snap.empty) return NextResponse.json({ connected: false });

        const connections = snap.docs.map(d => {
            const data = d.data();
            return {
                user_id: data.user_id,
                nickname: data.nickname,
                email: data.email,
                seller_level: data.seller_level,
                connected_at: data.connected_at,
                token_valid: data.expires_at > Date.now(),
            };
        });

        return NextResponse.json({ connected: true, connections });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
