// scripts/init-firestore.ts
import { adminDb } from '../lib/firebase/admin';

async function initializeFirestore() {
    console.log('⏳ Iniciando inicialización de Firestore...');

    if (!adminDb) {
        console.error('❌ Error: Firebase Admin no está configurado. Revisa tus variables de entorno.');
        return;
    }

    try {
        // Create app_data collection with settings
        await adminDb.collection('app_data').doc('ad_settings').set({
            key: 'ad_settings',
            value: {
                fb_token: '',
                fb_account_id: '',
                tt_token: '',
                tt_account_id: '',
            },
            updated_by: 'system',
            updated_at: new Date().toISOString(),
        });

        // Create product_mappings
        await adminDb.collection('app_data').doc('product_mappings').set({
            key: 'product_mappings',
            value: {},
            updated_by: 'system',
            updated_at: new Date().toISOString(),
        });

        // Create campaign_mappings
        await adminDb.collection('app_data').doc('campaign_mappings').set({
            key: 'campaign_mappings',
            value: {},
            updated_by: 'system',
            updated_at: new Date().toISOString(),
        });

        console.log('✅ Firestore inicializado correctamente');
    } catch (error) {
        console.error('❌ Error al inicializar Firestore:', error);
        console.log('\nSUGERENCIA: Asegúrate de que las variables FIREBASE_ADMIN_* en .env.local sean correctas.');
    }
}

initializeFirestore();
