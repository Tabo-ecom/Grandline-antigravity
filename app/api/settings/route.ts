import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth, unauthorizedResponse } from '@/lib/api/auth';
import { encryptSettings, decryptSettings } from '@/lib/api/crypto';

const COLLECTION = 'app_data';

function docId(userId: string) {
    return `ad_settings_${userId}`;
}

/**
 * GET /api/settings — Read ad settings (tokens decrypted server-side)
 */
export async function GET(req: NextRequest) {
    try {
        const auth = await verifyAuth(req);
        if (!auth) return unauthorizedResponse();
        if (!adminDb) return NextResponse.json({ error: 'Server not configured' }, { status: 500 });

        const docRef = adminDb.collection(COLLECTION).doc(docId(auth.teamId));
        const snap = await docRef.get();

        if (!snap.exists) {
            return NextResponse.json({ settings: null });
        }

        const raw = snap.data()?.value;
        if (!raw) return NextResponse.json({ settings: null });

        const decrypted = decryptSettings(raw);
        return NextResponse.json({ settings: decrypted });
    } catch (error) {
        console.error('Error reading settings:', error);
        return NextResponse.json({ error: 'Error al leer configuración' }, { status: 500 });
    }
}

/**
 * POST /api/settings — Save ad settings (tokens encrypted server-side)
 */
export async function POST(req: NextRequest) {
    try {
        const auth = await verifyAuth(req);
        if (!auth) return unauthorizedResponse();
        if (!adminDb) return NextResponse.json({ error: 'Server not configured' }, { status: 500 });

        const { settings } = await req.json();
        if (!settings) {
            return NextResponse.json({ error: 'Settings required' }, { status: 400 });
        }

        const encrypted = encryptSettings(settings);

        const docRef = adminDb.collection(COLLECTION).doc(docId(auth.teamId));
        await docRef.set({
            key: 'ad_settings',
            value: encrypted,
            userId: auth.teamId,
            updated_at: new Date(),
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error saving settings:', error);
        return NextResponse.json({ error: 'Error al guardar configuración' }, { status: 500 });
    }
}
