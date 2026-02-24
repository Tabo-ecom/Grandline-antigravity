import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';

export async function POST(req: NextRequest) {
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
            return NextResponse.json({ error: 'Solo administradores pueden crear usuarios' }, { status: 403 });
        }

        const { email, password, displayName, role, allowedModules } = await req.json();

        if (!email || !password || !displayName) {
            return NextResponse.json({ error: 'Faltan campos requeridos (email, password, displayName)' }, { status: 400 });
        }

        if (password.length < 6) {
            return NextResponse.json({ error: 'La contraseña debe tener al menos 6 caracteres' }, { status: 400 });
        }

        const userRecord = await adminAuth.createUser({
            email,
            password,
            displayName,
        });

        const callerData = callerDoc.data()!;
        const teamId = callerData.team_id || decodedToken.uid;

        await adminDb.collection('user_profiles').doc(userRecord.uid).set({
            user_id: userRecord.uid,
            email,
            role: role || 'viewer',
            display_name: displayName,
            team_id: teamId,
            allowed_modules: allowedModules || [],
            created_by: decodedToken.uid,
            created_at: new Date(),
        });

        return NextResponse.json({
            success: true,
            user: {
                uid: userRecord.uid,
                email,
                displayName,
                role: role || 'viewer',
                allowed_modules: allowedModules || [],
            },
        });
    } catch (error: any) {
        console.error('Error creating user:', error);
        if (error.code === 'auth/email-already-exists') {
            return NextResponse.json({ error: 'Este email ya está registrado' }, { status: 409 });
        }
        if (error.code === 'auth/invalid-email') {
            return NextResponse.json({ error: 'Email inválido' }, { status: 400 });
        }
        const msg = error.message || 'Error interno';
        if (msg.includes('Missing or insufficient permissions') || msg.includes('PERMISSION_DENIED')) {
            return NextResponse.json({
                error: 'Error de permisos del servidor. Verifica que la cuenta de servicio de Firebase Admin tenga acceso a Firestore.'
            }, { status: 500 });
        }
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
