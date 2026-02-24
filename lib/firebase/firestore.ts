import { db } from './config';
import {
    collection,
    doc,
    getDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    getDocs,
    Timestamp,
} from 'firebase/firestore';

// Collection names
export const COLLECTIONS = {
    APP_DATA: 'app_data',
    ORDER_FILES: 'order_files',
    USER_PROFILES: 'user_profiles',
    IMPORT_LOGS: 'import_logs',
} as const;

// App Data helpers
export async function getAppData<T = any>(key: string, userId: string = ''): Promise<T | null> {
    // Try new format first (key_userId), then fall back to legacy format (just key)
    if (userId) {
        const newDocRef = doc(db, COLLECTIONS.APP_DATA, `${key}_${userId}`);
        const newSnap = await getDoc(newDocRef);
        if (newSnap.exists()) return newSnap.data().value as T;
    }
    // Fallback: legacy doc without userId suffix
    const legacyRef = doc(db, COLLECTIONS.APP_DATA, key);
    const legacySnap = await getDoc(legacyRef);
    return legacySnap.exists() ? legacySnap.data().value as T : null;
}

export async function setAppData<T = any>(
    key: string,
    value: T,
    userId: string = ''
): Promise<void> {
    if (!userId) throw new Error("userId is required to save app data");
    const docRef = doc(db, COLLECTIONS.APP_DATA, `${key}_${userId}`);
    await setDoc(docRef, {
        key,
        value,
        userId,
        updated_at: Timestamp.now(),
    });
}

// Order Files helpers
export async function getOrderFile(country: string) {
    const docRef = doc(db, COLLECTIONS.ORDER_FILES, country);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? docSnap.data() : null;
}

export async function getAllOrderFiles(userId: string = '') {
    // Try userId-filtered query first
    if (userId) {
        const q = query(
            collection(db, COLLECTIONS.ORDER_FILES),
            where('userId', '==', userId)
        );
        const snapshot = await getDocs(q);
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
    // Fallback: get all docs (legacy — no userId field)
    const fallbackSnap = await getDocs(collection(db, COLLECTIONS.ORDER_FILES));
    return fallbackSnap.docs
        .map(d => d.data())
        .sort((a, b) => {
            const ta = a.uploaded_at?.toMillis?.() || 0;
            const tb = b.uploaded_at?.toMillis?.() || 0;
            return tb - ta;
        });
}

export async function saveOrderFile(data: {
    userId: string;
    fileName: string;
    country: string;
    orderCount: number;
    orders: any[];
}) {
    // 1. Create a unique log entry
    const logRef = doc(collection(db, COLLECTIONS.IMPORT_LOGS));

    // 2. Save the orders using the SAME unique ID in order_files
    const docRef = doc(db, COLLECTIONS.ORDER_FILES, logRef.id);
    await setDoc(docRef, {
        ...data,
        id: logRef.id, // Include the ID for easier management
        uploaded_at: Timestamp.now(),
    });

    // 3. Save the log entry
    await setDoc(logRef, {
        userId: data.userId,
        fileName: data.fileName,
        country: data.country,
        orderCount: data.orderCount,
        uploaded_at: Timestamp.now(),
    });
}

/**
 * Delete an import log and its associated order data
 */
export async function deleteImportLog(logId: string) {
    // 1. Delete the detailed order data
    await deleteDoc(doc(db, COLLECTIONS.ORDER_FILES, logId));

    // 2. Delete the log entry
    await deleteDoc(doc(db, COLLECTIONS.IMPORT_LOGS, logId));
}

/**
 * Find existing imports that overlap with new orders
 */
export async function findOverlappingImports(userId: string, country: string, newOrderIds: string[]) {
    // Fetch all imports for this user and country
    const q = query(
        collection(db, COLLECTIONS.ORDER_FILES),
        where('userId', '==', userId),
        where('country', '==', country)
    );

    const snapshot = await getDocs(q);
    const existingImports = snapshot.docs.map(doc => ({
        id: doc.id,
        ...(doc.data() as { fileName: string, orders: { ID: string }[] })
    }));

    const results = {
        superseded: [] as { id: string, fileName: string }[], // Old is subset of New (Auto-replace)
        conflicts: [] as { id: string, fileName: string, missingCount: number, commonCount: number }[], // Partial overlap (Ask)
        isSubset: false as boolean | string, // New is subset of Old (Warning: duplicate)
    };

    const newIdsSet = new Set(newOrderIds);

    for (const old of existingImports) {
        const oldIds = old.orders.map(o => o.ID);
        const oldIdsSet = new Set(oldIds);

        const common = oldIds.filter(id => newIdsSet.has(id));
        const missingFromNew = oldIds.filter(id => !newIdsSet.has(id));
        const missingFromOld = newOrderIds.filter(id => !oldIdsSet.has(id));

        if (common.length === 0) continue; // No overlap

        if (missingFromNew.length === 0) {
            // New file contains EVERYTHING from old file (and maybe more)
            results.superseded.push({ id: old.id, fileName: old.fileName });
        } else if (missingFromOld.length === 0) {
            // Old file contains EVERYTHING from new file
            // User is re-uploading a subset of an existing file
            results.isSubset = old.fileName;
        } else {
            // Partial overlap
            results.conflicts.push({
                id: old.id,
                fileName: old.fileName,
                missingCount: missingFromNew.length,
                commonCount: common.length
            });
        }
    }

    return results;
}

/**
 * Get import history for a user or all users
 */
export async function getImportHistory(userId?: string) {
    let q;
    if (userId) {
        q = query(
            collection(db, COLLECTIONS.IMPORT_LOGS),
            where('userId', '==', userId)
        );
    } else {
        q = query(collection(db, COLLECTIONS.IMPORT_LOGS));
    }

    const snapshot = await getDocs(q);
    const logs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        uploaded_at: doc.data().uploaded_at?.toDate?.() || new Date()
    }));

    // Sort by uploaded_at descending (most recent first)
    return logs.sort((a, b) => b.uploaded_at.getTime() - a.uploaded_at.getTime());
}

