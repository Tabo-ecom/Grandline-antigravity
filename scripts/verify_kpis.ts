
import { DropiOrder, KPIResults } from '../lib/calculations/kpis';

// === COPIED UTILS ===
const isEntregado = (status: string) => ['ENTREGADO', 'RECIBIDO'].includes(status?.toUpperCase());
const isCancelado = (status: string) => ['CANCELADO', 'ANULADO'].includes(status?.toUpperCase());
const isDevolucion = (status: string) => ['DEVOLUCION', 'DEVUELTO'].includes(status?.toUpperCase());
const isTransit = (status: string) => ['TRANSITO', 'EN RUTA', 'EN CAMINO', 'DESPACHADO', 'EN REPARTO', 'NOVEDAD'].includes(status?.toUpperCase());

// === OLD IMPLEMENTATION ===
function calculateKPIsOld(
    orders: DropiOrder[],
    mappedAds: number = 0,
    totalRevenueGlobal?: number
): KPIResults {
    const delivered = orders.filter(o => isEntregado(o.ESTATUS));
    const canceled = orders.filter(o => isCancelado(o.ESTATUS));
    const returns = orders.filter(o => isDevolucion(o.ESTATUS));
    const transit = orders.filter(o => isTransit(o.ESTATUS));
    const nonCanceled = orders.filter(o => !isCancelado(o.ESTATUS));
    const dispatched = orders.filter(o => !isCancelado(o.ESTATUS) && !isTransit(o.ESTATUS));

    const n_ord = new Set(orders.map(o => o.ID).filter(Boolean)).size;
    const n_ent = new Set(delivered.map(o => o.ID).filter(Boolean)).size;
    const n_can = new Set(canceled.map(o => o.ID).filter(Boolean)).size;
    const n_dev = new Set(returns.map(o => o.ID).filter(Boolean)).size;
    const n_tra = new Set(transit.map(o => o.ID).filter(Boolean)).size;
    const n_nc = new Set(nonCanceled.map(o => o.ID).filter(Boolean)).size;
    const n_dispatched = n_ent + n_dev;

    const tasa_ent = n_nc > 0 ? (n_ent / n_nc) * 100 : 0;
    const tasa_can = n_ord > 0 ? (n_can / n_ord) * 100 : 0;
    const tasa_dev = n_dispatched > 0 ? (n_dev / n_dispatched) * 100 : 0;

    const seenFact = new Set<string>();
    const fact_neto = nonCanceled.reduce((sum, o) => {
        if (o.ID && !seenFact.has(o.ID)) {
            seenFact.add(o.ID);
            return sum + (o["TOTAL DE LA ORDEN"] || 0);
        }
        return sum;
    }, 0);

    const seenIng = new Set<string>();
    const ing_real = delivered.reduce((sum, o) => {
        if (o.ID && !seenIng.has(o.ID)) {
            seenIng.add(o.ID);
            return sum + (o["TOTAL DE LA ORDEN"] || 0);
        }
        return sum;
    }, 0);

    const cpr = delivered.reduce(
        (sum, o) => sum + (o["PRECIO PROVEEDOR X CANTIDAD"] || o["PRECIO PROVEEDOR"] || 0),
        0
    );

    const seenFlEnt = new Set<string>();
    const fl_ent = delivered.reduce((sum, o) => {
        if (o.ID && !seenFlEnt.has(o.ID)) {
            seenFlEnt.add(o.ID);
            return sum + (o["PRECIO FLETE"] || 0);
        }
        return sum;
    }, 0);

    const seenFlDev = new Set<string>();
    const fl_dev = returns.reduce((sum, o) => {
        if (o.ID && !seenFlDev.has(o.ID)) {
            seenFlDev.add(o.ID);
            return sum + (o["COSTO DEVOLUCION FLETE"] || o["PRECIO FLETE"] || 0);
        }
        return sum;
    }, 0);

    const seenFlTra = new Set<string>();
    const fl_tra = transit.reduce((sum, o) => {
        if (o.ID && !seenFlTra.has(o.ID)) {
            seenFlTra.add(o.ID);
            return sum + (o["PRECIO FLETE"] || 0);
        }
        return sum;
    }, 0);

    const g_ads = mappedAds;
    const u_real = ing_real - cpr - g_ads - fl_ent - fl_dev - fl_tra;

    const roas_bruto = g_ads > 0 ? fact_neto / g_ads : 0;
    const roas_real = g_ads > 0 ? ing_real / g_ads : 0;
    const cpa = n_ord > 0 ? g_ads / n_ord : 0;
    const cpe = n_ent > 0 ? g_ads / n_ent : 0;
    const mer = g_ads > 0 ? (totalRevenueGlobal || fact_neto) / g_ads : 0;
    const perc_ads_revenue = fact_neto > 0 ? (g_ads / fact_neto) * 100 : 0;

    const costo_dev_orden = n_ord > 0 ? fl_dev / n_ord : 0;
    const utilidad_por_entrega = n_ent > 0 ? u_real / n_ent : 0;

    return {
        n_ord, n_ent, n_can, n_dev, n_tra, n_nc,
        tasa_ent, tasa_can, tasa_dev,
        fact_neto, ing_real, cpr,
        fl_ent, fl_dev, fl_tra,
        g_ads, u_real,
        roas_bruto, roas_real, cpa, cpe, mer, perc_ads_revenue,
        costo_dev_orden, utilidad_por_entrega, roas: roas_bruto,
        fact_despachada: fact_neto
    };
}

