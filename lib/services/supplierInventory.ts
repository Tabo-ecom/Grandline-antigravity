import { getAppData, setAppData } from '../firebase/firestore';

// ── Types ───────────────────────────────────────────────────────────────────

export interface InventoryProduct {
    id: string;
    productoId: string;         // PRODUCTO_ID from Dropi
    nombre: string;
    variacionId: string;        // Empty string if no variation
    variacion: string;
    costoInterno: number;       // Internal cost (what it costs us)
    precioProveedor: number;    // Price charged to dropshippers
    stockInicial: number;
    stockActual: number;        // Computed: inicial + compras + devoluciones - despachos
    alertaStock30: boolean;
    alertaStock7: boolean;
    createdAt: number;
    updatedAt: number;
}

export interface InventoryMovement {
    id: string;
    productoId: string;
    variacionId: string;
    tipo: 'compra' | 'devolucion' | 'despacho' | 'ajuste';
    cantidad: number;           // Positive = in, negative = out
    referencia?: string;        // Order ID, purchase note, etc.
    fecha: string;              // YYYY-MM-DD
    notas?: string;
    createdAt: number;
}

export interface StockAlert {
    product: InventoryProduct;
    stockActual: number;
    promedioDespachosDiarios: number;
    diasRestantes: number;
    nivel: '7dias' | '30dias';
}

const INVENTORY_KEY = 'supplier_inventory';
const MOVEMENTS_KEY = 'supplier_movements';

// ── CRUD — Products ─────────────────────────────────────────────────────────

export async function getInventory(userId: string): Promise<InventoryProduct[]> {
    if (!userId) return [];
    const data = await getAppData<InventoryProduct[]>(INVENTORY_KEY, userId);
    return Array.isArray(data) ? data : [];
}

export async function saveInventoryProduct(product: InventoryProduct, userId: string): Promise<void> {
    if (!userId) return;
    const current = await getInventory(userId);
    const filtered = current.filter(p => p.id !== product.id);
    await setAppData(INVENTORY_KEY, [...filtered, product], userId);
}

export async function bulkSaveInventory(products: InventoryProduct[], userId: string): Promise<void> {
    if (!userId) return;
    const current = await getInventory(userId);
    // Merge: key by productoId + variacionId to preserve all variations
    const byKey = new Map<string, InventoryProduct>();
    for (const p of current) byKey.set(getInventoryKey(p.productoId, p.variacionId), p);
    for (const p of products) {
        const key = getInventoryKey(p.productoId, p.variacionId);
        const existing = byKey.get(key);
        if (existing) {
            // Update cost and stock, preserve existing data
            byKey.set(key, {
                ...existing,
                costoInterno: p.costoInterno || existing.costoInterno,
                stockInicial: p.stockInicial,
                nombre: p.nombre || existing.nombre,
                variacion: p.variacion || existing.variacion,
                precioProveedor: p.precioProveedor || existing.precioProveedor,
                updatedAt: Date.now(),
            });
        } else {
            byKey.set(key, p);
        }
    }
    await setAppData(INVENTORY_KEY, Array.from(byKey.values()), userId);
}

export async function clearAllInventory(userId: string): Promise<void> {
    if (!userId) return;
    await setAppData(INVENTORY_KEY, [], userId);
    await setAppData(MOVEMENTS_KEY, [], userId);
}

export async function deleteInventoryProduct(productId: string, userId: string): Promise<void> {
    if (!userId) return;
    const current = await getInventory(userId);
    const filtered = current.filter(p => p.id !== productId);
    await setAppData(INVENTORY_KEY, filtered, userId);
}

// ── CRUD — Movements ────────────────────────────────────────────────────────

export async function getMovements(userId: string): Promise<InventoryMovement[]> {
    if (!userId) return [];
    const data = await getAppData<InventoryMovement[]>(MOVEMENTS_KEY, userId);
    return Array.isArray(data) ? data : [];
}

export async function addMovement(movement: InventoryMovement, userId: string): Promise<void> {
    if (!userId) return;
    const current = await getMovements(userId);
    await setAppData(MOVEMENTS_KEY, [...current, movement], userId);
}

export async function bulkAddMovements(movements: InventoryMovement[], userId: string): Promise<void> {
    if (!userId || !movements.length) return;
    const current = await getMovements(userId);
    // Dedup by referencia (order ID) + productoId + variacionId to avoid double-counting
    const existingKeys = new Set(
        current.map(m => `${m.tipo}_${m.referencia}_${m.productoId}_${m.variacionId}`)
    );
    const newMovements = movements.filter(
        m => !existingKeys.has(`${m.tipo}_${m.referencia}_${m.productoId}_${m.variacionId}`)
    );
    if (newMovements.length > 0) {
        await setAppData(MOVEMENTS_KEY, [...current, ...newMovements], userId);
    }
}

