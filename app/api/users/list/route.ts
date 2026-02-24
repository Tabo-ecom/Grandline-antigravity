import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';

export async function GET(req: NextRequest) {
    try {
        if (!adminAuth || !adminDb) {
            return NextResponse.json({ error: 'Firebase Admin no configurado. Verifica las variables FIREBASE_ADMIN_* en .env.local' }, { status: 500 });
        }

        const authHeader = req.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(token);

        const callerDoc = await adminDb.collection('user_profiles').doc(decodedToken.uid).get();
        if (!callerDoc.exists || callerDoc.data()?.role !== 'admin') {
            return NextResponse.json({ error: 'Solo administradores pueden ver usuarios' }, { status: 403 });
        }

        const callerData = callerDoc.data()!;
        const teamId = callerData.team_id || decodedToken.uid;

        // Auto-migrate: set team_id on admin's profile if missing
        if (!callerData.team_id) {
            await adminDb.collection('user_profiles').doc(decodedToken.uid).update({
                team_id: decodedToken.uid,
            });
        }

        const snapshot = await adminDb.collection('user_profiles')
            .where('team_id', '==', teamId)
            .get();

        const usersMap = new Map<string, any>();
        snapshot.docs.forEach(doc => {
            const data = doc.data();
            usersMap.set(data.user_id || doc.id, {
                user_id: data.user_id || doc.id,
                email: data.email,
                display_name: data.display_name,
                role: data.role,
                allowed_modules: data.allowed_modules || [],
                created_at: data.created_at,
                created_by: data.created_by,
            });
        });

        // Always include the admin themselves (handles case where team_id was just set)
        if (!usersMap.has(decodedToken.uid)) {
            usersMap.set(decodedToken.uid, {
                user_id: callerData.user_id || decodedToken.uid,
                email: callerData.email,
                display_name: callerData.display_name,
                role: callerData.role,
                allowed_modules: callerData.allowed_modules || [],
                created_at: callerData.created_at,
                created_by: callerData.created_by,
            });
        }

        return NextResponse.json({ users: Array.from(usersMap.values()) });
    } catch (error: any) {
        console.error('Error listing users:', error);
        const msg = error.message || 'Error interno';
        if (msg.includes('Missing or insufficient permissions') || msg.includes('PERMISSION_DENIED')) {
            return NextResponse.json({
                error: 'Error de permisos del servidor. Verifica que la cuenta de servicio de Firebase Admin tenga acceso a Firestore (rol Cloud Datastore User o Firebase Admin).'
            }, { status: 500 });
        }
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
