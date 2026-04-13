import { storage } from '../firebase/config';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

// ── Upload ──────────────────────────────────────────────────────────────────

export async function uploadPurchaseDocument(
    file: File,
    userId: string,
    purchaseId: string
): Promise<{ storagePath: string; downloadUrl: string }> {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `supplier_docs/${userId}/${purchaseId}/${Date.now()}_${safeName}`;
    const storageRef = ref(storage, storagePath);
    await uploadBytes(storageRef, file);
    const downloadUrl = await getDownloadURL(storageRef);
    return { storagePath, downloadUrl };
}

// ── Delete ──────────────────────────────────────────────────────────────────

export async function deletePurchaseDocument(storagePath: string): Promise<void> {
    const storageRef = ref(storage, storagePath);
    await deleteObject(storageRef);
}
