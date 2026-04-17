import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse } from '@/lib/api/auth';
import { adminDb } from '@/lib/firebase/admin';
import { getMeliOrders, refreshAccessToken } from '@/lib/services/mercadolibre';

export async function GET(req: NextRequest) {
    try {
        const auth = await verifyAuth(req);
        if (!auth) return unauthorizedResponse();
        if (!adminDb) return NextResponse.json({ error: 'Admin not initialized' }, { status: 500 });

        const { searchParams } = new URL(req.url);
        const dateFrom = searchParams.get('from') || '';
        const dateTo = searchParams.get('to') || '';
        const status = searchParams.get('status') || '';
        const limit = parseInt(searchParams.get('limit') || '50');
        const offset = parseInt(searchParams.get('offset') || '0');

        // Get MeLi connection for this team
        const connectionsSnap = await adminDb.collection('meli_connections').get();
        if (connectionsSnap.empty) {
            return NextResponse.json({ error: 'MercadoLibre no conectado' }, { status: 400 });
        }

        // Use first connection (can extend to multi-account later)
        const connDoc = connectionsSnap.docs[0];
        let conn = connDoc.data();

        // Refresh token if expired
        if (conn.expires_at && conn.expires_at < Date.now()) {
            try {
                const newTokens = await refreshAccessToken(conn.refresh_token);
                await adminDb.collection('meli_connections').doc(connDoc.id).update({
                    access_token: newTokens.access_token,
                    refresh_token: newTokens.refresh_token,
                    expires_at: newTokens.expires_at,
                    updated_at: Date.now(),
                });
                conn = { ...conn, ...newTokens };
            } catch (err: any) {
                return NextResponse.json({ error: 'Token expirado, reconecta MercadoLibre', detail: err.message }, { status: 401 });
            }
        }

        const orders = await getMeliOrders(conn.access_token, conn.user_id, {
            dateFrom, dateTo, status, limit, offset,
        });

        return NextResponse.json(orders);
    } catch (error: any) {
        return NextResponse.json({ error: error.message || 'Error obteniendo ordenes' }, { status: 500 });
    }
}
