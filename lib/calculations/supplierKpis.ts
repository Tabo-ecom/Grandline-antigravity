import type { SupplierOrder } from '../utils/supplierParser';
import type { InventoryProduct } from '../services/supplierInventory';
import { isEntregado, isCancelado, isDevolucion, isTransit } from '../utils/status';

// ── Types ───────────────────────────────────────────────────────────────────

export interface SupplierKPIResults {
    // Order counts (deduplicated by ID)
    n_ord: number;
    n_ent: number;
    n_can: number;
    n_dev: number;
    n_tra: number;
    n_pen: number;        // Pendiente (not yet dispatched)
    n_desp: number;       // Dispatched = all except cancel/rejected/pending/devolucion

    // Financial (sum all lines)
    ingreso_proveedor: number;    // Total PRECIO_PROVEEDOR_X_CANTIDAD for entregados
    costo_interno: number;        // Total internal cost for entregados
    ganancia_real: number;        // ingreso_proveedor - costo_interno
    margen: number;               // (ganancia_real / ingreso_proveedor) * 100
    unidades_vendidas: number;    // Total CANTIDAD for entregados

    // Shipping
    flete_entregados: number;
    flete_devoluciones: number;

    // Rates
    tasa_entrega: number;
    tasa_devolucion: number;
    tasa_cancelacion: number;

    // By product
    por_producto: ProductSupplierKPI[];
    // By store
    por_tienda: StoreSupplierKPI[];

    // Projection
    ordenes_transito: number;
    ingreso_proyectado: number;
    ganancia_proyectada: number;

    // Daily data for charts
    datos_diarios: DailySupplierData[];
}

export interface ProductSupplierKPI {
    productoId: string;
    nombre: string;
    variacion: string;
    unidades: number;
    ingreso: number;
    costoInterno: number;
    ganancia: number;
    margen: number;
    ordenes: number;
}

export interface StoreSupplierKPI {
    tienda: string;
    unidades: number;
    ingreso: number;
    ganancia: number;
    ordenes: number;
}

export interface DailySupplierData {
    fecha: string;
    ingreso: number;
    ganancia: number;
    ordenes: number;
    unidades: number;
}

// ── Status helpers ──────────────────────────────────────────────────────────

const STATUS_PENDIENTE = ['PENDIENTE'];

function isPendiente(status: string): boolean {
    const normalized = status.toUpperCase().trim();
    return STATUS_PENDIENTE.some(s => normalized.includes(s));
}

/** Dispatched = everything except cancelled, rejected, pending, devolucion */
export function isDespachado(status: string): boolean {
    return !isCancelado(status) && !isPendiente(status) && !isDevolucion(status);
}

// ── Main calculation ────────────────────────────────────────────────────────

