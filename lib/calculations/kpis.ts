import {
    isEntregado,
    isCancelado,
    isDevolucion,
    isTransit,
} from '../utils/status';

// Dropi order interface
export interface DropiOrder {
    ID: string;
    ESTATUS: string;
    "TOTAL DE LA ORDEN": number;
    PRODUCTO?: string;
    SKU?: string | number;
    PRODUCTO_ID?: string | number;
    CANTIDAD?: number;
    "PRECIO PROVEEDOR"?: number;
    "PRECIO PROVEEDOR X CANTIDAD"?: number;
    "PRECIO FLETE"?: number;
    "COSTO DEVOLUCION FLETE"?: number;
    GANANCIA?: number;
    FECHA?: string | Date;
    CIUDAD?: string;
    "CIUDAD DESTINO"?: string;
    COMISION?: number;
    GRUPO_PRODUCTO?: string;
    PAIS?: string;
    TRANSPORTADORA?: string;
    RECAUDO?: string;
}

// KPI results interface
export interface KPIResults {
    // Order counts
    n_ord: number;          // Total orders (Gross)
    n_ent: number;          // Delivered (Entregados)
    n_can: number;          // Canceled (Cancelados)
    n_dev: number;          // Returns (Devoluciones)
    n_tra: number;          // In transit (Tránsito)
    n_nc: number;           // Non-canceled (n_ord - n_can) - Base para Tasa de Entrega

    // Conversion/Performance rates
    tasa_ent: number;       // Delivery rate (% of non-canceled) - "Tasa de Entrega"
    tasa_can: number;       // Cancelation rate (% of total) - "Tasa de Cancelación"
    tasa_dev: number;       // Return rate (% of dispatched) - "Tasa de Devolución"

    // Financial metrics
    fact_neto: number;      // Net invoiced (excluding canceled) - "Facturación Neta"
    ing_real: number;       // Real income (delivered only) - "Ingreso Entregados"
    cpr: number;            // Product cost (of delivered)
    fl_ent: number;         // Shipping cost (delivered)
    fl_dev: number;         // Return shipping cost
    fl_tra: number;         // Transit shipping cost
    g_ads: number;          // Ad spend (mapped) - "Gasto Total Ads"
    u_real: number;         // Real profit - "Utilidad Real"

    // Performance Metrics (Blueprint Tiers)
    roas_bruto: number;     // Facturación Neta / Gasto Ads - "ROAS Bruto"
    roas_real: number;      // Ingreso Entregados / Gasto Ads - "ROAS Real"
    cpa: number;            // Gasto Ads / Total Órdenes - "CPA"
    cpe: number;            // Gasto Ads / Órdenes Entregadas - "CPE"
    mer: number;            // Revenue Total / Gasto Ads Total - "MER" (same as roas_bruto here, but global)
    perc_ads_revenue: number; // (Gasto Ads / Facturación Neta) * 100 - "% del Gasto vs Revenue"

    // COD Logic
    costo_dev_orden: number; // Flete Devoluciones / Total Órdenes - "Costo Devolución/Orden"
    utilidad_por_entrega: number; // Utilidad Real / Entregados - "Utilidad Real por Órden Entregada"
    roas: number;           // Alias for backward compatibility (roas_bruto)

    // New additions for GlobalSummary
    fact_despachada: number;
    utilidad_proyectada?: number;
}