// User Profile helpers
export async function getUserProfile(userId: string) {
    const docRef = doc(db, COLLECTIONS.USER_PROFILES, userId);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? docSnap.data() : null;
}

export async function createUserProfile(
    userId: string,
    email: string,
    role: 'admin' | 'viewer',
    displayName: string,
    teamId?: string
) {
    const docRef = doc(db, COLLECTIONS.USER_PROFILES, userId);
    await setDoc(docRef, {
        user_id: userId,
        email,
        role,
        display_name: displayName,
        team_id: teamId || userId,
        created_at: Timestamp.now(),
    });
}

export async function updateUserRole(userId: string, role: 'admin' | 'viewer') {
    const docRef = doc(db, COLLECTIONS.USER_PROFILES, userId);
    await updateDoc(docRef, {
        role,
        updated_at: Timestamp.now(),
    });
}

export async function listUsers() {
    const q = query(collection(db, COLLECTIONS.USER_PROFILES));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data());
}

// Territory Carriers CRUD
export interface TerritoryCarrier {
    id?: string;
    carrierName: string;
    country: string;
    coverageCities: string[];
    avgDeliveryDays: number;
    costPerKg: number;
    isActive: boolean;
    createdAt?: any;
}

export async function listCarriers(country?: string): Promise<TerritoryCarrier[]> {
    const colRef = collection(db, 'territory_carriers');
    const q = country
        ? query(colRef, where('country', '==', country))
        : query(colRef);
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as TerritoryCarrier));
}

export async function saveCarrier(carrier: TerritoryCarrier): Promise<string> {
    const colRef = collection(db, 'territory_carriers');
    if (carrier.id) {
        const docRef = doc(db, 'territory_carriers', carrier.id);
        const { id, ...data } = carrier;
        await updateDoc(docRef, { ...data });
        return carrier.id;
    } else {
        const docRef = doc(colRef);
        await setDoc(docRef, { ...carrier, createdAt: Timestamp.now() });
        return docRef.id;
    }
}

export async function deleteCarrier(carrierId: string): Promise<void> {
    await deleteDoc(doc(db, 'territory_carriers', carrierId));
}

// ─── Log Pose Projections ─────────────────────────────────
export interface SavedProjection {
    id?: string;
    userId: string;
    name: string;
    type: 'simulator' | 'calculator';
    params: Record<string, number | string>;
    results: Record<string, number>;
    createdAt?: Timestamp;
}

export async function listProjections(userId: string): Promise<SavedProjection[]> {
    const colRef = collection(db, 'logpose_projections');
    const q = query(colRef, where('userId', '==', userId));
    const snapshot = await getDocs(q);
    const results = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as SavedProjection));
    // Sort client-side to avoid needing a composite Firestore index
    return results.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
}

export async function saveProjection(projection: SavedProjection): Promise<string> {
    const colRef = collection(db, 'logpose_projections');
    const docRef = doc(colRef);
    await setDoc(docRef, { ...projection, createdAt: Timestamp.now() });
    return docRef.id;
}

export async function deleteProjection(projectionId: string): Promise<void> {
    await deleteDoc(doc(db, 'logpose_projections', projectionId));
}