// === NEW IMPLEMENTATION ===
function calculateKPIsNew(
    orders: DropiOrder[],
    mappedAds: number = 0,
    totalRevenueGlobal?: number
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
    let cpr = 0; // Costo Producto Real (Entregados) - Can have duplicates if multiple lines per order?
    // Original logic: delivered.reduce(sum + cost). `delivered` is just filtered array.
    // If input `orders` has multiple lines with same ID, `delivered` has multiple lines.
    // Original `cpr` sums ALL lines.

    // Unique Order Financials (Facturacion, Fletes)
    // Original uses sets to verify uniqueness.
    const seenFact = new Set<string>();
    const seenIng = new Set<string>();
    const seenFlEnt = new Set<string>();
    const seenFlDev = new Set<string>();
    const seenFlTra = new Set<string>();

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

        // Delivered (Ingreso Real, Costo Producto, Flete Entrega)
        if (isEnt) {
            if (id && !seenIng.has(id)) {
                seenIng.add(id);
                ing_real += (o["TOTAL DE LA ORDEN"] || 0);
            }

            // Costo Producto is SUM of all lines (no unique check in original)
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

    // derived counts
    const n_ord = uniqueIds.all.size;
    const n_ent = uniqueIds.ent.size;
    const n_can = uniqueIds.can.size;
    const n_dev = uniqueIds.dev.size;
    const n_tra = uniqueIds.tra.size;
    const n_nc = uniqueIds.nc.size;
    const n_dispatched = n_ent + n_dev;

    // Rates
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
    const costo_dev_orden = n_ord > 0 ? fl_dev / n_ord : 0;
    const utilidad_por_entrega = n_ent > 0 ? u_real / n_ent : 0;

    return {
        n_ord, n_ent, n_can, n_dev, n_tra, n_nc,
        tasa_ent, tasa_can, tasa_dev,
        fact_neto, ing_real, cpr,
        fl_ent, fl_dev, fl_tra,
        g_ads, u_real,
        roas_bruto, roas_real, cpa, cpe, mer, perc_ads_revenue,
        costo_dev_orden, utilidad_por_entrega, roas: roas_bruto,
        fact_despachada: fact_neto
    };
}

// === GENERATE SAMPLE DATA ===
const statuses = ['ENTREGADO', 'CANCELADO', 'DEVOLUCION', 'TRANSITO', 'ENTREGADO', 'CANCELADO'];
const sampleOrders: DropiOrder[] = [];
for (let i = 0; i < 10000; i++) {
    const id = `ORD-${Math.floor(i / 2)}`; // Duplicate IDs every 2 lines
    sampleOrders.push({
        ID: id,
        ESTATUS: statuses[i % statuses.length],
        "TOTAL DE LA ORDEN": 100 + (i % 50),
        "PRECIO PROVEEDOR": 30 + (i % 10),
        "PRECIO FLETE": 10,
        "COSTO DEVOLUCION FLETE": 15
    });
}

// === RUN & COMPARE ===
console.time('Old');
const resOld = calculateKPIsOld(sampleOrders, 5000);
console.timeEnd('Old');

console.time('New');
const resNew = calculateKPIsNew(sampleOrders, 5000);
console.timeEnd('New');

const strOld = JSON.stringify(resOld);
const strNew = JSON.stringify(resNew);

if (strOld === strNew) {
    console.log("SUCCESS: Results match!");
} else {
    console.error("FAILURE: Results differ!");
    console.log("Old:", resOld);
    console.log("New:", resNew);
}