export function calculateSupplierKPIs(
    orders: SupplierOrder[],
    inventory: InventoryProduct[],
    deliveryPercent: number = 70,
    productDeliveryOverrides: Record<string, number> = {}
): SupplierKPIResults {
    // Build inventory cost lookup: productoId_variacionId → costoInterno
    const costLookup = new Map<string, number>();
    for (const p of inventory) {
        costLookup.set(`${p.productoId}_${p.variacionId || 'NO_VAR'}`, p.costoInterno);
        // Also store without variation for fallback
        if (!costLookup.has(`${p.productoId}_NO_VAR`)) {
            costLookup.set(`${p.productoId}_NO_VAR`, p.costoInterno);
        }
    }

    function getInternalCost(order: SupplierOrder): number {
        const key = `${order.PRODUCTO_ID}_${order.VARIACION_ID || 'NO_VAR'}`;
        const cost = costLookup.get(key) ?? costLookup.get(`${order.PRODUCTO_ID}_NO_VAR`) ?? 0;
        return cost * order.CANTIDAD;
    }

    // Deduplicated counts
    const seenOrd = new Set<string>();
    const seenEnt = new Set<string>();
    const seenCan = new Set<string>();
    const seenDev = new Set<string>();
    const seenTra = new Set<string>();
    const seenPen = new Set<string>();
    const seenDesp = new Set<string>();

    // Financial accumulators (sum ALL lines)
    let ingreso_proveedor = 0;
    let costo_interno = 0;
    let unidades_vendidas = 0;
    let flete_entregados = 0;
    let flete_devoluciones = 0;

    // Transit accumulators for projection
    let transit_ingreso = 0;
    let transit_costo = 0;

    // By product
    const productMap = new Map<string, ProductSupplierKPI>();
    // By store
    const storeMap = new Map<string, StoreSupplierKPI>();
    // Daily
    const dailyMap = new Map<string, DailySupplierData>();

    for (const order of orders) {
        const status = order.ESTATUS;
        const id = order.ID;

        // Deduplicated counts
        seenOrd.add(id);
        if (isEntregado(status)) seenEnt.add(id);
        else if (isCancelado(status)) seenCan.add(id);
        else if (isDevolucion(status)) seenDev.add(id);
        else if (isPendiente(status)) seenPen.add(id);
        else seenTra.add(id);

        if (isDespachado(status)) seenDesp.add(id);

        // Financial — sum ALL lines
        if (isEntregado(status)) {
            const ingresoLine = order.PRECIO_PROVEEDOR_X_CANTIDAD || 0;
            const costoLine = getInternalCost(order);

            ingreso_proveedor += ingresoLine;
            costo_interno += costoLine;
            unidades_vendidas += order.CANTIDAD;
            flete_entregados += order.PRECIO_FLETE || 0;

            // By product
            const prodKey = `${order.PRODUCTO_ID}_${order.VARIACION_ID || ''}`;
            const existing = productMap.get(prodKey);
            if (existing) {
                existing.unidades += order.CANTIDAD;
                existing.ingreso += ingresoLine;
                existing.costoInterno += costoLine;
                existing.ganancia += ingresoLine - costoLine;
                existing.ordenes++;
            } else {
                productMap.set(prodKey, {
                    productoId: order.PRODUCTO_ID,
                    nombre: order.PRODUCTO,
                    variacion: order.VARIACION || '',
                    unidades: order.CANTIDAD,
                    ingreso: ingresoLine,
                    costoInterno: costoLine,
                    ganancia: ingresoLine - costoLine,
                    margen: 0,
                    ordenes: 1,
                });
            }

            // By store
            const tienda = order.TIENDA || 'Sin tienda';
            const storeExisting = storeMap.get(tienda);
            if (storeExisting) {
                storeExisting.unidades += order.CANTIDAD;
                storeExisting.ingreso += ingresoLine;
                storeExisting.ganancia += ingresoLine - costoLine;
                storeExisting.ordenes++;
            } else {
                storeMap.set(tienda, {
                    tienda,
                    unidades: order.CANTIDAD,
                    ingreso: ingresoLine,
                    ganancia: ingresoLine - costoLine,
                    ordenes: 1,
                });
            }

            // Daily
            const fecha = order.FECHA?.split?.(' ')?.[0] || order.FECHA || '';
            if (fecha) {
                const dailyExisting = dailyMap.get(fecha);
                if (dailyExisting) {
                    dailyExisting.ingreso += ingresoLine;
                    dailyExisting.ganancia += ingresoLine - costoLine;
                    dailyExisting.ordenes++;
                    dailyExisting.unidades += order.CANTIDAD;
                } else {
                    dailyMap.set(fecha, {
                        fecha,
                        ingreso: ingresoLine,
                        ganancia: ingresoLine - costoLine,
                        ordenes: 1,
                        unidades: order.CANTIDAD,
                    });
                }
            }
        }

        if (isDevolucion(status)) {
            flete_devoluciones += order.COSTO_DEVOLUCION_FLETE || order.PRECIO_FLETE || 0;
        }

        // Transit projection
        if (isTransit(status) && !isPendiente(status)) {
            const prodDelPercent = productDeliveryOverrides[order.PRODUCTO_ID] ?? deliveryPercent;
            transit_ingreso += (order.PRECIO_PROVEEDOR_X_CANTIDAD || 0) * (prodDelPercent / 100);
            transit_costo += getInternalCost(order) * (prodDelPercent / 100);
        }
    }

    // Compute margins for products
    const por_producto = Array.from(productMap.values()).map(p => ({
        ...p,
        margen: p.ingreso > 0 ? (p.ganancia / p.ingreso) * 100 : 0,
    })).sort((a, b) => b.ganancia - a.ganancia);

    const por_tienda = Array.from(storeMap.values()).sort((a, b) => b.ganancia - a.ganancia);

    const datos_diarios = Array.from(dailyMap.values()).sort((a, b) => a.fecha.localeCompare(b.fecha));

    const n_nc = seenOrd.size - seenCan.size;
    const ganancia_real = ingreso_proveedor - costo_interno;

    return {
        n_ord: seenOrd.size,
        n_ent: seenEnt.size,
        n_can: seenCan.size,
        n_dev: seenDev.size,
        n_tra: seenTra.size,
        n_pen: seenPen.size,
        n_desp: seenDesp.size,

        ingreso_proveedor,
        costo_interno,
        ganancia_real,
        margen: ingreso_proveedor > 0 ? (ganancia_real / ingreso_proveedor) * 100 : 0,
        unidades_vendidas,

        flete_entregados,
        flete_devoluciones,

        tasa_entrega: n_nc > 0 ? (seenEnt.size / n_nc) * 100 : 0,
        tasa_devolucion: (seenEnt.size + seenDev.size) > 0 ? (seenDev.size / (seenEnt.size + seenDev.size)) * 100 : 0,
        tasa_cancelacion: seenOrd.size > 0 ? (seenCan.size / seenOrd.size) * 100 : 0,

        por_producto,
        por_tienda,

        ordenes_transito: seenTra.size,
        ingreso_proyectado: transit_ingreso,
        ganancia_proyectada: transit_ingreso - transit_costo,

        datos_diarios,
    };
}