// Calculate KPIs for a dataset
export function calculateKPIs(
    orders: DropiOrder[],
    mappedAds: number = 0,
    totalRevenueGlobal?: number // Optional for MER calculation if different from fact_neto
): KPIResults {
    const uniqueIds = {
        all: new Set<string>(),
        ent: new Set<string>(),
        can: new Set<string>(),
        dev: new Set<string>(),
        tra: new Set<string>(),
        nc: new Set<string>()
    };

    // Financial accumulations
    let fact_neto = 0;
    let ing_real = 0;
    let cpr = 0; // Costo Producto Real (Entregados) - Sum of all lines

    // Unique Order Financials (Facturacion, Fletes) to avoid double counting
    const seenFact = new Set<string>();
    const seenIng = new Set<string>();
    const seenFlEnt = new Set<string>();
    const seenFlDev = new Set<string>();
    const seenFlTra = new Set<string>();
    const seenFactDespachada = new Set<string>();

    let fl_ent = 0;
    let fl_dev = 0;
    let fl_tra = 0;
    let fact_despachada = 0;

    for (let i = 0; i < orders.length; i++) {
        const o = orders[i];
        const status = o.ESTATUS || '';
        const id = o.ID;

        // Status Checks
        const isEnt = isEntregado(status);
        const isCan = isCancelado(status);
        const isDev = isDevolucion(status);
        const isTra = isTransit(status);

        // 1. Counts
        if (id) {
            uniqueIds.all.add(id);
            if (isEnt) uniqueIds.ent.add(id);
            if (isCan) uniqueIds.can.add(id);
            if (isDev) uniqueIds.dev.add(id);
            if (isTra) uniqueIds.tra.add(id);
            if (!isCan) uniqueIds.nc.add(id);
        }

        // 2. Financials

        // Non-Canceled (Facturación Neta)
        if (!isCan) {
            if (id && !seenFact.has(id)) {
                seenFact.add(id);
                fact_neto += (o["TOTAL DE LA ORDEN"] || 0);
            }
        }

        // Dispatched (Facturación Despachada = Entregado + Devolucion + Transito)
        const isDespachado = isEnt || isDev || isTra;
        if (isDespachado) {
            if (id && !seenFactDespachada.has(id)) {
                seenFactDespachada.add(id);
                fact_despachada += (o["TOTAL DE LA ORDEN"] || 0);
            }
        }

        // Delivered (Ingreso Real, Costo Producto, Flete Entrega)
        if (isEnt) {
            if (id && !seenIng.has(id)) {
                seenIng.add(id);
                ing_real += (o["TOTAL DE LA ORDEN"] || 0);
            }

            // Costo Producto is SUM of all lines (no unique check in original logic either)
            cpr += (o["PRECIO PROVEEDOR X CANTIDAD"] || o["PRECIO PROVEEDOR"] || 0);

            if (id && !seenFlEnt.has(id)) {
                seenFlEnt.add(id);
                fl_ent += (o["PRECIO FLETE"] || 0);
            }
        }

        // Returns (Flete Devolución)
        if (isDev) {
            if (id && !seenFlDev.has(id)) {
                seenFlDev.add(id);
                fl_dev += (o["COSTO DEVOLUCION FLETE"] || o["PRECIO FLETE"] || 0);
            }
        }

        // Transit (Flete Tránsito)
        if (isTra) {
            if (id && !seenFlTra.has(id)) {
                seenFlTra.add(id);
                fl_tra += (o["PRECIO FLETE"] || 0);
            }
        }
    }

    // Derived counts
    const n_ord = uniqueIds.all.size;
    const n_ent = uniqueIds.ent.size;
    const n_can = uniqueIds.can.size;
    const n_dev = uniqueIds.dev.size;
    const n_tra = uniqueIds.tra.size;
    const n_nc = uniqueIds.nc.size;
    const n_dispatched = n_ent + n_dev; // Approximate for return rate base

    // Conversion rates
    const tasa_ent = n_nc > 0 ? (n_ent / n_nc) * 100 : 0;
    const tasa_can = n_ord > 0 ? (n_can / n_ord) * 100 : 0;
    const tasa_dev = n_dispatched > 0 ? (n_dev / n_dispatched) * 100 : 0;

    // Profit
    const g_ads = mappedAds;
    const u_real = ing_real - cpr - g_ads - fl_ent - fl_dev - fl_tra;

    // Performance Metrics
    const roas_bruto = g_ads > 0 ? fact_neto / g_ads : 0;
    const roas_real = g_ads > 0 ? ing_real / g_ads : 0;
    const cpa = n_ord > 0 ? g_ads / n_ord : 0;
    const cpe = n_ent > 0 ? g_ads / n_ent : 0;
    const mer = g_ads > 0 ? (totalRevenueGlobal || fact_neto) / g_ads : 0;
    const perc_ads_revenue = fact_neto > 0 ? (g_ads / fact_neto) * 100 : 0;

    // COD Specific
    const costo_dev_orden = n_ord > 0 ? fl_dev / n_ord : 0;
    const utilidad_por_entrega = n_ent > 0 ? u_real / n_ent : 0;

    return {
        n_ord,
        n_ent,
        n_can,
        n_dev,
        n_tra,
        n_nc,
        tasa_ent,
        tasa_can,
        tasa_dev,
        fact_neto,
        ing_real,
        cpr,
        fl_ent,
        fl_dev,
        fl_tra,
        g_ads,
        u_real,
        roas_bruto,
        roas_real,
        cpa,
        cpe,
        mer,
        perc_ads_revenue,
        costo_dev_orden,
        utilidad_por_entrega,
        fact_despachada,
        roas: roas_bruto, // Alias for backward compatibility
    };
}

// Projection interface
export interface ProjectionResult {
    producto: string; // Display Name
    productoId: string; // Unique ID (for saving/overrides)
    ordenes: number;
    percent_ent: number;
    ingreso: number;
    costo: number;
    fl_ent: number;
    fl_resto: number;
    ads: number;
    utilidad: number;
}

