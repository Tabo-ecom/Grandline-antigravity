
import { getAppData, setAppData } from '../firebase/firestore';

export interface ProductGroup {
    id: string; // Group name (e.g., "TESTEO")
    name: string; // Display name
    productIds: string[]; // Array of product IDs in this group
    country?: string; // Optional country filter
    color?: string; // Optional color for UI
    updatedAt: number;
}

/**
 * Product Group Services
 */
export async function getProductGroups(userId: string = ''): Promise<ProductGroup[]> {
    if (!userId) return [];
    const data = await getAppData<ProductGroup[]>('product_groups', userId);
    return Array.isArray(data) ? data : [];
}

export async function saveProductGroup(group: ProductGroup, userId: string) {
    if (!userId) return;
    const current = await getProductGroups(userId);
    const filtered = current.filter(g => g.id !== group.id);
    await setAppData('product_groups', [...filtered, group], userId);
}

export async function deleteProductGroup(groupId: string, userId: string) {
    if (!userId) return;
    const current = await getProductGroups(userId);
    const filtered = current.filter(g => g.id !== groupId);
    await setAppData('product_groups', filtered, userId);
}

export function getProductGroup(productId: string, groups: ProductGroup[]): ProductGroup | null {
    if (!productId) return null;
    const searchId = productId.toLowerCase().trim();
    return groups.find(g =>
        g.productIds.some(id => id.toLowerCase().trim() === searchId)
    ) || null;
}

export function getEffectiveProductId(productId: string, groups: ProductGroup[]): string {
    const group = getProductGroup(productId, groups);
    return group ? group.id : productId;
}
