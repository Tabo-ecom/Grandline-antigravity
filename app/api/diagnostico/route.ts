import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export async function POST(req: NextRequest) {
    try {
        if (!adminDb) {
            return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
        }

        const body = await req.json();
        const { name, email, whatsapp, survey, metrics, country, productCount, dateRange } = body;

        if (!name || !email) {
            return NextResponse.json({ error: 'Nombre y email son requeridos' }, { status: 400 });
        }

        await adminDb.collection('diagnostic_leads').add({
            name,
            email,
            whatsapp: whatsapp || '',
            survey: survey || {},
            metrics: metrics || {},
            country: country || '',
            productCount: productCount || 0,
            dateRange: dateRange || '',
            createdAt: new Date().toISOString(),
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[Diagnostico API] Error:', error);
        return NextResponse.json({ error: 'Error guardando datos' }, { status: 500 });
    }
}
