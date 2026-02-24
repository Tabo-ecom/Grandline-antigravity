// scripts/make-admin.ts
import { adminDb, adminAuth } from '../lib/firebase/admin';

async function makeAdmin(email: string) {
    console.log(`⏳ Buscando usuario con email: ${email}...`);

    try {
        if (!adminAuth || !adminDb) {
            console.error('❌ Firebase Admin no está configurado correctamente.');
            return;
        }

        // 1. Try to find the user in Auth
        let uid: string | undefined;
        try {
            const userRecord = await adminAuth.getUserByEmail(email);
            uid = userRecord.uid;
            console.log(`✅ Usuario encontrado en Firebase Auth (UID: ${uid})`);
        } catch (authError: any) {
            if (authError.code === 'auth/user-not-found') {
                console.log('❌ El correo no está registrado en Firebase Authentication.');
                console.log('TIP: Registrate primero en la aplicación (http://localhost:3000/login).');
                return;
            }
            throw authError;
        }

        // 2. Check if the profile document exists, if not create it
        const userRef = adminDb.collection('user_profiles').doc(uid);
        const doc = await userRef.get();

        if (!doc.exists) {
            console.log(`⏳ Creando perfil faltante en Firestore para ${email}...`);
            await userRef.set({
                user_id: uid,
                email: email,
                role: 'admin',
                display_name: email.split('@')[0],
                created_at: new Date().toISOString()
            });
        } else {
            console.log(`⏳ Actualizando rol a administrador...`);
            await userRef.update({
                role: 'admin'
            });
        }

        console.log(`✅ ¡Éxito! El usuario ${email} ahora es ADMINISTRADOR.`);
    } catch (error) {
        console.error('❌ Error al procesar:', error);
    }
}

const email = process.argv[2];
if (!email) {
    console.log('Uso: npx tsx scripts/make-admin.ts tu-email@ejemplo.com');
} else {
    makeAdmin(email);
}
