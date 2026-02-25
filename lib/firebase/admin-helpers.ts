/**
 * Firebase Admin SDK helpers for server-side operations (cron jobs, API routes)
 * These bypass Firestore security rules, intended only for trusted server code.
 */

import { adminDb } from './admin';

const COLLECTIONS = {
    APP_DATA: 'app_data',
    ORDER_FILES: 'order_files',
} as const;

export async function adminGetAppData<T = any>(key: string, userId: string = ''): Promise<T | null> {
    if (!adminDb) throw new Error('Firebase Admin SDK not configured');

    // Try new format first (key_userId)
    if (userId) {
        const newDoc = await adminDb.collection(COLLECTIONS.APP_DATA).doc(`${key}_${userId}`).get();
        if (newDoc.exists) return newDoc.data()?.value as T;
    }
    // Fallback: legacy doc without userId suffix
    const legacyDoc = await adminDb.collection(COLLECTIONS.APP_DATA).doc(key).get();
    return legacyDoc.exists ? legacyDoc.data()?.value as T : null;
}

export async function adminGetAllOrderFiles(userId: string = '') {
    if (!adminDb) throw new Error('Firebase Admin SDK not configured');

    // Try userId-filtered query first
    if (userId) {
        const snapshot = await adminDb.collection(COLLECTIONS.ORDER_FILES)
            .where('userId', '==', userId).get();
        if (snapshot.docs.length > 0) {
            return snapshot.docs
                .map(d => d.data())
                .sort((a, b) => {
                    const ta = a.uploaded_at?.toMillis?.() || 0;
                    const tb = b.uploaded_at?.toMillis?.() || 0;
                    return tb - ta;
                });
        }
    }
    // Fallback: get all docs
    const fallbackSnap = await adminDb.collection(COLLECTIONS.ORDER_FILES).get();
    return fallbackSnap.docs
        .map(d => d.data())
        .sort((a, b) => {
            const ta = a.uploaded_at?.toMillis?.() || 0;
            const tb = b.uploaded_at?.toMillis?.() || 0;
            return tb - ta;
        });
}

export async function adminSetAppData<T = any>(key: string, value: T, userId: string = ''): Promise<void> {
    if (!adminDb) throw new Error('Firebase Admin SDK not configured');
    if (!userId) throw new Error('userId is required to save app data');
    await adminDb.collection(COLLECTIONS.APP_DATA).doc(`${key}_${userId}`).set({
        key,
        value,
        userId,
        updated_at: new Date(),
    });
}

export async function adminGetAllDocs(collectionName: string, userId: string = '') {
    if (!adminDb) throw new Error('Firebase Admin SDK not configured');

    if (userId) {
        const snapshot = await adminDb.collection(collectionName)
            .where('userId', '==', userId).get();
        if (snapshot.docs.length > 0) {
            return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        }
    }
    const snapshot = await adminDb.collection(collectionName).get();
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}