export async function deleteMovement(movementId: string, userId: string): Promise<void> {
    if (!userId) return;
    const current = await getMovements(userId);
    const filtered = current.filter(m => m.id !== movementId);
    await setAppData(MOVEMENTS_KEY, filtered, userId);
}

// ── Stock Computation ───────────────────────────────────────────────────────

export function computeStock(product: InventoryProduct, movements: InventoryMovement[]): number {
    const relevant = movements.filter(
        m => m.productoId === product.productoId && m.variacionId === product.variacionId
    );
    const delta = relevant.reduce((sum, m) => sum + m.cantidad, 0);
    return product.stockInicial + delta;
}

export function computeAllStocks(
    products: InventoryProduct[],
    movements: InventoryMovement[]
): InventoryProduct[] {
    return products.map(p => ({
        ...p,
        stockActual: computeStock(p, movements),
    }));
}

// ── Stock Alerts ────────────────────────────────────────────────────────────

export function calculateStockAlerts(
    products: InventoryProduct[],
    movements: InventoryMovement[]
): StockAlert[] {
    const alerts: StockAlert[] = [];
    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

    for (const product of products) {
        const stock = computeStock(product, movements);

        // Calculate average daily dispatches from last 30 days
        const recentDispatches = movements.filter(
            m => m.productoId === product.productoId &&
                 m.variacionId === product.variacionId &&
                 m.tipo === 'despacho' &&
                 m.createdAt >= thirtyDaysAgo
        );
        const totalDispatched = Math.abs(recentDispatches.reduce((sum, m) => sum + m.cantidad, 0));
        const promedioDespachosDiarios = totalDispatched / 30;

        if (promedioDespachosDiarios <= 0) continue;

        const diasRestantes = stock / promedioDespachosDiarios;

        if (diasRestantes <= 7 && product.alertaStock7) {
            alerts.push({ product, stockActual: stock, promedioDespachosDiarios, diasRestantes, nivel: '7dias' });
        } else if (diasRestantes <= 30 && product.alertaStock30) {
            alerts.push({ product, stockActual: stock, promedioDespachosDiarios, diasRestantes, nivel: '30dias' });
        }
    }

    return alerts.sort((a, b) => a.diasRestantes - b.diasRestantes);
}

// ── Inventory Key Helper ────────────────────────────────────────────────────

export function getInventoryKey(productoId: string, variacionId: string): string {
    return `${productoId}_${variacionId || 'NO_VAR'}`;
}

// ── Receive from Purchase Order ─────────────────────────────────────────────

/**
 * Creates 'compra' movements and updates costoInterno with weighted average landed cost.
 * @param items Array of { productoId, variacionId, cantidad, landedCostUnitCOP, purchaseRef }
 */
export async function receiveFromPurchase(
    items: { productoId: string; variacionId: string; cantidad: number; landedCostUnitCOP: number; purchaseRef: string }[],
    userId: string
): Promise<void> {
    if (!userId || items.length === 0) return;

    const inventory = await getInventory(userId);
    const movements = await getMovements(userId);

    const newMovements: InventoryMovement[] = [];
    const updatedInventory = [...inventory];
    const now = Date.now();

    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.cantidad <= 0) continue;

        // Create compra movement
        newMovements.push({
            id: `compra_po_${now}_${i}`,
            productoId: item.productoId,
            variacionId: item.variacionId || '',
            tipo: 'compra',
            cantidad: item.cantidad,
            referencia: item.purchaseRef,
            fecha: new Date().toISOString().split('T')[0],
            notas: `Recepción de importación ${item.purchaseRef}`,
            createdAt: now,
        });

        // Update costoInterno with weighted average
        const key = getInventoryKey(item.productoId, item.variacionId);
        const invIdx = updatedInventory.findIndex(p => getInventoryKey(p.productoId, p.variacionId) === key);
        if (invIdx >= 0) {
            const product = updatedInventory[invIdx];
            const currentStock = computeStock(product, movements);
            const oldCosto = product.costoInterno || 0;

            // Weighted average: (currentStock × oldCost + newQty × newCost) / totalStock
            const totalStock = currentStock + item.cantidad;
            const newCostoInterno = totalStock > 0
                ? Math.round((currentStock * oldCosto + item.cantidad * item.landedCostUnitCOP) / totalStock)
                : item.landedCostUnitCOP;

            updatedInventory[invIdx] = { ...product, costoInterno: newCostoInterno, updatedAt: now };
        }
    }

    // Bulk save movements
    if (newMovements.length > 0) {
        await bulkAddMovements(newMovements, userId);
    }

    // Save updated inventory with new costs
    await setAppData(INVENTORY_KEY, updatedInventory, userId);
}
