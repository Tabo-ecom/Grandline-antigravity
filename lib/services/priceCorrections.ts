import { getAppData, setAppData } from '../firebase/firestore';

// ── Types ───────────────────────────────────────────────────────────────────

export interface PriceCorrection {
    id: string;
    productId: string;           // PRODUCTO_ID (effective, post-group resolution)
    productName: string;         // Display name
    originalUnitPrice: number;   // The wrong unit price to match (e.g., 3000) — in COP
    correctedUnitPrice: number;  // The correct unit price (e.g., 7000) — in COP
    country?: string;            // Optional: limit to a specific country
    createdAt: number;
}

const CORRECTIONS_KEY = 'price_corrections';

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Get the effective unit price from an order (PRECIO PROVEEDOR X CANTIDAD / CANTIDAD) */
export function getSupplierUnitPrice(order: {
    "PRECIO PROVEEDOR"?: number;
    "PRECIO PROVEEDOR X CANTIDAD"?: number;
    CANTIDAD?: number;
}): number {
    const totalCost = order["PRECIO PROVEEDOR X CANTIDAD"] || 0;
    const unitCost = order["PRECIO PROVEEDOR"] || 0;
    const qty = order.CANTIDAD || 1;

    // Prefer deriving from total cost (since parser only maps PRECIO PROVEEDOR X CANTIDAD)
    if (totalCost > 0) return Math.round(totalCost / qty);
    return Math.round(unitCost);
}

// ── CRUD Functions ──────────────────────────────────────────────────────────

export async function getPriceCorrections(userId: string): Promise<PriceCorrection[]> {
    if (!userId) return [];
    const data = await getAppData<PriceCorrection[]>(CORRECTIONS_KEY, userId);
    return Array.isArray(data) ? data : [];
}

export async function savePriceCorrection(correction: PriceCorrection, userId: string): Promise<void> {
    if (!userId) return;
    const current = await getPriceCorrections(userId);
    const filtered = current.filter(c => c.id !== correction.id);
    await setAppData(CORRECTIONS_KEY, [...filtered, correction], userId);
}

export async function deletePriceCorrection(id: string, userId: string): Promise<void> {
    if (!userId) return;
    const current = await getPriceCorrections(userId);
    const filtered = current.filter(c => c.id !== id);
    await setAppData(CORRECTIONS_KEY, filtered, userId);
}

// ── Apply Logic ─────────────────────────────────────────────────────────────

/**
 * Apply price corrections to orders in-place.
 * Called in useDashboardData after currency conversion, before caching.
 * Matches by productId + unit price derived from PRECIO PROVEEDOR X CANTIDAD / CANTIDAD.
 */
export function applyPriceCorrections<T extends {
    PRODUCTO_ID?: string | number;
    "PRECIO PROVEEDOR"?: number;
    "PRECIO PROVEEDOR X CANTIDAD"?: number;
    CANTIDAD?: number;
    country?: string;
}>(orders: T[], corrections: PriceCorrection[]): T[] {
    if (!corrections.length) return orders;

    // Build lookup: productId → corrections[]
    const lookup = new Map<string, PriceCorrection[]>();
    for (const c of corrections) {
        const existing = lookup.get(c.productId) || [];
        existing.push(c);
        lookup.set(c.productId, existing);
    }

    for (const order of orders) {
        const pid = order.PRODUCTO_ID?.toString() || '';
        const productCorrections = lookup.get(pid);
        if (!productCorrections) continue;

        const unitPrice = getSupplierUnitPrice(order);
        const qty = order.CANTIDAD || 1;

        for (const corr of productCorrections) {
            // Country filter
            if (corr.country && order.country !== corr.country) continue;

            // Match unit price with ±1 tolerance for currency conversion rounding
            if (Math.abs(unitPrice - corr.originalUnitPrice) <= 1) {
                order["PRECIO PROVEEDOR"] = corr.correctedUnitPrice;
                order["PRECIO PROVEEDOR X CANTIDAD"] = corr.correctedUnitPrice * qty;
                break; // Only one correction per order
            }
        }
    }

    return orders;
}
