import {
    isEntregado,
    isCancelado,
    isDevolucion,
    isTransit,
    isPendienteConfirmacion,
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

    // Pending confirmation
    n_pend: number;         // Pendiente Confirmación count
    perc_pend: number;      // % of total orders that are pending

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
        nc: new Set<string>(),
        pend: new Set<string>(),
    };

    // Financial accumulations
    let fact_neto = 0;    // Sum ALL lines (subtotals per product line)
    let ing_real = 0;     // Sum ALL lines (subtotals per product line)
    let cpr = 0;          // Costo Producto Real (Entregados) - Sum of all lines
    let fact_despachada = 0; // Sum ALL lines (subtotals per product line)

    // Dropi splits ALL financial fields proportionally per product line.
    // Sum ALL lines without deduplication for every financial field.
    let fl_ent = 0;
    let fl_dev = 0;
    let fl_tra = 0;

    for (let i = 0; i < orders.length; i++) {
        const o = orders[i];
        const status = o.ESTATUS || '';
        const id = o.ID;

        // Status Checks
        const isEnt = isEntregado(status);
        const isCan = isCancelado(status);
        const isDev = isDevolucion(status);
        const isPend = isPendienteConfirmacion(status);
        const isTra = !isEnt && !isCan && !isDev && !isPend; // Transit = everything else

        // 1. Counts (deduplicated by ID)
        if (id) {
            uniqueIds.all.add(id);
            if (isEnt) uniqueIds.ent.add(id);
            if (isCan) uniqueIds.can.add(id);
            if (isDev) uniqueIds.dev.add(id);
            if (isPend) uniqueIds.pend.add(id);
            if (isTra) uniqueIds.tra.add(id);
            if (!isCan) uniqueIds.nc.add(id);
        }

        // 2. Financials — sum ALL lines (Dropi splits values per product line)

        // Non-Canceled (Facturación Neta)
        if (!isCan) {
            fact_neto += (o["TOTAL DE LA ORDEN"] || 0);
        }

        // Dispatched (Facturación Despachada = Entregado + Devolucion + Transito)
        const isDespachado = isEnt || isDev || isTra;
        if (isDespachado) {
            fact_despachada += (o["TOTAL DE LA ORDEN"] || 0);
        }

        // Delivered (Ingreso Real, Costo Producto, Flete Entrega)
        if (isEnt) {
            ing_real += (o["TOTAL DE LA ORDEN"] || 0);
            cpr += (o["PRECIO PROVEEDOR X CANTIDAD"] || o["PRECIO PROVEEDOR"] || 0);
            fl_ent += (o["PRECIO FLETE"] || 0);
        }

        // Returns (Flete Devolución) - COSTO DEVOLUCION FLETE if > 0, else PRECIO FLETE
        if (isDev) {
            fl_dev += (o["COSTO DEVOLUCION FLETE"] || o["PRECIO FLETE"] || 0);
        }

        // Transit (Flete Tránsito)
        if (isTra) {
            fl_tra += (o["PRECIO FLETE"] || 0);
        }
    }

    // Derived counts
    const n_ord = uniqueIds.all.size;
    const n_ent = uniqueIds.ent.size;
    const n_can = uniqueIds.can.size;
    const n_dev = uniqueIds.dev.size;
    const n_tra = uniqueIds.tra.size;
    const n_nc = uniqueIds.nc.size;
    const n_pend = uniqueIds.pend.size;
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
        n_pend,
        perc_pend: n_ord > 0 ? (n_pend / n_ord) * 100 : 0,
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
// pendingCancelPercent: % of "Pendiente Confirmación" orders expected to cancel (0-100)
export function calculateProjection(
    orders: DropiOrder[],
    idField: 'PRODUCTO_ID' | 'GRUPO_PRODUCTO' | 'PRODUCTO' = 'PRODUCTO_ID',
    percentDelivery: Record<string, number>, // Product ID -> % delivery
    bufferMultiplier: number,
    adsPerProduct: Record<string, number>, // Product ID -> Ads
    pendingCancelPercent: Record<string, number> = {} // Product ID -> % cancel of pending
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

        // Dropi splits all values per product line, so averages are per unique order
        const nonCanceledBasis = productOrders.filter(o => !isCancelado(o.ESTATUS));
        const basisOrders = delivered.length > 0 ? delivered : nonCanceledBasis;

        // Group by order ID to get per-order totals (sum split values back together)
        const basisByOrder = new Map<string, { revenue: number; cost: number; shipping: number }>();
        basisOrders.forEach(o => {
            const id = o.ID;
            if (!basisByOrder.has(id)) {
                basisByOrder.set(id, { revenue: 0, cost: 0, shipping: 0 });
            }
            const entry = basisByOrder.get(id)!;
            entry.revenue += (o["TOTAL DE LA ORDEN"] || 0);
            entry.cost += (o["PRECIO PROVEEDOR X CANTIDAD"] || o["PRECIO PROVEEDOR"] || 0);
            entry.shipping += (o["PRECIO FLETE"] || 0);
        });

        const basisUniqueCount = basisByOrder.size;
        const basisTotals = Array.from(basisByOrder.values());
        const avgOrderValue = basisUniqueCount > 0
            ? basisTotals.reduce((sum, v) => sum + v.revenue, 0) / basisUniqueCount
            : 0;
        const avgCost = basisUniqueCount > 0
            ? basisTotals.reduce((sum, v) => sum + v.cost, 0) / basisUniqueCount
            : 0;
        const avgShipping = basisUniqueCount > 0
            ? basisTotals.reduce((sum, v) => sum + v.shipping, 0) / basisUniqueCount
            : 0;

        // Calculate projection
        // Step 1: Count non-canceled orders and separate pending ones
        const nonCanceledIds = new Set(productOrders.filter(o => !isCancelado(o.ESTATUS)).map(o => o.ID));
        const pendingIds = new Set(productOrders.filter(o => isPendienteConfirmacion(o.ESTATUS)).map(o => o.ID));
        const confirmedCount = nonCanceledIds.size - pendingIds.size; // Already dispatched/in process
        const pendingCount = pendingIds.size;

        // Step 2: Apply pending cancel % — remove projected cancels from pending
        const pendCancelPct = pendingCancelPercent[productId] ?? pendingCancelPercent[productName] ?? 0;
        const pendingCanceled = pendingCount * (pendCancelPct / 100);
        const pendingSurviving = pendingCount - pendingCanceled;

        // Step 3: Effective non-canceled = confirmed + surviving pending
        const nonCanceledCount = confirmedCount + pendingSurviving;
        const percentEnt = percentDelivery[productId] || percentDelivery[productName] || 80;

        const projectedDeliveredCount = nonCanceledCount * (percentEnt / 100);
        const projectedNotDeliveredCount = nonCanceledCount - projectedDeliveredCount;

        const ingreso = projectedDeliveredCount * avgOrderValue;
        const costo = projectedDeliveredCount * avgCost;
        const fl_ent = projectedDeliveredCount * avgShipping;

        // Non-delivered shipping average (group by order, sum lines)
        const restByOrder = new Map<string, number>();
        notDeliveredOrCanceled.forEach(o => {
            const id = o.ID;
            restByOrder.set(id, (restByOrder.get(id) || 0) + (o["PRECIO FLETE"] || 0));
        });
        const avgShippingRest = restByOrder.size > 0
            ? Array.from(restByOrder.values()).reduce((sum, v) => sum + v, 0) / restByOrder.size
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

// Freight analysis: compare outbound (delivered) vs return shipping by country/carrier
export interface FreightAnalysisCarrier {
    carrier: string;
    avgOutbound: number;
    avgReturn: number;
    diffPercent: number; // (return - outbound) / outbound * 100
    sampleSize: number;
}

export interface FreightAnalysisResult {
    country: string;
    carriers: FreightAnalysisCarrier[];
    hasIncrease: boolean;      // any carrier shows >5% increase
    avgDiffPercent: number;    // weighted avg across carriers
    recommendedBuffer: number; // suggested multiplier (1.0 if no increase, else 1 + avg%)
    summary: string;           // human-readable recommendation
}

export function analyzeFreightByCountry(orders: DropiOrder[]): Record<string, FreightAnalysisResult> {
    // Group orders by country
    const byCountry = new Map<string, DropiOrder[]>();
    orders.forEach(o => {
        const country = (o as any).country || o.PAIS || 'Desconocido';
        if (!byCountry.has(country)) byCountry.set(country, []);
        byCountry.get(country)!.push(o);
    });

    const results: Record<string, FreightAnalysisResult> = {};

    byCountry.forEach((cOrders, country) => {
        // Group by carrier
        const carrierOutbound = new Map<string, number[]>();
        const carrierReturn = new Map<string, number[]>();

        // Outbound = delivered orders, use PRECIO FLETE
        cOrders.filter(o => isEntregado(o.ESTATUS)).forEach(o => {
            const carrier = (o as any).TRANSPORTADORA || 'Desconocida';
            const flete = o["PRECIO FLETE"] || 0;
            if (flete > 0) {
                if (!carrierOutbound.has(carrier)) carrierOutbound.set(carrier, []);
                carrierOutbound.get(carrier)!.push(flete);
            }
        });

        // Return = devolucion orders, use COSTO DEVOLUCION FLETE or PRECIO FLETE
        cOrders.filter(o => isDevolucion(o.ESTATUS)).forEach(o => {
            const carrier = (o as any).TRANSPORTADORA || 'Desconocida';
            const flete = o["COSTO DEVOLUCION FLETE"] || o["PRECIO FLETE"] || 0;
            if (flete > 0) {
                if (!carrierReturn.has(carrier)) carrierReturn.set(carrier, []);
                carrierReturn.get(carrier)!.push(flete);
            }
        });

        const allCarriers = new Set([...carrierOutbound.keys(), ...carrierReturn.keys()]);
        const carriersAnalysis: FreightAnalysisCarrier[] = [];

        allCarriers.forEach(carrier => {
            const outboundValues = carrierOutbound.get(carrier) || [];
            const returnValues = carrierReturn.get(carrier) || [];
            if (outboundValues.length === 0 || returnValues.length === 0) return;

            const avgOut = outboundValues.reduce((a, b) => a + b, 0) / outboundValues.length;
            const avgRet = returnValues.reduce((a, b) => a + b, 0) / returnValues.length;
            const diff = avgOut > 0 ? ((avgRet - avgOut) / avgOut) * 100 : 0;

            carriersAnalysis.push({
                carrier,
                avgOutbound: Math.round(avgOut),
                avgReturn: Math.round(avgRet),
                diffPercent: Math.round(diff),
                sampleSize: outboundValues.length + returnValues.length,
            });
        });

        // Weighted average diff
        const totalSamples = carriersAnalysis.reduce((s, c) => s + c.sampleSize, 0);
        const weightedDiff = totalSamples > 0
            ? carriersAnalysis.reduce((s, c) => s + c.diffPercent * c.sampleSize, 0) / totalSamples
            : 0;

        const hasIncrease = carriersAnalysis.some(c => c.diffPercent > 5);
        const recommendedBuffer = hasIncrease ? 1 + Math.max(weightedDiff, 0) / 100 : 1.0;

        let summary: string;
        if (carriersAnalysis.length === 0) {
            summary = `Sin datos suficientes para analizar fletes en ${country}.`;
        } else if (hasIncrease) {
            const top = carriersAnalysis.filter(c => c.diffPercent > 5)
                .sort((a, b) => b.diffPercent - a.diffPercent);
            const details = top.map(c => `${c.carrier}: +${c.diffPercent}%`).join(', ');
            summary = `Aumento detectado en devoluciones: ${details}. Buffer recomendado: ${(recommendedBuffer).toFixed(2)}x`;
        } else {
            const names = carriersAnalysis.map(c => c.carrier).join(', ');
            summary = `Las transportadoras (${names}) no aumentan el flete en devoluciones.`;
        }

        results[country] = {
            country,
            carriers: carriersAnalysis.sort((a, b) => b.diffPercent - a.diffPercent),
            hasIncrease,
            avgDiffPercent: Math.round(weightedDiff),
            recommendedBuffer: parseFloat(recommendedBuffer.toFixed(2)),
            summary,
        };
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
