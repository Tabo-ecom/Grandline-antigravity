import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';

export async function PUT(req: NextRequest) {
    try {
        if (!adminAuth || !adminDb) {
            return NextResponse.json({ error: 'Firebase Admin no configurado' }, { status: 500 });
        }

        const authHeader = req.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(token);

        const callerDoc = await adminDb.collection('user_profiles').doc(decodedToken.uid).get();
        if (!callerDoc.exists || callerDoc.data()?.role !== 'admin') {
            return NextResponse.json({ error: 'Solo administradores pueden editar usuarios' }, { status: 403 });
        }

        const { userId, role, allowedModules, displayName } = await req.json();

        if (!userId) {
            return NextResponse.json({ error: 'userId es requerido' }, { status: 400 });
        }

        const callerData = callerDoc.data()!;
        const teamId = callerData.team_id || decodedToken.uid;

        const targetDoc = await adminDb.collection('user_profiles').doc(userId).get();
        if (!targetDoc.exists || targetDoc.data()?.team_id !== teamId) {
            return NextResponse.json({ error: 'Usuario no encontrado en tu equipo' }, { status: 404 });
        }

        const updateData: Record<string, any> = { updated_at: new Date() };
        if (role !== undefined) updateData.role = role;
        if (allowedModules !== undefined) updateData.allowed_modules = allowedModules;
        if (displayName !== undefined) updateData.display_name = displayName;

        await adminDb.collection('user_profiles').doc(userId).update(updateData);

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error updating user:', error);
        const msg = error.message || 'Error interno';
        if (msg.includes('Missing or insufficient permissions') || msg.includes('PERMISSION_DENIED')) {
            return NextResponse.json({
                error: 'Error de permisos del servidor. Verifica que la cuenta de servicio de Firebase Admin tenga acceso a Firestore.'
            }, { status: 500 });
        }
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
