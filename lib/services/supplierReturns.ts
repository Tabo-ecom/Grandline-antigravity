import { getAppData, setAppData } from '../firebase/firestore';
import type { SupplierOrder } from '../utils/supplierParser';
import type { RawReturn } from '../utils/supplierParser';
import { isDevolucion } from '../utils/status';

// ── Types ───────────────────────────────────────────────────────────────────

export interface SupplierReturn {
    id: string;
    idDropi: string;
    fechaRecibido: string;
    producto: string;            // Name from returns file
    productoId?: string;         // Resolved from supplier orders
    variacionId?: string;
    variacion?: string;
    cantidad: number;            // Resolved from supplier order
    transportadora: string;
    guiaInicial: string;
    telefono: string;
    addedToInventory: boolean;
    createdAt: number;
}

export interface UnreportedReturn {
    orderId: string;
    producto: string;
    productoId: string;
    variacionId: string;
    variacion: string;
    cantidad: number;
    fecha: string;
    transportadora: string;
    numeroGuia: string;
}

const RETURNS_KEY = 'supplier_returns';

// ── CRUD ────────────────────────────────────────────────────────────────────

export async function getReturns(userId: string): Promise<SupplierReturn[]> {
    if (!userId) return [];
    const data = await getAppData<SupplierReturn[]>(RETURNS_KEY, userId);
    return Array.isArray(data) ? data : [];
}

export async function saveReturn(ret: SupplierReturn, userId: string): Promise<void> {
    if (!userId) return;
    const current = await getReturns(userId);
    const filtered = current.filter(r => r.id !== ret.id);
    await setAppData(RETURNS_KEY, [...filtered, ret], userId);
}

export async function deleteReturn(returnId: string, userId: string): Promise<void> {
    if (!userId) return;
    const current = await getReturns(userId);
    const filtered = current.filter(r => r.id !== returnId);
    await setAppData(RETURNS_KEY, filtered, userId);
}

export async function bulkImportReturns(
    newReturns: SupplierReturn[],
    userId: string
): Promise<{ imported: number; skipped: number }> {
    if (!userId) return { imported: 0, skipped: 0 };
    const current = await getReturns(userId);
    const existingIds = new Set(current.map(r => r.idDropi));

    const toImport = newReturns.filter(r => r.idDropi && !existingIds.has(r.idDropi));
    const skipped = newReturns.length - toImport.length;

    if (toImport.length > 0) {
        await setAppData(RETURNS_KEY, [...current, ...toImport], userId);
    }

    return { imported: toImport.length, skipped };
}

// ── Resolution ──────────────────────────────────────────────────────────────

/**
 * Resolve raw returns from the CONTROL TICKETS file against supplier orders.
 * Matches by ID DROPI to find the exact product, variation, and quantity.
 */
export function resolveReturnProducts(
    rawReturns: RawReturn[],
    supplierOrders: SupplierOrder[]
): SupplierReturn[] {
    // Build lookup: order ID → order lines (an order can have multiple product lines)
    const orderLookup = new Map<string, SupplierOrder[]>();
    for (const order of supplierOrders) {
        const existing = orderLookup.get(order.ID) || [];
        existing.push(order);
        orderLookup.set(order.ID, existing);
    }

    const now = Date.now();
    return rawReturns
        .filter(r => r.idDropi) // Only process returns with ID DROPI
        .map((raw, index) => {
            const orderLines = orderLookup.get(raw.idDropi);

            if (orderLines && orderLines.length > 0) {
                // If multiple product lines in same order, create one return per line
                // For simplicity, combine into one entry with first line's info
                // (most orders have 1 product line)
                const firstLine = orderLines[0];
                const totalQty = orderLines.reduce((sum, l) => sum + l.CANTIDAD, 0);

                return {
                    id: `ret_${now}_${index}`,
                    idDropi: raw.idDropi,
                    fechaRecibido: raw.fechaRecibido,
                    producto: firstLine.PRODUCTO,
                    productoId: firstLine.PRODUCTO_ID,
                    variacionId: firstLine.VARIACION_ID,
                    variacion: firstLine.VARIACION,
                    cantidad: totalQty,
                    transportadora: raw.transportadora,
                    guiaInicial: raw.guiaInicial,
                    telefono: raw.telefono,
                    addedToInventory: false,
                    createdAt: now,
                };
            }

            // No match found — use raw data with unknown product info
            return {
                id: `ret_${now}_${index}`,
                idDropi: raw.idDropi,
                fechaRecibido: raw.fechaRecibido,
                producto: raw.producto || 'Sin identificar',
                productoId: undefined,
                variacionId: undefined,
                variacion: undefined,
                cantidad: 1,
                transportadora: raw.transportadora,
                guiaInicial: raw.guiaInicial,
                telefono: raw.telefono,
                addedToInventory: false,
                createdAt: now,
            };
        });
}

// ── Unreported Returns Detection ────────────────────────────────────────────

/**
 * Find orders with DEVOLUCION status in supplier orders that don't have
 * a corresponding entry in the returns received file.
 */
export function getUnreportedReturns(
    supplierOrders: SupplierOrder[],
    returns: SupplierReturn[]
): UnreportedReturn[] {
    const reportedIds = new Set(returns.map(r => r.idDropi));

    // Get unique order IDs with DEVOLUCION status
    const devolutionOrders = new Map<string, SupplierOrder>();
    for (const order of supplierOrders) {
        if (isDevolucion(order.ESTATUS) && !reportedIds.has(order.ID)) {
            if (!devolutionOrders.has(order.ID)) {
                devolutionOrders.set(order.ID, order);
            }
        }
    }

    return Array.from(devolutionOrders.values()).map(order => ({
        orderId: order.ID,
        producto: order.PRODUCTO,
        productoId: order.PRODUCTO_ID,
        variacionId: order.VARIACION_ID,
        variacion: order.VARIACION,
        cantidad: order.CANTIDAD,
        fecha: order.FECHA,
        transportadora: order.TRANSPORTADORA,
        numeroGuia: order.NUMERO_GUIA,
    }));
}
