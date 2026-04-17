import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse } from '@/lib/api/auth';
import { getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

export async function GET(req: NextRequest) {
    try {
        const auth = await verifyAuth(req);
        if (!auth) return unauthorizedResponse();

        if (!getApps().length) {
            return NextResponse.json({ error: 'Admin not initialized' }, { status: 500 });
        }

        const db = getFirestore();
        const snap = await db.collection('fcm_tokens').get();
        const tokens = snap.docs.map(d => ({
            userId: d.id,
            tokenPrefix: (d.data().token || '').slice(0, 30) + '...',
            updatedAt: d.data().updated_at,
            userAgent: (d.data().user_agent || '').slice(0, 50),
        }));

        return NextResponse.json({
            adminInitialized: true,
            totalTokens: tokens.length,
            tokens,
        });
    } catch (error: any) {
        return NextResponse.json({ error: error?.message }, { status: 500 });
    }
}