// Calculate projection for products
export function calculateProjection(
    orders: DropiOrder[],
    idField: 'PRODUCTO_ID' | 'GRUPO_PRODUCTO' | 'PRODUCTO' = 'PRODUCTO_ID',
    percentDelivery: Record<string, number>, // Product ID -> % delivery
    bufferMultiplier: number,
    adsPerProduct: Record<string, number> // Product ID -> Ads
): ProjectionResult[] {
    // Group orders by product ID
    const productGroups = new Map<string, DropiOrder[]>();
    const idToName = new Map<string, string>();

    orders.forEach(order => {
        const idValue = order[idField]?.toString() || order['PRODUCTO'] || 'unknown';
        const nameValue = order['PRODUCTO'] || idValue;

        if (!productGroups.has(idValue)) {
            productGroups.set(idValue, []);
            idToName.set(idValue, nameValue);
        }
        productGroups.get(idValue)!.push(order);
    });

    const results: ProjectionResult[] = [];

    // BUG FIX: Iterate over all products that have either orders OR ad spend.
    // Previously, products with spend but 0 orders were ignored, causing 
    // discrepancies in global profit totals.
    const allProductNames = new Set([
        ...Array.from(productGroups.keys()),
        ...Object.keys(adsPerProduct)
    ]);

    allProductNames.forEach((productId) => {
        const productOrders = productGroups.get(productId) || [];
        const productName = idToName.get(productId) || productId;
        const delivered = productOrders.filter(o => isEntregado(o.ESTATUS));
        const canceled = productOrders.filter(o => isCancelado(o.ESTATUS));

        // Orders that are NOT delivered and NOT canceled (Transit, Returns, etc.)
        const notDeliveredOrCanceled = productOrders.filter(o => !isEntregado(o.ESTATUS) && !isCancelado(o.ESTATUS));

        // Calculate averages from delivered orders (Real Data)
        const nonCanceledBasis = productOrders.filter(o => !isCancelado(o.ESTATUS));
        const basisOrders = delivered.length > 0 ? delivered : nonCanceledBasis;

        const avgOrderValue = basisOrders.length > 0
            ? basisOrders.reduce((sum, o) => sum + (o["TOTAL DE LA ORDEN"] || 0), 0) / basisOrders.length
            : 0;

        const avgCost = basisOrders.length > 0
            ? basisOrders.reduce((sum, o) => sum + (o["PRECIO PROVEEDOR X CANTIDAD"] || o["PRECIO PROVEEDOR"] || 0), 0) / basisOrders.length
            : 0;

        const avgShipping = basisOrders.length > 0
            ? basisOrders.reduce((sum, o) => sum + (o["PRECIO FLETE"] || 0), 0) / basisOrders.length
            : 0;

        // Calculate projection
        const nonCanceledCount = new Set(productOrders.filter(o => !isCancelado(o.ESTATUS)).map(o => o.ID)).size;
        const percentEnt = percentDelivery[productId] || percentDelivery[productName] || 80;

        const projectedDeliveredCount = nonCanceledCount * (percentEnt / 100);
        const projectedNotDeliveredCount = nonCanceledCount - projectedDeliveredCount;

        const ingreso = projectedDeliveredCount * avgOrderValue;
        const costo = projectedDeliveredCount * avgCost;
        const fl_ent = projectedDeliveredCount * avgShipping;

        const avgShippingRest = notDeliveredOrCanceled.length > 0
            ? notDeliveredOrCanceled.reduce((sum, o) => sum + (o["PRECIO FLETE"] || 0), 0) / notDeliveredOrCanceled.length
            : avgShipping;

        const fl_resto = projectedNotDeliveredCount * avgShippingRest * bufferMultiplier;

        const ads = adsPerProduct[productId] || 0;
        const utilidad = ingreso - costo - fl_ent - fl_resto - ads;

        // Only include if there's either orders or ads
        if (nonCanceledCount > 0 || ads > 0) {
            results.push({
                producto: productName,
                productoId: productId,
                ordenes: nonCanceledCount,
                percent_ent: percentEnt,
                ingreso,
                costo,
                fl_ent,
                fl_resto,
                ads,
                utilidad,
            });
        }
    });

    return results;
}

// Count statuses helper (using Unique Order IDs)
export function countStatuses(orders: DropiOrder[]) {
    return {
        entregados: new Set(orders.filter(o => isEntregado(o.ESTATUS)).map(o => o.ID)).size,
        cancelados: new Set(orders.filter(o => isCancelado(o.ESTATUS)).map(o => o.ID)).size,
        devoluciones: new Set(orders.filter(o => isDevolucion(o.ESTATUS)).map(o => o.ID)).size,
        transito: new Set(orders.filter(o => isTransit(o.ESTATUS)).map(o => o.ID)).size,
    };
}
