// scripts/delete-all-imports.ts
import { adminDb } from '../lib/firebase/admin';

async function deleteAllImports() {
    console.log('⏳ Iniciando limpieza de importaciones...');

    if (!adminDb) {
        console.error('❌ Error: Firebase Admin no está configurado. Revisa tus variables de entorno.');
        return;
    }

    try {
        // 1. Delete all order data
        console.log('--- Borrando order_files ---');
        const orderFiles = await adminDb.collection('order_files').get();
        const orderBatch = adminDb.batch();
        orderFiles.forEach(doc => {
            orderBatch.delete(doc.ref);
            console.log(`- Programado para borrar: ${doc.id}`);
        });
        await orderBatch.commit();
        console.log(`✅ ${orderFiles.size} archivos de órdenes eliminados.`);

        // 2. Delete all import logs
        console.log('--- Borrando import_logs ---');
        const importLogs = await adminDb.collection('import_logs').get();
        const logBatch = adminDb.batch();
        importLogs.forEach(doc => {
            logBatch.delete(doc.ref);
            console.log(`- Programado para borrar log: ${doc.id}`);
        });
        await logBatch.commit();
        console.log(`✅ ${importLogs.size} logs de importación eliminados.`);

        console.log('\n✨ Limpieza completada exitosamente. El sistema está listo para nuevas importaciones.');
    } catch (error) {
        console.error('❌ Error durante la limpieza:', error);
    }
}

deleteAllImports();
